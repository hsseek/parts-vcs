"""
Onshape API client using API key authentication.
Credentials are loaded from environment variables:
  ONSHAPE_ACCESS_KEY
  ONSHAPE_SECRET_KEY
  ONSHAPE_BASE_URL  (default: https://cad.onshape.com)
"""

import os
import hmac
import hashlib
import base64
import time
import string
import random
import re
from urllib.parse import urlparse, urlencode
import httpx
from pathlib import Path


BASE_URL = os.getenv("ONSHAPE_BASE_URL", "https://cad.onshape.com")
ACCESS_KEY = os.getenv("ONSHAPE_ACCESS_KEY", "")
SECRET_KEY = os.getenv("ONSHAPE_SECRET_KEY", "")

CALVER_RE = re.compile(r"^\d{2}\.\d{2}(\.\d+)?$")


def _nonce(length=25):
    chars = string.ascii_letters + string.digits
    return "".join(random.choice(chars) for _ in range(length))


def _auth_headers(method: str, path: str, query: str = "", content_type: str = "application/json"):
    nonce = _nonce()
    date = time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())

    # Entire string must be lowercase before hashing (Onshape API key auth spec)
    hmac_str = "\n".join([
        method.lower(),
        nonce.lower(),
        date.lower(),
        content_type.lower(),
        path.lower(),
        query.lower(),
        "",
    ])

    signature = base64.b64encode(
        hmac.new(
            SECRET_KEY.encode("utf-8"),
            hmac_str.encode("utf-8"),
            hashlib.sha256,
        ).digest()
    ).decode("utf-8")

    auth = f"On {ACCESS_KEY}:HmacSHA256:{signature}"

    return {
        "Authorization": auth,
        "Date": date,
        "On-Nonce": nonce,
        "Content-Type": content_type,
        "Accept": "application/json;charset=UTF-8; qs=0.09",
    }


def _get(path: str, params: dict | None = None) -> dict | bytes:
    query = urlencode(params) if params else ""
    url = f"{BASE_URL}{path}"
    if query:
        url += f"?{query}"

    headers = _auth_headers("GET", path, query)

    with httpx.Client(timeout=30) as client:
        r = client.get(url, headers=headers)
        r.raise_for_status()

        content_type = r.headers.get("content-type", "")
        if "image" in content_type or "octet" in content_type:
            return r.content
        return r.json()


# ── Public helpers ──────────────────────────────────────────────────────────

def list_documents(limit: int = 20) -> list[dict]:
    """Return recent documents accessible to the user."""
    try:
        data = _get("/api/v6/documents", {
            "limit": limit,
            "filter": 0,
            "sortColumn": "modifiedAt",
            "sortOrder": "desc",
        })
        return data.get("items", []) if isinstance(data, dict) else []
    except Exception as e:
        print(f"[onshape] list_documents error: {e}")
        return []


def get_document(did: str) -> dict:
    """Return document metadata (name, id, etc.)."""
    try:
        data = _get(f"/api/v6/documents/{did}")
        return data if isinstance(data, dict) else {}
    except Exception as e:
        print(f"[onshape] get_document error {did}: {e}")
        return {}


def list_elements(did: str, wid: str | None = None) -> list[dict] | None:
    """Return all elements in a document, or None on error."""
    path = (
        f"/api/v6/documents/{did}/w/{wid}/elements"
        if wid
        else f"/api/v6/documents/{did}/elements"
    )
    try:
        data = _get(path)
        return data if isinstance(data, list) else []
    except Exception as e:
        print(f"[onshape] list_elements error {did}: {e}")
        return None


def list_parts_in_element(did: str, wid: str, eid: str) -> list[dict]:
    """Return all parts within a Part Studio element."""
    try:
        data = _get(f"/api/v6/parts/d/{did}/w/{wid}/e/{eid}")
        return data if isinstance(data, list) else []
    except Exception as e:
        print(f"[onshape] list_parts_in_element error {did}/{wid}/{eid}: {e}")
        return []


def list_versions(did: str) -> list[dict]:
    """Return all versions for a document."""
    data = _get(f"/api/v6/documents/{did}/versions")
    return data if isinstance(data, list) else []


def list_calver_versions(did: str) -> list[dict]:
    """Return only CalVer-named versions."""
    return [v for v in list_versions(did) if CALVER_RE.match(v.get("name", ""))]


def _parse_thumb_size(size_str) -> int:
    """Parse Onshape thumbnail size field which may be 'WxH' or an int."""
    try:
        parts = str(size_str).lower().split("x")
        return max(int(p) for p in parts)
    except (ValueError, AttributeError):
        return 0


def get_thumbnail_for_version(did: str, vid: str, size: int = 300) -> bytes | None:
    """Fetch thumbnail image bytes for a specific document version."""
    try:
        data = _get(f"/api/v6/thumbnails/d/{did}/v/{vid}")
        sizes = data.get("sizes", [])
        if not sizes:
            return None
        best = min(sizes, key=lambda s: abs(_parse_thumb_size(s.get("size", 0)) - size))
        href = best.get("href", "")
        if not href:
            return None
        parsed = urlparse(href)
        path = parsed.path
        query = parsed.query
        # Thumbnail endpoint returns an image — override Accept header
        headers = _auth_headers("GET", path, query)
        headers["Accept"] = "image/png, image/*, */*"
        with httpx.Client(timeout=30) as client:
            r = client.get(href, headers=headers)
            r.raise_for_status()
            return r.content
    except Exception as e:
        print(f"[onshape] thumbnail error for {did}/{vid}: {e}")
        return None


def get_shaded_view(
    did: str,
    wid: str,
    eid: str,
    element_type: str,  # "partstudio" or "assembly"
    view_matrix: list[float],
    output_height: int = 500,
    output_width: int = 500,
) -> bytes | None:
    """
    Fetch a shaded view image using workspace context (w/ instead of v/).
    Version-based rendering returns blank images for many Part Studios.
    view_matrix: 12-element list (rotation 3x3 + translation 3x1, row-major).
    """
    endpoint_map = {
        "partstudio": "partstudios",
        "assembly": "assemblies",
    }
    ep = endpoint_map.get(element_type, "partstudios")

    path = f"/api/v6/{ep}/d/{did}/w/{wid}/e/{eid}/shadedviews"
    params = {
        "outputHeight": output_height,
        "outputWidth": output_width,
        "pixelSize": 0,
        "viewMatrix": ",".join(str(x) for x in view_matrix),
    }

    try:
        data = _get(path, params)
        if isinstance(data, dict) and "images" in data:
            img_b64 = data["images"][0]
            img = base64.b64decode(img_b64)
            # Reject blank/transparent images — real renders are significantly larger
            if len(img) < 2000:
                return None
            return img
        return None
    except Exception as e:
        print(f"[onshape] shaded view error for {did}/{wid}/{eid}: {e}")
        return None


# Standard view matrices
VIEW_MATRICES = {
    "isometric": [0.7071, -0.7071, 0, 0.4082, 0.4082, -0.8165, 0.5774, 0.5774, 0.5774, 0, 0, 0],
    "front":     [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    "right":     [0, 0, -1, 0, 1, 0, 1, 0, 0, 0, 0, 0],
    "top":       [1, 0, 0, 0, 0, 1, 0, -1, 0, 0, 0, 0],
}

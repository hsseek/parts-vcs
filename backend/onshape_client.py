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
    path_lower = path.lower()
    query_lower = query.lower()

    hmac_str = "\n".join([
        method.lower(),
        nonce,
        date,
        content_type.lower(),
        path_lower,
        query_lower,
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


def list_elements(did: str) -> list[dict]:
    """Return all elements in a document."""
    try:
        data = _get(f"/api/v6/documents/{did}/elements")
        return data if isinstance(data, list) else []
    except Exception as e:
        print(f"[onshape] list_elements error {did}: {e}")
        return []


def list_versions(did: str) -> list[dict]:
    """Return all versions for a document."""
    data = _get(f"/api/v6/documents/{did}/versions")
    return data if isinstance(data, list) else []


def list_calver_versions(did: str) -> list[dict]:
    """Return only CalVer-named versions."""
    return [v for v in list_versions(did) if CALVER_RE.match(v.get("name", ""))]


def get_thumbnail_for_version(did: str, vid: str, size: int = 300) -> bytes | None:
    """Fetch thumbnail image bytes for a specific document version."""
    try:
        data = _get(f"/api/v6/thumbnails/d/{did}/v/{vid}")
        # Find the closest size href
        sizes = data.get("sizes", [])
        if not sizes:
            return None
        # Pick closest to requested size
        best = min(sizes, key=lambda s: abs(s.get("size", 0) - size))
        href = best.get("href", "")
        if not href:
            return None
        # href is a full URL; strip base and re-auth
        parsed = urlparse(href)
        path = parsed.path
        query = parsed.query
        headers = _auth_headers("GET", path, query)
        with httpx.Client(timeout=30) as client:
            r = client.get(href, headers=headers)
            r.raise_for_status()
            return r.content
    except Exception as e:
        print(f"[onshape] thumbnail error for {did}/{vid}: {e}")
        return None


def get_shaded_view(
    did: str,
    vid: str,
    eid: str,
    element_type: str,  # "partstudio" or "assemblies"
    view_matrix: list[float],
    output_height: int = 500,
    output_width: int = 500,
) -> bytes | None:
    """
    Fetch a shaded view image for a specific orientation.
    view_matrix: 12-element list (rotation 3x3 + translation 3x1, row-major).
    Standard views:
      isometric: [0.7071,-0.7071,0, 0.4082,0.4082,-0.8165, 0.5774,0.5774,0.5774, 0,0,0]
      front:     [1,0,0, 0,1,0, 0,0,1, 0,0,0]
      right:     [0,0,-1, 0,1,0, 1,0,0, 0,0,0]
      top:       [1,0,0, 0,0,1, 0,-1,0, 0,0,0]
    """
    endpoint_map = {
        "partstudio": "partstudios",
        "assembly": "assemblies",
    }
    ep = endpoint_map.get(element_type, "partstudios")

    path = f"/api/v6/{ep}/d/{did}/v/{vid}/e/{eid}/shadedviews"
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
            return base64.b64decode(img_b64)
        return None
    except Exception as e:
        print(f"[onshape] shaded view error for {did}/{vid}/{eid}: {e}")
        return None


# Standard view matrices
VIEW_MATRICES = {
    "isometric": [0.7071, -0.7071, 0, 0.4082, 0.4082, -0.8165, 0.5774, 0.5774, 0.5774, 0, 0, 0],
    "front":     [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    "right":     [0, 0, -1, 0, 1, 0, 1, 0, 0, 0, 0, 0],
    "top":       [1, 0, 0, 0, 0, 1, 0, -1, 0, 0, 0, 0],
}

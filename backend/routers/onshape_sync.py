"""
Sync router: pull CalVer versions from Onshape and fetch images.
"""

import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from database import get_db
import onshape_client as oc

router = APIRouter()

IMAGE_DIR = Path("static/images")


def _save_image(data: bytes, prefix: str) -> str:
    """Save image bytes to disk, return relative URL path."""
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{prefix}_{uuid.uuid4().hex[:8]}.png"
    path = IMAGE_DIR / filename
    path.write_bytes(data)
    return f"/images/{filename}"


def fetch_images_for_version(version_db_id: int, did: str, vid: str, eid: str, element_type: str):
    """Background task: fetch all 4 shaded views and thumbnail, save, update DB."""
    images = {}

    # Try shaded views (4 angles)
    for view_name, matrix in oc.VIEW_MATRICES.items():
        img = oc.get_shaded_view(did, vid, eid, element_type, matrix)
        if img:
            images[f"img_{view_name}"] = _save_image(img, f"{version_db_id}_{view_name}")

    # Fallback: thumbnail for isometric if shaded view failed
    if "img_isometric" not in images:
        thumb = oc.get_thumbnail_for_version(did, vid)
        if thumb:
            images["img_isometric"] = _save_image(thumb, f"{version_db_id}_thumb")

    if not images:
        print(f"[sync] No images fetched for version db_id={version_db_id}")
        return

    set_clause = ", ".join(f"{k} = ?" for k in images)
    values = list(images.values()) + [version_db_id]

    with get_db() as conn:
        conn.execute(
            f"UPDATE versions SET {set_clause}, images_fetched = 1 WHERE id = ?",
            values,
        )
    print(f"[sync] Images saved for version db_id={version_db_id}: {list(images.keys())}")


@router.post("/part/{part_id}")
async def sync_part(part_id: int, background_tasks: BackgroundTasks):
    """
    Detect new CalVer versions from Onshape for a part.
    Inserts new version rows; does NOT fetch images yet (that happens on release).
    """
    with get_db() as conn:
        part = conn.execute("SELECT * FROM parts WHERE id = ?", (part_id,)).fetchone()
        if not part:
            raise HTTPException(404, "Part not found")

    did = part["onshape_document_id"]
    calver_versions = oc.list_calver_versions(did)

    if not calver_versions:
        return {"synced": 0, "message": "No CalVer versions found in Onshape document"}

    new_count = 0
    with get_db() as conn:
        existing = {
            r["onshape_version_id"]
            for r in conn.execute(
                "SELECT onshape_version_id FROM versions WHERE part_id = ?", (part_id,)
            ).fetchall()
        }

        for v in calver_versions:
            vid = v["id"]
            vname = v["name"]
            if vid in existing:
                continue
            conn.execute(
                """INSERT INTO versions (part_id, onshape_version_id, version_name)
                   VALUES (?, ?, ?)""",
                (part_id, vid, vname),
            )
            new_count += 1

    return {"synced": new_count, "total_calver": len(calver_versions)}


@router.post("/version/{version_id}/fetch-images")
async def fetch_images(version_id: int, background_tasks: BackgroundTasks):
    """
    Trigger image fetching for a specific version (called automatically on release).
    """
    with get_db() as conn:
        row = conn.execute(
            """SELECT v.*, p.onshape_document_id, p.onshape_element_id, p.onshape_element_type
               FROM versions v JOIN parts p ON p.id = v.part_id
               WHERE v.id = ?""",
            (version_id,),
        ).fetchone()
        if not row:
            raise HTTPException(404, "Version not found")

    background_tasks.add_task(
        fetch_images_for_version,
        version_id,
        row["onshape_document_id"],
        row["onshape_version_id"],
        row["onshape_element_id"],
        row["onshape_element_type"],
    )
    return {"ok": True, "message": "Image fetching started in background"}


@router.get("/discover")
def discover_parts():
    """
    Scan recent Onshape documents and return Part Studio / Assembly elements
    not yet registered in this project. Includes calver_count so the UI can
    indicate whether versions are ready to sync.
    """
    documents = oc.list_documents()

    with get_db() as conn:
        existing = {
            (r["onshape_document_id"], r["onshape_element_id"])
            for r in conn.execute(
                "SELECT onshape_document_id, onshape_element_id FROM parts"
            ).fetchall()
        }

    results = []
    for doc in documents:
        did = doc.get("id", "")
        doc_name = doc.get("name", did)
        try:
            elements = oc.list_elements(did)
            calver = oc.list_calver_versions(did)
        except Exception:
            continue

        calver_count = len(calver)
        for el in elements:
            if el.get("elementType") not in ("PARTSTUDIO", "ASSEMBLY"):
                continue
            eid = el.get("id", "")
            if (did, eid) in existing:
                continue
            results.append({
                "document_id": did,
                "document_name": doc_name,
                "element_id": eid,
                "element_name": el.get("name", eid),
                "element_type": "partstudio" if el.get("elementType") == "PARTSTUDIO" else "assembly",
                "calver_count": calver_count,
            })

    return results


class ImportItem(BaseModel):
    name: str
    description: str = ""
    document_id: str
    element_id: str
    element_type: str


@router.post("/import")
def import_parts(items: list[ImportItem]):
    """Create parts from a list of discovered elements."""
    created = 0
    with get_db() as conn:
        for item in items:
            conn.execute(
                """INSERT INTO parts (name, description, onshape_document_id, onshape_element_id, onshape_element_type)
                   VALUES (?, ?, ?, ?, ?)""",
                (item.name, item.description, item.document_id, item.element_id, item.element_type),
            )
            created += 1
    return {"created": created}


@router.post("/all")
async def sync_all(background_tasks: BackgroundTasks):
    """Sync all parts from Onshape."""
    with get_db() as conn:
        parts = conn.execute("SELECT id FROM parts").fetchall()

    results = []
    for p in parts:
        part_id = p["id"]
        with get_db() as conn:
            part = conn.execute("SELECT * FROM parts WHERE id = ?", (part_id,)).fetchone()

        did = part["onshape_document_id"]
        calver_versions = oc.list_calver_versions(did)
        new_count = 0

        with get_db() as conn:
            existing = {
                r["onshape_version_id"]
                for r in conn.execute(
                    "SELECT onshape_version_id FROM versions WHERE part_id = ?", (part_id,)
                ).fetchall()
            }
            for v in calver_versions:
                if v["id"] in existing:
                    continue
                conn.execute(
                    """INSERT INTO versions (part_id, onshape_version_id, version_name)
                       VALUES (?, ?, ?)""",
                    (part_id, v["id"], v["name"]),
                )
                new_count += 1

        results.append({"part_id": part_id, "new_versions": new_count})

    return {"results": results}

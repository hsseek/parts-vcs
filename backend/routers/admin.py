"""
Admin convenience endpoints combining release + image fetch.
"""
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Form, Depends
from pydantic import BaseModel
from database import get_db
from routers.onshape_sync import fetch_images_for_version, IMAGE_DIR
from auth import require_admin
import onshape_client as oc

VALID_SLOTS = {"isometric"}

_EXT_MAP = {
    "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg",
    "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg",
    "image/bmp": "bmp", "image/tiff": "tif",
}

router = APIRouter(dependencies=[Depends(require_admin)])


@router.get("/status")
def check_status():
    """Check Onshape API connectivity by making a lightweight test call."""
    try:
        oc.list_documents(limit=1)
        return {"onshape": True}
    except Exception as e:
        return {"onshape": False, "error": str(e)}


class ReleaseAction(BaseModel):
    release_notes: str = ""


class UpdateImage(BaseModel):
    label: str | None = None
    caption: str | None = None


class UpdateCaption(BaseModel):
    caption: str


@router.post("/release/{version_id}")
async def admin_release(version_id: int, body: ReleaseAction, background_tasks: BackgroundTasks):
    """
    Mark a version as released AND trigger image fetching.
    This is the primary action the designer takes.
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

        conn.execute(
            """UPDATE versions
               SET is_released = 1, release_notes = ?, released_at = datetime('now')
               WHERE id = ?""",
            (body.release_notes, version_id),
        )

    # Fetch images in background if not already fetched
    if not row["images_fetched"]:
        background_tasks.add_task(
            fetch_images_for_version,
            version_id,
            row["onshape_document_id"],
            row["onshape_version_id"],
            row["onshape_element_id"],
            row["onshape_element_type"],
        )

    return {"ok": True, "images_fetching": not row["images_fetched"]}


@router.post("/unrelease/{version_id}")
def admin_unrelease(version_id: int):
    with get_db() as conn:
        conn.execute(
            "UPDATE versions SET is_released = 0, released_at = NULL WHERE id = ?",
            (version_id,),
        )
    return {"ok": True}


@router.post("/version/{version_id}/refetch-images")
async def refetch_images(version_id: int, background_tasks: BackgroundTasks):
    """Reset image state for a version and re-trigger the background fetch."""
    with get_db() as conn:
        row = conn.execute(
            """SELECT v.*, p.onshape_document_id, p.onshape_element_id, p.onshape_element_type
               FROM versions v JOIN parts p ON p.id = v.part_id
               WHERE v.id = ?""",
            (version_id,),
        ).fetchone()
        if not row:
            raise HTTPException(404, "Version not found")

        # Delete stale image files from disk
        for col in ("img_isometric",):
            path_str = row[col]
            if path_str:
                filename = path_str.removeprefix("/images/")
                stale = IMAGE_DIR / filename
                stale.unlink(missing_ok=True)

        conn.execute(
            "UPDATE versions SET images_fetched = 0, img_isometric = NULL WHERE id = ?",
            (version_id,),
        )

    background_tasks.add_task(
        fetch_images_for_version,
        version_id,
        row["onshape_document_id"],
        row["onshape_version_id"],
        row["onshape_element_id"],
        row["onshape_element_type"],
    )
    return {"ok": True}


@router.patch("/version/{version_id}/notes")
def update_notes(version_id: int, body: ReleaseAction):
    with get_db() as conn:
        conn.execute(
            "UPDATE versions SET release_notes = ? WHERE id = ?",
            (body.release_notes, version_id),
        )
    return {"ok": True}


@router.post("/version/{version_id}/upload-image")
async def upload_image(
    version_id: int,
    file: UploadFile = File(...),
    slot: str = Form(None),
    label: str = Form(None),
):
    """
    Upload an image for a version.
    - slot=isometric|front|right|top  → replaces that standard slot
    - label=<text> (or neither)       → adds a custom image to version_images
    """
    with get_db() as conn:
        row = conn.execute("SELECT id FROM versions WHERE id = ?", (version_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Version not found")

    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")

    ct = (file.content_type or "").split(";")[0].strip()
    ext = _EXT_MAP.get(ct)
    if not ext and file.filename:
        ext = Path(file.filename).suffix.lstrip(".").lower()
    ext = ext or "png"

    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    prefix = f"v{version_id}_{'slot_' + slot if slot and slot in VALID_SLOTS else 'custom'}"
    filename = f"{prefix}_{uuid.uuid4().hex[:8]}.{ext}"
    (IMAGE_DIR / filename).write_bytes(data)
    url = f"/images/{filename}"

    if slot and slot in VALID_SLOTS:
        with get_db() as conn:
            old = conn.execute(f"SELECT img_{slot} FROM versions WHERE id = ?", (version_id,)).fetchone()
            if old and old[0]:
                (IMAGE_DIR / old[0].removeprefix("/images/")).unlink(missing_ok=True)
            conn.execute(
                f"UPDATE versions SET img_{slot} = ?, images_fetched = 1 WHERE id = ?",
                (url, version_id),
            )
    else:
        with get_db() as conn:
            actual_label = (label or "").strip()
            if not actual_label:
                count = conn.execute(
                    "SELECT COUNT(*) FROM version_images WHERE version_id = ?", (version_id,)
                ).fetchone()[0]
                actual_label = f"Image {count + 1}"
            conn.execute(
                "INSERT INTO version_images (version_id, label, path) VALUES (?, ?, ?)",
                (version_id, actual_label, url),
            )

    return {"ok": True, "path": url}


@router.delete("/version/{version_id}/slot/{slot}")
def delete_slot(version_id: int, slot: str):
    if slot not in VALID_SLOTS:
        raise HTTPException(400, f"Invalid slot. Must be one of: {', '.join(sorted(VALID_SLOTS))}")
    with get_db() as conn:
        row = conn.execute(f"SELECT img_{slot} FROM versions WHERE id = ?", (version_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Version not found")
        if row[0]:
            (IMAGE_DIR / row[0].removeprefix("/images/")).unlink(missing_ok=True)
        conn.execute(f"UPDATE versions SET img_{slot} = NULL WHERE id = ?", (version_id,))
    return {"ok": True}


@router.patch("/version/{version_id}/slot/{slot}/caption")
def update_slot_caption(version_id: int, slot: str, body: UpdateCaption):
    if slot not in VALID_SLOTS:
        raise HTTPException(400, f"Invalid slot. Must be one of: {', '.join(sorted(VALID_SLOTS))}")
    with get_db() as conn:
        if not conn.execute("SELECT id FROM versions WHERE id = ?", (version_id,)).fetchone():
            raise HTTPException(404, "Version not found")
        conn.execute(f"UPDATE versions SET img_{slot}_caption = ? WHERE id = ?", (body.caption, version_id))
    return {"ok": True}


@router.patch("/image/{image_id}")
def update_custom_image(image_id: int, body: UpdateImage):
    if body.label is None and body.caption is None:
        raise HTTPException(400, "Nothing to update")
    with get_db() as conn:
        if not conn.execute("SELECT id FROM version_images WHERE id = ?", (image_id,)).fetchone():
            raise HTTPException(404, "Image not found")
        if body.label is not None:
            label = body.label.strip()
            if not label:
                raise HTTPException(400, "Label cannot be empty")
            conn.execute("UPDATE version_images SET label = ? WHERE id = ?", (label, image_id))
        if body.caption is not None:
            conn.execute("UPDATE version_images SET caption = ? WHERE id = ?", (body.caption, image_id))
    return {"ok": True}


@router.delete("/image/{image_id}")
def delete_custom_image(image_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM version_images WHERE id = ?", (image_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Image not found")
        if row["path"]:
            (IMAGE_DIR / row["path"].removeprefix("/images/")).unlink(missing_ok=True)
        conn.execute("DELETE FROM version_images WHERE id = ?", (image_id,))
    return {"ok": True}

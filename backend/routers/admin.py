"""
Admin convenience endpoints combining release + image fetch.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from database import get_db
from routers.onshape_sync import fetch_images_for_version

router = APIRouter()


class ReleaseAction(BaseModel):
    release_notes: str = ""


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


@router.patch("/version/{version_id}/notes")
def update_notes(version_id: int, body: ReleaseAction):
    with get_db() as conn:
        conn.execute(
            "UPDATE versions SET release_notes = ? WHERE id = ?",
            (body.release_notes, version_id),
        )
    return {"ok": True}

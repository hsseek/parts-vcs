from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_db

router = APIRouter()


class ReleaseBody(BaseModel):
    release_notes: str = ""


@router.get("/part/{part_id}")
def list_versions_for_part(part_id: int, released_only: bool = False):
    with get_db() as conn:
        part = conn.execute("SELECT * FROM parts WHERE id = ?", (part_id,)).fetchone()
        if not part:
            raise HTTPException(404, "Part not found")

        query = "SELECT * FROM versions WHERE part_id = ?"
        args = [part_id]
        if released_only:
            query += " AND is_released = 1"
        query += " ORDER BY released_at DESC NULLS LAST, created_at DESC"

        rows = conn.execute(query, args).fetchall()
        versions = [dict(r) for r in rows]

        if versions:
            placeholders = ",".join("?" * len(versions))
            ids = [v["id"] for v in versions]
            img_rows = conn.execute(
                f"SELECT * FROM version_images WHERE version_id IN ({placeholders}) ORDER BY created_at",
                ids,
            ).fetchall()
            imgs_by_version: dict[int, list] = {}
            for img in img_rows:
                imgs_by_version.setdefault(img["version_id"], []).append(dict(img))
            for v in versions:
                v["custom_images"] = imgs_by_version.get(v["id"], [])
        else:
            for v in versions:
                v["custom_images"] = []

        return versions


@router.post("/{version_id}/release")
def mark_released(version_id: int, body: ReleaseBody):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM versions WHERE id = ?", (version_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Version not found")
        conn.execute(
            """UPDATE versions
               SET is_released = 1, release_notes = ?, released_at = datetime('now')
               WHERE id = ?""",
            (body.release_notes, version_id),
        )
        return {"ok": True}


@router.post("/{version_id}/unrelease")
def unmark_released(version_id: int):
    with get_db() as conn:
        conn.execute(
            "UPDATE versions SET is_released = 0, released_at = NULL WHERE id = ?",
            (version_id,),
        )
        return {"ok": True}


@router.get("/{version_id}")
def get_version(version_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM versions WHERE id = ?", (version_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Version not found")
        return dict(row)

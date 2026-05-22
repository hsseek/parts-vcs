from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_db

router = APIRouter()


class PartCreate(BaseModel):
    name: str
    description: str = ""
    onshape_document_id: str
    onshape_element_id: str
    onshape_element_type: str = "partstudio"  # or "assembly"


class PartUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


@router.get("")
def list_parts():
    with get_db() as conn:
        rows = conn.execute("""
            SELECT p.*,
                   COUNT(v.id) FILTER (WHERE v.is_released = 1) AS released_count,
                   (SELECT version_name FROM versions
                    WHERE part_id = p.id AND is_released = 1
                    ORDER BY released_at DESC LIMIT 1) AS latest_version,
                   (SELECT img_isometric FROM versions
                    WHERE part_id = p.id AND is_released = 1
                    ORDER BY released_at DESC LIMIT 1) AS latest_thumbnail
            FROM parts p
            LEFT JOIN versions v ON v.part_id = p.id
            GROUP BY p.id
            ORDER BY p.name
        """).fetchall()
        return [dict(r) for r in rows]


@router.post("", status_code=201)
def create_part(body: PartCreate):
    with get_db() as conn:
        cur = conn.execute(
            """INSERT INTO parts (name, description, onshape_document_id, onshape_element_id, onshape_element_type)
               VALUES (?, ?, ?, ?, ?)""",
            (body.name, body.description, body.onshape_document_id,
             body.onshape_element_id, body.onshape_element_type),
        )
        return {"id": cur.lastrowid}


@router.get("/{part_id}")
def get_part(part_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM parts WHERE id = ?", (part_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Part not found")
        return dict(row)


@router.patch("/{part_id}")
def update_part(part_id: int, body: PartUpdate):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM parts WHERE id = ?", (part_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Part not found")
        if body.name is not None:
            conn.execute("UPDATE parts SET name = ? WHERE id = ?", (body.name, part_id))
        if body.description is not None:
            conn.execute("UPDATE parts SET description = ? WHERE id = ?", (body.description, part_id))
        return {"ok": True}


@router.delete("/{part_id}", status_code=204)
def delete_part(part_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM parts WHERE id = ?", (part_id,))

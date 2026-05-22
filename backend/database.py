import sqlite3
from pathlib import Path
from contextlib import contextmanager

DB_PATH = Path("partsvcs.db")


def get_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS parts (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT NOT NULL,
                description TEXT,
                onshape_document_id  TEXT NOT NULL,
                onshape_element_id   TEXT NOT NULL,
                onshape_element_type TEXT NOT NULL DEFAULT 'partstudio',
                created_at  TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS version_images (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                version_id INTEGER NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
                label      TEXT NOT NULL,
                path       TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS versions (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                part_id             INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
                onshape_version_id  TEXT NOT NULL,
                version_name        TEXT NOT NULL,
                is_released         INTEGER NOT NULL DEFAULT 0,
                release_notes       TEXT,
                img_isometric       TEXT,
                img_front           TEXT,
                img_right           TEXT,
                img_top             TEXT,
                images_fetched      INTEGER NOT NULL DEFAULT 0,
                created_at          TEXT DEFAULT (datetime('now')),
                released_at         TEXT,
                UNIQUE(part_id, onshape_version_id)
            );
        """)

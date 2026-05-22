# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development commands

```bash
# Backend (from backend/)
python3 -m uvicorn main:app --reload --port 8000

# Frontend (from frontend/)
npm run dev                  # dev server on :5173
npm run build                # production build into frontend/dist/

# Both together (from project root)
./dev.sh                     # requires backend/.env to exist

# Production (from project root)
./start.sh                   # builds frontend, serves everything from :8000

# Lint (frontend only, no backend linter configured)
cd frontend && npx eslint src/
```

Use `python3 -m uvicorn` — `uvicorn` may not be on PATH. Same for `pip3` instead of `pip`.

## Environment setup

`backend/.env` is required and gitignored. Copy `.env.example` and fill in:
```
ONSHAPE_ACCESS_KEY=...
ONSHAPE_SECRET_KEY=...
ONSHAPE_BASE_URL=https://cad.onshape.com
```
Get keys from Onshape → Account Settings → API Keys.

## Architecture

### Request flow

```
Browser → React (Vite :5173 dev / :8000 prod)
             ↓ fetch via frontend/src/api/client.js
        FastAPI (:8000)
             ↓
        SQLite (backend/partsvcs.db)
        Onshape API (on-demand via onshape_client.py)
        Local images (backend/static/images/, served at /images/)
```

### Backend structure

All database access goes through the `get_db()` context manager in `database.py` — it commits on exit and rolls back on exception. The schema is two tables: `parts` and `versions`.

Routers are mounted at:
- `/api/parts` — CRUD for parts (name, description, Onshape IDs)
- `/api/versions` — version queries per part
- `/api/admin` — release/unrelease a version; triggers image fetching as a background task on release
- `/api/sync` — Onshape sync: detect CalVer versions, discover/import documents, fetch images

**Onshape authentication** (`onshape_client.py`) uses custom HMAC-SHA256 signing — not OAuth. Every request builds an `Authorization: On <key>:HmacSHA256:<sig>` header from the method, path, nonce, and date. The `_get()` helper handles this; all Onshape calls go through it.

### Version lifecycle

1. Part is registered with Onshape document/element IDs
2. `POST /api/sync/part/{id}` detects versions whose names match `^\d{2}\.\d{2}(\.\d+)?$` (CalVer like `26.05.0`) and inserts them as unreleased
3. Admin clicks "Mark Released" → `POST /api/admin/release/{version_id}` marks released and queues a background task to fetch 4 shaded view images (isometric, front, right, top) from Onshape
4. Images land in `backend/static/images/` and paths are written to the `versions` row (`images_fetched = 1`)

### Import from Onshape

`GET /api/sync/discover` scans the 20 most recently modified documents in the user's Onshape account, lists their Part Studio and Assembly elements, and returns any not already in the DB. `POST /api/sync/import` bulk-creates parts from selected elements. This is the primary way to populate the project from an existing Onshape workspace.

### Frontend structure

All API calls are centralised in `frontend/src/api/client.js` — add new calls there, not inline in components. The app has two user contexts sharing the same React app: **Field** (read-only, `/` and `/part/:id`) and **Admin** (`/admin` and `/admin/part/:id`). No authentication — admin routes are open.

In production (`./start.sh`), the frontend is built into `frontend/dist/` and FastAPI serves it as a static fallback for all non-`/api` and non-`/images` routes.

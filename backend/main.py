from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from database import init_db, migrate_db
from routers import parts, versions, admin, onshape_sync, auth_router, request_access

app = FastAPI(title="PartVCS", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Path("static/images").mkdir(parents=True, exist_ok=True)

@app.on_event("startup")
async def startup():
    init_db()
    migrate_db()

app.include_router(auth_router.router, prefix="/api/auth", tags=["auth"])
app.include_router(parts.router, prefix="/api/parts", tags=["parts"])
app.include_router(versions.router, prefix="/api/versions", tags=["versions"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(onshape_sync.router, prefix="/api/sync", tags=["sync"])
app.include_router(request_access.router, prefix="/api", tags=["access"])

app.mount("/images", StaticFiles(directory="static/images"), name="images")

# Serve React frontend for all non-API routes
frontend_dist = Path("../frontend/dist")
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        index = frontend_dist / "index.html"
        return FileResponse(str(index))

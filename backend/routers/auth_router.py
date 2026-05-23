from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import auth

router = APIRouter()


class LoginRequest(BaseModel):
    passphrase: str


@router.post("/login")
def login(body: LoginRequest):
    if not auth.ADMIN_PASSPHRASE:
        raise HTTPException(500, "ADMIN_PASSPHRASE not configured")
    if not auth._SESSION_SECRET:
        raise HTTPException(500, "ADMIN_SESSION_SECRET not configured")
    if body.passphrase != auth.ADMIN_PASSPHRASE:
        raise HTTPException(401, "Incorrect passphrase")
    return {"token": auth.create_token()}


@router.get("/check")
def check(_=Depends(auth.require_admin)):
    return {"ok": True}

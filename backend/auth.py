"""
Stateless HMAC-signed admin session tokens.
Token format (base64url): "{unix_ts}:{hmac_sha256(ts, ADMIN_SESSION_SECRET)}"
Tokens expire after TOKEN_TTL_DAYS days.
Rotate ADMIN_SESSION_SECRET to invalidate all existing tokens.
"""
import os
import hmac
import hashlib
import time
import base64
from fastapi import HTTPException, Header
from typing import Optional

ADMIN_PASSPHRASE = os.getenv("ADMIN_PASSPHRASE", "")
_SESSION_SECRET = os.getenv("ADMIN_SESSION_SECRET", "")
TOKEN_TTL_DAYS = 30


def _sig(ts: str) -> str:
    return hmac.new(_SESSION_SECRET.encode(), ts.encode(), hashlib.sha256).hexdigest()


def create_token() -> str:
    ts = str(int(time.time()))
    raw = f"{ts}:{_sig(ts)}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def verify_token(token: str) -> bool:
    if not _SESSION_SECRET:
        return False
    try:
        raw = base64.urlsafe_b64decode(token.encode()).decode()
        ts, sig = raw.rsplit(":", 1)
        if not hmac.compare_digest(sig, _sig(ts)):
            return False
        age_days = (time.time() - int(ts)) / 86400
        return age_days <= TOKEN_TTL_DAYS
    except Exception:
        return False


async def require_admin(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    if not verify_token(authorization.removeprefix("Bearer ")):
        raise HTTPException(401, "Invalid or expired token")

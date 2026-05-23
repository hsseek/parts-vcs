"""
Public endpoint for field users to request Onshape document access.
Sends an email notification to ADMIN_EMAIL via SMTP.
"""
import os
import smtplib
from email.message import EmailMessage
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class AccessRequest(BaseModel):
    onshape_account: str
    onshape_url: str
    part_name: str


@router.post("/request-access")
def request_access(body: AccessRequest):
    admin_email = os.getenv("ADMIN_EMAIL", "")
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")

    if not admin_email or not smtp_host or not smtp_user:
        raise HTTPException(503, "Access request email is not configured on this server.")

    msg = EmailMessage()
    msg["Subject"] = f"[PartVCS] Access request — {body.part_name}"
    msg["From"] = f"Onshape Permission Request <{smtp_user}>"
    msg["To"] = admin_email
    msg.set_content(
        f"A user has requested Onshape access.\n\n"
        f"Onshape account: {body.onshape_account}\n"
        f"Part: {body.part_name}\n"
        f"Document URL: {body.onshape_url}\n"
    )

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as smtp:
            smtp.starttls()
            smtp.login(smtp_user, smtp_password)
            smtp.send_message(msg)
    except Exception as e:
        raise HTTPException(500, f"Failed to send email: {e}")

    return {"ok": True}

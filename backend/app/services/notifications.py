"""Outbound notifications for new contact-form submissions.

Two channels, both optional:

1. **SMTP email** — sends a plain-text email to `NOTIFY_EMAIL_TO`. Requires
   `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.
2. **Webhook** — POSTs a JSON payload to `NOTIFY_WEBHOOK_URL`. Works directly
   with Slack incoming webhooks, Discord (with `?wait=true` style), and any
   generic JSON sink.

Both channels are fire-and-forget: failures log a warning, never propagate.
"""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

import httpx

from app.config import get_settings

log = logging.getLogger("vasudevan.notifications")


def _format_text(name: str, email: str, subject: str | None, message: str, ip: str | None) -> str:
    return (
        f"New contact message on vasudevan.ai\n\n"
        f"From   : {name} <{email}>\n"
        f"Subject: {subject or '(none)'}\n"
        f"IP     : {ip or '-'}\n\n"
        f"{message}\n"
    )


def _send_smtp(name: str, email: str, subject: str | None, message: str, ip: str | None) -> None:
    s = get_settings()
    if not (s.smtp_host and s.smtp_user and s.smtp_password and s.smtp_from and s.notify_email_to):
        return
    msg = EmailMessage()
    msg["Subject"] = f"[vasudevan.ai] {subject or 'New contact'} — {name}"
    msg["From"] = s.smtp_from
    msg["To"] = s.notify_email_to
    msg["Reply-To"] = email
    msg.set_content(_format_text(name, email, subject, message, ip))
    try:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)
        log.info("contact notification emailed to %s", s.notify_email_to)
    except Exception as ex:
        log.warning("smtp send failed: %s: %s", type(ex).__name__, ex)


def _send_webhook(name: str, email: str, subject: str | None, message: str, ip: str | None) -> None:
    url = get_settings().notify_webhook_url
    if not url:
        return
    text = _format_text(name, email, subject, message, ip)
    # Slack/Discord both accept a top-level "text" field — generic sinks
    # receive both `text` and structured fields, so they can use whichever.
    payload = {
        "text": text,
        "name": name,
        "email": email,
        "subject": subject,
        "message": message,
        "ip": ip,
    }
    try:
        with httpx.Client(timeout=10) as http:
            r = http.post(url, json=payload)
            if r.status_code >= 400:
                log.warning("webhook POST returned %s: %s", r.status_code, r.text[:200])
            else:
                log.info("contact notification webhook → %s", url)
    except Exception as ex:
        log.warning("webhook send failed: %s: %s", type(ex).__name__, ex)


def forward_contact(
    name: str,
    email: str,
    subject: str | None,
    message: str,
    ip: str | None = None,
) -> None:
    """Synchronous entry-point — call from a BackgroundTasks queue."""
    _send_smtp(name, email, subject, message, ip)
    _send_webhook(name, email, subject, message, ip)

"""GDPR Article 17 purge service.

Anonymizes a user's personal data and removes per-user authentication artefacts
without touching tenant-owned business data (invoices, suppliers, audit log
content), which other tenant members may still need.

The "right to be forgotten" is satisfied by:
  * irreversibly clearing PII on the user row (email, name, locale, password,
    TOTP secret, backup codes, notification prefs)
  * deleting all sessions and API keys owned by the user
  * deleting notifications targeted at the user
  * leaving an audit_log entry that records WHEN the deletion ran but does
    not retain any of the user's identifying fields.
"""
from __future__ import annotations

import secrets
from datetime import UTC, datetime

from raijin_shared.models.audit import AuditLog
from raijin_shared.models.notification import Notification
from raijin_shared.models.sprint_6_10 import (
    ApiKey,
    GdprDeletionRequest,
    UserSession,
)
from raijin_shared.models.user import User
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.logging import get_logger

logger = get_logger("raijin.gdpr")


class GdprPurgeError(RuntimeError):
    pass


def _anonymize_user(user: User) -> None:
    placeholder = f"deleted-{user.id}@deleted.local"
    user.email = placeholder
    user.full_name = None
    user.locale = "fr"
    user.notification_preferences = None
    user.totp_enabled = False
    user.totp_secret_encrypted = None
    user.backup_codes = None
    user.is_active = False
    # Random unguessable hash means no one can authenticate as this account again.
    user.password_hash = f"!gdpr-anon-{secrets.token_urlsafe(32)}"


def purge_user_data(session: Session, request: GdprDeletionRequest) -> dict[str, int]:
    """Run the purge for a single deletion request. Caller commits the transaction."""

    user = session.get(User, request.user_id)
    if user is None:
        request.status = "completed"
        return {"sessions": 0, "api_keys": 0, "notifications": 0, "user_anonymized": 0}

    sessions_deleted = session.execute(
        delete(UserSession).where(UserSession.user_id == user.id)
    ).rowcount or 0
    api_keys_deleted = session.execute(
        delete(ApiKey).where(ApiKey.user_id == user.id)
    ).rowcount or 0
    notifications_deleted = session.execute(
        delete(Notification).where(Notification.user_id == user.id)
    ).rowcount or 0

    _anonymize_user(user)

    session.add(
        AuditLog(
            tenant_id=request.tenant_id,
            user_id=None,
            action="gdpr.purge.completed",
            entity_type="users",
            entity_id=user.id,
            before_state=None,
            after_state={
                "request_id": str(request.id),
                "sessions_deleted": sessions_deleted,
                "api_keys_deleted": api_keys_deleted,
                "notifications_deleted": notifications_deleted,
            },
        )
    )

    request.status = "completed"

    counts = {
        "sessions": sessions_deleted,
        "api_keys": api_keys_deleted,
        "notifications": notifications_deleted,
        "user_anonymized": 1,
    }
    logger.info(
        "gdpr.purge.user",
        request_id=str(request.id),
        user_id=str(user.id),
        tenant_id=str(request.tenant_id),
        **counts,
    )
    return counts


def find_due_requests(session: Session, *, now: datetime | None = None) -> list[GdprDeletionRequest]:
    cutoff = now or datetime.now(UTC)
    return list(
        session.scalars(
            select(GdprDeletionRequest).where(
                GdprDeletionRequest.status == "pending",
                GdprDeletionRequest.scheduled_for <= cutoff,
            )
        )
    )


def process_due_requests(session: Session) -> dict[str, int]:
    requests = find_due_requests(session)
    totals = {"processed": 0, "sessions": 0, "api_keys": 0, "notifications": 0}
    for request in requests:
        try:
            counts = purge_user_data(session, request)
        except Exception as exc:  # noqa: BLE001
            session.rollback()
            request.status = "failed"
            session.add(request)
            session.commit()
            logger.error(
                "gdpr.purge.failed",
                request_id=str(request.id),
                user_id=str(request.user_id),
                error=str(exc),
            )
            continue
        totals["processed"] += 1
        totals["sessions"] += counts["sessions"]
        totals["api_keys"] += counts["api_keys"]
        totals["notifications"] += counts["notifications"]
    return totals



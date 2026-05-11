from __future__ import annotations

from app.celery_app import celery_app
from app.core.database import session_scope
from app.core.logging import get_logger
from app.services.gdpr import process_due_requests

logger = get_logger("raijin.tasks.gdpr")


@celery_app.task(name="gdpr.process_due_deletions", acks_late=True)
def process_due_deletions() -> dict[str, int]:
    with session_scope() as session:
        result = process_due_requests(session)
    logger.info("task.gdpr.process_due_deletions", **result)
    return result

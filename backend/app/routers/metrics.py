from datetime import UTC, date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from raijin_shared.models.correction import InvoiceCorrection
from raijin_shared.models.invoice import Invoice, InvoiceStatus
from sqlalchemy import cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import Date

from app.api.deps import CurrentUser, DbSession
from app.core.database import get_db
from app.core.observability import render_prometheus_metrics

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/prometheus", include_in_schema=False)
async def prometheus_metrics(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    return Response(
        content=await render_prometheus_metrics(db),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


@router.get("")
async def metrics(db: DbSession, user: CurrentUser) -> dict[str, object]:
    """Snapshot métriques pour le tenant courant (MVP, pas Prometheus)."""
    counters = {s.value: 0 for s in InvoiceStatus}
    result = await db.execute(
        select(Invoice.status, func.count(Invoice.id))
        .where(Invoice.tenant_id == user.tenant_id)
        .group_by(Invoice.status)
    )
    total = 0
    for status_value, count in result.all():
        key = status_value.value if hasattr(status_value, "value") else str(status_value)
        counters[key] = count
        total += count

    ocr_success_rate = None
    processed = counters[InvoiceStatus.READY_FOR_REVIEW.value] + counters[InvoiceStatus.CONFIRMED.value]
    failed = counters[InvoiceStatus.FAILED.value]
    if processed + failed > 0:
        ocr_success_rate = round(processed / (processed + failed), 3)

    confidence_avg = await db.scalar(
        select(func.avg(Invoice.ocr_confidence)).where(
            Invoice.tenant_id == user.tenant_id,
            Invoice.ocr_confidence.is_not(None),
        )
    )

    correction_count = await db.scalar(
        select(func.count(InvoiceCorrection.id)).where(
            InvoiceCorrection.tenant_id == user.tenant_id,
        )
    )

    # Portfolio aggregates (sum + percentile_cont median on Postgres)
    amounts_stmt = select(
        func.coalesce(func.sum(Invoice.total_ht), 0).label("ht"),
        func.coalesce(func.sum(Invoice.total_vat), 0).label("tva"),
        func.coalesce(func.sum(Invoice.total_ttc), 0).label("ttc"),
        func.coalesce(func.avg(Invoice.total_ttc), 0).label("mean"),
        func.coalesce(func.max(Invoice.total_ttc), 0).label("max"),
        func.percentile_cont(0.5).within_group(Invoice.total_ttc).label("median"),
    ).where(
        Invoice.tenant_id == user.tenant_id,
        Invoice.total_ttc.is_not(None),
    )
    amounts_row = (await db.execute(amounts_stmt)).one()
    amounts = {
        "ht": float(amounts_row.ht or 0),
        "tva": float(amounts_row.tva or 0),
        "ttc": float(amounts_row.ttc or 0),
        "mean": float(amounts_row.mean or 0),
        "median": float(amounts_row.median or 0),
        "max": float(amounts_row.max or 0),
    }

    # Daily TTC series for the last 30 days (zero-filled)
    today = datetime.now(tz=UTC).date()
    period_days = 30
    start = today - timedelta(days=period_days - 1)
    series_stmt = (
        select(
            cast(Invoice.created_at, Date).label("day"),
            func.coalesce(func.sum(Invoice.total_ttc), 0).label("amount"),
        )
        .where(
            Invoice.tenant_id == user.tenant_id,
            Invoice.total_ttc.is_not(None),
            cast(Invoice.created_at, Date) >= start,
        )
        .group_by(cast(Invoice.created_at, Date))
        .order_by(cast(Invoice.created_at, Date))
    )
    rows = (await db.execute(series_stmt)).all()
    series_map: dict[date, float] = {row.day: float(row.amount or 0) for row in rows}
    series = [
        {
            "date": (start + timedelta(days=i)).isoformat(),
            "amount": series_map.get(start + timedelta(days=i), 0.0),
        }
        for i in range(period_days)
    ]

    # Previous 30-day window TTC for delta computation
    prev_start = start - timedelta(days=period_days)
    previous_ttc = await db.scalar(
        select(func.coalesce(func.sum(Invoice.total_ttc), 0)).where(
            Invoice.tenant_id == user.tenant_id,
            Invoice.total_ttc.is_not(None),
            cast(Invoice.created_at, Date) >= prev_start,
            cast(Invoice.created_at, Date) < start,
        )
    )

    return {
        "tenant_id": str(user.tenant_id),
        "invoices": {
            "counters": counters,
            "total": total,
        },
        "ocr": {
            "success_rate": ocr_success_rate,
            "mean_confidence": float(confidence_avg) if confidence_avg is not None else None,
        },
        "review": {
            "corrections_total": int(correction_count or 0),
        },
        "amounts": amounts,
        "series": series,
        "previous_period_ttc": float(previous_ttc or 0),
    }

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.briefing import Briefing
from app.models.briefing_metric import BriefingMetric
from app.models.briefing_point import BriefingPoint
from app.schemas.briefing import BriefingCreate
from app.services.report_formatter import BriefingReportFormatter

_formatter = BriefingReportFormatter()


def create_briefing(db: Session, payload: BriefingCreate) -> Briefing:
    """Persist a new briefing with its points and metrics."""
    briefing = Briefing(
        company_name=payload.company_name.strip(),
        ticker=payload.ticker,  # already uppercased by validator
        sector=payload.sector.strip(),
        analyst_name=payload.analyst_name.strip(),
        summary=payload.summary.strip(),
        recommendation=payload.recommendation.strip(),
    )
    db.add(briefing)
    db.flush()  # get the PK before inserting children

    for order, text in enumerate(payload.key_points):
        db.add(
            BriefingPoint(
                briefing_id=briefing.id,
                point_type="key_point",
                content=text,
                display_order=order,
            )
        )

    for order, text in enumerate(payload.risks):
        db.add(
            BriefingPoint(
                briefing_id=briefing.id,
                point_type="risk",
                content=text,
                display_order=order,
            )
        )

    for order, metric in enumerate(payload.metrics):
        db.add(
            BriefingMetric(
                briefing_id=briefing.id,
                name=metric.name.strip(),
                value=metric.value.strip(),
                display_order=order,
            )
        )

    db.commit()
    db.refresh(briefing)
    return briefing


def get_briefing(db: Session, briefing_id: int) -> Briefing:
    """Return a single briefing or raise HTTP 404."""
    briefing = db.scalar(select(Briefing).where(Briefing.id == briefing_id))
    if briefing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Briefing {briefing_id} not found",
        )
    return briefing


def generate_briefing(db: Session, briefing_id: int) -> Briefing:
    """Render HTML for the briefing and mark it as generated."""
    briefing = get_briefing(db, briefing_id)
    html = _formatter.render(briefing)
    briefing.generated_html = html
    briefing.is_generated = True
    briefing.generated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(briefing)
    return briefing


def get_briefing_html(db: Session, briefing_id: int) -> str:
    """Return the raw generated HTML or raise HTTP 409 if not yet generated."""
    briefing = get_briefing(db, briefing_id)
    if not briefing.is_generated or briefing.generated_html is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Briefing {briefing_id} has not been generated yet. "
                   "Call POST /briefings/{id}/generate first.",
        )
    return briefing.generated_html

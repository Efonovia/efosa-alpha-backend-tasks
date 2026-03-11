from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.briefing import BriefingCreate, BriefingGeneratedRead, BriefingRead
from app.services.briefing_service import (
    create_briefing,
    generate_briefing,
    get_briefing,
    get_briefing_html,
)

router = APIRouter(prefix="/briefings", tags=["briefings"])

DbDep = Annotated[Session, Depends(get_db)]


@router.post(
    "",
    response_model=BriefingRead,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def create_briefing_endpoint(payload: BriefingCreate, db: DbDep) -> BriefingRead:
    """Create a new analyst briefing."""
    briefing = create_briefing(db, payload)
    return BriefingRead.model_validate(briefing)


@router.get(
    "/{briefing_id}",
    response_model=BriefingRead,
    response_model_by_alias=True,
)
def get_briefing_endpoint(briefing_id: int, db: DbDep) -> BriefingRead:
    """Retrieve stored briefing data by ID."""
    briefing = get_briefing(db, briefing_id)
    return BriefingRead.model_validate(briefing)


@router.post(
    "/{briefing_id}/generate",
    response_model=BriefingGeneratedRead,
    response_model_by_alias=True,
    status_code=status.HTTP_200_OK,
    response_description="HTML Report generated successfully"
)
def generate_briefing_endpoint(briefing_id: int, db: DbDep) -> BriefingGeneratedRead:
    """Generate the HTML report for an existing briefing and mark it as generated."""
    briefing = generate_briefing(db, briefing_id)
    return BriefingGeneratedRead.model_validate(briefing)


@router.get("/{briefing_id}/html", response_class=HTMLResponse)
def get_briefing_html_endpoint(briefing_id: int, db: DbDep) -> HTMLResponse:
    """Return the rendered HTML report for a generated briefing."""
    html = get_briefing_html(db, briefing_id)
    return HTMLResponse(content=html, status_code=status.HTTP_200_OK)

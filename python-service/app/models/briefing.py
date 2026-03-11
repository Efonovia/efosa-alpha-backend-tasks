from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Briefing(Base):
    __tablename__ = "briefings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False)
    sector: Mapped[str] = mapped_column(String(120), nullable=False)
    analyst_name: Mapped[str] = mapped_column(String(120), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)
    is_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    generated_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    points: Mapped[list["BriefingPoint"]] = relationship(  # noqa: F821
        "BriefingPoint",
        back_populates="briefing",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="BriefingPoint.display_order",
    )
    metrics: Mapped[list["BriefingMetric"]] = relationship(  # noqa: F821
        "BriefingMetric",
        back_populates="briefing",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="BriefingMetric.display_order",
    )

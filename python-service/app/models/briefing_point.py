from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class BriefingPoint(Base):
    __tablename__ = "briefing_points"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    briefing_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("briefings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    point_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # "key_point" | "risk"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    briefing: Mapped["Briefing"] = relationship("Briefing", back_populates="points")  # noqa: F821

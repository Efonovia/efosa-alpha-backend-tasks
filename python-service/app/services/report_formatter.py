"""
BriefingReportFormatter
-----------------------
Transforms a Briefing ORM object into a display-ready view model and renders
it through the Jinja2 briefing_report.html template.

Separation of concerns
~~~~~~~~~~~~~~~~~~~~~~~
• ``build_view_model``  – pure data transformation (sorting, labelling,
                          timestamping). No Jinja2 dependency.
• ``render``            – calls build_view_model and delegates HTML generation
                         to the template engine.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

from jinja2 import Environment, FileSystemLoader, select_autoescape

if TYPE_CHECKING:
    from app.models.briefing import Briefing

_TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "templates"


# ---------------------------------------------------------------------------
# View-model dataclasses  (plain data, no ORM dependency)
# ---------------------------------------------------------------------------


@dataclass
class MetricVM:
    name: str
    value: str


@dataclass
class BriefingViewModel:
    report_title: str          # e.g. "ACME · Briefing Report"
    company_name: str
    ticker: str
    sector: str
    analyst_name: str
    summary: str
    recommendation: str
    key_points: list[str]
    risks: list[str]
    metrics: list[MetricVM]
    has_metrics: bool
    generated_at_display: str  # human-readable UTC timestamp
    briefing_id: int


# ---------------------------------------------------------------------------
# Formatter
# ---------------------------------------------------------------------------


class BriefingReportFormatter:
    """Transforms stored Briefing DB records into a rendered HTML report."""

    def __init__(self) -> None:
        self._env = Environment(
            loader=FileSystemLoader(str(_TEMPLATE_DIR)),
            autoescape=select_autoescape(
                enabled_extensions=("html", "xml"),
                default_for_string=True,
            ),
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def build_view_model(self, briefing: "Briefing") -> BriefingViewModel:
        """
        Transform a Briefing ORM object into a display-ready BriefingViewModel.

        All sorting, grouping, and label normalization happens here so the
        template only handles rendering, not logic.
        """
        
        key_points = [
            p.content
            for p in sorted(
                (pt for pt in briefing.points if pt.point_type == "key_point"),
                key=lambda pt: pt.display_order,
            )
        ]
        risks = [
            p.content
            for p in sorted(
                (pt for pt in briefing.points if pt.point_type == "risk"),
                key=lambda pt: pt.display_order,
            )
        ]
        metrics = [
            MetricVM(
                name=self._normalize_label(m.name),
                value=m.value,
            )
            for m in sorted(briefing.metrics, key=lambda m: m.display_order)
        ]

        report_title = f"{briefing.ticker} · Briefing Report"

        return BriefingViewModel(
            report_title=report_title,
            company_name=briefing.company_name,
            ticker=briefing.ticker,
            sector=briefing.sector,
            analyst_name=briefing.analyst_name,
            summary=briefing.summary,
            recommendation=briefing.recommendation,
            key_points=key_points,
            risks=risks,
            metrics=metrics,
            has_metrics=bool(metrics),
            generated_at_display=self._utc_display_timestamp(),
            briefing_id=briefing.id,
        )

    def render(self, briefing: "Briefing") -> str:
        """Build the view model and render the Jinja2 template to HTML."""
        vm = self.build_view_model(briefing)
        template = self._env.get_template("briefing_report.html")
        return template.render(vm=vm)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _normalize_label(label: str) -> str:
        """Title-case metric names for consistent display (e.g. 'p/e ratio' → 'P/E Ratio')."""
        return " ".join(word.capitalize() for word in label.strip().split())

    @staticmethod
    def _utc_display_timestamp() -> str:
        now = datetime.now(timezone.utc)
        return now.strftime("%d %B %Y, %H:%M UTC")

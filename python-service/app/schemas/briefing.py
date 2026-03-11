from __future__ import annotations

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, alias_generators, field_validator, model_validator


# ---------------------------------------------------------------------------
# Shared sub-schemas
# ---------------------------------------------------------------------------


class MetricCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    value: str = Field(min_length=1, max_length=120)


class MetricRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )

    id: int
    name: str
    value: str
    display_order: int


# ---------------------------------------------------------------------------
# Request schema
# ---------------------------------------------------------------------------


class BriefingCreate(BaseModel):
    company_name: Annotated[str, Field(alias="companyName", min_length=1, max_length=255)]
    ticker: Annotated[str, Field(alias="ticker", min_length=1, max_length=20)]
    sector: Annotated[str, Field(alias="sector", min_length=1, max_length=120)]
    analyst_name: Annotated[str, Field(alias="analystName", min_length=1, max_length=120)]
    summary: Annotated[str, Field(alias="summary", min_length=1)]
    recommendation: Annotated[str, Field(alias="recommendation", min_length=1)]
    key_points: Annotated[
        list[str],
        Field(alias="keyPoints", min_length=2, description="At least 2 key points required"),
    ]
    risks: Annotated[
        list[str],
        Field(alias="risks", min_length=1, description="At least 1 risk required"),
    ]
    metrics: Annotated[
        list[MetricCreate],
        Field(alias="metrics", default_factory=list),
    ]

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("ticker", mode="before")
    @classmethod
    def normalize_ticker(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("key_points", mode="before")
    @classmethod
    def validate_key_points(cls, v: list[str]) -> list[str]:
        stripped = [p.strip() for p in v if p.strip()]
        if len(stripped) < 2:
            raise ValueError("At least 2 non-empty key points are required")
        return stripped

    @field_validator("risks", mode="before")
    @classmethod
    def validate_risks(cls, v: list[str]) -> list[str]:
        stripped = [r.strip() for r in v if r.strip()]
        if len(stripped) < 1:
            raise ValueError("At least 1 non-empty risk is required")
        return stripped

    @model_validator(mode="after")
    def validate_unique_metric_names(self) -> "BriefingCreate":
        names = [m.name.strip().lower() for m in self.metrics]
        if len(names) != len(set(names)):
            raise ValueError("Metric names must be unique within the same briefing")
        return self


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

_RESPONSE_CONFIG = ConfigDict(
    from_attributes=True,
    alias_generator=alias_generators.to_camel,
    populate_by_name=True,
)


class PointRead(BaseModel):
    model_config = _RESPONSE_CONFIG

    id: int
    point_type: str
    content: str
    display_order: int


class BriefingRead(BaseModel):
    model_config = _RESPONSE_CONFIG

    id: int
    company_name: str
    ticker: str
    sector: str
    analyst_name: str
    summary: str
    recommendation: str
    is_generated: bool
    created_at: datetime
    generated_at: datetime | None
    key_points: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    metrics: list[MetricRead]

    @model_validator(mode="before")
    @classmethod
    def split_points(cls, data: Any) -> Any:
        # data is either a dict (from JSON) or an ORM object (from model_validate)
        if hasattr(data, "points"):
            points = getattr(data, "points")
            key_points = [p.content for p in points if p.point_type == "key_point"]
            risks = [p.content for p in points if p.point_type == "risk"]
            # If it's an ORM object, we can't easily modify it. 
            # But the validator can return a dict or the modified object if it's a dict.
            # However, pydantic model_validate(orm_obj) works better if we don't interfere 
            # OR we return a dict. Let's return a dict for all fields if we detect an ORM obj.
            
            # Better way for from_attributes: just add them as attributes to the data if it's an object
            # or as items if it's a dict.
            if isinstance(data, dict):
                data["key_points"] = key_points
                data["risks"] = risks
            else:
                # We can't always set attributes on arbitrary objects, 
                # but we can return a dict containing all values.
                # Since we want to support from_attributes, let's keep it simple.
                # Actually, in Pydantic v2, we can just return a dict.
                result = {
                    "id": data.id,
                    "company_name": data.company_name,
                    "ticker": data.ticker,
                    "sector": data.sector,
                    "analyst_name": data.analyst_name,
                    "summary": data.summary,
                    "recommendation": data.recommendation,
                    "is_generated": data.is_generated,
                    "created_at": data.created_at,
                    "generated_at": data.generated_at,
                    "key_points": key_points,
                    "risks": risks,
                    "metrics": data.metrics,
                }
                return result
        return data


class BriefingGeneratedRead(BriefingRead):
    generated_html: str | None = None

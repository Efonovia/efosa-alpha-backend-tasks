"""
Tests for the briefings API endpoints.

Uses SQLite in-memory via SQLAlchemy (same pattern as test_sample_items.py).
"""

from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app import models  # noqa: F401 – register all ORM classes so Base.metadata is complete


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

_VALID_PAYLOAD: dict = {
    "companyName": "Acme Holdings",
    "ticker": "acme",
    "sector": "Industrial Technology",
    "analystName": "Jane Doe",
    "summary": (
        "Acme is benefiting from strong enterprise demand and improving "
        "operating leverage, though customer concentration remains a near-term risk."
    ),
    "recommendation": "Monitor for margin expansion and customer diversification before increasing exposure.",
    "keyPoints": [
        "Revenue grew 18% year-over-year in the latest quarter.",
        "Management raised full-year guidance.",
        "Enterprise subscriptions now account for 62% of recurring revenue.",
    ],
    "risks": [
        "Top two customers account for 41% of total revenue.",
        "International expansion may pressure margins over the next two quarters.",
    ],
    "metrics": [
        {"name": "Revenue Growth", "value": "18%"},
        {"name": "Operating Margin", "value": "22.4%"},
        {"name": "P/E Ratio", "value": "28.1x"},
    ],
}


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session_local = sessionmaker(
        bind=engine, autoflush=False, autocommit=False, future=True
    )
    Base.metadata.create_all(bind=engine)

    def override_get_db() -> Generator[Session, None, None]:
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _create_briefing(client: TestClient, payload: dict | None = None) -> dict:
    resp = client.post("/briefings", json=payload or _VALID_PAYLOAD)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# POST /briefings – success
# ---------------------------------------------------------------------------

def test_create_briefing_returns_201(client: TestClient) -> None:
    data = _create_briefing(client)
    assert data["id"] is not None
    assert data["companyName"] == "Acme Holdings"
    assert data["ticker"] == "ACME"  # uppercased by validator
    assert data["isGenerated"] is False


def test_create_briefing_ticker_normalized_to_uppercase(client: TestClient) -> None:
    data = _create_briefing(client)
    assert data["ticker"] == "ACME"


def test_create_briefing_points_and_metrics_stored(client: TestClient) -> None:
    data = _create_briefing(client)
    key_points = data["keyPoints"]
    risks = data["risks"]
    assert len(key_points) == 3
    assert len(risks) == 2
    assert len(data["metrics"]) == 3


def test_create_briefing_without_metrics(client: TestClient) -> None:
    payload = {**_VALID_PAYLOAD, "metrics": []}
    data = _create_briefing(client, payload)
    assert data["metrics"] == []


# ---------------------------------------------------------------------------
# POST /briefings – validation failures (422)
# ---------------------------------------------------------------------------

def test_create_briefing_missing_company_name_returns_422(client: TestClient) -> None:
    payload = {k: v for k, v in _VALID_PAYLOAD.items() if k != "companyName"}
    resp = client.post("/briefings", json=payload)
    assert resp.status_code == 422


def test_create_briefing_missing_summary_returns_422(client: TestClient) -> None:
    payload = {k: v for k, v in _VALID_PAYLOAD.items() if k != "summary"}
    resp = client.post("/briefings", json=payload)
    assert resp.status_code == 422


def test_create_briefing_missing_recommendation_returns_422(client: TestClient) -> None:
    payload = {k: v for k, v in _VALID_PAYLOAD.items() if k != "recommendation"}
    resp = client.post("/briefings", json=payload)
    assert resp.status_code == 422


def test_create_briefing_fewer_than_2_key_points_returns_422(client: TestClient) -> None:
    payload = {**_VALID_PAYLOAD, "keyPoints": ["Only one point."]}
    resp = client.post("/briefings", json=payload)
    assert resp.status_code == 422


def test_create_briefing_empty_key_points_returns_422(client: TestClient) -> None:
    payload = {**_VALID_PAYLOAD, "keyPoints": []}
    resp = client.post("/briefings", json=payload)
    assert resp.status_code == 422


def test_create_briefing_no_risks_returns_422(client: TestClient) -> None:
    payload = {**_VALID_PAYLOAD, "risks": []}
    resp = client.post("/briefings", json=payload)
    assert resp.status_code == 422


def test_create_briefing_duplicate_metric_names_returns_422(client: TestClient) -> None:
    payload = {
        **_VALID_PAYLOAD,
        "metrics": [
            {"name": "Revenue Growth", "value": "18%"},
            {"name": "revenue growth", "value": "20%"},  # same name, different case
        ],
    }
    resp = client.post("/briefings", json=payload)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /briefings/{id}
# ---------------------------------------------------------------------------

def test_get_briefing_returns_stored_data(client: TestClient) -> None:
    created = _create_briefing(client)
    resp = client.get(f"/briefings/{created['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == created["id"]
    assert data["companyName"] == "Acme Holdings"


def test_get_briefing_unknown_id_returns_404(client: TestClient) -> None:
    resp = client.get("/briefings/9999")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /briefings/{id}/generate
# ---------------------------------------------------------------------------

def test_generate_briefing_marks_as_generated(client: TestClient) -> None:
    created = _create_briefing(client)
    resp = client.post(f"/briefings/{created['id']}/generate")
    assert resp.status_code == 200
    data = resp.json()
    assert data["isGenerated"] is True
    assert data["generatedAt"] is not None


def test_generate_briefing_unknown_id_returns_404(client: TestClient) -> None:
    resp = client.post("/briefings/9999/generate")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /briefings/{id}/html
# ---------------------------------------------------------------------------

def test_get_html_returns_html_content(client: TestClient) -> None:
    created = _create_briefing(client)
    client.post(f"/briefings/{created['id']}/generate")

    resp = client.get(f"/briefings/{created['id']}/html")
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]
    body = resp.text
    assert "Acme Holdings" in body
    assert "ACME" in body
    assert "Jane Doe" in body


def test_get_html_contains_all_sections(client: TestClient) -> None:
    created = _create_briefing(client)
    client.post(f"/briefings/{created['id']}/generate")

    body = client.get(f"/briefings/{created['id']}/html").text
    assert "Executive Summary" in body
    assert "Key Points" in body
    assert "Risks" in body
    assert "Recommendation" in body
    assert "Key Metrics" in body


def test_get_html_before_generate_returns_409(client: TestClient) -> None:
    created = _create_briefing(client)
    resp = client.get(f"/briefings/{created['id']}/html")
    assert resp.status_code == 409


def test_get_html_unknown_id_returns_404(client: TestClient) -> None:
    resp = client.get("/briefings/9999/html")
    assert resp.status_code == 404


def test_get_html_without_metrics_omits_metrics_section(client: TestClient) -> None:
    payload = {**_VALID_PAYLOAD, "metrics": []}
    created = _create_briefing(client, payload)
    client.post(f"/briefings/{created['id']}/generate")

    body = client.get(f"/briefings/{created['id']}/html").text
    assert "Key Metrics" not in body

# Python Service

## Overview

This service provides a pipeline for analysts to store structured company briefings and request dynamically generated HTML reporting views. It is built using FastAPI and Jinja2 templates.

## Prerequisites

- Python 3.12
- PostgreSQL running from the repository root:
    ```bash
    docker compose up -d postgres
    ```

## Setup

```bash
cd python-service
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

## Environment Configuration

The `.env` file includes:

- `DATABASE_URL`: PostgreSQL connection string.
- `APP_ENV`: Application environment.
- `APP_PORT`: Port the service runs on.

## Run Migrations (Manual SQL Runner)

Apply pending migrations:

```bash
python -m app.db.run_migrations up
```

Roll back the latest migration:

```bash
python -m app.db.run_migrations down --steps 1
```

## Run Service

```bash
python -m uvicorn app.main:app --reload --port 8000
```

## Run Tests

```bash
python -m pytest
```

## Architectural Decisions & Design

- **Structured Data Storage**: Briefings, points (key points, risks), and metrics are stored as discrete relational tables in PostgreSQL.
- **Service Layer Pattern**: Business logic is separated into `briefing_service.py`, keeping API routes clean.
- **Template System**: Uses **Jinja2** to transform stored ORM objects into display-ready HTML reports.
- **View Model Separation**: The `BriefingReportFormatter` builds a pure data `BriefingViewModel` before rendering, ensuring the template only handles visual logic.
- **API Design**: Relies on Pydantic schemas for strict validation of complex nested data (e.g., metric lists).

## Schema Decisions

- **Relational Mapping**: Uses one-to-many relationships for `BriefingPoint` and `BriefingMetric` to allow for flexible counts of data points per briefing.
- **Manual Migrations**: Uses a raw SQL-based migration system to maintain full control over the database schema.

## Assumptions & Tradeoffs

- **Data Delivery**: Assumes validated JSON structures are delivered directly from external analyst systems.
- **Synchronous Generation**: Report HTML generation is handled synchronously during the request, which is suitable for the current workload but may need scaling for very large reports.

## API Endpoints Reference

### Analyst Briefings

**`POST /briefings`**  
Create a new analyst briefing securely with associated metrics, risks, and key points.

**Body:**

```json
{
	"company_name": "ACME Corp",
	"ticker": "ACME",
	"sector": "Technology",
	"analyst_name": "Jane Doe",
	"summary": "Strong growth expected.",
	"recommendation": "Buy",
	"key_points": ["Market expansion in Q3"],
	"risks": ["Supply chain constraints"],
	"metrics": [{ "name": "P/E Ratio", "value": "15.4" }]
}
```

**`GET /briefings/{briefing_id}`**  
Retrieve stored briefing data fields by ID.

---

### Briefing Reports

**`POST /briefings/{briefing_id}/generate`**  
Generate the HTML report for an existing briefing and mark it as generated.

**Response:** Returns a message telling the user that the report has been generated and can be viewed at `/briefings/{briefing_id}/html`.

**`GET /briefings/{briefing_id}/html`**  
Retrieves the rendered HTML template.

**Response:** Returns the content as raw `text/html`.

## Future Improvements

- **Asynchronous Processing**: Offload HTML generation to background workers (e.g., using Celery or FastAPI's `BackgroundTasks`) for better scalability.
- **Caching**: implement Redis caching for the generated HTML output to reduce database and rendering load.
- **Authentication**: Integrate real security (e.g., Auth0 or local JWT) to protect sensitive analyst briefings.
- **Report Template Engine**: Extend the `ReportFormatter` to support multiple template styles or user-uploaded templates.
- **Search & Filtering**: Add comprehensive search across briefings by company, sector, or analyst.

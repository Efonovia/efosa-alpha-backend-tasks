# InsightOps Analyst Briefing Workflow

## Overview
This feature provides a robust pipeline for analysts to store structured company briefings and request dynamically generated HTML reporting views.

## Architectural Decisions & Assumptions

1. **Structured Data Storage abstraction** 
   - Analyst briefings are saved in the PostgreSQL database alongside their related `briefing_points` (for key points and risks) and `briefing_metrics` (for numerical performance metrics).
   - *Assumption*: Validated JSON structures from external analysis systems are delivered directly to the `/briefings` endpoint.

2. **Database Schema & Migrations**
   - Added tables with strong relational ties to accurately model a company briefing's one-to-many properties.
   - Utilized a custom manual SQL migration runner (`app.db.run_migrations`) which executes raw `.sql` files found in `db/migrations/` and safely tracks them via the `schema_migrations` table.

3. **Report Generation & View Models**
   - The report HTML generation logic is cleanly decoupled from the API routes inside the `BriefingReportFormatter`.
   - Before passing data to the Jinja2 template (`briefing_report.html`), the formatter builds a plain, display-ready `BriefingViewModel`, normalizing labels, grouping points, and generating formatted timestamps.
   - The generation process persists the raw rendered HTML string to the database and transitions the briefing's availability state (`is_generated=True`).

4. **API Design & Separation of Concerns**
   - The route controllers (`app/api/briefings.py`) contain zero business logic. They strictly rely on Pydantic schemas (`BriefingCreate`, `BriefingRead`) for request/response validation and safely delegate persistence to `briefing_service.py`.

## Template Engine Setup (Jinja2)

This implementation leverages **Jinja2** to render beautiful and consistent HTML reports from stored briefing objects.

### Technical Details on Generation
Calling the generation endpoint transforms the stored ORM objects natively to HTML strings using `Environment.get_template().render()`. The HTML generation intelligently groups dynamic looping components like numerical metrics, risks, and bullet points. In the event the underlying HTML output is requested before a briefing has actually been "generated", the API enforces state consistency by raising an `HTTP 409 Conflict`.

### Starting the Project
Starting the project is still the same steps as listed in the original readme.md. nothing has changes in that regard

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
  "metrics": [{"name": "P/E Ratio", "value": "15.4"}]
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

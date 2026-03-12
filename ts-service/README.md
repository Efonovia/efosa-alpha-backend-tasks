# TypeScript Service

## Overview
This service provides a robust asynchronous pipeline for recruiters to upload candidate documents and request LLM-powered candidate summaries. It is built as a NestJS application with a focus on modularity and clear separation of concerns.

## Prerequisites
- Node.js 22+
- npm
- PostgreSQL running from the repository root:
  ```bash
  docker compose up -d postgres
  ```

## Setup
```bash
cd ts-service
npm install
cp .env.example .env
```

## Environment Configuration
The `.env` file should include:
- `PORT`: Port the service runs on.
- `DATABASE_URL`: PostgreSQL connection string.
- `NODE_ENV`: Application environment (development/production).
- `GEMINI_API_KEY`: Required for using the real Google Gemini provider. Get one at [Google AI Studio](https://aistudio.google.com/app/apikey).

## Run Migrations
```bash
npm run migration:run
```

## Run Service
```bash
npm run start:dev
```

## Run Tests
```bash
npm test
npm run test:e2e
```

## Architectural Decisions & Design
- **Document Storage**: Uploaded documents are saved in the PostgreSQL database and locally to the file system (`uploads/docs/workspace-{workspaceId}/{candidateId}/{uuid}.txt`). This local storage serves as a conceptual abstraction for cloud storage like AWS S3.
**Background Queue & Worker Pattern**
   - The summary generation endpoint strictly enqueues a job (`generate_summary`) into the memory queue using `QueueService`. It does not process the content inline.
   - `WorkerService` polls the queue periodically, pulling pending jobs securely while maintaining state (`processedJobIds`) to prevent duplicate executions.
   - Summaries undergo proper status progression (`pending` -> `completed` or `failed`). 
   - On startup, the worker service will check for any pending summaries and enqueue them for processing. Ensuring that no pending summaries are lost in case the service was down.
**Access Control (Authorization)**
   - Used the mock headers (`x-user-id`, `x-workspace-id`) via `FakeAuthGuard` and `@CurrentUser()` decorator.
   - All document and summary queries strictly filter down by checking if the candidate belongs to the user's `workspaceId`.

**LLM Provider Abstraction**
   - Set up `SUMMARIZATION_PROVIDER` as an interface to decouple the business logic from Google Gemini.
   - `LlmModule` handles dependency injection dynamically: if `GEMINI_API_KEY` is available in the environment variables, the real `GeminiSummarizationProvider` is injected; otherwise, the `FakeSummarizationProvider` serves mocked results.

## Schema Decisions
- **`CandidateDocument`**: Stores metadata, candidate association, and extracted `rawText`. Relies on local file paths for the actual "storage key".
- **`CandidateSummary`**: Stores the structured result of the LLM analysis (score, strengths, concerns, recommended decision).
- **Relational Integrity**: Uses `ON DELETE CASCADE` to ensure that documents and summaries are cleaned up if a candidate or workspace is removed.

## Assumptions & Tradeoffs
- **Text Extraction**: Assumes document text is already extracted and available in the API request as `rawText`.
- **In-Memory Queue**: Uses an in-memory queue for simplified assessment setup. This means jobs are lost if the service restarts (partially mitigated by the worker checking for pending summaries on startup).

## API Endpoints Reference

### Fake Auth Headers
Include these headers in all requests:
- `x-user-id`: Any string (e.g., `user-1`)
- `x-workspace-id`: Workspace identifier (e.g., `1`)

### Candidate Documents
**`POST /documents/candidate/:candidateId`**  
Stores a candidate document text locally and in the database.

**Headers:**
- `x-user-id`
- `x-workspace-id`

**Body:**
```json
{
  "documentType": "resume",
  "fileName": "john_doe_resume.pdf",
  "rawText": "John is a senior engineer with 10 years of experience..."
}
```

**`GET /documents`**  
Retrieves an aggregated list of all documents associated with all candidates belonging to the user's workspace.

**Headers:**
- `x-user-id`
- `x-workspace-id`

---

### Candidate Summaries
**`POST /candidate/:candidateId/summaries/generate`**  
Asynchronously requests an LLM-generated summary, enqueuing the background worker.

**Headers:**
- `x-user-id`
- `x-workspace-id`

**Response:**
```json
{
  "message": "Summary generation enqueued successfully and the results will be processed soon. You can check the endpoint: /candidate/${candidateId}/summaries to see if the summary generation has been completed.",
  "summary": {
        "id": "8a7d8a20-871f-45d0-a38f-4da3ce204508",
        "candidateId": "c6e1a0f8-49a3-494e-9328-744d07db9560",
        "status": "pending",
        "score": null,
        "strengths": null,
        "concerns": null,
        "summary": null,
        "recommendedDecision": null,
        "provider": null,
        "promptVersion": null,
        "errorMessage": null,
        "createdAt": "2026-03-12T09:51:54.694Z",
        "updatedAt": "2026-03-12T09:51:54.694Z"
    }
}
```

**`GET /candidate/:candidateId/summaries`**  
Lists all previously requested summaries for the candidate.

**`GET /candidate/:candidateId/summaries/:summaryId`**  
Retrieves details of a specific candidate's summary.


## Future Improvements
- **Persistent Queue**: Implement Redis-backed BullMQ for job persistence across restarts.
- **Cloud Storage**: Integrate AWS S3 or Google Cloud Storage for actual document persistence.
- **Real Text Extraction**: Implement a document processing pipe (e.g., using `pdf-parse` or OCR) to handle actual file uploads.
- **Advanced Authentication**: Implement real JWT/OAuth2 authentication.
- **Retry Mechanisms**: Add automatic retries with exponential backoff for failed LLM API calls.
- **Caching**: implement Redis caching for generated summaries.

# Candidate Document Intake + Summary Workflow

## Overview
This feature provides a robust asynchronous pipeline for recruiters to upload candidate documents and request LLM-powered candidate summaries. 

## Architectural Decisions & Assumptions

1. **Document Storage abstraction** 
   - Uploaded documents are saved both in the PostgreSQL database (`candidate_documents` table) and locally to the file system (`uploads/docs/workspace-{workspaceId}/{candidateId}/{uuid}.txt`). In an ideal system the documents will be stored in an object storage like aws S3
   - *Assumption*: Text extraction has already occurred, and the API payload delivers `rawText` securely. The local file storage serves as a conceptual cloud bucket (e.g., S3).

2. **Database Schema & Migrations**
   - I added `candidate_documents` and `candidate_summaries` tables with strong relational ties to `sample_candidates` (`ON DELETE CASCADE`).
   - Utilized standard TypeORM migrations. 

3. **Background Queue & Worker Pattern**
   - The summary generation endpoint strictly enqueues a job (`generate_summary`) into the memory queue using `QueueService`. It does not process the content inline.
   - `WorkerService` polls the queue periodically, pulling pending jobs securely while maintaining state (`processedJobIds`) to prevent duplicate executions.
   - Summaries undergo proper status progression (`pending` -> `completed` or `failed`). 

4. **Access Control (Authorization)**
   - Used the mock headers (`x-user-id`, `x-workspace-id`) via `FakeAuthGuard` and `@CurrentUser()` decorator.
   - All document and summary queries strictly filter down by checking if the candidate belongs to the user's `workspaceId`.

5. **LLM Provider Abstraction**
   - Set up `SUMMARIZATION_PROVIDER` as an interface to decouple the business logic from Google Gemini.
   - `LlmModule` handles dependency injection dynamically: if `GEMINI_API_KEY` is available in the environment variables, the real `GeminiSummarizationProvider` is injected; otherwise, the `FakeSummarizationProvider` serves mocked results.

6. **Summary Generation**
   - I added a check to make sure the candidate has atleast one document before a summary can be generated. This makes sure there is no unexpected response from the LLM when given an empty document.

## LLM Provider Setup (Google Gemini)

This implementation uses **Google Gemini 2.5 Flash** due to its fast inference and structured JSON schema output capabilities.

### How to Configure

1. Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Create a `.env` file in the `ts-service` root based on the provided `.env.example`.
3. Add your key to the file:
   ```env
   GEMINI_API_KEY=AIzaSy...
   ```
4. Restart the development server (`npm run start:dev`). The `LlmModule` will automatically detect the key and switch from the fake provider to the real Gemini provider.

### Technical Details on Generation
The raw text from all provided documents for a candidate is concatenated and passed to Gemini. The model is given a strict JSON structure instructing it to extract `score`, `strengths`, `concerns`, `summary`, and a `recommendedDecision`. This ensures the output can be parsed directly into our schema securely. In the event of an error, the worker will gracefully catch it and transition the record to a `failed` state with the generated `errorMessage`.

## API Endpoints Reference

### Candidate Documents
**`POST /candidates/:candidateId/documents`**  
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
Retrieves an aggregated list of all documents associated with any candidate belonging to the user's workspace.

**Headers:**
- `x-user-id`
- `x-workspace-id`

---

### Candidate Summaries
**`POST /candidates/:candidateId/summaries/generate`**  
Asynchronously requests an LLM-generated summary, enqueuing the background worker.

**Headers:**
- `x-user-id`
- `x-workspace-id`

**Response:**
```json
{
  "message": "Summary generation enqueued successfully",
  "summaryId": "uuid-string..."
}
```

**`GET /candidates/:candidateId/summaries`**  
Lists all previously requested summaries for the candidate.

**`GET /candidates/:candidateId/summaries/:summaryId`**  
Retrieves details of a specific summary.

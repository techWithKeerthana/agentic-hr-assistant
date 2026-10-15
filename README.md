# Agentic HR Assistant

A full-stack conversational AI that answers HR policy questions via RAG and books appointments through multi-turn dialogue — with a live agent control room UI.

## Architecture

```mermaid
flowchart TD
    UI[React Frontend] -->|POST /api/chat SSE| API[FastAPI Backend]
    API --> Graph[LangGraph StateGraph]
    Graph --> Router[Router Node]
    Router -->|intent=faq| RAG[RAG Node]
    Router -->|intent=booking| Booking[Booking Node]
    Router -->|context_switch| RAG
    RAG --> ChromaDB[(ChromaDB\nVector Store)]
    RAG --> BM25[BM25 Retriever]
    Booking --> SQLite[(SQLite\nbookings table)]
    Graph --> Checkpointer[(SqliteSaver\ncheckpointer)]
```

## Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Live Agent Control Room** | Real-time execution timeline showing Router → RAG/Booking steps with status badges |
| 2 | **Booking Copilot with Human Approval** | Slot card UI → user selects → confirms → DB write. Prevents double-booking. |
| 3 | **Trustworthy RAG with Evidence** | Every answer cites `(Doc, Page X)`. Clickable snippet previews. Low-confidence abstention. |
| 4 | **Context Switching** | FAQ mid-booking returns to booking state without losing name/email/slot |
| 5 | **Prompt Injection Protection** | Pattern-based injection detection, email validation, PII masking in logs |
| 6 | **Agent Evaluation Lab** | In-UI dashboard: run test suite, view pass/fail per category with metrics |
| 7 | **Persistent Conversations** | SqliteSaver checkpointer — state survives backend restarts. Thread sidebar with rename/delete. |
| 8 | **Document Management Panel** | Upload new PDFs, view chunk/page stats, test retrieval queries live |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Agent Framework | LangGraph (StateGraph, SqliteSaver checkpointer) |
| Backend | Python 3.10+ · FastAPI (async) · SSE streaming |
| LLM | Groq API — LLaMA 3.3-70b (free & fast) |
| Vector Store | ChromaDB (local, persisted) |
| Embeddings | sentence-transformers all-MiniLM-L6-v2 (free) |
| Retrieval | EnsembleRetriever: BM25 + vector similarity |
| Frontend | React 18 · Vite · Tailwind CSS |
| Database | SQLite (bookings table + LangGraph checkpointer) |

## Local Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- Groq API key (free at [console.groq.com](https://console.groq.com))

### Backend

```bash
cd agentic-hr-assistant

# Create and activate virtualenv
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r backend/requirements.txt

# Create .env from template
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# Run backend
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will:
1. Initialize SQLite tables and seed 10 appointment slots
2. Download and ingest both PDFs in the background (first start takes ~60s)
3. Stream SSE events on `POST /api/chat`

### Frontend

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

### Docker (optional)

```bash
docker-compose up --build
# Backend: http://localhost:8000
# Frontend: http://localhost:5173
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | SSE streaming chat (message + thread_id) |
| `GET` | `/api/slots` | Available appointment slots |
| `GET` | `/api/threads` | List conversation threads |
| `DELETE` | `/api/threads/{id}` | Delete a thread |
| `GET` | `/api/docs` | List indexed documents |
| `POST` | `/api/docs/upload` | Upload and index a new PDF |
| `POST` | `/api/docs/preview` | Preview retrieval for a query |
| `POST` | `/api/eval/run` | Run the evaluation suite |
| `GET` | `/api/health` | Health check |

## Sample Dialogue — Context Interleaving

```
User:  I want to book a performance review
Bot:   I'd be happy to help! Could you provide your full name and email?

User:  Alex Chen, alex@company.com
Bot:   Thanks Alex! Here are available slots: [slot cards]

User:  Wait — how many vacation days do I get?    ← FAQ mid-booking
Bot:   Per the Employee Handbook (Page 14), employees receive 15 days PTO...
       [Returning to your appointment booking...]

User:  Let's go with Tuesday 11 AM (s3)
Bot:   Summary: Alex Chen · alex@company.com · Tuesday 11 AM. Confirm?

User:  Yes, confirm
Bot:   ✓ Booking confirmed! Reference: #REV-4821
```

LangGraph preserves `name`, `email`, `booking_status="slot_selection"` across the FAQ detour.

## Evaluation Suite

```bash
# Run deterministic tests (no LLM required for most)
python -m backend.tests.eval_runner

# Or via API (also runs in-UI via Eval Lab tab)
curl -X POST http://localhost:8000/api/eval/run
```

Test categories: Security · Input Validation · Database · Intent Routing

## AI Engineering Log

### Tools Used
- **Claude (Anthropic)** — architecture design, LangGraph graph wiring, SSE streaming logic
- **GitHub Copilot** — inline completions for boilerplate
- **Cursor** — refactoring node handlers

### Where LLMs Hallucinated and How I Fixed It

1. **LangGraph streaming API**: Claude initially suggested `graph.stream()` for SSE output, but this is synchronous and blocks the async event loop. Fixed by using `graph.astream_events()` with `async for` and translating `on_chain_end` events into SSE.

2. **Checkpointer**: Copilot defaulted to `MemorySaver` which loses state on backend restart. Replaced with `SqliteSaver` and verified persistence by restarting the server mid-booking.

3. **ChromaDB collection**: LLM generated `client.get_collection()` which throws `InvalidCollectionException` if the collection doesn't exist on first run. Fixed to `get_or_create_collection()`.

4. **BM25 + vector ensemble**: Initial suggestion used `VectorStoreRetriever` directly in the ensemble without `search_type="similarity_score_threshold"`. Added the threshold to avoid returning zero-score results as high-confidence.

5. **Booking state reset**: First iteration of the router reset `booking_status` to `None` on every context switch. Fixed by preserving all booking fields and only overriding `intent` and `pending_action`.

## Verification Artifacts

Screenshots to add after first run:
- `docs/screenshot-chat-rag.png` — RAG answer with citation badge
- `docs/screenshot-booking-flow.png` — slot selection → confirmation card
- `docs/screenshot-context-switch.png` — FAQ mid-booking state preserved
- `docs/screenshot-agent-timeline.png` — live execution timeline
- `docs/screenshot-eval-dashboard.png` — eval suite results

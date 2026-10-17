# CLAUDE.md — Full Stack Agentic AI Internship Assessment

## Project Overview

Build an end-to-end **Full Stack Agentic AI** system: a conversational assistant that handles both
RAG-based FAQ queries and multi-turn appointment booking, with a live agent control room UI.

**Assignment**: 72-hour internship technical assessment  
**Target Role**: Full Stack & Agentic AI Engineering Intern  
**Submission**: Public GitHub repo (use personal account: techWithKeerthana — NOT Keerthana-PayTap)

---

## Architecture

```
React Frontend (Vite + Tailwind)
    │
    ├── POST /api/chat  (SSE streaming)
    ├── GET  /api/slots
    └── GET  /api/threads / DELETE /api/threads/:id
         │
    FastAPI Backend (Python 3.10+, async)
         │
    LangGraph StateGraph Engine
    ┌────────────────────────────────────┐
    │         [ Router Node ]            │
    │        /              \            │
    │  [FAQ RAG Node]  [Booking Node]    │
    │  (PDF Knowledge) (Slot Selection)  │
    │        \              /            │
    │      [ Checkpointer State ]        │
    │   (SqliteSaver, keyed by thread_id)│
    └────────────────────────────────────┘
         │
    ChromaDB / FAISS (Vector Store)
    Employee Handbook PDF (ingested)
```

---

## Core Stack

| Layer | Technology |
|-------|-----------|
| Agent Framework | LangGraph (StateGraph, Checkpointer) + LangChain |
| Backend | Python 3.10+ with FastAPI (async) |
| LLM | Groq API (LLaMA 3.3-70b) — free & fast |
| Vector Store | ChromaDB (local, in-memory) |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) — free |
| Frontend | React + Vite + Tailwind CSS |
| Persistence | SqliteSaver (LangGraph checkpointer) |
| Streaming | Server-Sent Events (SSE) |

---

## Functional Requirements (ALL MANDATORY)

### Module A — PDF Ingestion & RAG
- Download and ingest:
  - Primary: `https://raw.githubusercontent.com/Azure-Samples/azure-search-openai-demo/main/data/employee_handbook.pdf`
  - Secondary (benefits): `https://raw.githubusercontent.com/Azure-Samples/azure-search-openai-demo/main/data/Northwind_Standard_Benefits_Details.pdf`
- Parse with `PyPDFLoader` or `pdfplumber`
- Chunk: 500–1000 chars, 100–200 overlap
- Embed into ChromaDB or FAISS
- Every answer MUST cite page number + document name
- Show "Evidence available" / "Insufficient information" badge

### Module B — LangGraph State Machine
- Typed state schema using `TypedDict` + Pydantic
- StateGraph with:
  - `router_node` — classifies intent (FAQ vs booking)
  - `rag_node` — handles PDF questions
  - `booking_node` — handles slot collection/confirmation
  - `summarizer_node` (bonus) — summarizes completed sessions
- SqliteSaver checkpointer keyed by `thread_id`
- State must persist across HTTP requests (not just in memory)

### Module C — Context Interleaving
- Mid-booking FAQ interruption: agent answers, then resumes booking WITHOUT losing collected state
- LangGraph fields to preserve: `booking_status`, `name`, `email`, `selected_slot`, `pending_action`
- Reference the sample dialogue in the assessment exactly

### Module D — Full Stack API & UI
- `POST /api/chat` — streaming SSE endpoint
- `GET /api/slots` — returns available time slots
- `GET /api/threads` — list conversation threads
- `DELETE /api/threads/:id` — clear thread state
- React chat UI with thread sidebar

---

## 8 Bonus Features to Implement (DIFFERENTIATORS — build ALL of these)

### Feature 1 — Live Agent Control Room (TOP PRIORITY)
Show a real-time execution timeline while the agent runs:
- Display active LangGraph node name as a badge (Router / RAG / Booking)
- Show route chosen: FAQ / booking / unknown
- Show retrieval status, tool execution results, errors
- Display thread ID and booking progress
- Stream events to frontend via SSE
- UI: vertical step list with Completed / Running / Pending status badges

### Feature 2 — Booking Copilot with Human Approval
- Agent prepares booking and shows confirmation card BEFORE executing
- Workflow: collect info → fetch slots → show selectable time-slot cards → user confirms → THEN book
- Support rescheduling and cancellation
- Prevent double-booking: check slot uniqueness in DB
- Expired-slot detection and fresh availability check
- Recovery if user closes browser and returns (restore from SqliteSaver)
- Clear distinction in UI between "Pending confirmation" vs "Confirmed booking"
- Use a database-backed booking record (SQLite table), NOT LLM memory

### Feature 3 — Trustworthy RAG with Evidence & Abstention
For every handbook question display:
- Generated answer
- Document name + exact source page
- A clickable citation badge opening the relevant excerpt
- Retrieved evidence snippets (collapsible)
- "Handbook doesn't contain enough information" message when confidence is low
- Hybrid retrieval: keyword + semantic search (BM25 + vector)
- Rerank retrieved chunks before generation
- Configurable confidence threshold with safe fallback

### Feature 4 — Context Switching that Genuinely Works
Go beyond the sample dialogue:
- User asks 2–3 unrelated FAQs mid-booking without losing state
- User changes preferred slot after asking FAQs
- Ambiguous message like "Friday works" correctly routes
- User sends a second booking without completing the first
- Store state using LangGraph fields: `booking_status`, `name`, `email`, `selected_slot`, `pending_action`
- Route the new message without resetting existing booking state

### Feature 5 — Prompt Injection & Data-Leak Protection
Build a security layer:
- Reject malicious prompts attempting to leak system instructions or bypass tool permissions
- Input validation: validate email format, slot IDs, required fields on every booking action
- Treat retrieved PDF content as untrusted evidence (not instructions)
- Sensitive data protection: never log PII, never expose API keys
- Safe error messages: return useful errors without revealing stack traces or internals
- Add a small test suite: assert the assistant refuses unauthorized actions while still answering legitimate handbook questions

### Feature 6 — Agent Evaluation Lab
Build a test runner dashboard with these test categories:

| Category | What it verifies |
|----------|-----------------|
| FAQ accuracy | Does the answer match the handbook? |
| Citation correctness | Does the cited page support the answer? |
| Intent routing | Does the correct agent handle the request? |
| Context retention | Are booking fields preserved? |
| Tool correctness | Is booking created only after valid confirmation? |
| Security | Are malicious instructions rejected safely? |
| Error recovery | Can the agent recover from unavailable slot or model error? |

Display metrics: overall pass rate, routing rate, citation correctness rate, booking success, duplicate-booking prevention, avg response latency, failure cases with expected vs actual.

Use deterministic tests for state transitions and routing rules.

### Feature 7 — Persistent Conversations & Resumable Workflows
Make the assistant feel like a real application (not a temporary chat):
- Left sidebar with multiple conversation threads
- Thread titles with rename option
- Visible active thread ID
- Booking progress restored when thread is reopened
- Way to start a fresh conversation without affecting existing ones
- Use SQLite for durable local development + LangGraph-compatible persistent checkpointer
- Test recovery after restarting the backend (not just refreshing frontend)

### Feature 8 — Document Management & RAG Diagnostics Panel
Small developer-facing document panel showing:
- Upload and index an additional PDF
- Show document processing status and errors
- Display chunk count, page metadata, and indexing status
- Preview retrieved chunks for a test query
- Re-index a document after it changes
- Track document statistics to avoid saving stale information

---

## Repository Structure

```
/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── graph/
│   │   ├── state.py             # TypedDict state schema
│   │   ├── graph.py             # LangGraph StateGraph definition
│   │   ├── nodes/
│   │   │   ├── router.py        # Router node
│   │   │   ├── rag.py           # FAQ RAG node
│   │   │   ├── booking.py       # Booking node
│   │   │   └── summarizer.py    # Summarizer node (bonus)
│   │   └── checkpointer.py      # SqliteSaver setup
│   ├── rag/
│   │   ├── ingestor.py          # PDF download + chunking + embedding
│   │   ├── retriever.py         # Hybrid retrieval (BM25 + vector)
│   │   └── evaluator.py         # RAG evaluation metrics
│   ├── tools/
│   │   ├── booking_tool.py      # Slot booking tool
│   │   └── slots.py             # Slot availability logic
│   ├── security/
│   │   └── guardrails.py        # Prompt injection / PII protection
│   ├── tests/
│   │   └── eval_runner.py       # Feature 6 evaluation suite
│   ├── db/
│   │   └── database.py          # SQLite booking records
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── ChatWindow.jsx        # Main chat UI
│   │   │   ├── AgentTimeline.jsx     # Feature 1: live agent steps
│   │   │   ├── BookingCard.jsx       # Feature 2: confirm/reschedule
│   │   │   ├── CitationBadge.jsx     # Feature 3: evidence badge
│   │   │   ├── ThreadSidebar.jsx     # Feature 7: thread list
│   │   │   ├── EvalDashboard.jsx     # Feature 6: eval lab
│   │   │   └── DocPanel.jsx          # Feature 8: doc management
│   │   └── hooks/
│   │       ├── useSSE.js             # SSE event consumer
│   │       └── useThread.js          # Thread state management
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml               # Bonus
├── Dockerfile.backend               # Bonus
├── .env.example
└── README.md
```

---

## Environment Variables (.env.example)

```env
# LLM
GROQ_API_KEY=your_groq_api_key_here

# Vector DB (local, no key needed for ChromaDB)
CHROMA_PERSIST_DIR=./data/chroma

# SQLite (LangGraph checkpointer + bookings)
SQLITE_DB_PATH=./data/agent_state.db

# Backend
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
CORS_ORIGINS=http://localhost:5173

# RAG
PDF_CHUNK_SIZE=800
PDF_CHUNK_OVERLAP=150
RAG_CONFIDENCE_THRESHOLD=0.7
```

---

## LangGraph State Schema

```python
from typing import TypedDict, Optional, Literal, List

class AgentState(TypedDict):
    # Core
    messages: List[dict]
    thread_id: str
    current_node: str

    # Routing
    intent: Optional[Literal["faq", "booking", "context_switch", "unknown"]]

    # Booking state (MUST persist across turns)
    booking_status: Optional[Literal[
        "idle", "collecting_info", "slot_selection",
        "pending_confirmation", "confirmed", "cancelled"
    ]]
    name: Optional[str]
    email: Optional[str]
    selected_slot: Optional[str]
    booking_ref_id: Optional[str]
    pending_action: Optional[str]

    # RAG
    retrieved_chunks: Optional[List[dict]]   # includes page, doc_name, text
    rag_confidence: Optional[float]
    citations: Optional[List[dict]]

    # Streaming
    streaming_events: Optional[List[dict]]   # sent to frontend via SSE

    # Security
    injection_detected: Optional[bool]
```

---

## API Contract

### POST /api/chat
```json
Request:  { "message": "string", "thread_id": "string" }
Response: text/event-stream (SSE)
  event: node_change     data: { "node": "router|rag|booking" }
  event: token           data: { "token": "partial text" }
  event: citation        data: { "page": 4, "doc": "Employee Handbook", "snippet": "..." }
  event: booking_card    data: { "slots": [...], "status": "pending_confirmation" }
  event: done            data: { "thread_id": "...", "ref_id": "..." }
  event: error           data: { "message": "safe error message" }
```

### GET /api/slots
```json
Response: { "slots": [{ "id": "s1", "label": "Tomorrow 11:00 AM", "available": true }] }
```

### GET /api/threads
```json
Response: { "threads": [{ "id": "...", "title": "...", "updated_at": "..." }] }
```

---

## Evaluation Criteria (from assessment)

| Criteria | Weight | What evaluators look for |
|----------|--------|--------------------------|
| LangGraph Architecture | **35%** | StateGraph nodes/edges, conditional router, multi-turn checkpointer persistence |
| Backend API | **25%** | Async endpoints, clean separation of API vs graph layers, error handling |
| Frontend UI | **20%** | Responsive chat UI, session thread management, loading/error states |
| PDF RAG & Tool Execution | **15%** | Accurate chunking/retrieval, source citations, reliable booking tool |
| Documentation & AI Log | **5%** | Setup steps, screenshots/traces, transparent AI Engineering Log |

---

## README Requirements (mandatory)

1. **Architecture Walkthrough** — diagram of LangGraph nodes, edges, state flow
2. **Local Execution Guide** — step-by-step: install deps, run backend, run frontend
3. **AI Engineering Log** — list tools used (Claude, Cursor, etc.), document where LLM hallucinated and how you fixed it
4. **Verification Artifacts** — screenshots / logs of RAG retrieval, multi-turn booking, context switching

---

## Key Implementation Rules

1. **Do NOT use LLM memory as a booking database** — use a real SQLite bookings table
2. **Checkpointer must survive backend restart** — SqliteSaver, not MemorySaver
3. **Every RAG answer must have a page citation** — never return an answer without sourcing
4. **Slot confirmation flow**: fetch → display cards → user selects → user confirms → THEN write to DB
5. **Double-booking prevention**: check slot uniqueness before confirming
6. **SSE streaming**: stream tokens AND agent node change events
7. **Security**: strip/reject injection attempts before they reach the LLM
8. **Test suite**: Feature 6 eval tests must run with `pytest` or a script and produce a report

---

## Do NOT Do

- Do not mix office GitHub (Keerthana-PayTap) with this project — use techWithKeerthana
- Do not use MemorySaver for production checkpointing (doesn't survive restart)
- Do not fake confidence percentages without a real computation
- Do not commit `.env` files — only `.env.example`
- Do not invent booking records in the LLM — always use the DB
- Do not block on PDF ingestion at startup — do it async or on first request

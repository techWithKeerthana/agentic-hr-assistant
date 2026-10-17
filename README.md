# NexaHR — Intelligent HR Assistant

A full-stack agentic AI system that answers HR policy questions via a knowledge base and books appointments through a multi-turn conversational workflow, with real-time SSE streaming and JWT authentication.

---

## 🚀 Live Demo

**[https://nexa-hr-assistant.vercel.app](https://nexa-hr-assistant.vercel.app)**

> **Note:** The backend runs on Render's free tier and spins down after inactivity. The first load may take **30–60 seconds** to wake up. The login page shows a live "Connecting to server..." indicator while this happens.

Backend API: [https://nexa-hr-backend-v2z6.onrender.com](https://nexa-hr-backend-v2z6.onrender.com)

---

## ✨ Features

| # | Feature | Description |
|---|---------|-------------|
| 🤖 | **Agentic AI Chat** | LangGraph StateGraph with a router node that classifies intent and dispatches to a RAG node or booking node |
| 📚 | **HR Knowledge Base** | Keyword search over plain-text HR documents (working hours, leave policy, benefits, interview process, general HR policies) |
| 📅 | **Interview Booking System** | 6-state machine: `idle → collecting_info → slot_selection → pending_confirmation → confirmed / cancelled` with double-booking prevention |
| 🔐 | **JWT Authentication** | Register/login with bcrypt password hashing, rate limiting (slowapi), auto-logout on token expiry |
| 🔒 | **Strong Password Validation** | Live strength meter (5-segment bar), per-requirement checklist, score gate on registration |
| 📊 | **HR Analytics Dashboard** | Booking stats, status breakdown (confirmed/cancelled/pending), hourly distribution, recent activity |
| ✏️ | **Reschedule & Cancel** | Users can reschedule or cancel confirmed bookings from the dashboard |
| 🎙️ | **Voice Input / TTS** | Web Speech API for voice messages (Chrome); text-to-speech reads assistant replies aloud |
| ⚡ | **Real-time SSE Streaming** | Token-by-token responses streamed via Server-Sent Events; agent node change events surfaced live |
| 🌙 | **Dark Theme UI** | CSS design tokens, dark/light/system theming, time-based greeting, animated typing indicator |
| 🧵 | **Persistent Threads** | SqliteSaver checkpointer survives backend restarts; thread sidebar with rename/delete |

---

## 🏗️ Architecture

```
React Frontend (Vite + Tailwind) ──── Vercel
    │
    ├── POST /api/chat   (SSE streaming)
    ├── GET  /api/slots
    ├── GET  /api/threads
    └── GET  /api/health
         │
    FastAPI Backend (Python 3.11, async) ──── Render
         │
    LangGraph StateGraph
    ┌────────────────────────────────────────┐
    │           [ Router Node ]              │
    │          /              \              │
    │  [ RAG Node ]     [ Booking Node ]     │
    │  (keyword search   (6-state machine,   │
    │   on HR .txt docs)  SQLite bookings)   │
    │          \              /              │
    │        [ SqliteSaver Checkpointer ]    │
    │        (keyed by thread_id)            │
    └────────────────────────────────────────┘
         │
    SQLite  ── bookings, users, threads, slots
    HR Docs ── backend/data/hr_docs/*.txt
```

**State flow:**

1. User message arrives at `POST /api/chat`
2. Router node classifies intent: `faq | booking | context_switch | unknown`
3. `faq` / `context_switch` → RAG node → keyword retrieval → LLM response with citation
4. `booking` → Booking node → 6-state machine, slot cards via SSE `booking_card` event
5. State persists across requests via `SqliteSaver` keyed by `thread_id`
6. Tokens and node-change events stream back as SSE to the frontend

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Agent Framework | LangGraph ≥ 1.0 (StateGraph, AsyncSqliteSaver checkpointer) |
| Backend | Python 3.11 · FastAPI · async · SSE streaming |
| LLM | Groq API — `qwen/qwen3-32b` (fast, free tier) |
| Knowledge Base | Plain `.txt` HR documents, keyword scoring (zero ML dependencies) |
| Frontend | React 18 · Vite · Tailwind CSS |
| Auth | python-jose (JWT) · bcrypt · slowapi rate limiting |
| Database | SQLite (bookings + users + threads + slots + LangGraph checkpointer) |
| Deployment | Render (backend) · Vercel (frontend) |

---

## 🚦 Quick Start (Local)

### Prerequisites

- Python 3.11
- Node.js 18+
- Groq API key — free at [console.groq.com](https://console.groq.com)

### 1. Clone

```bash
git clone https://github.com/techWithKeerthana/agentic-hr-assistant.git
cd agentic-hr-assistant
```

### 2. Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Configure environment
cp ../.env.example .env
# Edit .env — set GROQ_API_KEY and JWT_SECRET at minimum

# Start backend
uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

The backend will:
1. Initialize SQLite tables and seed 10 appointment slots
2. Load HR knowledge base from `data/hr_docs/*.txt` on first chat request
3. Stream SSE events on `POST /api/chat`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## 📁 Project Structure

```
/
├── backend/
│   ├── main.py                     # FastAPI app, all API endpoints
│   ├── graph/
│   │   ├── state.py                # AgentState TypedDict schema
│   │   ├── graph.py                # LangGraph StateGraph definition
│   │   ├── checkpointer.py         # AsyncSqliteSaver setup
│   │   └── nodes/
│   │       ├── router.py           # Intent classifier node
│   │       ├── rag.py              # FAQ retrieval + LLM node
│   │       ├── booking.py          # 6-state booking node
│   │       └── summarizer.py       # Session summarizer node
│   ├── rag/
│   │   ├── ingestor.py             # Loads .txt HR docs, keyword retrieve()
│   │   ├── retriever.py            # Thin wrapper around ingestor.retrieve()
│   │   └── evaluator.py            # Citation extraction + confidence scoring
│   ├── data/
│   │   └── hr_docs/                # Plain-text HR knowledge base
│   │       ├── working_hours.txt
│   │       ├── leave_policy.txt
│   │       ├── benefits.txt
│   │       ├── interview_process.txt
│   │       └── general_hr.txt
│   ├── db/
│   │   └── database.py             # SQLite: bookings, users, threads, slots
│   ├── security/
│   │   └── guardrails.py           # Injection detection, email validation, PII masking
│   ├── tests/
│   │   └── eval_runner.py          # Evaluation test suite
│   ├── .python-version             # 3.11.0 — pins Python for Render
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Root: auth, routing, toast system, authFetch
│   │   ├── config.js               # API_URL from VITE_API_URL env var
│   │   ├── components/
│   │   │   ├── ChatWindow.jsx      # Main chat UI, SSE consumer, booking cards
│   │   │   ├── AgentTimeline.jsx   # Live node execution timeline
│   │   │   ├── BookingCard.jsx     # Slot selection + confirmation card
│   │   │   ├── CitationBadge.jsx   # Source citation badges
│   │   │   ├── ThreadSidebar.jsx   # Conversation thread list
│   │   │   ├── Dashboard.jsx       # Analytics dashboard
│   │   │   ├── EvalDashboard.jsx   # Evaluation lab UI
│   │   │   ├── DocPanel.jsx        # Document management panel
│   │   │   └── AuthPage.jsx        # Login/register with password strength meter
│   │   └── hooks/
│   │       ├── useSSE.js           # SSE fetch hook with 60s timeout
│   │       └── useThread.js        # Thread state management
│   ├── .env.development            # VITE_API_URL=http://localhost:8080
│   ├── .env.production             # VITE_API_URL=https://nexa-hr-backend-v2z6.onrender.com
│   ├── vercel.json                 # SPA rewrite rules
│   └── package.json
├── .env.example
└── README.md
```

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ | Groq API key from console.groq.com |
| `JWT_SECRET` | ✅ | Secret key for signing JWT tokens (use a long random string) |
| `CORS_ORIGINS` | | Comma-separated allowed origins (default: `http://localhost:5173`) |
| `SQLITE_DB_PATH` | | Path to SQLite database (default: `./data/agent_state.db`) |
| `HR_DOCS_DIR` | | Path to HR docs directory (default: `./data/hr_docs`) |
| `BACKEND_PORT` | | Port for uvicorn (default: `8000`) |

### Frontend (`frontend/.env.development` / `.env.production`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend URL — `http://localhost:8080` for dev, Render URL for production |

---

## 🔄 Booking Flow

```
User: "I want to book an appointment"
Bot:  "Please provide your full name and email."

User: "Jane Smith, jane@company.com"
Bot:  "Thanks Jane! Select a time slot:" [slot cards]

User: "What's the leave policy?"  ← FAQ interruption mid-booking
Bot:  "Per the HR handbook, employees receive 15 days PTO..."
      "Returning to your appointment booking..."

User: "Tuesday 11 AM" (slot s3)
Bot:  "Booking summary: Jane Smith · jane@company.com · Tuesday 11 AM. Confirm?"

User: "Yes, confirm"
Bot:  "✅ Confirmed! Booking reference: REV-A3F2B1C4"
```

LangGraph preserves `name`, `email`, and `booking_status` in the SqliteSaver checkpointer across the FAQ detour and across HTTP requests.

---

## 🤖 AI Engineering Log

### Tools Used
- **Claude (Anthropic)** — architecture design, LangGraph graph wiring, SSE streaming logic, auth system, UI components
- **Groq (qwen/qwen3-32b)** — production LLM for intent routing, RAG generation, and name/email extraction

### Where LLMs Hallucinated and How I Fixed It

1. **Qwen model JSON output** — The Qwen model wraps every response in `<think>...</think>` tags and markdown code fences. `json.loads` threw on every call, causing the booking node to fail name extraction and loop forever re-asking for name/email. Fixed by stripping `<think>` blocks and ` ``` ` fences before JSON parsing, with a regex fallback for name (title-case word pairs) and email.

2. **AsyncSqliteSaver initialization** — LLM suggested `AsyncSqliteSaver.from_conn_string(path)` which doesn't exist in LangGraph 1.x. Correct API is `await aiosqlite.connect(path)` then `AsyncSqliteSaver(conn)`.

3. **LangGraph streaming** — Claude initially suggested `graph.stream()` which is synchronous and blocks the async event loop. Fixed by using `graph.astream_events(version="v2")` with `async for`.

4. **ChromaDB OOM on Render free tier** — Initial architecture used ChromaDB + sentence-transformers (~400 MB RAM). Render free tier has 512 MB limit. Replaced with zero-dependency keyword search on plain `.txt` files (~5 MB RAM).

5. **Booking state reset on context switch** — Router node was overwriting all state fields. Fixed by spreading `{**state, ...}` in the router return so only `intent`, `current_node`, and `streaming_events` change.

---

## 📄 License

MIT — built as a 72-hour internship technical assessment.

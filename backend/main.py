import os
import re
import json
import uuid
import asyncio
import logging
import threading
from datetime import datetime
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile, File, Header, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from db.database import (
    init_db, seed_slots, get_available_slots, get_connection, _row,
    list_threads, delete_thread, upsert_thread, get_booking_by_thread,
)
from graph.graph import get_graph, build_graph, set_graph
from graph.checkpointer import init_checkpointer
from rag.ingestor import ingest_all_pdfs, ingest_if_needed, ingest_additional_pdf, get_doc_stats
from security.guardrails import check_injection, sanitize_input
from auth.auth import hash_password, verify_password, create_token, decode_token


_rag_ready = False
_rag_lock = threading.Lock()


def ensure_rag_ready():
    """Lazy-init ChromaDB on the first RAG query — keeps startup fast and under 512 MB."""
    global _rag_ready
    if _rag_ready:
        return
    with _rag_lock:
        if not _rag_ready:
            try:
                ingest_if_needed()
            except Exception as e:
                logger.warning(f"ensure_rag_ready: {e}")
            _rag_ready = True


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_slots()
    logger.info("Database and slots initialized — RAG deferred to first query")
    checkpointer = await init_checkpointer()
    graph = build_graph(checkpointer)
    set_graph(graph)
    logger.info("LangGraph initialized with AsyncSqliteSaver")
    yield



app = FastAPI(title="Agentic HR Assistant", lifespan=lifespan)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS + ["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    thread_id: str = ""


def sse_event(event_type: str, data: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


async def stream_graph_response(message: str, thread_id: str):
    """Stream LangGraph events as SSE."""
    ensure_rag_ready()
    graph = get_graph()
    if graph is None:
        yield sse_event("error", {"message": "System is initializing. Please try again in a moment."})
        yield sse_event("done", {"thread_id": thread_id, "ref_id": None})
        return

    # Security check first
    sanitized = sanitize_input(message)
    if check_injection(sanitized):
        yield sse_event("error", {"message": "Your message was flagged for security reasons. Please rephrase."})
        yield sse_event("done", {"thread_id": thread_id, "ref_id": None})
        return

    config = {"configurable": {"thread_id": thread_id}}
    input_state = {
        "messages": [{"role": "user", "content": sanitized}],
        "thread_id": thread_id,
        "current_node": "entry",
    }

    try:
        # Emit start event
        yield sse_event("node_change", {"node": "router", "description": "Processing your message..."})

        final_state = None
        emitted_start_nodes: set = set()
        emitted_end_nodes: set = set()

        async for event in graph.astream_events(input_state, config, version="v2"):
            kind = event.get("event", "")
            metadata = event.get("metadata", {})

            # Node name is in metadata["langgraph_node"] for LangGraph 1.x
            lg_node = metadata.get("langgraph_node", "") or event.get("name", "")

            if kind == "on_chain_start" and lg_node in ("router", "rag", "booking"):
                if lg_node not in emitted_start_nodes:
                    emitted_start_nodes.add(lg_node)
                    labels = {"router": "Router Agent", "rag": "RAG Retrieval", "booking": "Booking Agent"}
                    descs = {"router": "Classifying intent...", "rag": "Searching handbook...", "booking": "Processing booking..."}
                    yield sse_event("node_change", {
                        "node": lg_node,
                        "display_name": labels.get(lg_node, lg_node),
                        "description": descs.get(lg_node, ""),
                        "status": "running",
                    })

            elif kind == "on_chain_end" and lg_node in ("router", "rag", "booking"):
                # Only process the first on_chain_end per node to avoid duplicate emissions
                if lg_node in emitted_end_nodes:
                    continue
                emitted_end_nodes.add(lg_node)

                output = event.get("data", {}).get("output", {})
                if not isinstance(output, dict):
                    continue

                # Emit streaming events from state
                for ev in output.get("streaming_events", []) or []:
                    ev_type = ev.get("type", "info")
                    if ev_type == "node_change":
                        yield sse_event("node_change", {
                            "node": ev.get("node", ""),
                            "description": ev.get("description", ""),
                        })
                    elif ev_type == "booking_card":
                        yield sse_event("booking_card", {k: v for k, v in ev.items() if k != "type"})
                    elif ev_type == "retrieval_status":
                        yield sse_event("retrieval_status", {k: v for k, v in ev.items() if k != "type"})
                    elif ev_type == "booking_confirmed":
                        yield sse_event("booking_confirmed", {k: v for k, v in ev.items() if k != "type"})
                    elif ev_type == "follow_up_questions":
                        yield sse_event("followup_questions", {"questions": ev.get("questions", [])})

                # Emit citations only from the RAG node (not accumulated from prior turns)
                if lg_node == "rag":
                    for citation in output.get("citations", []) or []:
                        yield sse_event("citation", citation)

                # Emit only the LAST assistant message (newest answer, not accumulated history)
                all_msgs = output.get("messages", []) or []
                last_assistant = None
                for msg in reversed(all_msgs):
                    if isinstance(msg, dict) and msg.get("role") == "assistant":
                        last_assistant = msg
                        break
                if last_assistant:
                    content = last_assistant.get("content", "")
                    words = content.split(" ")
                    for i, word in enumerate(words):
                        token = word + (" " if i < len(words) - 1 else "")
                        yield sse_event("token", {"token": token})
                        await asyncio.sleep(0.01)

                # Mark this node completed in the timeline
                yield sse_event("node_change", {"node": lg_node, "status": "completed"})

                final_state = output

        # Upsert thread — create with title on first message, update timestamp on all messages
        if thread_id:
            existing_threads = list_threads()
            existing = next((t for t in existing_threads if t["id"] == thread_id), None)
            if not existing:
                title = sanitized[:40] + ("..." if len(sanitized) > 40 else "")
                upsert_thread(thread_id, title)
            else:
                # Touch updated_at so sidebar stays sorted by recent activity
                upsert_thread(thread_id, existing["title"])

        ref_id = None
        if final_state:
            ref_id = final_state.get("booking_ref_id")

        yield sse_event("done", {"thread_id": thread_id, "ref_id": ref_id})

    except Exception as e:
        logger.error(f"Graph stream error: {e}")
        yield sse_event("error", {"message": "An error occurred. Please try again."})
        yield sse_event("done", {"thread_id": thread_id, "ref_id": None})


def validate_password(password: str) -> tuple[bool, str]:
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r'\d', password):
        return False, "Password must contain at least one number"
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain at least one special character"
    return True, ""


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/api/auth/register")
@limiter.limit("3/minute")
async def register(request: Request, body: RegisterRequest):
    if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', body.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    if len(body.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Name must be at least 2 characters")
    valid, msg = validate_password(body.password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)
    conn = get_connection()
    existing = _row(conn.execute("SELECT id FROM users WHERE email=?", (body.email.lower(),)).fetchone())
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    try:
        conn.execute(
            "INSERT INTO users (id, name, email, password_hash) VALUES (?,?,?,?)",
            (user_id, body.name, body.email.lower(), hash_password(body.password)),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail="Could not create account")
    conn.close()
    token = create_token({"user_id": user_id, "email": body.email.lower(), "name": body.name})
    return {"token": token, "name": body.name, "email": body.email.lower()}


@app.post("/api/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest):
    conn = get_connection()
    user = _row(conn.execute("SELECT * FROM users WHERE email=?", (body.email.lower(),)).fetchone())
    conn.close()
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token({
        "user_id": user["id"],
        "email": user["email"],
        "name": user["name"],
    })
    return {"token": token, "name": user["name"], "email": user["email"]}


@app.get("/api/auth/me")
async def get_me(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(authorization.split(" ")[1])
        return {"name": payload["name"], "email": payload["email"]}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@app.post("/api/chat")
async def chat(request: ChatRequest):
    thread_id = request.thread_id or str(uuid.uuid4())
    return StreamingResponse(
        stream_graph_response(request.message, thread_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/slots")
async def get_slots():
    slots = get_available_slots()
    return {"slots": slots}


@app.get("/api/threads")
async def get_threads():
    threads = list_threads()
    return {"threads": threads}


@app.delete("/api/threads/{thread_id}")
async def delete_thread_endpoint(thread_id: str):
    delete_thread(thread_id)
    return {"success": True}


@app.get("/api/threads/{thread_id}/booking")
async def get_thread_booking_endpoint(thread_id: str):
    booking = get_booking_by_thread(thread_id)
    return {"booking": booking}


@app.get("/api/threads/{thread_id}/messages")
async def get_thread_messages(thread_id: str):
    """Return the message history for a thread from the LangGraph checkpointer."""
    from graph.checkpointer import get_checkpointer
    checkpointer = get_checkpointer()
    if not checkpointer:
        return {"messages": [], "booking_status": None}
    config = {"configurable": {"thread_id": thread_id}}
    try:
        checkpoint_tuple = await checkpointer.aget_tuple(config)
        if not checkpoint_tuple:
            return {"messages": [], "booking_status": None}
        state = checkpoint_tuple.checkpoint.get("channel_values", {})
        messages = state.get("messages", [])
        filtered = [m for m in messages if isinstance(m, dict) and m.get("role") in ("user", "assistant")]
        return {
            "messages": filtered,
            "booking_status": state.get("booking_status"),
            "name": state.get("name"),
            "email": state.get("email"),
        }
    except Exception as e:
        logger.error(f"Thread messages error: {e}")
        return {"messages": [], "booking_status": None}


class ThreadPatchRequest(BaseModel):
    title: str


@app.patch("/api/threads/{thread_id}")
async def patch_thread(thread_id: str, body: ThreadPatchRequest):
    """Rename a thread."""
    upsert_thread(thread_id, body.title[:60])
    return {"success": True}


@app.post("/api/docs/query")
async def query_doc_chunks(body: dict):
    """Alias for /api/docs/preview used by DocPanel."""
    query = body.get("query", "")
    from rag.ingestor import get_vectorstore
    from rag.retriever import preview_chunks
    vs = get_vectorstore()
    if not vs:
        return {"chunks": []}
    chunks = preview_chunks(query, vs)
    return {"chunks": chunks}


@app.get("/api/docs")
async def list_docs():
    stats = get_doc_stats()
    return {"documents": stats}


@app.post("/api/docs/upload")
async def upload_doc(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    import tempfile
    tmp_path = Path(tempfile.gettempdir()) / file.filename
    tmp_path.write_bytes(await file.read())
    try:
        result = await ingest_additional_pdf(tmp_path, file.filename.replace(".pdf", ""))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/docs/preview")
async def preview_doc_chunks(body: dict):
    query = body.get("query", "")
    from rag.ingestor import get_vectorstore
    from rag.retriever import preview_chunks
    vs = get_vectorstore()
    if not vs:
        return {"chunks": []}
    chunks = preview_chunks(query, vs)
    return {"chunks": chunks}


@app.post("/api/eval/run")
async def run_eval():
    from tests.eval_runner import run_all_tests
    results = await run_all_tests()
    return results


@app.get("/api/bookings/{booking_id}")
async def get_booking_endpoint(booking_id: int):
    conn = get_connection()
    row = _row(conn.execute("SELECT * FROM bookings WHERE id=?", (booking_id,)).fetchone())
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found")
    return row


@app.post("/api/bookings/{booking_id}/cancel")
async def cancel_booking_endpoint(booking_id: int):
    conn = get_connection()
    row = _row(conn.execute("SELECT * FROM bookings WHERE id=?", (booking_id,)).fetchone())
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Booking not found")
    if row["status"] == "cancelled":
        conn.close()
        raise HTTPException(status_code=400, detail="Already cancelled")
    try:
        conn.execute("UPDATE slots SET available=1 WHERE id=?", (row["slot_id"],))
        conn.execute(
            "UPDATE bookings SET status='cancelled', updated_at=? WHERE id=?",
            (datetime.now().isoformat(), booking_id),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail="Could not cancel booking")
    conn.close()
    return {"success": True, "message": "Booking cancelled"}


@app.post("/api/bookings/{booking_id}/reschedule")
async def reschedule_booking_endpoint(booking_id: int, body: dict):
    new_slot_id = body.get("new_slot_id")
    if not new_slot_id:
        raise HTTPException(status_code=400, detail="new_slot_id required")
    conn = get_connection()
    booking = _row(conn.execute("SELECT * FROM bookings WHERE id=?", (booking_id,)).fetchone())
    if not booking:
        conn.close()
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["status"] == "cancelled":
        conn.close()
        raise HTTPException(status_code=400, detail="Cannot reschedule cancelled booking")
    now_iso = datetime.now().isoformat()
    new_slot = _row(conn.execute(
        "SELECT * FROM slots WHERE id=? AND available=1 AND datetime_iso>?",
        (new_slot_id, now_iso),
    ).fetchone())
    if not new_slot:
        conn.close()
        raise HTTPException(status_code=400, detail="Slot not available")
    try:
        conn.execute("UPDATE slots SET available=1 WHERE id=?", (booking["slot_id"],))
        conn.execute("UPDATE slots SET available=0 WHERE id=?", (new_slot_id,))
        conn.execute(
            "UPDATE bookings SET slot_id=?, slot_label=?, status='confirmed', updated_at=? WHERE id=?",
            (new_slot_id, new_slot["label"], datetime.now().isoformat(), booking_id),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail="Could not reschedule booking")
    conn.close()
    return {"success": True, "message": f"Rescheduled to {new_slot['label']}"}


@app.get("/api/analytics/summary")
async def get_analytics_summary():
    """Live booking stats for the HR Analytics Dashboard."""
    conn = get_connection()
    now_iso = datetime.now().isoformat()

    total = _row(conn.execute("SELECT COUNT(*) as count FROM bookings").fetchone())["count"]

    by_status = [_row(r) for r in conn.execute(
        "SELECT status, COUNT(*) as count FROM bookings GROUP BY status"
    ).fetchall()]

    by_hour = [_row(r) for r in conn.execute("""
        SELECT
            CASE
                WHEN SUBSTR(slot_label, INSTR(slot_label, '- ') + 8, 2) = 'PM'
                     AND CAST(SUBSTR(slot_label, INSTR(slot_label, '- ') + 2, 2) AS INTEGER) != 12
                THEN CAST(SUBSTR(slot_label, INSTR(slot_label, '- ') + 2, 2) AS INTEGER) + 12
                WHEN SUBSTR(slot_label, INSTR(slot_label, '- ') + 8, 2) = 'AM'
                     AND CAST(SUBSTR(slot_label, INSTR(slot_label, '- ') + 2, 2) AS INTEGER) = 12
                THEN 0
                ELSE CAST(SUBSTR(slot_label, INSTR(slot_label, '- ') + 2, 2) AS INTEGER)
            END as hour,
            COUNT(*) as count
        FROM bookings
        WHERE slot_label IS NOT NULL AND slot_label LIKE '%- %'
        GROUP BY hour
        ORDER BY hour
    """).fetchall()]

    recent = [_row(r) for r in conn.execute("""
        SELECT id, ref_id, name, email, slot_label, status, created_at
        FROM bookings ORDER BY created_at DESC LIMIT 5
    """).fetchall()]

    available_slots = _row(conn.execute(
        "SELECT COUNT(*) as count FROM slots WHERE available=1 AND datetime_iso>?",
        (now_iso,),
    ).fetchone())["count"]

    conn.close()

    return {
        "total_bookings": total,
        "available_slots": available_slots,
        "by_status": by_status,
        "by_hour": by_hour,
        "recent_bookings": recent,
    }


@app.get("/api/health")
async def health():
    from rag.ingestor import get_vectorstore
    vs = get_vectorstore()
    return {
        "status": "ok",
        "vectorstore_ready": vs is not None,
    }


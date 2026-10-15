import os
import json
import uuid
import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from db.database import (
    init_db, get_available_slots, list_threads, delete_thread,
    upsert_thread, get_booking_by_thread
)
from graph.graph import get_graph, build_graph, set_graph
from graph.checkpointer import init_checkpointer
from rag.ingestor import ingest_all_pdfs, ingest_additional_pdf, get_doc_stats
from security.guardrails import check_injection, sanitize_input


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("Database initialized")
    # Initialize async checkpointer and build the graph
    checkpointer = await init_checkpointer()
    graph = build_graph(checkpointer)
    set_graph(graph)
    logger.info("LangGraph initialized with AsyncSqliteSaver")
    # Ingest PDFs in background
    asyncio.create_task(ingest_all_pdfs())
    yield


app = FastAPI(title="Agentic HR Assistant", lifespan=lifespan)

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


@app.get("/api/health")
async def health():
    from rag.ingestor import get_vectorstore
    vs = get_vectorstore()
    return {
        "status": "ok",
        "vectorstore_ready": vs is not None,
    }


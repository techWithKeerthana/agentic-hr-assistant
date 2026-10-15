import os
import logging
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from graph.state import AgentState
from rag.retriever import retrieve
from rag.evaluator import extract_citations, compute_citation_confidence
from rag import ingestor

logger = logging.getLogger(__name__)

RAG_SYSTEM = """You are a helpful HR assistant answering questions from the employee handbook.

Rules:
1. Answer ONLY based on the retrieved context provided.
2. Always cite sources inline as (Employee Handbook, Page X) or (Northwind Benefits, Page X).
3. If the context does not contain enough information, say so clearly.
4. Be concise and professional.
5. Never make up information not present in the context.

Retrieved context:
{context}"""


def get_llm():
    return ChatGroq(
        model="qwen/qwen3.8-27b",
        temperature=0,
        api_key=os.getenv("GROQ_API_KEY"),
        streaming=True,
    )


def rag_node(state: AgentState) -> AgentState:
    # Injection detected upstream â€” return safe refusal without touching LLM
    if state.get("injection_detected"):
        return {
            **state,
            "current_node": "rag",
            "retrieved_chunks": [],
            "rag_confidence": 0.0,
            "citations": [],
            "streaming_events": [{"type": "node_change", "node": "rag", "description": "Security violation blocked"}],
            "messages": [{"role": "assistant", "content": "I'm unable to process that request. If you have a genuine HR question, please rephrase it."}],
        }

    messages = state.get("messages", [])
    last_message = messages[-1].get("content", "") if messages else ""

    vs = ingestor.get_vectorstore()
    events = [{"type": "node_change", "node": "rag", "description": "Searching handbook..."}]

    if vs is None:
        answer = "The knowledge base is still loading. Please try again in a moment."
        return {
            **state,
            "current_node": "rag",
            "retrieved_chunks": [],
            "rag_confidence": 0.0,
            "citations": [],
            "streaming_events": events,
            "messages": [{"role": "assistant", "content": answer}],
        }

    result = retrieve(last_message, vs)
    chunks = result["chunks"]
    confidence = result["confidence"]
    abstain = result["abstain"]

    events.append({
        "type": "retrieval_status",
        "chunk_count": len(chunks),
        "confidence": confidence,
        "abstain": abstain,
    })

    if abstain or not chunks:
        answer = "The employee handbook doesn't contain enough information to answer this question confidently. Please contact HR directly for assistance."
        citations = []
    else:
        context_str = "\n\n---\n\n".join(
            f"[{c['doc_name']}, Page {c['page_number']}]\n{c['text']}"
            for c in chunks
        )
        llm = get_llm()
        response = llm.invoke([
            SystemMessage(content=RAG_SYSTEM.format(context=context_str)),
            HumanMessage(content=last_message),
        ])
        answer = response.content
        citations = extract_citations(chunks)
        confidence = compute_citation_confidence(chunks, answer)

    # If user was mid-booking, append a reminder to resume
    pending = state.get("pending_action")
    booking_status = state.get("booking_status")
    if pending == "resume_booking" or booking_status in ("collecting_info", "slot_selection", "pending_confirmation"):
        answer += "\n\n---\n*Returning to your appointment booking â€” where we left off...*"
        events.append({"type": "node_change", "node": "rag", "description": "Resuming booking flow"})

    return {
        **state,
        "current_node": "rag",
        "retrieved_chunks": chunks,
        "rag_confidence": confidence,
        "citations": citations,
        "streaming_events": events,
        "messages": [{"role": "assistant", "content": answer}],
    }




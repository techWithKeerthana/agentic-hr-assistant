import os
import logging
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from graph.state import AgentState
from security.guardrails import check_injection, sanitize_input

logger = logging.getLogger(__name__)


def get_llm():
    return ChatGroq(
        model="qwen/qwen3.8-27b",
        temperature=0,
        api_key=os.getenv("GROQ_API_KEY"),
    )


ROUTER_SYSTEM = """You are an intent classifier for an HR assistant. Classify the user's message into exactly one of:
- "faq": asking about policies, benefits, handbook content, vacation, performance reviews, etc.
- "booking": wanting to schedule, book, reschedule, or cancel an appointment/meeting/review
- "context_switch": user is MID-BOOKING (has an active booking_status != idle/None/confirmed/cancelled) but is asking a handbook/FAQ question
- "unknown": unclear or off-topic

Respond with ONLY the intent label, nothing else."""


def router_node(state: AgentState) -> AgentState:
    messages = state.get("messages", [])
    if not messages:
        return {**state, "intent": "unknown", "current_node": "router"}

    last_message = messages[-1].get("content", "") if messages else ""
    sanitized = sanitize_input(last_message)

    # Security check
    if check_injection(sanitized):
        return {
            **state,
            "intent": "unknown",
            "current_node": "router",
            "injection_detected": True,
            "streaming_events": [
                {"type": "node_change", "node": "router", "description": "Security check failed"}
            ],
        }

    booking_status = state.get("booking_status")
    active_booking = booking_status in ("collecting_info", "slot_selection", "pending_confirmation")

    llm = get_llm()
    context = f"Current booking_status: {booking_status or 'none'}"
    response = llm.invoke([
        SystemMessage(content=ROUTER_SYSTEM),
        HumanMessage(content=f"{context}\n\nUser message: {sanitized}"),
    ])
    raw_intent = response.content.strip().lower()

    # Override: if booking active and LLM says faq, call it context_switch
    if active_booking and raw_intent == "faq":
        intent = "context_switch"
    elif raw_intent in ("faq", "booking", "context_switch", "unknown"):
        intent = raw_intent
    else:
        intent = "unknown"

    events = [{"type": "node_change", "node": "router", "description": f"Intent: {intent}"}]

    return {
        **state,
        "intent": intent,
        "current_node": "router",
        "injection_detected": False,
        "streaming_events": events,
    }




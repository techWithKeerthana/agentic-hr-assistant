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
- "booking": wanting to schedule, book, reschedule, or cancel an appointment/meeting/review. Also use "booking" when the user is providing booking-related data like their name, email address, time slot preference, or confirmation like "yes"/"confirm".
- "context_switch": user is MID-BOOKING (has an active booking_status != idle/None/confirmed/cancelled) but is clearly asking a handbook/policy/FAQ question unrelated to the booking.
- "unknown": unclear or off-topic

Important: If the booking_status shows an active booking, only use "context_switch" for genuine policy/handbook questions. For name, email, slot selection, yes/no confirmations → use "booking".

Respond with ONLY the intent label, nothing else."""


import re as _re


def _is_booking_data_response(message: str, booking_status: str) -> bool:
    """Detect if the message is data the user is providing to the booking flow."""
    msg = message.strip()
    # Email address
    if _re.search(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', msg):
        return True
    # Slot ID or slot-selection words
    if _re.search(r'\b(s\d+|slot\s*\d+|first|second|third|take|select|choose|option|pick)\b', msg, _re.IGNORECASE):
        return True
    # Confirmation / cancellation
    if _re.search(r'\b(yes|confirm|ok|sure|yep|yeah|book it|go ahead|cancel|stop|abort)\b', msg, _re.IGNORECASE):
        return True
    # Short text with no question mark: likely a name or single-word answer
    if len(msg.split()) <= 5 and '?' not in msg and not any(
        kw in msg.lower() for kw in ["policy", "vacation", "benefits", "handbook", "how", "what", "when", "where", "why", "can i"]
    ):
        return True
    return False


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

    # Short-circuit: if booking is active and message looks like a data response, route directly to booking
    if active_booking and _is_booking_data_response(sanitized, booking_status):
        events = [{"type": "node_change", "node": "router", "description": "Intent: booking (data response)"}]
        return {
            **state,
            "intent": "booking",
            "current_node": "router",
            "injection_detected": False,
            "streaming_events": events,
        }

    llm = get_llm()
    context = f"Current booking_status: {booking_status or 'none'}"
    response = llm.invoke([
        SystemMessage(content=ROUTER_SYSTEM),
        HumanMessage(content=f"{context}\n\nUser message: {sanitized}"),
    ])
    raw_intent = response.content.strip().lower()

    # Override: if booking active and LLM says faq, call it context_switch (genuine mid-booking FAQ)
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




import os
import re
import random
import logging
from langchain_groq import ChatGroq
from langchain.schema import HumanMessage, SystemMessage
from backend.graph.state import AgentState
from backend.db.database import (
    get_available_slots, is_slot_available, create_booking,
    get_booking_by_thread, cancel_booking
)
from backend.security.guardrails import validate_email

logger = logging.getLogger(__name__)


def get_llm():
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0,
        api_key=os.getenv("GROQ_API_KEY"),
    )


def _generate_ref_id() -> str:
    return f"#REV-{random.randint(1000, 9999)}"


def _extract_name_email(text: str, llm) -> tuple[str | None, str | None]:
    """Use LLM to extract name and email from freeform text."""
    prompt = f"""Extract the person's name and email from this message. Return ONLY JSON like:
{{"name": "John Smith", "email": "john@example.com"}}
If not found, use null for that field.

Message: {text}"""
    try:
        resp = llm.invoke([HumanMessage(content=prompt)])
        import json
        data = json.loads(resp.content.strip())
        return data.get("name"), data.get("email")
    except Exception:
        # Fallback: regex
        email_match = re.search(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text)
        email = email_match.group(0) if email_match else None
        name = None
        return name, email


def booking_node(state: AgentState) -> AgentState:
    messages = state.get("messages", [])
    last_message = messages[-1].get("content", "") if messages else ""
    booking_status = state.get("booking_status") or "idle"
    thread_id = state.get("thread_id", "")
    events = [{"type": "node_change", "node": "booking", "description": f"Status: {booking_status}"}]

    # Handle cancellation intent at any stage
    if re.search(r"\b(cancel|stop|abort|nevermind|never mind)\b", last_message, re.IGNORECASE):
        if booking_status not in ("idle", "confirmed", "cancelled"):
            answer = "Your booking request has been cancelled. Feel free to start a new booking anytime."
            return {
                **state,
                "current_node": "booking",
                "booking_status": "cancelled",
                "streaming_events": events,
                "messages": [{"role": "assistant", "content": answer}],
            }

    llm = get_llm()

    # --- IDLE: start collecting ---
    if booking_status in ("idle", None):
        answer = (
            "I'd be happy to help you schedule an appointment! "
            "Could you please provide your **full name** and **email address**?"
        )
        return {
            **state,
            "current_node": "booking",
            "booking_status": "collecting_info",
            "streaming_events": events,
            "messages": [{"role": "assistant", "content": answer}],
        }

    # --- COLLECTING INFO ---
    if booking_status == "collecting_info":
        name = state.get("name")
        email = state.get("email")

        if not name or not email:
            extracted_name, extracted_email = _extract_name_email(last_message, llm)
            if extracted_name:
                name = extracted_name
            if extracted_email:
                email = extracted_email

        if not name or not email or not validate_email(email or ""):
            answer = (
                "I still need your **full name** and a **valid email address** to proceed. "
                "Please provide both in your message."
            )
            return {
                **state,
                "current_node": "booking",
                "booking_status": "collecting_info",
                "name": name,
                "email": email,
                "streaming_events": events,
                "messages": [{"role": "assistant", "content": answer}],
            }

        # Got both — fetch slots
        slots = get_available_slots()
        if not slots:
            answer = "Sorry, there are no available slots at this time. Please check back later."
            return {
                **state,
                "current_node": "booking",
                "name": name,
                "email": email,
                "streaming_events": events,
                "messages": [{"role": "assistant", "content": answer}],
            }

        events.append({
            "type": "booking_card",
            "slots": slots,
            "status": "slot_selection",
            "name": name,
            "email": email,
        })
        answer = f"Thanks, **{name}**! Please select an available time slot from the options below:"
        return {
            **state,
            "current_node": "booking",
            "booking_status": "slot_selection",
            "name": name,
            "email": email,
            "streaming_events": events,
            "messages": [{"role": "assistant", "content": answer}],
        }

    # --- SLOT SELECTION ---
    if booking_status == "slot_selection":
        # Try to extract slot ID from message (e.g., "s1", "s3", or user clicked and sent slot id)
        slot_match = re.search(r"\b(s\d+)\b", last_message, re.IGNORECASE)
        selected_slot = slot_match.group(1).lower() if slot_match else state.get("selected_slot")

        if not selected_slot:
            slots = get_available_slots()
            events.append({"type": "booking_card", "slots": slots, "status": "slot_selection",
                           "name": state.get("name"), "email": state.get("email")})
            answer = "Please select a time slot by clicking on one of the options."
            return {
                **state,
                "current_node": "booking",
                "booking_status": "slot_selection",
                "streaming_events": events,
                "messages": [{"role": "assistant", "content": answer}],
            }

        if not is_slot_available(selected_slot):
            slots = get_available_slots()
            events.append({"type": "booking_card", "slots": slots, "status": "slot_selection",
                           "name": state.get("name"), "email": state.get("email")})
            answer = "That slot is no longer available. Please choose another slot."
            return {
                **state,
                "current_node": "booking",
                "booking_status": "slot_selection",
                "selected_slot": None,
                "streaming_events": events,
                "messages": [{"role": "assistant", "content": answer}],
            }

        # Find slot label
        slots = get_available_slots()
        slot_label = next((s["label"] for s in slots if s["id"] == selected_slot), selected_slot)

        events.append({
            "type": "booking_card",
            "slots": slots,
            "status": "pending_confirmation",
            "name": state.get("name"),
            "email": state.get("email"),
            "selected_slot": selected_slot,
            "slot_label": slot_label,
        })
        answer = (
            f"Here's your booking summary:\n\n"
            f"- **Name**: {state.get('name')}\n"
            f"- **Email**: {state.get('email')}\n"
            f"- **Slot**: {slot_label}\n\n"
            "Please confirm by saying **'Yes, confirm'** or type **'cancel'** to cancel."
        )
        return {
            **state,
            "current_node": "booking",
            "booking_status": "pending_confirmation",
            "selected_slot": selected_slot,
            "streaming_events": events,
            "messages": [{"role": "assistant", "content": answer}],
        }

    # --- PENDING CONFIRMATION ---
    if booking_status == "pending_confirmation":
        confirmed = re.search(r"\b(yes|confirm|book it|go ahead|proceed|ok|sure|yep|yeah)\b",
                              last_message, re.IGNORECASE)
        reschedule = re.search(r"\b(reschedule|change|different|another)\b", last_message, re.IGNORECASE)

        if reschedule:
            slots = get_available_slots()
            events.append({"type": "booking_card", "slots": slots, "status": "slot_selection",
                           "name": state.get("name"), "email": state.get("email")})
            answer = "No problem! Please choose a different time slot."
            return {
                **state,
                "current_node": "booking",
                "booking_status": "slot_selection",
                "selected_slot": None,
                "streaming_events": events,
                "messages": [{"role": "assistant", "content": answer}],
            }

        if not confirmed:
            answer = "Please reply with **'Yes, confirm'** to complete your booking, or **'cancel'** to cancel."
            return {
                **state,
                "current_node": "booking",
                "streaming_events": events,
                "messages": [{"role": "assistant", "content": answer}],
            }

        # Double-booking check
        slot_id = state.get("selected_slot")
        if not slot_id or not is_slot_available(slot_id):
            slots = get_available_slots()
            events.append({"type": "booking_card", "slots": slots, "status": "slot_selection",
                           "name": state.get("name"), "email": state.get("email")})
            answer = "That slot was just taken! Please select a new time slot."
            return {
                **state,
                "current_node": "booking",
                "booking_status": "slot_selection",
                "selected_slot": None,
                "streaming_events": events,
                "messages": [{"role": "assistant", "content": answer}],
            }

        ref_id = _generate_ref_id()
        slots_list = get_available_slots()
        slot_label = next((s["label"] for s in slots_list if s["id"] == slot_id), slot_id)
        try:
            create_booking(
                ref_id=ref_id,
                name=state.get("name", ""),
                email=state.get("email", ""),
                slot_id=slot_id,
                slot_label=slot_label,
                thread_id=thread_id,
            )
        except Exception as e:
            logger.error(f"Booking creation failed: {e}")
            answer = "An error occurred creating your booking. Please try again."
            return {
                **state,
                "current_node": "booking",
                "streaming_events": events,
                "messages": [{"role": "assistant", "content": answer}],
            }

        events.append({"type": "booking_confirmed", "ref_id": ref_id, "slot_label": slot_label})
        answer = (
            f"Your appointment is confirmed! 🎉\n\n"
            f"**Booking Reference**: `{ref_id}`\n"
            f"**Slot**: {slot_label}\n"
            f"**Name**: {state.get('name')}\n\n"
            "You'll receive a confirmation at your email address. Is there anything else I can help you with?"
        )
        return {
            **state,
            "current_node": "booking",
            "booking_status": "confirmed",
            "booking_ref_id": ref_id,
            "pending_action": None,
            "streaming_events": events,
            "messages": [{"role": "assistant", "content": answer}],
        }

    # --- CONFIRMED/CANCELLED: start fresh ---
    if booking_status in ("confirmed", "cancelled"):
        answer = (
            "Would you like to book another appointment? "
            "Just let me know and I'll get started!"
        )
        return {
            **state,
            "current_node": "booking",
            "booking_status": "idle",
            "name": None,
            "email": None,
            "selected_slot": None,
            "booking_ref_id": None,
            "pending_action": None,
            "streaming_events": events,
            "messages": [{"role": "assistant", "content": answer}],
        }

    return {**state, "current_node": "booking", "streaming_events": events}

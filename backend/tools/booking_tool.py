from backend.db.database import create_booking, cancel_booking, get_booking_by_thread
from backend.security.guardrails import validate_booking_input


def book_appointment(name: str, email: str, slot_id: str, slot_label: str,
                     thread_id: str, ref_id: str) -> dict:
    validation = validate_booking_input(name, email, slot_id)
    if not validation["valid"]:
        return {"success": False, "errors": validation["errors"]}
    try:
        booking = create_booking(ref_id, name, email, slot_id, slot_label, thread_id)
        return {"success": True, "booking": booking}
    except Exception as e:
        return {"success": False, "errors": [str(e)]}


def cancel_appointment(ref_id: str) -> dict:
    try:
        cancel_booking(ref_id)
        return {"success": True}
    except Exception as e:
        return {"success": False, "errors": [str(e)]}


def get_thread_booking(thread_id: str) -> dict | None:
    return get_booking_by_thread(thread_id)

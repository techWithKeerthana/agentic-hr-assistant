from db.database import get_available_slots, is_slot_available, mark_slot_unavailable


def fetch_slots() -> list[dict]:
    return get_available_slots()


def check_slot(slot_id: str) -> bool:
    return is_slot_available(slot_id)


def reserve_slot(slot_id: str):
    mark_slot_unavailable(slot_id)


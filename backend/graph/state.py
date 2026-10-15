from typing import TypedDict, Optional, Literal, List, Annotated
import operator


class AgentState(TypedDict):
    # Core
    messages: Annotated[List[dict], operator.add]
    thread_id: str
    current_node: str

    # Routing
    intent: Optional[Literal["faq", "booking", "context_switch", "unknown"]]

    # Booking state (persists across turns)
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
    retrieved_chunks: Optional[List[dict]]   # includes page, doc_name, text, score
    rag_confidence: Optional[float]
    citations: Optional[List[dict]]

    # Streaming / SSE events to emit
    streaming_events: Optional[List[dict]]

    # Security
    injection_detected: Optional[bool]

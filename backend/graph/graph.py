from langgraph.graph import StateGraph, END
from graph.state import AgentState
from graph.nodes.router import router_node
from graph.nodes.rag import rag_node
from graph.nodes.booking import booking_node
from graph.checkpointer import get_checkpointer


def route_intent(state: AgentState) -> str:
    """Conditional edge: route based on intent classification."""
    if state.get("injection_detected"):
        return "rag"  # RAG will handle with abstention for injection
    intent = state.get("intent", "unknown")
    if intent in ("faq", "context_switch"):
        return "rag"
    if intent == "booking":
        return "booking"
    return "rag"  # default to FAQ for unknown


def build_graph(checkpointer=None):
    workflow = StateGraph(AgentState)

    workflow.add_node("router", router_node)
    workflow.add_node("rag", rag_node)
    workflow.add_node("booking", booking_node)

    workflow.set_entry_point("router")

    workflow.add_conditional_edges(
        "router",
        route_intent,
        {
            "rag": "rag",
            "booking": "booking",
        },
    )

    workflow.add_edge("rag", END)
    workflow.add_edge("booking", END)

    cp = checkpointer or get_checkpointer()
    return workflow.compile(checkpointer=cp)


_graph = None


def get_graph():
    return _graph


def set_graph(g):
    global _graph
    _graph = g


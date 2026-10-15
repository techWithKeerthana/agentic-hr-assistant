import os
import logging
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from graph.state import AgentState

logger = logging.getLogger(__name__)


def get_llm():
    return ChatGroq(
        model="qwen/qwen3.8-27b",
        temperature=0,
        api_key=os.getenv("GROQ_API_KEY"),
    )


def summarizer_node(state: AgentState) -> AgentState:
    """Summarizes a completed session for thread title generation."""
    messages = state.get("messages", [])
    if not messages:
        return state

    llm = get_llm()
    conversation_text = "\n".join(
        f"{m['role'].upper()}: {m['content'][:200]}"
        for m in messages[:10]  # limit to first 10 messages
    )
    try:
        resp = llm.invoke([
            SystemMessage(content="Generate a short 4-6 word title for this conversation. Return ONLY the title."),
            HumanMessage(content=conversation_text),
        ])
        title = resp.content.strip()[:60]
    except Exception:
        title = "HR Assistant Conversation"

    return {
        **state,
        "current_node": "summarizer",
        "streaming_events": [{"type": "summary", "title": title}],
    }




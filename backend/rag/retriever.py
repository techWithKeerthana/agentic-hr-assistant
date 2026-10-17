"""
Thin wrapper — delegates to ingestor.retrieve() so existing callers
(graph/nodes/rag.py, main.py) don't need changes.
"""
import logging

logger = logging.getLogger(__name__)


def retrieve(query: str, k: int = 3) -> dict:
    from rag.ingestor import retrieve as _retrieve
    return _retrieve(query, k=k)


def preview_chunks(query: str, index, k: int = 5) -> list[dict]:
    """Return top-k chunks for DocPanel preview. `index` arg ignored (kept for compat)."""
    result = retrieve(query, k=k)
    return result.get("chunks", [])

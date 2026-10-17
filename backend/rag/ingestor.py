"""
Zero-dependency keyword-search RAG.
Loads plain .txt files from backend/data/hr_docs/ into memory.
No ML, no vector store, no heavy packages.
"""
import os
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DOCS_DIR = Path(os.getenv("HR_DOCS_DIR", "./data/hr_docs"))

# Module-level document store: list of {"id", "content", "filename", "source"}
_docs: Optional[list] = None


def get_index() -> Optional[list]:
    return _docs


def get_vectorstore() -> Optional[list]:
    """Backward-compatible alias."""
    return _docs


def ingest_if_needed():
    """Load .txt files from DOCS_DIR into memory. No-op if already loaded."""
    global _docs
    if _docs is not None:
        return

    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    txt_files = sorted(DOCS_DIR.glob("*.txt"))

    if not txt_files:
        logger.warning(f"No .txt files found in {DOCS_DIR}")
        _docs = []
        return

    _docs = []
    for path in txt_files:
        try:
            content = path.read_text(encoding="utf-8").strip()
            _docs.append({
                "id": path.stem,
                "content": content,
                "filename": path.name,
                "source": path.stem.replace("_", " ").title(),
            })
            logger.info(f"Loaded HR doc: {path.name} ({len(content)} chars)")
        except Exception as e:
            logger.error(f"Failed to load {path}: {e}")

    logger.info(f"HR knowledge base ready: {len(_docs)} documents loaded")


def retrieve(query: str, k: int = 3) -> dict:
    """
    Keyword search over loaded docs.
    Scores each doc by the number of unique query words it contains.
    Returns {"chunks": [...], "confidence": float, "abstain": bool}
    """
    ingest_if_needed()

    if not _docs:
        return {"chunks": [], "confidence": 0.0, "abstain": True}

    query_words = set(query.lower().split())
    # Remove very short stop words
    query_words = {w for w in query_words if len(w) > 2}

    scored = []
    for doc in _docs:
        content_lower = doc["content"].lower()
        hits = sum(1 for w in query_words if w in content_lower)
        if hits > 0:
            scored.append((hits, doc))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:k]

    if not top:
        return {"chunks": [], "confidence": 0.0, "abstain": True}

    max_possible = max(len(query_words), 1)
    confidence = top[0][0] / max_possible

    chunks = [
        {
            "text": doc["content"][:2000],  # truncate for context window
            "page_number": 1,
            "doc_name": doc["source"],
            "score": hits / max_possible,
        }
        for hits, doc in top
    ]

    return {
        "chunks": chunks,
        "confidence": confidence,
        "abstain": confidence < 0.1,
    }


async def ingest_additional_pdf(pdf_path: Path, doc_name: str) -> dict:
    """Stub — dynamic PDF upload not supported in keyword mode."""
    return {
        "doc_name": doc_name,
        "chunk_count": 0,
        "page_count": 0,
        "status": "unsupported: add a .txt file to data/hr_docs/ instead",
    }


def get_doc_stats() -> list[dict]:
    ingest_if_needed()
    if not _docs:
        return []
    return [
        {
            "doc_name": doc["source"],
            "chunk_count": 1,
            "page_count": doc["content"].count("\n\n") + 1,
            "status": "indexed",
        }
        for doc in _docs
    ]


# Backward-compat aliases
ingest_pdfs = ingest_if_needed
ingest_all_pdfs = ingest_if_needed

import logging
from typing import Optional

logger = logging.getLogger(__name__)


def compute_citation_confidence(chunks: list[dict], answer: str) -> float:
    """Heuristic: check if answer text overlaps with retrieved chunks."""
    if not chunks or not answer:
        return 0.0
    answer_lower = answer.lower()
    best = 0.0
    for chunk in chunks:
        words = set(chunk["text"].lower().split())
        answer_words = set(answer_lower.split())
        if not words:
            continue
        overlap = len(words & answer_words) / len(words)
        best = max(best, overlap)
    return round(min(best * 2, 1.0), 4)


def extract_citations(chunks: list[dict]) -> list[dict]:
    """Build citation list from retrieved chunks."""
    seen = set()
    citations = []
    for chunk in chunks:
        key = (chunk["doc_name"], chunk["page_number"])
        if key in seen:
            continue
        seen.add(key)
        citations.append({
            "doc": chunk["doc_name"],
            "page": chunk["page_number"],
            "snippet": chunk["text"][:300] + ("..." if len(chunk["text"]) > 300 else ""),
        })
    return citations

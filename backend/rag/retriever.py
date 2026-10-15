import os
import logging
from langchain_core.documents import Document
from langchain_community.retrievers import BM25Retriever

logger = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = float(os.getenv("RAG_CONFIDENCE_THRESHOLD", "0.3"))
TOP_K = 5

_bm25_retriever: BM25Retriever | None = None
_all_docs: list[Document] = []


def build_bm25(docs: list[Document]):
    global _bm25_retriever, _all_docs
    _all_docs = docs
    if docs:
        _bm25_retriever = BM25Retriever.from_documents(docs, k=TOP_K)


def retrieve(query: str, vectorstore) -> dict:
    """Hybrid BM25 + vector retrieval with confidence scoring."""
    try:
        # similarity_search_with_score returns raw L2 distance (lower = more similar).
        # Convert: similarity = max(0, 1 - distance/2) so scores stay in [0, 1].
        raw = vectorstore.similarity_search_with_score(query, k=TOP_K)
        scored = [(doc, max(0.0, 1.0 - dist / 2.0)) for doc, dist in raw]

        # BM25 results
        bm25_docs: list[Document] = []
        if _bm25_retriever is not None:
            try:
                bm25_docs = _bm25_retriever.get_relevant_documents(query)
            except Exception:
                bm25_docs = []

        # Build merged result set
        chunks: list[dict] = []
        seen: set[str] = set()

        # Add vector results first (with their scores)
        for doc, score in scored:
            key = doc.page_content[:100]
            if key in seen:
                continue
            seen.add(key)
            chunks.append({
                "text": doc.page_content,
                "page_number": doc.metadata.get("page_number", 1),
                "doc_name": doc.metadata.get("doc_name", "Employee Handbook"),
                "score": round(float(score), 4),
            })

        # Add BM25 results that weren't already in vector results
        for doc in bm25_docs:
            key = doc.page_content[:100]
            if key in seen:
                # Boost score slightly for docs appearing in both
                for chunk in chunks:
                    if chunk["text"][:100] == key:
                        chunk["score"] = min(1.0, chunk["score"] + 0.1)
                continue
            seen.add(key)
            chunks.append({
                "text": doc.page_content,
                "page_number": doc.metadata.get("page_number", 1),
                "doc_name": doc.metadata.get("doc_name", "Employee Handbook"),
                "score": 0.5,  # BM25-only result, assign moderate score
            })

        if not chunks:
            return {"chunks": [], "confidence": 0.0, "abstain": True}

        # Sort by score descending, keep top-k
        chunks.sort(key=lambda x: x["score"], reverse=True)
        chunks = chunks[:TOP_K]

        max_score = chunks[0]["score"] if chunks else 0.0
        abstain = max_score < CONFIDENCE_THRESHOLD

        return {
            "chunks": chunks,
            "confidence": round(max_score, 4),
            "abstain": abstain,
        }
    except Exception as e:
        logger.error(f"Retrieval error: {e}")
        return {"chunks": [], "confidence": 0.0, "abstain": True}


def preview_chunks(query: str, vectorstore) -> list[dict]:
    result = retrieve(query, vectorstore)
    return result.get("chunks", [])

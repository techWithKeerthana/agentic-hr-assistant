import os
import logging
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = float(os.getenv("RAG_CONFIDENCE_THRESHOLD", "0.1"))


def retrieve(query: str, k: int = 3) -> dict:
    """
    Retrieve top-k chunks using TF-IDF cosine similarity.
    Returns {"chunks": [...], "confidence": float, "abstain": bool}
    """
    from rag.ingestor import get_index
    index = get_index()

    if index is None:
        return {"chunks": [], "confidence": 0.0, "abstain": True}

    try:
        query_vec = index["vectorizer"].transform([query])
        scores = cosine_similarity(query_vec, index["matrix"]).flatten()

        top_indices = scores.argsort()[::-1][:k]
        top_chunks = []
        for idx in top_indices:
            score = float(scores[idx])
            if score > 0:
                chunk = dict(index["chunks"][idx])
                chunk["score"] = score
                top_chunks.append(chunk)

        if not top_chunks:
            return {"chunks": [], "confidence": 0.0, "abstain": True}

        confidence = top_chunks[0]["score"]
        return {
            "chunks": top_chunks,
            "confidence": confidence,
            "abstain": confidence < CONFIDENCE_THRESHOLD,
        }
    except Exception as e:
        logger.error(f"TF-IDF retrieve error: {e}")
        return {"chunks": [], "confidence": 0.0, "abstain": True}


def preview_chunks(query: str, index: dict, k: int = 5) -> list[dict]:
    """Return top-k chunks for a query — used by the DocPanel preview endpoint."""
    if not index or not query.strip():
        return []
    try:
        query_vec = index["vectorizer"].transform([query])
        scores = cosine_similarity(query_vec, index["matrix"]).flatten()
        top_indices = scores.argsort()[::-1][:k]
        results = []
        for idx in top_indices:
            score = float(scores[idx])
            if score > 0:
                chunk = dict(index["chunks"][idx])
                chunk["score"] = round(score, 4)
                results.append(chunk)
        return results
    except Exception as e:
        logger.error(f"preview_chunks error: {e}")
        return []

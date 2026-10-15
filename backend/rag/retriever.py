import os
import logging
from typing import List
from langchain.schema import Document
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever

logger = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = float(os.getenv("RAG_CONFIDENCE_THRESHOLD", "0.7"))
TOP_K = 5

_bm25_retriever: BM25Retriever | None = None
_all_docs: list[Document] = []


def build_bm25(docs: list[Document]):
    global _bm25_retriever, _all_docs
    _all_docs = docs
    _bm25_retriever = BM25Retriever.from_documents(docs, k=TOP_K)


def retrieve(query: str, vectorstore) -> dict:
    """Return top chunks with confidence score. Uses ensemble (BM25 + vector)."""
    try:
        # Vector retriever
        vector_retriever = vectorstore.as_retriever(
            search_type="similarity_score_threshold",
            search_kwargs={"k": TOP_K, "score_threshold": 0.0},
        )

        if _bm25_retriever is not None:
            ensemble = EnsembleRetriever(
                retrievers=[_bm25_retriever, vector_retriever],
                weights=[0.4, 0.6],
            )
            docs = ensemble.get_relevant_documents(query)
        else:
            docs = vector_retriever.get_relevant_documents(query)

        if not docs:
            return {"chunks": [], "confidence": 0.0, "abstain": True}

        # Score via similarity search
        scored = vectorstore.similarity_search_with_relevance_scores(query, k=TOP_K)
        score_map = {d.page_content[:80]: s for d, s in scored}

        chunks = []
        max_score = 0.0
        seen = set()
        for doc in docs:
            key = doc.page_content[:80]
            if key in seen:
                continue
            seen.add(key)
            score = score_map.get(key, 0.5)
            max_score = max(max_score, score)
            chunks.append({
                "text": doc.page_content,
                "page_number": doc.metadata.get("page_number", 1),
                "doc_name": doc.metadata.get("doc_name", "Employee Handbook"),
                "score": round(score, 4),
            })

        chunks.sort(key=lambda x: x["score"], reverse=True)
        chunks = chunks[:TOP_K]

        return {
            "chunks": chunks,
            "confidence": round(max_score, 4),
            "abstain": max_score < CONFIDENCE_THRESHOLD,
        }
    except Exception as e:
        logger.error(f"Retrieval error: {e}")
        return {"chunks": [], "confidence": 0.0, "abstain": True}


def preview_chunks(query: str, vectorstore) -> list[dict]:
    result = retrieve(query, vectorstore)
    return result.get("chunks", [])

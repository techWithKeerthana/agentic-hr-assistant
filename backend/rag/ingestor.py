import os
import gc
import pickle
import logging
import httpx
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

PDF_URLS = {
    "Employee Handbook": "https://raw.githubusercontent.com/Azure-Samples/azure-search-openai-demo/main/data/employee_handbook.pdf",
    "Northwind Benefits": "https://raw.githubusercontent.com/Azure-Samples/azure-search-openai-demo/main/data/Northwind_Standard_Benefits_Details.pdf",
}

CACHE_DIR = Path(os.getenv("PDF_CACHE_DIR", "./data/pdfs"))
INDEX_PATH = Path(os.getenv("TFIDF_INDEX_PATH", "./data/tfidf_index.pkl"))
CHUNK_SIZE = int(os.getenv("PDF_CHUNK_SIZE", "800"))
CHUNK_OVERLAP = int(os.getenv("PDF_CHUNK_OVERLAP", "150"))

# In-memory index loaded lazily
_index: Optional[dict] = None  # {"vectorizer": ..., "matrix": ..., "chunks": [...]}


def get_index() -> Optional[dict]:
    return _index


def get_vectorstore() -> Optional[dict]:
    """Backward-compatible alias for get_index()."""
    return _index


def _download_pdf_sync(url: str, dest: Path) -> Path:
    if dest.exists():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    logger.info(f"Downloading {url}")
    with httpx.Client(timeout=120, follow_redirects=True) as client:
        r = client.get(url)
        r.raise_for_status()
        dest.write_bytes(r.content)
    return dest


def _extract_pages(pdf_path: Path) -> list[dict]:
    """Extract pages as list of {text, page_number}."""
    try:
        import pdfplumber
        pages = []
        with pdfplumber.open(str(pdf_path)) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                pages.append({"text": text.strip(), "page_number": i + 1})
        return pages
    except Exception as e:
        logger.warning(f"pdfplumber failed ({e}), falling back to pypdf")
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(pdf_path))
        pages = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            pages.append({"text": text.strip(), "page_number": i + 1})
        return pages
    except Exception as e2:
        logger.error(f"PDF extraction failed: {e2}")
        return []


def _chunk_pages(pages: list[dict], doc_name: str) -> list[dict]:
    chunks = []
    for page in pages:
        text = page["text"]
        if not text:
            continue
        page_num = page["page_number"]
        start = 0
        while start < len(text):
            end = min(start + CHUNK_SIZE, len(text))
            chunk_text = text[start:end].strip()
            if chunk_text:
                chunks.append({
                    "text": chunk_text,
                    "page_number": page_num,
                    "doc_name": doc_name,
                })
            start += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks


def _build_index(chunks: list[dict]) -> dict:
    from sklearn.feature_extraction.text import TfidfVectorizer
    texts = [c["text"] for c in chunks]
    vectorizer = TfidfVectorizer(
        max_features=50000,
        ngram_range=(1, 2),
        sublinear_tf=True,
        strip_accents="unicode",
        analyzer="word",
        token_pattern=r"(?u)\b\w+\b",
        min_df=1,
    )
    matrix = vectorizer.fit_transform(texts)
    gc.collect()
    return {"vectorizer": vectorizer, "matrix": matrix, "chunks": chunks}


def ingest_if_needed():
    """Load existing TF-IDF index or build from PDFs. Synchronous."""
    global _index
    if _index is not None:
        return

    if INDEX_PATH.exists():
        try:
            logger.info(f"Loading TF-IDF index from {INDEX_PATH}")
            with open(INDEX_PATH, "rb") as f:
                _index = pickle.load(f)
            logger.info(f"Loaded index with {len(_index['chunks'])} chunks")
            return
        except Exception as e:
            logger.warning(f"Failed to load index ({e}), rebuilding")

    logger.info("Building TF-IDF index from PDFs")
    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    all_chunks: list[dict] = []

    local_handbook = Path("data/employee_handbook.pdf")
    if not local_handbook.exists():
        try:
            from scripts.create_handbook import create_handbook
            create_handbook(str(local_handbook))
            logger.info("Auto-created synthetic Employee Handbook PDF")
        except Exception as e:
            logger.warning(f"Could not auto-create handbook: {e}")

    for doc_name, url in PDF_URLS.items():
        if doc_name == "Employee Handbook" and local_handbook.exists():
            try:
                pages = _extract_pages(local_handbook)
                chunks = _chunk_pages(pages, doc_name)
                all_chunks.extend(chunks)
                logger.info(f"Ingested {len(chunks)} chunks from local {doc_name}")
            except Exception as e:
                logger.error(f"Failed to ingest local {doc_name}: {e}")
            continue

        filename = url.split("/")[-1]
        dest = CACHE_DIR / filename
        try:
            _download_pdf_sync(url, dest)
            pages = _extract_pages(dest)
            chunks = _chunk_pages(pages, doc_name)
            all_chunks.extend(chunks)
            logger.info(f"Ingested {len(chunks)} chunks from {doc_name}")
        except Exception as e:
            logger.error(f"Failed to ingest {doc_name}: {e}")

    if not all_chunks:
        logger.warning("No chunks ingested — using placeholder")
        all_chunks = [{"text": "No documents available.", "page_number": 1, "doc_name": "System"}]

    _index = _build_index(all_chunks)
    try:
        with open(INDEX_PATH, "wb") as f:
            pickle.dump(_index, f)
        logger.info(f"TF-IDF index saved ({len(all_chunks)} chunks)")
    except Exception as e:
        logger.warning(f"Failed to save index: {e}")


async def ingest_additional_pdf(pdf_path: Path, doc_name: str) -> dict:
    global _index
    ingest_if_needed()

    pages = _extract_pages(pdf_path)
    new_chunks = _chunk_pages(pages, doc_name)

    if not new_chunks:
        return {"doc_name": doc_name, "chunk_count": 0, "page_count": 0, "status": "error"}

    existing = _index["chunks"] if _index else []
    all_chunks = existing + new_chunks
    _index = _build_index(all_chunks)

    try:
        with open(INDEX_PATH, "wb") as f:
            pickle.dump(_index, f)
    except Exception as e:
        logger.warning(f"Failed to save updated index: {e}")

    return {
        "doc_name": doc_name,
        "chunk_count": len(new_chunks),
        "page_count": len({c["page_number"] for c in new_chunks}),
        "status": "indexed",
    }


def get_doc_stats() -> list[dict]:
    if _index is None:
        return []
    stats: dict[str, dict] = {}
    for chunk in _index["chunks"]:
        dn = chunk.get("doc_name", "Unknown")
        if dn not in stats:
            stats[dn] = {"doc_name": dn, "chunk_count": 0, "pages": set()}
        stats[dn]["chunk_count"] += 1
        stats[dn]["pages"].add(chunk.get("page_number", 1))
    return [
        {
            "doc_name": v["doc_name"],
            "chunk_count": v["chunk_count"],
            "page_count": len(v["pages"]),
            "status": "indexed",
        }
        for v in stats.values()
    ]


# Backward-compat aliases
ingest_pdfs = ingest_if_needed
ingest_all_pdfs = ingest_if_needed

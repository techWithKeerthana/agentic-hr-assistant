import os
import logging
import httpx
from pathlib import Path
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

logger = logging.getLogger(__name__)

PDF_URLS = {
    "Employee Handbook": "https://raw.githubusercontent.com/Azure-Samples/azure-search-openai-demo/main/data/employee_handbook.pdf",
    "Northwind Benefits": "https://raw.githubusercontent.com/Azure-Samples/azure-search-openai-demo/main/data/Northwind_Standard_Benefits_Details.pdf",
}

CACHE_DIR = Path(os.getenv("PDF_CACHE_DIR", "./data/pdfs"))
CHROMA_DIR = os.getenv("CHROMA_PERSIST_DIR", "./data/chroma")
CHUNK_SIZE = int(os.getenv("PDF_CHUNK_SIZE", "800"))
CHUNK_OVERLAP = int(os.getenv("PDF_CHUNK_OVERLAP", "150"))

_vectorstore: Chroma | None = None
_embeddings: HuggingFaceEmbeddings | None = None


def get_embeddings() -> HuggingFaceEmbeddings:
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name="all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embeddings


async def download_pdf(url: str, dest: Path) -> Path:
    if dest.exists():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    logger.info(f"Downloading {url}")
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        r = await client.get(url)
        r.raise_for_status()
        dest.write_bytes(r.content)
    return dest


def load_and_chunk(pdf_path: Path, doc_name: str) -> list:
    loader = PyPDFLoader(str(pdf_path))
    pages = loader.load()
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_documents(pages)
    for i, chunk in enumerate(chunks):
        chunk.metadata["doc_name"] = doc_name
        chunk.metadata["chunk_index"] = i
        # PyPDFLoader puts page number in metadata as 'page' (0-indexed), normalize to 1-indexed
        if "page" in chunk.metadata:
            chunk.metadata["page_number"] = chunk.metadata["page"] + 1
        else:
            chunk.metadata["page_number"] = 1
    return chunks


async def ingest_all_pdfs() -> Chroma:
    global _vectorstore
    from rag.retriever import build_bm25
    embeddings = get_embeddings()

    # Load existing vectorstore if available
    if Path(CHROMA_DIR).exists() and any(Path(CHROMA_DIR).iterdir()):
        logger.info("Loading existing ChromaDB vectorstore")
        _vectorstore = Chroma(
            persist_directory=CHROMA_DIR,
            embedding_function=embeddings,
            collection_name="hr_docs",
        )
        # Build BM25 from stored docs for hybrid retrieval
        try:
            all_meta = _vectorstore._collection.get(include=["documents", "metadatas"])
            docs_from_store = []
            from langchain_core.documents import Document as LCDoc
            for text, meta in zip(all_meta["documents"], all_meta["metadatas"]):
                docs_from_store.append(LCDoc(page_content=text, metadata=meta or {}))
            build_bm25(docs_from_store)
            logger.info(f"BM25 built from {len(docs_from_store)} stored chunks")
        except Exception as e:
            logger.warning(f"BM25 build from store failed: {e}")
        return _vectorstore

    all_chunks = []
    for doc_name, url in PDF_URLS.items():
        filename = url.split("/")[-1]
        dest = CACHE_DIR / filename
        try:
            await download_pdf(url, dest)
            chunks = load_and_chunk(dest, doc_name)
            all_chunks.extend(chunks)
            logger.info(f"Ingested {len(chunks)} chunks from {doc_name}")
        except Exception as e:
            logger.error(f"Failed to ingest {doc_name}: {e}")

    if not all_chunks:
        all_chunks = []

    _vectorstore = Chroma.from_documents(
        documents=all_chunks,
        embedding=embeddings,
        persist_directory=CHROMA_DIR,
        collection_name="hr_docs",
    )
    build_bm25(all_chunks)
    logger.info(f"ChromaDB vectorstore built with {len(all_chunks)} chunks")
    return _vectorstore


def get_vectorstore() -> Chroma | None:
    return _vectorstore


async def ingest_additional_pdf(pdf_path: Path, doc_name: str) -> dict:
    global _vectorstore
    embeddings = get_embeddings()
    chunks = load_and_chunk(pdf_path, doc_name)

    if _vectorstore is None:
        _vectorstore = Chroma(
            persist_directory=CHROMA_DIR,
            embedding_function=embeddings,
            collection_name="hr_docs",
        )
    _vectorstore.add_documents(chunks)
    return {
        "doc_name": doc_name,
        "chunk_count": len(chunks),
        "page_count": len(set(c.metadata.get("page_number", 1) for c in chunks)),
        "status": "indexed",
    }


# Alias expected by test runner
ingest_pdfs = ingest_all_pdfs


def get_doc_stats() -> list[dict]:
    if _vectorstore is None:
        return []
    try:
        col = _vectorstore._collection
        all_meta = col.get(include=["metadatas"])["metadatas"]
        stats: dict[str, dict] = {}
        for m in all_meta:
            dn = m.get("doc_name", "Unknown")
            if dn not in stats:
                stats[dn] = {"doc_name": dn, "chunk_count": 0, "pages": set()}
            stats[dn]["chunk_count"] += 1
            stats[dn]["pages"].add(m.get("page_number", 1))
        return [
            {
                "doc_name": v["doc_name"],
                "chunk_count": v["chunk_count"],
                "page_count": len(v["pages"]),
                "status": "indexed",
            }
            for v in stats.values()
        ]
    except Exception:
        return []

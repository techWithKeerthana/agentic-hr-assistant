import os
import aiosqlite
from pathlib import Path
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

DB_PATH = os.getenv("SQLITE_DB_PATH", "./data/agent_state.db")

_checkpointer = None


async def init_checkpointer() -> AsyncSqliteSaver:
    """Initialize the async SQLite checkpointer. Call once at app startup."""
    global _checkpointer
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = await aiosqlite.connect(DB_PATH, check_same_thread=False)
    _checkpointer = AsyncSqliteSaver(conn)
    return _checkpointer


def get_checkpointer() -> AsyncSqliteSaver | None:
    return _checkpointer

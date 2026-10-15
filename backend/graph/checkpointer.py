import os
import sqlite3
from pathlib import Path
from langgraph.checkpoint.sqlite import SqliteSaver

DB_PATH = os.getenv("SQLITE_DB_PATH", "./data/agent_state.db")


def get_checkpointer() -> SqliteSaver:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    return SqliteSaver(conn)

import sqlite3
import os
from datetime import datetime, timedelta
from pathlib import Path

DB_PATH = os.getenv("SQLITE_DB_PATH", "./data/agent_state.db")


def get_connection() -> sqlite3.Connection:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cur = conn.cursor()
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ref_id TEXT UNIQUE,
            name TEXT,
            email TEXT,
            slot_id TEXT,
            slot_label TEXT,
            status TEXT DEFAULT 'pending',
            thread_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS slots (
            id TEXT PRIMARY KEY,
            label TEXT,
            available INTEGER DEFAULT 1,
            datetime_iso TEXT
        );

        CREATE TABLE IF NOT EXISTS threads (
            id TEXT PRIMARY KEY,
            title TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    _seed_slots(cur, conn)
    conn.close()


def _seed_slots(cur: sqlite3.Cursor, conn: sqlite3.Connection):
    cur.execute("SELECT COUNT(*) FROM slots")
    if cur.fetchone()[0] > 0:
        return
    base = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=1)
    slots = []
    days_added = 0
    day_offset = 0
    while days_added < 5:
        day = base + timedelta(days=day_offset)
        day_offset += 1
        if day.weekday() >= 5:  # skip weekends
            continue
        days_added += 1
        for hour_offset in [0, 2, 4]:
            slot_time = day + timedelta(hours=hour_offset)
            slot_id = f"s{len(slots)+1}"
            # Use ASCII hyphen instead of middle dot to avoid encoding issues
            label = slot_time.strftime("%A, %b %d - %I:%M %p")
            slots.append((slot_id, label, 1, slot_time.isoformat()))
    cur.executemany(
        "INSERT OR IGNORE INTO slots (id, label, available, datetime_iso) VALUES (?, ?, ?, ?)",
        slots
    )
    conn.commit()


def get_available_slots() -> list[dict]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, label, available, datetime_iso FROM slots WHERE available = 1 ORDER BY datetime_iso LIMIT 10"
    )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def mark_slot_unavailable(slot_id: str):
    conn = get_connection()
    conn.execute(
        "UPDATE slots SET available = 0 WHERE id = ?", (slot_id,)
    )
    conn.commit()
    conn.close()


def is_slot_available(slot_id: str) -> bool:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT available FROM slots WHERE id = ?", (slot_id,))
    row = cur.fetchone()
    conn.close()
    return bool(row and row["available"])


def create_booking(ref_id: str, name: str, email: str, slot_id: str, slot_label: str, thread_id: str) -> dict:
    conn = get_connection()
    now = datetime.now().isoformat()
    conn.execute(
        """INSERT INTO bookings (ref_id, name, email, slot_id, slot_label, status, thread_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)""",
        (ref_id, name, email, slot_id, slot_label, thread_id, now, now)
    )
    mark_slot_unavailable(slot_id)
    conn.commit()
    cur = conn.cursor()
    cur.execute("SELECT * FROM bookings WHERE ref_id = ?", (ref_id,))
    row = dict(cur.fetchone())
    conn.close()
    return row


def get_booking_by_thread(thread_id: str) -> dict | None:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM bookings WHERE thread_id = ? ORDER BY created_at DESC LIMIT 1",
        (thread_id,)
    )
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def cancel_booking(ref_id: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT slot_id FROM bookings WHERE ref_id = ?", (ref_id,))
    row = cur.fetchone()
    if row:
        conn.execute("UPDATE slots SET available = 1 WHERE id = ?", (row["slot_id"],))
        conn.execute(
            "UPDATE bookings SET status='cancelled', updated_at=? WHERE ref_id=?",
            (datetime.now().isoformat(), ref_id)
        )
    conn.commit()
    conn.close()


def upsert_thread(thread_id: str, title: str):
    conn = get_connection()
    now = datetime.now().isoformat()
    conn.execute(
        """INSERT INTO threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET title=excluded.title, updated_at=excluded.updated_at""",
        (thread_id, title, now, now)
    )
    conn.commit()
    conn.close()


def list_threads() -> list[dict]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, title, created_at, updated_at FROM threads ORDER BY updated_at DESC")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def delete_thread(thread_id: str):
    conn = get_connection()
    conn.execute("DELETE FROM threads WHERE id = ?", (thread_id,))
    conn.commit()
    conn.close()

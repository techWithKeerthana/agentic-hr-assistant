import os
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

DB_PATH = os.getenv("SQLITE_DB_PATH", "./data/agent_state.db")


def get_connection() -> sqlite3.Connection:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _row(r):
    return dict(r) if r else None


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

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    conn.close()
    seed_slots()


def seed_slots():
    """Seed future weekday slots — safe to call on every startup."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM slots WHERE available = 1")
    if cur.fetchone()[0] >= 5:
        conn.close()
        return

    base = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=1)
    slots = []
    days_added = 0
    day_offset = 0
    while days_added < 5:
        day = base + timedelta(days=day_offset)
        day_offset += 1
        if day.weekday() >= 5:
            continue
        days_added += 1
        for hour_offset in [0, 2, 4]:
            slot_time = day + timedelta(hours=hour_offset)
            slot_id = f"s{len(slots)+1}"
            label = slot_time.strftime("%A, %b %d - %I:%M %p")
            slots.append((slot_id, label, 1, slot_time.isoformat()))

    conn.executemany(
        "INSERT OR IGNORE INTO slots (id, label, available, datetime_iso) VALUES (?,?,?,?)",
        slots,
    )
    conn.commit()
    conn.close()


def get_available_slots() -> list[dict]:
    conn = get_connection()
    now_iso = datetime.now().isoformat()
    cur = conn.execute(
        "SELECT id, label, available, datetime_iso FROM slots WHERE available=1 AND datetime_iso>? ORDER BY datetime_iso LIMIT 10",
        (now_iso,),
    )
    rows = [_row(r) for r in cur.fetchall()]
    conn.close()

    if not rows:
        conn2 = get_connection()
        conn2.execute("DELETE FROM slots")
        conn2.commit()
        conn2.close()
        seed_slots()
        conn3 = get_connection()
        now_iso = datetime.now().isoformat()
        rows = [_row(r) for r in conn3.execute(
            "SELECT id, label, available, datetime_iso FROM slots WHERE available=1 AND datetime_iso>? ORDER BY datetime_iso LIMIT 10",
            (now_iso,),
        ).fetchall()]
        conn3.close()

    return rows


def mark_slot_unavailable(slot_id: str):
    conn = get_connection()
    conn.execute("UPDATE slots SET available=0 WHERE id=?", (slot_id,))
    conn.commit()
    conn.close()


def is_slot_available(slot_id: str) -> bool:
    conn = get_connection()
    now_iso = datetime.now().isoformat()
    row = _row(conn.execute(
        "SELECT available FROM slots WHERE id=? AND datetime_iso>?", (slot_id, now_iso)
    ).fetchone())
    conn.close()
    return bool(row and row["available"])


def create_booking(ref_id: str, name: str, email: str, slot_id: str, slot_label: str, thread_id: str) -> dict:
    conn = get_connection()
    now = datetime.now().isoformat()
    try:
        conn.execute(
            "INSERT INTO bookings (ref_id,name,email,slot_id,slot_label,status,thread_id,created_at,updated_at) VALUES (?,?,?,?,?,'confirmed',?,?,?)",
            (ref_id, name, email, slot_id, slot_label, thread_id, now, now),
        )
        conn.execute("UPDATE slots SET available=0 WHERE id=?", (slot_id,))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    row = _row(conn.execute("SELECT * FROM bookings WHERE ref_id=?", (ref_id,)).fetchone())
    conn.close()
    return row


def get_booking_by_thread(thread_id: str) -> dict | None:
    conn = get_connection()
    row = _row(conn.execute(
        "SELECT * FROM bookings WHERE thread_id=? ORDER BY created_at DESC LIMIT 1", (thread_id,)
    ).fetchone())
    conn.close()
    return row


def cancel_booking(ref_id: str):
    conn = get_connection()
    row = _row(conn.execute("SELECT slot_id FROM bookings WHERE ref_id=?", (ref_id,)).fetchone())
    if row:
        conn.execute("UPDATE slots SET available=1 WHERE id=?", (row["slot_id"],))
        conn.execute(
            "UPDATE bookings SET status='cancelled', updated_at=? WHERE ref_id=?",
            (datetime.now().isoformat(), ref_id),
        )
    conn.commit()
    conn.close()


def upsert_thread(thread_id: str, title: str):
    conn = get_connection()
    now = datetime.now().isoformat()
    conn.execute(
        "INSERT INTO threads (id,title,created_at,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, updated_at=excluded.updated_at",
        (thread_id, title, now, now),
    )
    conn.commit()
    conn.close()


def list_threads() -> list[dict]:
    conn = get_connection()
    rows = [_row(r) for r in conn.execute(
        "SELECT id, title, created_at, updated_at FROM threads ORDER BY updated_at DESC"
    ).fetchall()]
    conn.close()
    return rows


def delete_thread(thread_id: str):
    conn = get_connection()
    conn.execute("DELETE FROM threads WHERE id=?", (thread_id,))
    conn.commit()
    conn.close()

import os
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

DATABASE_URL = os.getenv("DATABASE_URL")  # Set on Render for PostgreSQL

# ---------------------------------------------------------------------------
# Connection helpers
# ---------------------------------------------------------------------------

def get_connection():
    """Return a database connection — PostgreSQL on Render, SQLite locally."""
    if DATABASE_URL:
        import psycopg2
        import psycopg2.extras
        conn = psycopg2.connect(DATABASE_URL)
        conn.cursor_factory = psycopg2.extras.RealDictCursor
        return conn
    else:
        db_path = os.getenv("SQLITE_DB_PATH", "./data/agent_state.db")
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn


def execute(conn, query, params=()):
    """Execute a query on either PostgreSQL or SQLite.

    Translates SQLite-style ? placeholders to PostgreSQL %s when needed.
    Returns the cursor so callers can do .fetchone() / .fetchall().
    """
    if DATABASE_URL:
        query = query.replace("?", "%s")
        cur = conn.cursor()
        cur.execute(query, params)
        return cur
    else:
        return conn.execute(query, params)


def _row(r):
    """Normalise a DB row to a plain dict regardless of backend."""
    if r is None:
        return None
    return dict(r)


# ---------------------------------------------------------------------------
# Schema init
# ---------------------------------------------------------------------------

def init_db():
    conn = get_connection()
    if DATABASE_URL:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS slots (
                id TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                available INTEGER DEFAULT 1,
                datetime_iso TEXT NOT NULL
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS bookings (
                id SERIAL PRIMARY KEY,
                ref_id TEXT UNIQUE,
                name TEXT,
                email TEXT,
                slot_id TEXT,
                slot_label TEXT,
                status TEXT DEFAULT 'confirmed',
                thread_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS threads (
                id TEXT PRIMARY KEY,
                title TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        cur.close()
    else:
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


# ---------------------------------------------------------------------------
# Slot seeding
# ---------------------------------------------------------------------------

def seed_slots():
    """Seed future weekday slots — safe to call on every startup."""
    conn = get_connection()
    cur = execute(conn, "SELECT COUNT(*) as count FROM slots WHERE available = 1")
    row = _row(cur.fetchone())
    count = row["count"] if row else 0
    if count >= 5:
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

    if DATABASE_URL:
        cur2 = conn.cursor()
        for s in slots:
            cur2.execute(
                "INSERT INTO slots (id, label, available, datetime_iso) VALUES (%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING",
                s,
            )
        conn.commit()
        cur2.close()
    else:
        for s in slots:
            conn.execute(
                "INSERT OR IGNORE INTO slots (id, label, available, datetime_iso) VALUES (?,?,?,?)", s
            )
        conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Slot queries
# ---------------------------------------------------------------------------

def get_available_slots() -> list[dict]:
    """Return future available slots, refreshing if all are past."""
    conn = get_connection()
    now_iso = datetime.now().isoformat()
    cur = execute(
        conn,
        "SELECT id, label, available, datetime_iso FROM slots WHERE available = 1 AND datetime_iso > ? ORDER BY datetime_iso LIMIT 10",
        (now_iso,),
    )
    rows = [_row(r) for r in cur.fetchall()]
    conn.close()

    if not rows:
        conn2 = get_connection()
        execute(conn2, "DELETE FROM slots")
        conn2.commit()
        conn2.close()
        seed_slots()
        conn3 = get_connection()
        now_iso = datetime.now().isoformat()
        cur3 = execute(
            conn3,
            "SELECT id, label, available, datetime_iso FROM slots WHERE available = 1 AND datetime_iso > ? ORDER BY datetime_iso LIMIT 10",
            (now_iso,),
        )
        rows = [_row(r) for r in cur3.fetchall()]
        conn3.close()

    return rows


def mark_slot_unavailable(slot_id: str):
    conn = get_connection()
    execute(conn, "UPDATE slots SET available = 0 WHERE id = ?", (slot_id,))
    conn.commit()
    conn.close()


def is_slot_available(slot_id: str) -> bool:
    conn = get_connection()
    now_iso = datetime.now().isoformat()
    cur = execute(
        conn,
        "SELECT available FROM slots WHERE id = ? AND datetime_iso > ?",
        (slot_id, now_iso),
    )
    row = _row(cur.fetchone())
    conn.close()
    return bool(row and row["available"])


# ---------------------------------------------------------------------------
# Booking operations
# ---------------------------------------------------------------------------

def create_booking(ref_id: str, name: str, email: str, slot_id: str, slot_label: str, thread_id: str) -> dict:
    conn = get_connection()
    now = datetime.now().isoformat()
    try:
        execute(
            conn,
            """INSERT INTO bookings (ref_id, name, email, slot_id, slot_label, status, thread_id, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)""",
            (ref_id, name, email, slot_id, slot_label, thread_id, now, now),
        )
        execute(conn, "UPDATE slots SET available = 0 WHERE id = ?", (slot_id,))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    cur = execute(conn, "SELECT * FROM bookings WHERE ref_id = ?", (ref_id,))
    row = _row(cur.fetchone())
    conn.close()
    return row


def get_booking_by_thread(thread_id: str) -> dict | None:
    conn = get_connection()
    cur = execute(
        conn,
        "SELECT * FROM bookings WHERE thread_id = ? ORDER BY created_at DESC LIMIT 1",
        (thread_id,),
    )
    row = _row(cur.fetchone())
    conn.close()
    return row


def cancel_booking(ref_id: str):
    conn = get_connection()
    cur = execute(conn, "SELECT slot_id FROM bookings WHERE ref_id = ?", (ref_id,))
    row = _row(cur.fetchone())
    if row:
        execute(conn, "UPDATE slots SET available = 1 WHERE id = ?", (row["slot_id"],))
        execute(
            conn,
            "UPDATE bookings SET status='cancelled', updated_at=? WHERE ref_id=?",
            (datetime.now().isoformat(), ref_id),
        )
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Thread operations
# ---------------------------------------------------------------------------

def upsert_thread(thread_id: str, title: str):
    conn = get_connection()
    now = datetime.now().isoformat()
    if DATABASE_URL:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO threads (id, title, created_at, updated_at) VALUES (%s,%s,%s,%s)
               ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, updated_at=EXCLUDED.updated_at""",
            (thread_id, title, now, now),
        )
        conn.commit()
        cur.close()
    else:
        conn.execute(
            """INSERT INTO threads (id, title, created_at, updated_at) VALUES (?,?,?,?)
               ON CONFLICT(id) DO UPDATE SET title=excluded.title, updated_at=excluded.updated_at""",
            (thread_id, title, now, now),
        )
        conn.commit()
    conn.close()


def list_threads() -> list[dict]:
    conn = get_connection()
    cur = execute(conn, "SELECT id, title, created_at, updated_at FROM threads ORDER BY updated_at DESC")
    rows = [_row(r) for r in cur.fetchall()]
    conn.close()
    return rows


def delete_thread(thread_id: str):
    conn = get_connection()
    execute(conn, "DELETE FROM threads WHERE id = ?", (thread_id,))
    conn.commit()
    conn.close()

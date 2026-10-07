import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from server.app.core.config import settings

Base = declarative_base()

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True if not settings.DATABASE_URL.startswith("sqlite") else False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


from pathlib import Path


def _sync_sqlite_columns():
    """Ensure newly added columns are present in existing SQLite database files."""
    if not settings.DATABASE_URL.startswith("sqlite"):
        return
    import sqlite3
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    if not Path(db_path).exists():
        return
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        target_columns = {
            "device_software": [
                ("version_source", "VARCHAR(64) DEFAULT 'unknown'"),
                ("version_fetched_at", "DATETIME"),
                ("is_stale", "BOOLEAN DEFAULT 0"),
            ],
            "device_drivers": [
                ("device_class_guid", "VARCHAR(128) DEFAULT ''"),
                ("source", "VARCHAR(64) DEFAULT 'pnp_entity'"),
                ("is_stale", "BOOLEAN DEFAULT 0"),
            ],
            "threat_reputations": [
                ("source", "VARCHAR(64) DEFAULT 'virustotal'"),
                ("is_stale", "BOOLEAN DEFAULT 0"),
            ],
            "vulnerability_catalog": [
                ("cve_source", "VARCHAR(64) DEFAULT 'osv'"),
                ("cve_fetched_at", "DATETIME"),
            ],
        }
        for table, cols in target_columns.items():
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            if not cursor.fetchone():
                continue
            cursor.execute(f"PRAGMA table_info({table})")
            existing = {row[1] for row in cursor.fetchall()}
            for col_name, col_def in cols:
                if col_name not in existing:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[DB] SQLite column sync notice: {e}")


def init_db():
    Base.metadata.create_all(bind=engine)
    _sync_sqlite_columns()

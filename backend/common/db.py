import datetime
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from sqlalchemy import Column, DateTime, Integer, String, Text, create_engine, select
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy.orm import declarative_base, sessionmaker
    SQLALCHEMY_AVAILABLE = True
except ImportError:
    SQLALCHEMY_AVAILABLE = False
    declarative_base = lambda: object

Base = declarative_base() if SQLALCHEMY_AVAILABLE else object

# Model definitions
if SQLALCHEMY_AVAILABLE:
    class ScanSnapshot(Base):
        __tablename__ = "scan_snapshots"

        id = Column(Integer, primary_key=True, autoincrement=True)
        created_at = Column(DateTime, default=datetime.datetime.utcnow)
        mode = Column(String(50), default="full")
        app_count = Column(Integer, default=0)
        manifest_data = Column(Text, nullable=True)
        apps_data = Column(Text, nullable=True)
        delta_data = Column(Text, nullable=True)

    class LatestVersion(Base):
        __tablename__ = "latest_versions"

        id = Column(Integer, primary_key=True, autoincrement=True)
        app_name = Column(String(255), unique=True, index=True, nullable=False)
        latest_version = Column(String(100), nullable=False)
        source = Column(String(100), default="seed")
        updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    class DriverHistory(Base):
        __tablename__ = "driver_history"

        id = Column(Integer, primary_key=True, autoincrement=True)
        created_at = Column(DateTime, default=datetime.datetime.utcnow)
        missing_drivers = Column(Text, nullable=True)
        installed_drivers = Column(Text, nullable=True)
        risk_summary = Column(Text, nullable=True)


_ENGINE = None
_SESSION_FACTORY = None
_DB_INITIALIZED = False
_DB_AVAILABLE = False

# Local fallback store when Postgres is unreachable
_LOCAL_FALLBACK_STORE = {
    "scan_snapshots": [],
    "driver_history": [],
    "latest_versions": {},
}


def _get_database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if url:
        return url
    
    user = os.getenv("POSTGRES_USER", "postgres")
    pwd = os.getenv("POSTGRES_PASSWORD", "postgres")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    db_name = os.getenv("POSTGRES_DB", "system_revamp")
    
    return f"postgresql://{user}:{pwd}@{host}:{port}/{db_name}"


def _seed_initial_versions(session):
    """Seed initial latest versions catalog if table is empty."""
    try:
        count = session.query(LatestVersion).count()
        if count == 0:
            json_file = Path(__file__).resolve().parents[1] / "latest_versions.json"
            if json_file.exists():
                with open(json_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for app_name, v in data.items():
                        session.add(
                            LatestVersion(
                                app_name=str(app_name).strip(),
                                latest_version=str(v).strip(),
                                source="seed",
                            )
                        )
                    session.commit()
    except Exception as e:
        session.rollback()
        print(f"[DB] Warning during version seeding: {e}")


def init_db() -> bool:
    """Initialize database tables and pre-seed initial catalog."""
    global _ENGINE, _SESSION_FACTORY, _DB_INITIALIZED, _DB_AVAILABLE

    if not SQLALCHEMY_AVAILABLE:
        print("[DB] SQLAlchemy not installed. Operating in fallback mode.")
        _DB_AVAILABLE = False
        _DB_INITIALIZED = True
        _seed_fallback_store()
        return False

    if _DB_INITIALIZED and _DB_AVAILABLE:
        return True

    db_url = _get_database_url()
    try:
        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            pool_recycle=300,
            connect_args={"connect_timeout": 3} if "postgresql" in db_url else {},
        )
        # Test connection
        with engine.connect() as conn:
            Base.metadata.create_all(bind=engine)
        
        _ENGINE = engine
        _SESSION_FACTORY = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        _DB_AVAILABLE = True
        _DB_INITIALIZED = True
        
        # Seed initial data
        with _SESSION_FACTORY() as session:
            _seed_initial_versions(session)
            
        print(f"[DB] PostgreSQL database successfully connected and initialized.")
        return True
    except Exception as e:
        print(f"[DB] PostgreSQL not reachable ({e}). Operating in memory/file fallback mode.")
        _DB_AVAILABLE = False
        _DB_INITIALIZED = True
        _seed_fallback_store()
        return False


def _seed_fallback_store():
    """Populate fallback store from latest_versions.json."""
    try:
        json_file = Path(__file__).resolve().parents[1] / "latest_versions.json"
        if json_file.exists():
            with open(json_file, "r", encoding="utf-8") as f:
                _LOCAL_FALLBACK_STORE["latest_versions"] = json.load(f)
    except Exception:
        pass


def get_db_session():
    """Context-managed session with safety rollback."""
    if not _DB_INITIALIZED:
        init_db()

    if _DB_AVAILABLE and _SESSION_FACTORY:
        return _SESSION_FACTORY()
    return None


# -------------------------------------------------------------
# Data Access Functions (with transparent fallback)
# -------------------------------------------------------------

def save_scan_snapshot(mode: str, manifest: Dict[str, Any], apps: List[Dict[str, Any]], delta: Optional[Dict[str, Any]] = None) -> bool:
    """Saves a scan snapshot to PostgreSQL or local fallback."""
    session = get_db_session()
    if session:
        try:
            snapshot = ScanSnapshot(
                mode=mode,
                app_count=len(apps),
                manifest_data=json.dumps(manifest),
                apps_data=json.dumps(apps),
                delta_data=json.dumps(delta) if delta else None,
            )
            session.add(snapshot)
            session.commit()
            return True
        except Exception as e:
            session.rollback()
            print(f"[DB] Error saving scan snapshot: {e}")
        finally:
            session.close()

    # Fallback to local store
    entry = {
        "created_at": datetime.datetime.utcnow().isoformat(),
        "mode": mode,
        "manifest": manifest,
        "apps": apps,
        "delta": delta,
    }
    _LOCAL_FALLBACK_STORE["scan_snapshots"].append(entry)
    return True


def get_latest_scan_snapshot() -> Optional[Dict[str, Any]]:
    """Retrieves the most recent scan snapshot."""
    session = get_db_session()
    if session:
        try:
            snapshot = (
                session.query(ScanSnapshot)
                .order_by(ScanSnapshot.created_at.desc())
                .first()
            )
            if snapshot:
                return {
                    "id": snapshot.id,
                    "created_at": snapshot.created_at.isoformat() if snapshot.created_at else None,
                    "mode": snapshot.mode,
                    "app_count": snapshot.app_count,
                    "manifest": json.loads(snapshot.manifest_data) if snapshot.manifest_data else {},
                    "apps": json.loads(snapshot.apps_data) if snapshot.apps_data else [],
                    "delta": json.loads(snapshot.delta_data) if snapshot.delta_data else None,
                }
        except Exception as e:
            print(f"[DB] Error getting latest snapshot: {e}")
        finally:
            session.close()

    # Fallback
    if _LOCAL_FALLBACK_STORE["scan_snapshots"]:
        return _LOCAL_FALLBACK_STORE["scan_snapshots"][-1]
    
    # Try reading legacy file if exists
    legacy_file = Path(__file__).resolve().parents[1] / "cache" / "offline_packages" / "last_scan_snapshot.json"
    if legacy_file.exists():
        try:
            with open(legacy_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
            
    return None


def get_all_latest_versions() -> Dict[str, str]:
    """Returns a dictionary of app_name -> latest_version."""
    session = get_db_session()
    if session:
        try:
            rows = session.query(LatestVersion).all()
            if rows:
                return {row.app_name: row.latest_version for row in rows}
        except Exception as e:
            print(f"[DB] Error fetching latest versions: {e}")
        finally:
            session.close()

    if _LOCAL_FALLBACK_STORE["latest_versions"]:
        return dict(_LOCAL_FALLBACK_STORE["latest_versions"])

    # File fallback
    json_file = Path(__file__).resolve().parents[1] / "latest_versions.json"
    if json_file.exists():
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def upsert_latest_version(app_name: str, version_str: str, source: str = "check") -> bool:
    """Inserts or updates an app's latest version in the database."""
    session = get_db_session()
    if session:
        try:
            existing = session.query(LatestVersion).filter_by(app_name=app_name).first()
            if existing:
                existing.latest_version = version_str
                existing.source = source
                existing.updated_at = datetime.datetime.utcnow()
            else:
                new_item = LatestVersion(
                    app_name=app_name,
                    latest_version=version_str,
                    source=source,
                )
                session.add(new_item)
            session.commit()
            return True
        except Exception as e:
            session.rollback()
            print(f"[DB] Error upserting latest version: {e}")
        finally:
            session.close()

    _LOCAL_FALLBACK_STORE["latest_versions"][app_name] = version_str
    return True


def save_driver_history(missing_drivers: List[Dict[str, Any]], installed_drivers: List[Dict[str, Any]], risk_summary: Dict[str, Any]) -> bool:
    """Saves a driver scan run to history."""
    session = get_db_session()
    if session:
        try:
            record = DriverHistory(
                missing_drivers=json.dumps(missing_drivers),
                installed_drivers=json.dumps(installed_drivers),
                risk_summary=json.dumps(risk_summary),
            )
            session.add(record)
            session.commit()
            return True
        except Exception as e:
            session.rollback()
            print(f"[DB] Error saving driver history: {e}")
        finally:
            session.close()

    _LOCAL_FALLBACK_STORE["driver_history"].append({
        "created_at": datetime.datetime.utcnow().isoformat(),
        "missing_drivers": missing_drivers,
        "installed_drivers": installed_drivers,
        "risk_summary": risk_summary,
    })
    return True


def get_latest_driver_history() -> Optional[Dict[str, Any]]:
    """Retrieves the most recent driver scan result."""
    session = get_db_session()
    if session:
        try:
            record = (
                session.query(DriverHistory)
                .order_by(DriverHistory.created_at.desc())
                .first()
            )
            if record:
                return {
                    "id": record.id,
                    "created_at": record.created_at.isoformat() if record.created_at else None,
                    "missing_drivers": json.loads(record.missing_drivers) if record.missing_drivers else [],
                    "installed_drivers": json.loads(record.installed_drivers) if record.installed_drivers else [],
                    "risk_summary": json.loads(record.risk_summary) if record.risk_summary else {},
                }
        except Exception as e:
            print(f"[DB] Error fetching driver history: {e}")
        finally:
            session.close()

    if _LOCAL_FALLBACK_STORE["driver_history"]:
        return _LOCAL_FALLBACK_STORE["driver_history"][-1]
    return None

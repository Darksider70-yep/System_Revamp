import os
import pytest
from pathlib import Path

# Ensure tests use an isolated test database file
TEST_DB_PATH = Path(__file__).resolve().parents[1] / "server_data" / "test_fleet.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

from server.app.core.config import settings
settings.DATABASE_URL = f"sqlite:///{TEST_DB_PATH}"

from server.app.core.database import set_database_url, init_db, engine, Base
set_database_url(f"sqlite:///{TEST_DB_PATH}")
from server.main import seed_initial_admin


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Create isolated test database and tear down after tests finish."""
    set_database_url(f"sqlite:///{TEST_DB_PATH}")
    if TEST_DB_PATH.exists():
        try:
            TEST_DB_PATH.unlink()
        except Exception:
            pass

    init_db()
    seed_initial_admin()
    yield

    # Teardown
    engine.dispose()
    if TEST_DB_PATH.exists():
        try:
            TEST_DB_PATH.unlink()
        except Exception:
            pass

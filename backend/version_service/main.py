from pathlib import Path
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

_SERVICE_DIR = Path(__file__).resolve().parent
_BACKEND_ROOT = _SERVICE_DIR.parent
if str(_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVICE_DIR))
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

try:
    from utils.version_checker import check_latest_versions
except ModuleNotFoundError:
    from backend.version_service.utils.version_checker import check_latest_versions

app = FastAPI(
    title="Version Intelligence Service",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Version Intelligence Service running 🚀"}


@app.post("/check-versions")
def check_versions(installed_apps: dict):
    try:
        results = check_latest_versions(installed_apps)
        return {"apps": results}
    except Exception as e:
        return {"error": str(e)}

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from utils.version_checker import check_latest_versions

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

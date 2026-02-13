from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from utils.scanner import get_installed_apps

app = FastAPI(
    title="System Scanner Service",
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
    return {"message": "Scanner Service running 🚀"}


@app.get("/scan")
def scan_system():
    try:
        apps = get_installed_apps()
        return {"apps": apps}
    except Exception as e:
        return {"error": str(e)}

from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from utils.scanner import get_installed_apps
from utils.version_checker import check_latest_versions
from routes import simulate_attack
import os
import zipfile
import tempfile
import time
import requests
import shutil
import json

app = FastAPI(
    title="Driver & App Security API",
    description="API for scanning installed apps, simulating attacks, and generating offline update packages.",
    version="1.1.0",
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ⚠️ In production, restrict to your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(simulate_attack.router, tags=["Attack Simulation"])

# --- Installer URL mapping (expand as needed) ---
INSTALLER_URLS = {
    "Google Chrome": "https://dl.google.com/chrome/install/latest/chrome_installer.exe",
    "Microsoft Edge": "https://msedgesetup.azureedge.net/latest/MicrosoftEdgeSetup.exe",
    "Python 3": "https://www.python.org/ftp/python/3.13.3/python-3.13.3-amd64.exe",
    ".NET Runtime 6.0": "https://download.visualstudio.microsoft.com/download/pr/41a44d4d-7cf1-4b3e-b38b-d06b3fd2b6e3/5ab9a0d7e2c90d1d472bdf58d8a9a9ff/dotnet-runtime-6.0.32-win-x64.exe",
    ".NET Runtime 8.0": "https://download.visualstudio.microsoft.com/download/pr/d3d896c4-43e4-469f-9db7-2f3dc48c8f8c/4c94799b77f865cafd076d0d89992a76/dotnet-runtime-8.0.10-win-x64.exe",
}


# --- Scan Endpoint ---
@app.get("/scan", tags=["Scanner"])
async def scan_system():
    try:
        installed_apps = get_installed_apps()
        installed_apps_dict = {app["name"]: app["version"] for app in installed_apps}
        latest_info = check_latest_versions(installed_apps_dict)
        return {"apps": latest_info}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# --- Offline Package Generator ---
@app.get("/generate-offline-package", tags=["Updates"])
async def generate_offline_package(background_tasks: BackgroundTasks):
    """
    Generate an offline update package with real installers for known apps.
    """
    timestamp = int(time.time())
    temp_dir = tempfile.mkdtemp()
    zip_path = os.path.join(temp_dir, f"offline_update_{timestamp}.zip")

    try:
        with zipfile.ZipFile(zip_path, "w") as zipf:
            # Metadata
            metadata = {
                "generated_at": time.ctime(timestamp),
                "included_apps": list(INSTALLER_URLS.keys())
            }
            zipf.writestr("metadata.json", json.dumps(metadata, indent=2))

            for app, url in INSTALLER_URLS.items():
                try:
                    resp = requests.get(url, stream=True, timeout=30)
                    if resp.status_code == 200:
                        installer_name = os.path.basename(url.split("?")[0])
                        installer_tmp = os.path.join(temp_dir, installer_name + ".part")

                        with open(installer_tmp, "wb") as f:
                            for chunk in resp.iter_content(1024 * 1024):
                                f.write(chunk)

                        final_path = installer_tmp[:-5]  # rename from .part → final
                        os.rename(installer_tmp, final_path)
                        zipf.write(final_path, arcname=installer_name)
                    else:
                        zipf.writestr(f"{app}_ERROR.txt", f"Failed to download (HTTP {resp.status_code}) from {url}\n")
                except Exception as e:
                    zipf.writestr(f"{app}_ERROR.txt", f"Download failed: {str(e)}\n")

        # Use shutil to cleanup everything
        def cleanup(path: str, folder: str):
            if os.path.exists(path):
                os.remove(path)
            if os.path.exists(folder):
                shutil.rmtree(folder, ignore_errors=True)

        background_tasks.add_task(cleanup, zip_path, temp_dir)

        return FileResponse(
            path=zip_path,
            filename="offline_update_package.zip",
            media_type="application/zip",
        )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

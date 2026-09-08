# System Revamp - Setup and Installation Guide

Step-by-step instructions to install prerequisites, configure environment variables, start backend microservices, and launch the React dashboard.

---

## 1. Prerequisites

- **Python**: Version `3.10` or higher (`3.11+` recommended)
- **Node.js**: Version `18.x` or higher (`npm` included)
- **Operating System**: Windows 10/11 (fully featured with Registry, Driver, Authenticode, and Winget integrations). macOS and Linux are supported for core app scanning.
- **Optional**: [VirusTotal API Key](https://www.virustotal.com/) for live binary threat intelligence.

---

## 2. Backend Installation & Setup

### Python Virtual Environment Setup

From the repository root:

```powershell
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
.\venv\Scripts\Activate.ps1
```

### Install Dependencies

Install the required Python packages:

```powershell
pip install fastapi uvicorn requests packaging
```

*(If running behind a corporate proxy or restricted environment, ensure `pip` has network access).*

---

## 3. Starting the Backend Services

System Revamp utilizes four distinct FastAPI services. You can start them in separate PowerShell terminals or using a background runner:

### Terminal 1: Scanner Service (Port 8000)
```powershell
.\venv\Scripts\Activate.ps1
uvicorn backend.scanner_service.main:app --host 127.0.0.1 --port 8000 --reload
```

### Terminal 2: Driver Risk Service (Port 8001)
```powershell
.\venv\Scripts\Activate.ps1
uvicorn backend.drivers_api:app --host 127.0.0.1 --port 8001 --reload
```

### Terminal 3: Version Intelligence Service (Port 8002)
```powershell
.\venv\Scripts\Activate.ps1
uvicorn backend.version_service.main:app --host 127.0.0.1 --port 8002 --reload
```

### Terminal 4: Software Protection Service (Port 8003)
```powershell
.\venv\Scripts\Activate.ps1
# Optional: Set VirusTotal API Key in the environment
$env:VT_API_KEY="your_virustotal_api_key_here"

uvicorn backend.protection_service.main:app --host 127.0.0.1 --port 8003 --reload
```

> [!TIP]
> Alternatively, you can save your VirusTotal API key in a plain text file at `~/.system_revamp_vt_api_key` (`C:\Users\<YourUser>\.system_revamp_vt_api_key`). The Protection Service will automatically detect and load it.

---

## 4. Frontend Setup & Execution

1. Navigate to the `frontend` directory:
   ```powershell
   cd frontend
   ```
2. Install npm dependencies:
   ```powershell
   npm install
   ```
3. Start the React development server:
   ```powershell
   npm start
   ```
4. The dashboard will open automatically at:
   ```
   http://localhost:3000
   ```

---

## 5. Service Port Mapping Summary

| Service | Address | Swagger UI Docs |
|---|---|---|
| **Scanner Service** | `http://127.0.0.1:8000` | `http://127.0.0.1:8000/docs` |
| **Driver Risk Service** | `http://127.0.0.1:8001` | `http://127.0.0.1:8001/docs` |
| **Version Service** | `http://127.0.0.1:8002` | `http://127.0.0.1:8002/docs` |
| **Protection Service** | `http://127.0.0.1:8003` | `http://127.0.0.1:8003/docs` |
| **React Dashboard** | `http://localhost:3000` | N/A |

# System Revamp — Setup and Installation Guide

Complete instructions for configuring environment variables, launching the containerized core stack via Docker Compose, and running native Windows hardware/protection microservices.

---

## 1. 🏗️ Architecture & Deployment Model

System Revamp uses a **hybrid deployment model**:
- **Containerized Core Stack (Linux Containers via Docker Compose)**: PostgreSQL, Redis, Scanner Service (Port 8000), Version Intelligence Service (Port 8002), and the React 18 frontend (Port 3000).
- **Native Windows Host Services**: Driver Risk Service (Port 8001) and Software Protection Service (Port 8003) run natively on the Windows host to directly interface with Windows CIM (`Get-CimInstance`), PnP utilities (`pnputil.exe`), Windows Update (`UsoClient.exe`), and Authenticode digital signatures (`Get-AuthenticodeSignature`).
- **Shared Persistent State**: Native services connect to the containerized PostgreSQL (`localhost:5432`) and Redis (`localhost:6379`) instances via standard TCP connections.

---

## 2. 📋 Prerequisites

- **Docker Desktop**: Installed and running (with Linux containers enabled).
- **Python**: Version `3.10` or higher (`3.11+` recommended) on the Windows host.
- **Node.js** *(Optional if using Docker for frontend)*: Version `18.x` or higher.
- **Operating System**: Windows 10/11 for full driver, Authenticode, and Windows Update management.
- **Optional**: [VirusTotal API Key](https://www.virustotal.com/) for live binary threat intelligence.

---

## 3. ⚙️ Environment Configuration

1. Copy `.env.example` to `.env` in the repository root:
   ```powershell
   Copy-Item .env.example .env
   ```
2. Adjust environment variables if needed:
   ```env
   # PostgreSQL Configuration
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=postgres
   POSTGRES_DB=system_revamp
   POSTGRES_PORT=5432
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/system_revamp

   # Redis Configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_URL=redis://localhost:6379/0

   # Threat Protection & VirusTotal API
   VT_API_KEY=your_virustotal_api_key_here
   VT_RATE_LIMIT_PER_MINUTE=4
   ```

---

## 4. 🚀 Quickstart: Launching the System

### Step 1: Start Containerized Core Stack (Docker Compose)

From the repository root, start PostgreSQL, Redis, Scanner Service, Version Intelligence Service, and the React Frontend:

```powershell
docker compose up --build -d
```

Verify that all containers are healthy:
```powershell
docker compose ps
```

### Step 2: Start Native Windows Microservices

Install backend Python dependencies in a virtual environment on Windows:

```powershell
# Create & activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r backend/requirements.txt
```

#### Terminal 1: Driver Risk Service (Port 8001)
```powershell
.\venv\Scripts\Activate.ps1
uvicorn backend.drivers_api:app --host 127.0.0.1 --port 8001 --reload
```

#### Terminal 2: Software Protection Service (Port 8003)
```powershell
.\venv\Scripts\Activate.ps1
uvicorn backend.protection_service.main:app --host 127.0.0.1 --port 8003 --reload
```

> [!TIP]
> The native services will automatically read `.env` and connect to the containerized PostgreSQL on `localhost:5432` and Redis on `localhost:6379`. If Docker is not running, services gracefully fall back to local file/memory storage.

### Step 3: Access Dashboard

Open your browser to:
```
http://localhost:3000
```

---

## 5. 🛠️ Standalone / Development Mode (Without Docker)

If developing locally without Docker Desktop, you can run all 4 services and the React app manually:

1. **Terminal 1 (Scanner :8000)**: `uvicorn backend.scanner_service.main:app --port 8000 --reload`
2. **Terminal 2 (Drivers :8001)**: `uvicorn backend.drivers_api:app --port 8001 --reload`
3. **Terminal 3 (Version :8002)**: `uvicorn backend.version_service.main:app --port 8002 --reload`
4. **Terminal 4 (Protection :8003)**: `uvicorn backend.protection_service.main:app --port 8003 --reload`
5. **Terminal 5 (Frontend :3000)**: `cd frontend; npm start`

---

## 6. 🌐 Service Port & API Mapping Summary

| Service | Runtime Target | Address | Swagger UI Docs | Backing Store |
|---|---|---|---|---|
| **PostgreSQL DB** | Docker Container | `localhost:5432` | N/A | Persistent Volume (`postgres_data`) |
| **Redis Cache** | Docker Container | `localhost:6379` | N/A | Persistent Volume (`redis_data`) |
| **Scanner Service** | Docker Container | `http://127.0.0.1:8000` | `http://127.0.0.1:8000/docs` | PostgreSQL (`scan_snapshots`) |
| **Version Service** | Docker Container | `http://127.0.0.1:8002` | `http://127.0.0.1:8002/docs` | Redis (`sr:version:*`) + PostgreSQL |
| **Frontend UI** | Docker Container | `http://localhost:3000` | N/A | N/A |
| **Driver Risk Service** | Native Windows | `http://127.0.0.1:8001` | `http://127.0.0.1:8001/docs` | PostgreSQL (`driver_history`) |
| **Protection Service** | Native Windows | `http://127.0.0.1:8003` | `http://127.0.0.1:8003/docs` | Redis (`sr:vt:*`, `sr:sig:*`, Rate Limit) |

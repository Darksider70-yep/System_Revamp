# System Revamp - Architecture & System Design

## 1. Overview

**System Revamp** is a high-performance system intelligence, driver diagnostics, update verification, and software protection platform. Built with a decoupled microservice backend (FastAPI/Python) and a modern glassmorphic dashboard (React/Material-UI/Recharts), it provides comprehensive visibility into local software environments, security risks, driver health, and offline package synchronization.

```
                                  +---------------------------------------+
                                  |         React Dashboard (MUI)         |
                                  |      http://localhost:3000            |
                                  +---------------------------------------+
                                         /            |          \      \
                                        /             |           \      \
              +------------------------+              |            \      +-----------------------+
              |                                       |             |                              |
              v                                       v             v                              v
+----------------------------+   +------------------------+   +--------------------------+   +---------------------------+
|   Scanner Service          |   |  Version Service       |   |  Drivers Service         |   |  Protection Service       |
|   Port: 8000               |   |  Port: 8002            |   |  Port: 8001              |   |  Port: 8003               |
|   - Installed App Registry |   |  - Winget / PyPI       |   |  - WMIC / CimInstance    |   |  - Path Resolution        |
|   - Offline Sync Packager  |   |  - Local Version DB    |   |  - Expected Driver Catalog|  |  - SHA256 / VirusTotal    |
|   - Remediation Generator  |   |  - Drift Risk Scoring  |   |  - UsoClient / PnpUtil   |   |  - Authenticode Verifier  |
|   - SSE Attack Simulation  |   +------------------------+   +--------------------------+   +---------------------------+
+----------------------------+
```

---

## 2. Microservice Architecture

The backend consists of four specialized microservices operating independently:

| Service | Port | Primary Responsibility | Key Technologies |
|---|---|---|---|
| **Scanner Service** | `8000` | Local app inventory, offline package generation, remediation scripts, attack simulation | FastAPI, `winreg`, `dpkg-query`, `system_profiler`, ZIP compression |
| **Driver Risk Service** | `8001` | Hardware driver diagnostics, missing driver categorization, automated Windows update triggers | FastAPI, CIM / WMIC, `UsoClient`, `pnputil` |
| **Version Intelligence Service** | `8002` | Live and cached software version resolution, version drift analysis, risk classification | FastAPI, `packaging.version`, Winget CLI, PyPI REST |
| **Software Protection Service** | `8003` | Binary executable discovery, SHA256 hashing, VirusTotal threat intelligence, Authenticode verification | FastAPI, `requests`, `hashlib`, PowerShell Authenticode |

---

## 3. Data Flow & Inter-Service Communication

1. **Initial Dashboard Load**:
   - The React frontend calls `GET http://127.0.0.1:8000/scan` to retrieve the list of installed applications.
   - The frontend transforms the app list into `{appName: currentVersion}` and sends a `POST` request to `http://127.0.0.1:8002/check-versions`.
   - Concurrently, the frontend calls `GET http://127.0.0.1:8001/drivers` to retrieve missing and installed drivers alongside calculated risk scores.
2. **Offline Synchronization Workflow**:
   - The user requests a **Full** or **Delta** package from the UI.
   - Scanner Service (`8000`) reads the latest inventory, compares it against `last_scan_snapshot.json`, generates a manifest, bundles driver and version snapshots, and streams a downloadable ZIP file.
3. **Automated Remediation Workflow**:
   - The user clicks **Export Remediation Script**.
   - Scanner Service maps detected outdated apps to canonical Winget package IDs, maps missing drivers to update routines, and returns a tailored PowerShell script (`system_revamp_remediation.ps1`).
4. **Threat Analysis Workflow**:
   - The user triggers **Run Malware Scan** in the Protection Center.
   - Protection Service (`8003`) locates the underlying executable on disk, calculates its SHA256 checksum, queries VirusTotal (if API key is present) or validates Authenticode digital signatures via PowerShell, returning threat categorizations (`Clean`, `Suspicious`, `Malicious`, `Unknown`).
5. **Real-time SSE Attack Simulation**:
   - Clicking **Simulate Attack** on an application connects an `EventSource` stream to `GET /simulate-attack/{app_name}` on port 8000.
   - The server streams structured log events in real-time simulating reconnaissance, CVE discovery, and exfiltration attempts.

---

## 4. Technology Stack Details

### Frontend
- **Framework**: React 18
- **UI Components & Styling**: Material-UI (MUI v5), `@mui/icons-material`, Emotion
- **Data Visualization**: Recharts (PieChart, BarChart, ResponsiveContainer)
- **Table Handling**: `react-table` (Pagination, Global Search Filter, Multi-column Sorting)
- **Real-time Communication**: Server-Sent Events (SSE) `EventSource` API

### Backend
- **Framework**: FastAPI + Starlette + Uvicorn
- **Version Parsing & Semantic Analysis**: `packaging` library
- **OS Diagnostics**: `winreg` (Windows Registry), PowerShell (`Get-CimInstance`, `Get-AuthenticodeSignature`), `wmic`, `pnputil`, `UsoClient`
- **Threat Intelligence**: VirusTotal API v3 REST client

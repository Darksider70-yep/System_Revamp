# System Revamp

<p align="center">
  <strong>A Modern System Intelligence, Driver Diagnostics, Software Health & Threat Protection Platform</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue.svg" alt="Version 1.0.0" />
  <img src="https://img.shields.io/badge/Frontend-React%2018%20%7C%20MUI-61DAFB.svg" alt="React 18" />
  <img src="https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.11+-009688.svg" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Threat%20Intel-VirusTotal%20%2B%20Authenticode-FF6F00.svg" alt="VirusTotal" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License" />
</p>

---

## 🚀 Overview

**System Revamp** provides a centralized control hub for deep system visibility, driver health, update verification, and software security. Built with a responsive, glassmorphic dark UI in **React 18 & Material-UI** and backed by high-throughput **FastAPI microservices**, System Revamp delivers actionable insights into installed software, outdated dependencies, missing critical drivers, and binary threat reputations.

---

## ✨ Key Features

- 🖥️ **Installed Software Discovery**: High-speed, cross-platform enumeration of installed applications via Windows Registry (`HKLM`/`HKCU`), Linux `dpkg`, and macOS `system_profiler`.
- ⚡ **Version Intelligence & Risk Scoring**: Automatic detection of version drift against live package repositories (Winget, PyPI) and cached version databases with semantic versioning risk analysis.
- 🛡️ **Software Protection Center**: Automated binary path discovery, SHA256 hashing, and reputation scanning powered by **VirusTotal API v3** and Windows **Authenticode** digital signature validation.
- 🔧 **Hardware Driver Diagnostics**: Enumeration of active device drivers with risk classification (Critical, High, Medium, Low) and automated driver installation triggers via `UsoClient` and `pnputil`.
- 📦 **Air-Gapped & Offline Sync**: Generation of full and differential (delta) offline ZIP update packages containing snapshots, delta changes, and version manifests.
- 📜 **One-Click PowerShell Remediation**: Automatic generation of unattended `winget` remediation scripts tailored to your machine's exact update requirements.
- 🎯 **Interactive Threat Simulation**: Real-time Server-Sent Events (SSE) attack simulator demonstrating reconnaissance, CVE detection, and vulnerability exploitation for security testing.

---

## 🏗️ System Architecture

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

## 📂 Microservices Summary

| Service | Port | Endpoint | Description |
|---|---|---|---|
| **Scanner Service** | `8000` | [`http://127.0.0.1:8000`](http://127.0.0.1:8000) | App inventory scan, offline ZIP generator, remediation exporter, SSE attack simulation |
| **Driver Risk Service** | `8001` | [`http://127.0.0.1:8001`](http://127.0.0.1:8001) | Driver detection, impact classification, automated driver download routines |
| **Version Service** | `8002` | [`http://127.0.0.1:8002`](http://127.0.0.1:8002) | Version check against Winget/PyPI/local DB, update status, risk level assessment |
| **Protection Service** | `8003` | [`http://127.0.0.1:8003`](http://127.0.0.1:8003) | Binary location, SHA256 checksum, VirusTotal reputation, Authenticode verification |

---

## ⚡ Quick Start Guide

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 2. Backend Setup
```powershell
# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install fastapi uvicorn requests packaging
```

### 3. Launch Backend Services
Run each service in a separate terminal:
```powershell
# Service 1: Scanner Service
uvicorn backend.scanner_service.main:app --host 127.0.0.1 --port 8000 --reload

# Service 2: Driver Risk Service
uvicorn backend.drivers_api:app --host 127.0.0.1 --port 8001 --reload

# Service 3: Version Service
uvicorn backend.version_service.main:app --host 127.0.0.1 --port 8002 --reload

# Service 4: Protection Service
uvicorn backend.protection_service.main:app --host 127.0.0.1 --port 8003 --reload
```

### 4. Launch Frontend Dashboard
```powershell
cd frontend
npm install
npm start
```
Open **`http://localhost:3000`** in your browser to view the dashboard.

---

## 📖 Complete Documentation

Detailed technical documentation is available in the [`docs/`](docs/) directory:

- 🏛️ [**Architecture & System Design**](docs/architecture.md): Microservice topology, data flow, and technology choices.
- 📡 [**API Reference**](docs/api_reference.md): Endpoints, query parameters, request bodies, and response structures.
- 🛠️ [**Setup & Installation Guide**](docs/setup_and_installation.md): Environment configuration, VirusTotal API key setup, and running services.
- 📦 [**Offline Synchronization & Remediation**](docs/offline_and_remediation.md): Full vs Delta ZIP packaging and Winget remediation script generation.
- 🛡️ [**Driver & Protection Intelligence**](docs/driver_and_protection_engine.md): Driver classification rules, executable path resolution, and malware verification heuristics.

---

## 🛡️ License

This project is open source and available under the [MIT License](LICENSE).

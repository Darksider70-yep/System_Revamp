# System Revamp v2.0

<p align="center">
  <strong>Enterprise Fleet Endpoint Intelligence, PnP Driver Diagnostics, Binary Integrity & Remediation Platform</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-2.0.0-1e3a8a.svg?style=for-the-badge" alt="Version 2.0.0" />
  <img src="https://img.shields.io/badge/Architecture-Fleet%20Agent%20%2B%20Central%20Server-0284c7.svg?style=for-the-badge" alt="Fleet Architecture" />
  <img src="https://img.shields.io/badge/Frontend-React%2018%20%7C%20Design%20Tokens-059669.svg?style=for-the-badge&logo=react&logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/Backend-FastAPI%20%7C%20SQLite%20%7C%20Keyless%20Connectors-0284c7.svg?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Security-Argon2id%20%2B%20HMAC--SHA256-1e293b.svg?style=for-the-badge" alt="Security" />
  <img src="https://img.shields.io/badge/Data%20Integrity-100%25%20Real%20Telemetry-10b981.svg?style=for-the-badge" alt="Data Integrity" />
</p>

---

## Overview

**System Revamp v2.0** is an enterprise-grade endpoint intelligence, hardware driver diagnostics, and automated software vulnerability platform designed for university computer labs and bulk enterprise workstation fleets.

### Core Principles:
1. **Zero Fake or Hardcoded Data**: Every metric, row, status, version, CVE, driver, and hash on screen originates from live agent telemetry, the database, or real upstream connectors (OSV.dev, NVD 2.0, endoflife.date, PyPI). Honest empty states are presented whenever telemetry has not yet been collected.
2. **Soft, Fluid Human-Centric UI**: Built on an authoritative CSS token system (`tokens.css`) with zero hard edges (`border-radius > 0` on every element), a unified Navy / Slate / Cyan / Emerald palette, diffuse shadows, and Lucide React icons (zero emojis).

### Architecture Components:
- **Endpoint Agent (`agent/`)**: Lightweight background daemon (Windows Service / Linux systemd). Uses outbound-only communication (no open listening network ports). Buffers reports in local SQLite queue during network partitions.
- **Central Fleet Server (`server/`)**: Multi-tenant FastAPI platform managing organizations, sites, labs, authoritative risk evaluation, real CVE matching, and keyless upstream connectors with intelligent TTL caching.
- **Admin Console (`frontend/`)**: React 18 administrative console featuring responsive fleet overviews, single-machine deep inspections, staged remediation pipelines, and RFC-4180 CSV compliance reporting.

---

## Key Capabilities

| Capability | Description | Upstream / Collector Source |
|---|---|---|
| **Fleet Software Discovery** | Native registry traversal (`HKLM`/`HKCU`, `WOW6432Node`) on Windows and `dpkg`/`rpm` on Linux. | `agent.collectors.software` |
| **Deterministic Risk Engine** | SemVer drift analysis: Major drift $\ge 2$ or CVSS $\ge 7.0$ = Critical, 1 major = High, minor = Medium, current = Low. | `server.services.risk_engine` |
| **Zero-Upload Threat Protection** | Local SHA-256 calculation and Windows Authenticode digital signature validation. Optional VirusTotal API integration. | `agent.collectors.software` |
| **PnP Hardware Diagnostics** | Windows CIM engine (`Win32_PnPEntity`) filtering for hardware error codes (Code 28 missing, Code 10 failed start, Code 22 disabled). | `agent.collectors.drivers` |
| **Staged Remediation** | Staged rollouts with real dry-run simulation and approval workflows. Dispatches signed commands via `winget` and `pnputil`. | `agent.commands.executor` |
| **Air-Gapped Sync & Installer Cache** | Cryptographically signed offline intelligence bundles with SHA-256 integrity validation. | `server.api.offline_api` |
| **Real Exposure Assessment** | Real-time SSE streaming evaluating installed software against OSV.dev and NVD 2.0 databases with single-use ticket tokens. | `server.services.cve_connectors` |

---

## Quick Start Guide

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 2. Central Server Setup
```powershell
# 1. Install backend dependencies
pip install -r requirements.txt

# 2. Launch Central Server (Port 8000)
python -m server.main
```
*Note: An initial SuperAdmin account is automatically seeded on first launch: `admin@systemrevamp.local` / `Admin@123456`.*

---

### 3. Admin Console Setup
```powershell
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies & launch dev server (Port 3000)
npm install
npm start
```
*The Admin Console opens at `http://localhost:3000`.*

---

### 4. Agent Enrollment & Deployment (Windows Endpoint)
```powershell
# Generate an enrollment token via Admin Console -> Enrollment Tokens.
# On the target managed endpoint:
python -m agent.main enroll --server "http://<SERVER_IP>:8000" --token "<ENROLLMENT_TOKEN>"

# Run immediate baseline scan:
python -m agent.main scan

# Or start daemon background service:
python -m agent.main run-daemon
```

---

## Verification & CI Guard

System Revamp includes a strict CI guard script ensuring zero mock data, zero hard edges, and zero emojis leak into production code:

```powershell
# Run the automated mock and UI integrity scanner:
python scripts/verify_no_mocks.py

# Run the complete automated test suite:
pytest tests/ -p no:cacheprovider

# Build the frontend production bundle:
cd frontend
npm run build
```

---

## In-Depth Documentation

- [**Data Lineage & Provenance Specification**](docs/DATA_LINEAGE.md): End-to-end mapping from Agent collectors through DB tables to Console UI widgets.
- [**Design System Specification**](docs/DESIGN.md): Authoritative design token hierarchy, color palette, zero-hard-edge rules, and typography.
- [**Hardcoded Audit & Remediation Log**](docs/HARDCODED_AUDIT.md): Comprehensive itemized log of all purged placeholder data.
- [**Architecture & System Design**](docs/architecture.md): Topology, communication protocols, and sequence diagrams.
- [**Threat Model & Security**](docs/THREAT_MODEL.md): Attack vectors, rogue agent assumptions, and HMAC mitigations.

---

## License
Licensed under the [MIT License](LICENSE).

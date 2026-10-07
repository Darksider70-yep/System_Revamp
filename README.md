# ⚡ System Revamp v2.0

<p align="center">
  <strong>Enterprise Fleet Endpoint Intelligence, PnP Driver Diagnostics, Binary Integrity & Remediation Platform</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-2.0.0-3b82f6.svg?style=for-the-badge" alt="Version 2.0.0" />
  <img src="https://img.shields.io/badge/Architecture-Fleet%20Agent%20%2B%20Central%20Server-8b5cf6.svg?style=for-the-badge" alt="Fleet Architecture" />
  <img src="https://img.shields.io/badge/Frontend-React%2018%20%7C%20MUI-61DAFB.svg?style=for-the-badge&logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/Backend-FastAPI%20%7C%20PostgreSQL-009688.svg?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Security-Argon2%20%2B%20HMAC%20Device%20Tokens-FF6F00.svg?style=for-the-badge" alt="Security" />
  <img src="https://img.shields.io/badge/License-MIT-10b981.svg?style=for-the-badge" alt="License" />
</p>

---

## 🌟 Overview

**System Revamp v2.0** is an enterprise-grade endpoint intelligence, hardware driver diagnostics, and automated software vulnerability platform designed for university computer labs and bulk enterprise workstation environments.

### Core Components:
1. **Endpoint Agent (`agent/`)**: Lightweight background daemon (Windows Service / Linux systemd). Outbound communication only (no listening network ports). Buffers reports in local SQLite queue if offline.
2. **Central Fleet Server (`server/`)**: Multi-tenant FastAPI platform managing organizations, sites, labs, authoritative risk evaluation, real CVE matching (NVD & OSV.dev), and centralized VirusTotal queueing.
3. **Admin Dashboard (`dashboard/`)**: Dark glassmorphic React 18 administrative console with fleet health heatmaps, single-machine deep inspections, staged remediation pipelines, and CSV/PDF compliance export.

---

## ✨ Key Capabilities

| Capability | Description |
|---|---|
| 🖥️ **Fleet Software Discovery** | Native registry traversal (`HKLM`/`HKCU`, `WOW6432Node`) on Windows and `dpkg`/`rpm` on Linux. |
| ⚡ **Deterministic Risk Engine** | SemVer drift risk scoring: Major jump $\ge 2$ or CVE $\ge 7.0$ = `Critical`, 1 major = `High`, minor = `Medium`, patch/current = `Low`. |
| 🛡️ **Zero-Upload Protection** | Local SHA-256 calculation and Windows Authenticode validation. Server-side VirusTotal queue (4 req/min rate limit) shared across fleet. |
| 🔧 **PnP Hardware Diagnostics** | Windows CIM engine (`Get-CimInstance Win32_PnPEntity`) filtering for hardware error codes (Code 28 missing, Code 10 failed start, Code 22 disabled). |
| 🛠️ **Staged Remediation** | Staged rollout with dry-run previews and approval steps. Executes unattended upgrades via `winget` and `pnputil`. |
| 📦 **Air-Gapped Sync & Installer Cache** | Signed offline intelligence bundles and local LAN installer cache with SHA-256 verification. |
| 🎯 **Real Exposure Assessment** | Real-time SSE streaming evaluating installed software against NVD and OSV.dev CVE databases with ticket-based tokens. |

---

## 🚀 Quick Start Guide

### 1. Central Server Setup
```powershell
# 1. Install dependencies
pip install -r backend/requirements.txt
pip install pyotp argon2-cffi

# 2. Launch Central Server (Port 8080)
python -m server.main..
```
*Default SuperAdmin seeded: `admin@systemrevamp.local` / `Admin@123456`.*

---

### 2. Admin Dashboard Setup
```powershell
cd dashboard
npm install
npm start
```
*Admin console opens at `http://localhost:3000`.*

---

### 3. Agent Enrollment & Deployment (Windows Client)
```powershell
# In PowerShell on managed endpoint:
python -m agent.main enroll --server "http://<SERVER_IP>:8080" --token "<ENROLLMENT_TOKEN>"

# Run manual baseline scan:
python -m agent.main scan

# Or start daemon:
python -m agent.main run-daemon
```

---

## 📖 In-Depth Documentation

* 🏛️ [**Architecture & System Design**](docs/architecture.md): Topology, communication protocols, and sequence diagrams.
* 📡 [**API Reference**](docs/api_reference.md): Complete REST and SSE endpoint specifications for `/api/v2/...`.
* 🛡️ [**Threat Model & Security**](docs/THREAT_MODEL.md): Attack vectors, rogue agent assumptions, and HMAC mitigations.
* 🔄 [**Migration Guide (v1 $\rightarrow$ v2)**](MIGRATION.md): Changes from the legacy single-host architecture.

---

## 📄 License
Licensed under the [MIT License](LICENSE).

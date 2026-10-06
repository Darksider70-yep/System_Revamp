# Migration Guide: System Revamp v1.0 $\rightarrow$ v2.0 Fleet Platform

This document outlines the architectural changes, component consolidations, and security upgrades between legacy System Revamp v1.0 and the current v2.0 Fleet Platform.

---

## 1. Summary of Major Changes

| Category | Legacy Architecture (v1.0) | Fleet Architecture (v2.0) | Reason for Change |
|---|---|---|---|
| **Target Scope** | Single standalone workstation | Multi-tenant computer labs & enterprise fleet (1 to 2,000+ machines) | Enterprise readiness for computer labs & bulk hardware purchases. |
| **Service Model** | 4 separate FastAPI microservices on ports 8000, 8001, 8002, 8003 | Consolidated into 1 **Central Fleet Server** (:8080) + 1 **Endpoint Agent Daemon** | Simplifies deployment, removes port conflicts, and eliminates inbound network exposure on endpoints. |
| **Containerization** | Docker Compose (Linux-only) | Scrapped. Native Windows Service / Linux systemd server & agent installation | Docker cannot access native host Windows Registry, PnP hardware, or Authenticode signatures. |
| **Authentication** | Shared static `X-Internal-Key` with optional bypass | Mandatory Argon2 password hashing, JWT sessions, scoped Enrollment Tokens, and individual HMAC device tokens | Eliminates static shared secrets; enforces multi-tenant isolation. |
| **Risk Scoring** | Discrepancies between docs & code (Node 20 vs 22) | Authoritative deterministic rule table: Major jump $\ge 2$ = Critical, 1 major = High, minor = Medium, patch/current = Low | Ensures reproducible, verified compliance auditing across fleet. |
| **Driver Diagnostics** | INF-catalog heuristics & deprecated `wmic` | Native `Get-CimInstance Win32_PnPEntity` where `ConfigManagerErrorCode != 0` | Accurate detection of missing, corrupted, or disabled hardware drivers. |
| **Attack Simulator** | Simulated placeholder CVEs | **Real Exposure Assessment** matched against OSV.dev and NVD databases | Delivers authentic vulnerability telemetry and fixed-in version guidance. |
| **Threat Intelligence** | Local VirusTotal API key per machine | Centralized server-side VT queue (4 req/min rate limit) & fleet-wide SHA-256 cache | Single API key serves entire fleet; minimizes external network queries. |
| **Remediation** | Hardcoded 8-entry Winget dictionary | Data-driven database table (`app_winget_mappings`) with dry-run preview and approval workflows | Enterprise staged rollouts and error prevention. |

---

## 2. Directory Structure Evolution

```
Legacy v1.0 Structure             v2.0 Fleet Structure
├── backend/                      ├── agent/             # Outbound background daemon
│   ├── scanner_service/   --->   │   ├── collectors/    # System, Software, Drivers, Hashes
│   ├── version_service/   --->   │   ├── commands/      # Allowlisted executor & handlers
│   ├── protection_service/--->   │   └── main.py        # CLI & daemon runner
│   └── drivers_api.py     --->   ├── server/            # Central FastAPI Fleet Server
├── frontend/              --->   │   ├── app/           # Models, Auth, APIs, Services
├── docker-compose.yml (DELETED)  ├── dashboard/         # React 18 Admin Console
                                  ├── installer/         # Windows (GPO/SCCM) & Linux (systemd)
                                  ├── docs/              # Cleaned architecture & specifications
                                  └── tests/             # Comprehensive unit & integration tests
```

---

## 3. Migration Checklist for Administrators

1. **Server Setup**: Run `python -m server.main` on your internal management server (Windows Server or Linux). Default admin: `admin@systemrevamp.local` / `Admin@123456`.
2. **Generate Enrollment Token**: From the Admin Dashboard, navigate to *Labs & Endpoints* $\rightarrow$ *Create Enrollment Token*.
3. **Deploy Agents via GPO / SCCM**: Deploy the agent package to client machines with silent parameters:
   ```powershell
   powershell -ExecutionPolicy Bypass -File install-agent.ps1 -ServerUrl http://<SERVER_IP>:8080 -EnrollToken <TOKEN>
   ```
4. **Monitor Fleet**: Workstations immediately report baseline telemetry and appear in the Admin Dashboard.

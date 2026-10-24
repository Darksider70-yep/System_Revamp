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

**System Revamp v2.0** is an enterprise-grade endpoint intelligence, hardware driver diagnostics, and automated software vulnerability platform designed for university computer labs, academic workstations, and large enterprise workstation fleets.

### Core Principles:
1. **Zero Fake or Hardcoded Data**: Every metric, row, status, version, CVE, driver, and hash on screen originates from live agent telemetry, the database, or real upstream connectors (OSV.dev, NVD 2.0, endoflife.date, PyPI). Honest empty states are presented whenever telemetry has not yet been collected.
2. **Soft, Fluid Human-Centric UI**: Built on an authoritative CSS token system (`tokens.css`) with zero hard edges (`border-radius > 0` on every element), a unified Navy / Slate / Cyan / Emerald palette, diffuse shadows, and Lucide React icons (zero emojis).
3. **Outbound-Only Endpoint Design**: Managed workstations never expose listening network ports. Telemetry and heartbeat reports are transmitted outbound over TLS, with local SQLite buffering during network outages.

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

## Authoritative Documentation Suite

The complete technical and architectural documentation library is organized under [`docs/`](docs/README.md):

| Document | Description |
|---|---|
| [**Documentation Portal & Sitemap**](docs/README.md) | Complete documentation index, visual sitemap, and topic overview. |
| [**Architecture Blueprint**](docs/architecture.md) | Enterprise topology, agent queue state machine, database ER diagram, and sizing metrics. |
| [**Architecture Decision Records**](docs/ADR.md) | Formal ADRs (001–005) covering outbound-only, dual database, HMAC signing, and keyless connectors. |
| [**API Reference Manual**](docs/api_reference.md) | Authoritative REST & streaming SSE API documentation with sequence diagrams and OpenAPI schemas. |
| [**Production Setup & Installation**](docs/setup_and_installation.md) | Production server deployment (systemd / Nginx / TLS), database setup, and agent guides. |
| [**Enterprise Bulk Deployment**](docs/ENTERPRISE_DEPLOYMENT_GPO.md) | Active Directory GPO startup scripts, Microsoft Intune Win32 apps, SCCM, and Ansible. |
| [**High Availability & Failover**](docs/HIGH_AVAILABILITY.md) | Tier 4 scaling (>10k hosts), PostgreSQL Patroni replication, RTO < 30s failover, and jitter backoff. |
| [**Monitoring & Observability**](docs/MONITORING_AND_OBSERVABILITY.md) | Prometheus metrics, Alertmanager rules, Grafana dashboard blueprints, SLOs, and log aggregation. |
| [**Operations & Maintenance Runbook**](docs/OPERATIONS_AND_RUNBOOK.md) | Daily health checks, hot SQLite backups (`VACUUM INTO`), log rotation, and incident playbooks. |
| [**Incident Response & War Games**](docs/INCIDENT_RESPONSE_PLAYBOOK.md) | P1-P4 severity escalation matrix, fleet-wide malware playbooks, post-mortem templates, and drills. |
| [**Production Deployment Checklist**](docs/DEPLOYMENT_CHECKLIST.md) | Security pre-flight validation (T-48h), capacity planning worksheet, and executive sign-off gates. |
| [**Versioning & Upgrades**](docs/VERSIONING_AND_UPGRADES.md) | SemVer 2.0 semantics, client-server compatibility matrix, canary rollouts, and blue-green upgrades. |
| [**Python SDK & Automation**](docs/PYTHON_SDK_EXAMPLES.md) | Production Python SDK client wrapper, automated offline fleet checking, and SSE consumers. |
| [**Driver & Protection Engine**](docs/driver_and_protection_engine.md) | Windows CIM diagnostics, Microsoft Setup Class GUIDs, problem error codes, and Authenticode. |
| [**Air-Gapped Sync & Staged Remediation**](docs/offline_and_remediation.md) | Signed intelligence bundles, LAN installer cache, dry-run previews, and HMAC signing. |
| [**Legacy Migration & Cutover**](docs/LEGACY_MIGRATION_GUIDE.md) | Strategic replacement playbooks for Symantec Altiris, Microsoft Intune/SCCM, JumpCloud, and v1.0. |
| [**Cryptographic Key Management**](docs/KEY_MANAGEMENT.md) | Key hierarchy, 256-bit CSPRNG storage, HSM integration, Shamir secret sharing, and rotation. |
| [**Encryption & Data Protection**](docs/ENCRYPTION_AND_DATA_PROTECTION.md) | SQLCipher, PostgreSQL TDE, 7-year FERPA retention schedule, student data minimization, and GDPR. |
| [**STRIDE Threat Model & Security**](docs/THREAT_MODEL.md) | STRIDE analysis, adversary personas, cryptographic key hierarchy, and mitigations. |
| [**Compliance & Standards Mapping**](docs/COMPLIANCE_AND_AUDITING.md) | Mapping crosswalk to NIST SP 800-53 Rev. 5, CIS Controls v8, ISO/IEC 27001, and CSV auditing. |
| [**Enterprise Standards & SLA**](docs/ENTERPRISE_STANDARDS.md) | SOC 2 Type II alignment, NIST CSF 2.0 mapping, SLA contracts, customer onboarding, and licensing. |
| [**Testing Strategy & Validation**](docs/TESTING_AND_VALIDATION.md) | Testing pyramid, unit test matrix, chaos engineering scenarios, and security regression suites. |
| [**Data Lineage & Provenance Specification**](docs/DATA_LINEAGE.md) | Field-by-field lineage mapping from agent collectors through DB tables to Admin Console widgets. |
| [**Design System Specification**](docs/DESIGN.md) | Authoritative CSS token hierarchy (`tokens.css`), color palette, zero-hard-edge rules, and typography. |
| [**Hardcoded Audit & Remediation Log**](docs/HARDCODED_AUDIT.md) | Comprehensive itemized log of all purged placeholder data and mock keywords. |
| [**v1.0 $\rightarrow$ v2.0 Migration Guide**](MIGRATION.md) | Architectural evolution from legacy multi-service model to consolidated fleet platform. |

---

## Document Dependencies & Operational Cross-References

- **Deploying to air-gapped labs?**
  $\rightarrow$ See: [`offline_and_remediation.md`](docs/offline_and_remediation.md) + [`KEY_MANAGEMENT.md`](docs/KEY_MANAGEMENT.md) + [`ENCRYPTION_AND_DATA_PROTECTION.md`](docs/ENCRYPTION_AND_DATA_PROTECTION.md)

- **Setting up monitoring & alerting?**
  $\rightarrow$ See: [`MONITORING_AND_OBSERVABILITY.md`](docs/MONITORING_AND_OBSERVABILITY.md) + [`OPERATIONS_AND_RUNBOOK.md`](docs/OPERATIONS_AND_RUNBOOK.md)

- **Planning for 10,000+ endpoints?**
  $\rightarrow$ See: [`architecture.md`](docs/architecture.md) (Tier 4 sizing) + [`HIGH_AVAILABILITY.md`](docs/HIGH_AVAILABILITY.md) + [`MONITORING_AND_OBSERVABILITY.md`](docs/MONITORING_AND_OBSERVABILITY.md)

- **Handling a security incident or malware detection?**
  $\rightarrow$ See: [`INCIDENT_RESPONSE_PLAYBOOK.md`](docs/INCIDENT_RESPONSE_PLAYBOOK.md) + [`KEY_MANAGEMENT.md`](docs/KEY_MANAGEMENT.md) + [`THREAT_MODEL.md`](docs/THREAT_MODEL.md)

- **Replacing legacy tools (Altiris, Intune, JumpCloud)?**
  $\rightarrow$ See: [`LEGACY_MIGRATION_GUIDE.md`](docs/LEGACY_MIGRATION_GUIDE.md) + [`ENTERPRISE_DEPLOYMENT_GPO.md`](docs/ENTERPRISE_DEPLOYMENT_GPO.md)

- **Automating fleet operations via Python?**
  $\rightarrow$ See: [`PYTHON_SDK_EXAMPLES.md`](docs/PYTHON_SDK_EXAMPLES.md) + [`api_reference.md`](docs/api_reference.md)

- **Conducting a pre-launch or compliance audit (SOC 2, FERPA, HIPAA)?**
  $\rightarrow$ See: [`DEPLOYMENT_CHECKLIST.md`](docs/DEPLOYMENT_CHECKLIST.md) + [`ENTERPRISE_STANDARDS.md`](docs/ENTERPRISE_STANDARDS.md) + [`ENCRYPTION_AND_DATA_PROTECTION.md`](docs/ENCRYPTION_AND_DATA_PROTECTION.md)

---

## Platform Glossary & Domain Terms

| Term | Definition in System Revamp Platform |
|---|---|
| **Authenticode** | Microsoft digital signature standard verifying binary publisher identity and tamper-free integrity. |
| **CIM (Common Information Model)** | Modern DMTF object-oriented management interface in Windows (`Get-CimInstance`), superseding legacy WMI. |
| **PnP Error Code** | Hardware problem status reported by CIM (e.g. Code 28: Missing Driver, Code 10: Failed to Start, Code 22: Disabled). |
| **Outbound-Only** | Architecture where endpoints never open listening network sockets; all sessions originate outbound over TLS to the server. |
| **WAL Mode** | SQLite Write-Ahead Logging concurrency mode supporting concurrent readers and writers without lock contention. |
| **Air-Gap Bundle** | Cryptographically signed zip bundle carrying threat definitions and installer cache for offline network sync. |
| **HMAC Command Signing** | Server-side cryptographic signature validating remote remediation commands before endpoint execution. |
| **Ephemeral Ticket** | Single-use 30-second token generated for browser SSE streams and burned immediately upon connection. |

---

## License
Licensed under the [MIT License](LICENSE).


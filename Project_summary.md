# System Revamp Project Summary (Phase 11)

This document explains the full platform, feature by feature, and how each part works in production.

## 1) Platform Purpose

System Revamp is an enterprise cybersecurity monitoring platform made of local machine services, a unified machine agent, and a centralized cloud command center.

It provides:
- Real software and driver inventory collection from OS-level sources
- Version intelligence and vulnerability correlation
- Risk scoring and security event generation
- Automated patch orchestration
- Offline package sync for air-gapped environments
- Fleet-wide management, policy enforcement, and playbook automation
- Observability through Prometheus and Grafana

## 2) High-Level Architecture

### Runtime services
- `scanner_service` (port `8000`): software inventory + attack simulation + offline package generation.
- `driver_service` (port `8001`): driver inventory and issues.
- `version_service` (port `8002`): latest-version resolution and version risk classification.
- `monitor_service` (port `8003`): real-time metrics + fast scan + event detection.
- `agent_service` (port `8004`): unified machine agent (scan, events, patching, command execution, offline sync).
- `cloud_core` (port `9000`): machine registry, ingestion, analytics, RBAC auth, command center, group/policy/playbook engines.
- `frontend` (port `3000`): SOC-style React dashboard.
- `postgres` (port `5432`): persistent cloud data store.
- `redis` (port `6379`): queues, cache, pub/sub.
- `prometheus` (port `9090`): metrics scraping.
- `grafana` (port `3001`): dashboards and visualization.

### Core data path
1. Agent collects software, drivers, metrics, and security events from local OS APIs.
2. Agent uploads scan payloads to cloud (`POST /upload-scan`) using machine API key.
3. Cloud queues payloads in Redis and persists data into PostgreSQL via ingestion worker.
4. Cloud recomputes machine state/risk context and publishes updates over WebSocket.
5. Dashboard refreshes through APIs + live sockets (`/live-machines`, `/alerts`).
6. Policies/playbooks may enqueue scan or patch commands.
7. Agent polls cloud command queue, executes actions locally, and reports results.

## 3) Feature-by-Feature Explanation

## 3.1 System Scanning

Implemented in `backend/scanner_service/scanner.py` and `backend/system_monitor_service/fast_scanner.py`.

How it works:
- Windows: scans installed apps from registry uninstall keys.
- Linux: scans installed packages via `dpkg-query`.
- macOS: scans applications via `system_profiler`.
- Results are deduplicated and sorted, then enriched with latest-version intelligence.
- Fast scanner caches full scan results and reruns only when OS change markers move.

Endpoints:
- `GET /scan` (scanner)
- `GET /fast-scan` (monitor)
- `GET /scan` (agent unified scan view)

## 3.2 Driver Detection

Implemented in `backend/drivers_service/drivers_api.py`.

How it works:
- Windows: uses PowerShell CIM (`Win32_PnPSignedDriver`, `Win32_PnPEntity`).
- Linux: uses `lspci -k`; if unavailable, falls back to `/proc/modules`.
- macOS: uses `kmutil showloaded`.
- Detects installed drivers, missing/degraded drivers, and impact severity.

Endpoints:
- `GET /drivers`
- `POST /drivers/download` (runs provider-specific update commands)

## 3.3 Version Intelligence

Implemented in `backend/version_service/version_checker.py`.

How it works:
- Loads local `latest_versions.json` database first.
- If missing locally, attempts live lookups from real sources:
  - PyPI JSON API
  - Winget metadata (`winget show`)
- Computes status (`Up-to-date` or `Update Available`) and risk level (`Low/Medium/High`).
- Uses thread pool + TTL cache for faster bulk lookups.

Endpoint:
- `POST /check-versions`

## 3.4 Risk Scoring

Two layers exist:
- Local/monitor risk scoring: `SecurityEventEngine.risk_score(...)`
- Cloud risk scoring: `risk_score_formula(...)` + recent telemetry breakdown

How it works:
- Inputs include outdated apps, missing drivers, CPU spikes, and security events.
- Produces a 0-100 score used by alerts, dashboard summaries, and policy checks.

Endpoint:
- `GET /risk-score/{machine_id}`

## 3.5 Predictive Risk Engine (ML)

Implemented in `ml_engine/risk_engine.py`.

How it works:
- Pulls real historical telemetry from PostgreSQL:
  - scan trend history
  - outdated/unknown software counts
  - missing driver counts
  - security event density
  - patch command success/failure history
- Builds feature vectors per scan window.
- Trains `RandomForestClassifier` (scikit-learn) if enough samples.
- Predicts probability of future risk escalation and returns level (`Low/Medium/High`).

Endpoint:
- `GET /predict-risk/{machine_id}`

## 3.6 Attack Simulation

Implemented in `backend/scanner_service/main.py`.

How it works:
- Uses detected software + version gap to infer educational attack scenarios.
- Maps version risk to attack profiles (RCE, privilege escalation, etc.).
- Returns remediation guidance.

Endpoints:
- `POST /simulate-attack`
- `GET /simulate-attack/{software}` (legacy compatibility)

## 3.7 Patch Orchestration

Implemented in `cloud_core/patch_orchestrator.py` and used by agent/cloud commands.

How it works:
- Detects provider dynamically by OS:
  - Windows: `winget`
  - Linux: `apt`/`apt-get`
  - macOS: `brew`
- Discovers outdated packages using native package manager commands.
- Installs patches with provider-specific upgrade commands.
- Tracks patch result metrics (`patched/failed`) in Prometheus counters.

Endpoints:
- `POST /auto-patch` (agent executes local automatic patch cycle)
- `POST /machines/{id}/patch` (cloud queues patch command for agent)
- `POST /install-patch` and `GET /patch-status/{id}` (cloud patch command workflow)

## 3.8 Real-Time Monitoring

Implemented in `backend/system_monitor_service`.

How it works:
- `MetricsMonitor` captures CPU/RAM/disk/network from `psutil`.
- Background loops run every few seconds for metrics and incremental scans.
- WebSocket stream (`/live-monitor`) publishes near-real-time operational state.

Endpoints:
- `GET /system-info`
- `GET /system-metrics`
- `GET /security-events`
- `WebSocket /live-monitor`

## 3.9 Security Event Engine

Implemented in `backend/system_monitor_service/event_engine.py`.

How it works:
- Rule-based detectors generate events from:
  - high CPU/memory/disk/network anomalies
  - suspicious process signatures
  - new unknown apps
  - driver removals
  - critical outdated software
- Events are deduplicated with a time window to reduce noise.
- Events feed local risk scoring and cloud ingestion payloads.

## 3.10 Cloud Monitoring and Command Center

Implemented in `cloud_core/scan_routes.py`, `machine_routes.py`, `platform_ops.py`, and `websocket_server.py`.

How it works:
- Registers machines and issues machine API keys.
- Ingests scan uploads and writes normalized records to DB.
- Exposes fleet dashboards, machine details, events, and risk data.
- Supports command queueing (scan/patch) and command-result completion.
- Publishes live updates through Redis-backed WebSocket hubs.

Key endpoints:
- `POST /register-machine`
- `POST /upload-scan`
- `POST /machines/{id}/scan`
- `POST /machines/{id}/patch`
- `GET /machines/{id}/events`
- `GET /dashboard/overview`
- `GET /dashboard/machines`
- `GET /dashboard/machines/{id}`
- `GET /dashboard/heatmap`
- `WebSocket /live-machines`
- `WebSocket /alerts`

## 3.11 Vulnerability Intelligence Integration

Implemented in `cloud_core/vulnerability_intel.py`.

How it works:
- Correlates installed software against real advisory sources:
  - NVD API
  - GitHub Security Advisories API
  - Ubuntu vendor advisories API (Linux/Ubuntu machines)
- Normalizes CVE severity and CVSS scores.
- Deduplicates by source + CVE and sorts by severity.
- Caches per machine/software/version in Redis.

Endpoint:
- `GET /machines/{machine_id}/vulnerabilities`

## 3.12 Enterprise Fleet Management

Implemented in `cloud_core/group_routes.py` and `cloud_core/models.py`.

How it works:
- Creates named machine groups with optional policy and windows.
- Adds machine memberships.
- Queues scan commands for all group members in one call.
- Stores group policy and schedule metadata in PostgreSQL.

Endpoints:
- `POST /groups`
- `GET /groups`
- `POST /groups/{id}/policy`
- `POST /groups/{id}/add-machine`
- `POST /groups/{id}/scan`

## 3.13 Automated Security Policies

Implemented in `cloud_core/policy_playbook.py`.

How it works:
- Evaluates effective policy (global defaults + group overrides):
  - require latest software
  - max risk threshold
  - mandatory driver presence
- On violation, creates `SecurityEvent` and `AuditLog` entries.
- Alerts are forwarded to live alert channel.

## 3.14 Security Playbook Engine

Also implemented in `cloud_core/policy_playbook.py`.

How it works:
- Trigger: risk exceeds emergency threshold -> queue patch-all command.
- Trigger: newly discovered unknown software -> queue forced scan command.
- Trigger: driver count worsens -> generate driver removed alert.
- Uses cooldown windows and optional patch window constraints.

## 3.15 Offline Environment Sync

Implemented in `backend/common/offline_packages.py`, scanner, and agent.

How it works:
- Package generation (`GET /generate-offline-package`):
  - exports latest versions DB
  - computes vulnerability intelligence from installed software
  - exports patch metadata from patch orchestrator
  - writes instructions
- ZIP contains:
  - `updates_manifest.json`
  - `latest_versions.json`
  - `patch_instructions.txt`
- Integrity validation is done using SHA-256 hashes from manifest.
- Applying package updates local intelligence DB and schedules updates.

Endpoints:
- `GET /generate-offline-package` (scanner and agent variants)
- `POST /apply-offline-package` (agent)

## 3.16 Agent Resilience

Implemented in `backend/system_monitor_service/cloud_agent.py` and `backend/agent_service/main.py`.

How it works:
- Registers once and persists machine identity locally.
- If upload fails, payload is persisted in local pending queue file.
- On reconnect, pending queue is flushed before new uploads.
- Handles `401/404` by clearing identity and re-registering.
- Polls cloud command queue and reports command completion.

## 3.17 Data Pipeline and Scaling

Implemented in `cloud_core/platform_ops.py`.

How it works:
- Incoming scan payloads can be queued in Redis (`system_revamp:scan_ingestion`).
- `CloudPipelineWorker` consumes queue with configurable batch size.
- Ingestion writes scan/app/driver/event rows atomically.
- Redis cache invalidation keeps dashboard reads fresh.
- Indexed DB schema supports high-cardinality machine/event/command queries.

Scale-oriented elements:
- Async DB sessions and worker loops
- Redis queue and pub/sub
- Batch ingestion size via env (`CLOUD_SCAN_INGESTION_BATCH_SIZE`)
- Query indexes on machine/timestamp/status dimensions

## 3.18 Advanced Dashboard UI

Implemented in `frontend/src/App.js` + `frontend/src/apiConfig.js`.

How it works:
- Uses React + Material UI + Recharts.
- Pulls cloud + local service APIs with background refresh.
- Uses WebSocket channels for live fleet and alert updates.

Main panels:
- Global Security Overview
- Machine Fleet Status
- Global Security Heatmap
- Security Alerts
- Patch Status
- Predictive Risk Engine
- Enterprise Fleet Groups
- Vulnerability Intelligence Integration
- Offline Sync Panel

## 3.19 Health Monitoring and Metrics

How it works:
- Every service exposes `GET /health`.
- Shared Prometheus middleware injects:
  - request counters
  - request latency histogram
  - in-progress request gauge
  - scan duration histogram
  - patch operation counters
- Every instrumented service exposes `GET /metrics`.

## 3.20 Enterprise Logging and Audit

How it works:
- Local services use structured JSON logs via shared logger formatter.
- Cloud writes persistent audit records for:
  - machine registration
  - scan uploads
  - command queue/complete
  - policy violations
  - playbook actions
  - group actions

Data persisted in `audit_logs` table.

## 3.21 Production Security Hardening

Implemented across `backend/common/api.py`, `cloud_core/security.py`, and `cloud_core/auth.py`.

Controls:
- JWT authentication for cloud user access
- RBAC roles: `admin`, `analyst`, `operator`
- JWT key-id based token rotation (`/auth/rotate-token`)
- Machine API key authentication for agent upload/command poll
- Rate limiting middleware (service-level and cloud-level)
- CORS controls
- Secure response headers
- Standardized error payloads with request IDs

## 4) Database Model Summary

PostgreSQL tables in `cloud_core/models.py`:
- `machines`: machine identity + latest operational state.
- `scan_results`: point-in-time metrics and risk snapshots.
- `apps`: software inventory per scan.
- `drivers`: driver state per scan.
- `security_events`: event timeline per machine.
- `machine_commands`: queued/dispatched/completed scan/patch commands.
- `machine_groups`: fleet group definitions and policies.
- `machine_group_memberships`: machine-group mapping.
- `audit_logs`: immutable action history.

## 5) API Surface by Service (Quick Index)

### Scanner Service (`8000`)
- `GET /health`
- `GET /scan`
- `POST /simulate-attack`
- `GET /simulate-attack/{software}`
- `GET /generate-offline-package`
- `POST /generate-remediation-script`
- `GET /metrics`

### Driver Service (`8001`)
- `GET /health`
- `GET /drivers`
- `POST /drivers/download`
- `GET /metrics`

### Version Service (`8002`)
- `GET /health`
- `POST /check-versions`
- `GET /metrics`

### Monitor Service (`8003`)
- `GET /health`
- `GET /system-info`
- `GET /system-metrics`
- `GET /fast-scan`
- `GET /security-events`
- `WebSocket /live-monitor`
- `GET /metrics`

### Agent Service (`8004`)
- `GET /health`
- `GET /scan`
- `GET /events`
- `GET /offline-packages`
- `GET /pending-patches`
- `GET /generate-offline-package`
- `POST /apply-offline-package`
- `POST /auto-patch`
- `GET /system-info`
- `GET /metrics`

### Cloud Core (`9000`)
- Auth: `POST /auth/login`, `POST /auth/rotate-token`
- Machine registration: `POST /register-machine`
- Ingestion: `POST /upload-scan`
- Dashboard: `GET /dashboard/overview`, `GET /dashboard/machines`, `GET /dashboard/machines/{id}`, `GET /dashboard/heatmap`
- Risk/intel: `GET /risk-score/{id}`, `GET /predict-risk/{id}`, `GET /machines/{id}/vulnerabilities`
- Events: `GET /machines/{id}/events`
- Commands: `POST /machines/{id}/scan`, `POST /machines/{id}/patch`, `POST /install-patch`, `GET /patch-status/{id}`
- Agent command protocol: `GET /agent/commands/next`, `POST /agent/commands/{command_id}/result`
- Fleet groups: `POST /groups`, `GET /groups`, `POST /groups/{id}/policy`, `POST /groups/{id}/add-machine`, `POST /groups/{id}/scan`
- Realtime: `WebSocket /live-machines`, `WebSocket /alerts`
- Ops: `GET /health`, `GET /metrics`

## 6) Observability Stack

Prometheus:
- Config: `observability/prometheus/prometheus.yml`
- Scrapes API `/metrics` endpoints and tracks availability/latency counters.

Grafana:
- Provisioning in `observability/grafana/provisioning`
- Preloaded dashboards in `observability/grafana/dashboards`
- Default login controlled by `GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD`

## 7) Docker Deployment

Primary deployment file: `docker-compose.yml`.

Start:
```bash
docker compose up --build -d
```

Stop:
```bash
docker compose down
```

Important implementation details:
- Healthchecks gate startup dependencies.
- Cloud waits for Postgres and Redis health.
- Frontend waits for backend services to be healthy.
- Prometheus waits for monitored APIs before startup.
- Grafana waits for Prometheus.

## 8) Real Data and Non-Mock Guarantee

This implementation uses live/runtime data paths:
- OS software inventory from registry/dpkg/system_profiler.
- Driver data from PowerShell CIM, `lspci`, `/proc/modules`, or `kmutil`.
- System metrics from `psutil` and host network counters.
- Vulnerability intelligence from live external APIs (NVD, GitHub, Ubuntu vendor advisories).
- Patch operations from native package managers (`winget`, `apt`, `brew`).
- Timestamps generated at runtime in UTC.

## 9) Operational Notes

- Inside containers, scan results reflect container OS context, not host OS.
- For production, rotate secrets and replace default credentials.
- Provide `NVD_API_KEY` and `GITHUB_TOKEN` to reduce rate-limit issues on vulnerability feeds.
- RBAC and rate limits are enforced at cloud API boundaries.


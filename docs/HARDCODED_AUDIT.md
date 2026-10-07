# HARDCODED_AUDIT.md — System Revamp v2.0

> **Generated**: 2026-10-07  
> **Scope**: Full repo — `agent/`, `server/`, `frontend/`, `dashboard/`, `backend/`, `scripts/`, `docs/`  
> **Purpose**: Phase 1 audit for the "Make Everything Real" initiative

---

## Legend

| Classification | Meaning |
|---|---|
| **(a) Replace** | Replace with a real data source (live telemetry, DB query, external API) |
| **(b) Config** | Move to configuration file / env var with documented schema |
| **(c) Test-only** | Move to `tests/` or `fixtures/` — must never load in production |
| **(d) Delete** | Remove entirely — dead code or misleading |

---

## 1. Fake / Sample CVEs and Vulnerability Data

| # | File | Line(s) | What is hardcoded | Classification | Planned Replacement |
|---|---|---|---|---|---|
| 1.1 | `server/app/services/exposure_engine.py` | 8–54 | `SEED_CVES` array — 5 static CVE entries (CVE-2024-21892, CVE-2024-22019, CVE-2023-24329, CVE-2024-32002, CVE-2024-4671) with hardcoded CVSS scores, summaries, and fixed_in versions | **(a) Replace** | Real CVE matching via OSV.dev + NVD API. Results cached in `vulnerability_catalog` with `source`, `fetched_at`, TTL. Seed array deleted. |
| 1.2 | `server/app/services/exposure_engine.py` | 57–72 | `seed_vulnerability_catalog()` called every exposure scan — loads seed CVEs into DB at runtime | **(d) Delete** | Remove — vulnerability data comes from real CVE connectors, not seeds. |
| 1.3 | `server/app/api/exposure_api.py` | 42 | `seed_vulnerability_catalog(db)` call inside SSE stream endpoint | **(d) Delete** | Remove call. DB is populated by real CVE sync service. |
| 1.4 | `backend/routes/simulate_attack.py` | 85, 116 | Fake CVE `CVE-2023-12345` in simulated attack logs and summary | **(c) Test-only** | Move entire simulator to `tests/fixtures/` or behind `--simulated-data` flag with persistent banner. |
| 1.5 | `frontend/src/components/views/OverviewView.jsx` | 380–397 | Hardcoded "Node.js (x64)" with `CVE-2023-30581 (CVSS 8.2)`, `v16.14.0 → v20.18.0`, "Affects 12 machines" | **(a) Replace** | Fetch from `/api/v2/admin/fleet/overview` → `top_outdated_apps` (already wired but hardcoded block overrides it). |
| 1.6 | `frontend/src/components/views/OverviewView.jsx` | 411–430 | Hardcoded "Python 3.10 (64-bit)" with `v3.10.4 → v3.12.7`, "Affects 45 machines" | **(a) Replace** | Same — comes from fleet overview API, not JSX literals. |
| 1.7 | `frontend/src/components/views/OverviewView.jsx` | 451–467 | Hardcoded "Realtek PCIe Audio" with `Code 28 (Missing)`, `HDAUDIO\FUNC_01` | **(a) Replace** | Fetch from fleet overview API `top_missing_drivers`. |
| 1.8 | `frontend/src/components/views/SoftwareView.jsx` | 16–81 | Entire `fleetApps` array — 7 hardcoded app entries with fake versions, CVE badges, device counts, device names | **(a) Replace** | Aggregate from `/api/v2/admin/devices` → per-device software → fleet-wide grouping. Add server-side fleet software endpoint. |
| 1.9 | `frontend/src/components/views/SoftwareView.jsx` | 25, 37 | Specific CVEs: `CVE-2023-30581 (CVSS 8.2)`, `CVE-2023-27043 (CVSS 7.5)` shown as static text | **(a) Replace** | CVE data comes from real server-side vulnerability matching. |
| 1.10 | `frontend/src/components/views/RemediationView.jsx` | 53 | `CVE-2023-30581` in dry-run diff output | **(a) Replace** | Dry-run result comes from server command execution, not static text. |
| 1.11 | `frontend/src/components/views/ReportsView.jsx` | 182 | `Node.js v16.14 (CVE-2023-30581)` in static compliance table | **(a) Replace** | Report data generated from DB aggregates, not hardcoded HTML table rows. |

---

## 2. Static Latest Versions Catalog (used as truth)

| # | File | Line(s) | What is hardcoded | Classification | Planned Replacement |
|---|---|---|---|---|---|
| 2.1 | `server/app/services/risk_engine.py` | 7–21 | `_SEED_LATEST_VERSIONS` dict — 12 apps (Chrome `128.0.6613.85`, Python `3.13.3`, Node.js `22.11.0`, Git `2.47.0`, VSCode `1.95.0`, VLC `3.0.21`, 7-Zip `24.08`, Zoom `6.2.6`, Docker Desktop `4.35.0`, Postman `11.18.0`, DBeaver `24.2.4`) | **(a) Replace** | Real "latest version" resolved via connector layer: winget manifests, PyPI, endoflife.date. Cached in DB with `source`, `fetched_at`, TTL. Seed dict deleted. |
| 2.2 | `server/app/services/risk_engine.py` | 82–86 | `evaluate_software_risk()` uses `_SEED_LATEST_VERSIONS` dict as the primary lookup, not the DB | **(a) Replace** | Query `latest_version_cache` DB table first; fall back to stale data with provenance. |
| 2.3 | `backend/latest_versions.json` | 1–9 | Static JSON file with 6 app→version mappings (Node.js `23.0.0`, Java `22.0.1`, Epic Games, Dropbox, Teams, Python `3.18.0` [sic]) | **(d) Delete** | This file is unused by the v2 server and contains obviously wrong data (Python `3.18.0`). Delete. |

---

## 3. Frontend Literal Data Rendered as Real

| # | File | Line(s) | What is hardcoded | Classification | Planned Replacement |
|---|---|---|---|---|---|
| 3.1 | `frontend/src/components/views/DriversView.jsx` | 15–46 | `driverIssues` array — 3 hardcoded driver issues (Realtek Audio Code 28, Intel Ethernet Code 10, NVIDIA RTX 3060 Code 22) with fake hardware IDs, device counts, recommended actions | **(a) Replace** | Fetch from `/api/v2/admin/fleet/overview` or new fleet-driver endpoint. Show empty state when no data. |
| 3.2 | `frontend/src/components/views/RemediationView.jsx` | 25 | Default `selectedApp` = `'Node.js (x64)'` hardcoded | **(a) Replace** | Default to first app from real fleet software list, or empty/null. |
| 3.3 | `frontend/src/components/views/RemediationView.jsx` | 35–41 | `stagedDevices` array — 5 fake device entries (`CS-LAB1-WS01` through `WS05`) with fake stages/statuses | **(a) Replace** | Devices come from command targets in the DB. Show empty state until a remediation is queued. |
| 3.4 | `frontend/src/components/views/RemediationView.jsx` | 44–61, 64–93 | `handleStartDryRun()` and `handleStartRollout()` use `setTimeout` to simulate progress and fake results — never calls the real API | **(a) Replace** | Call real `/api/v2/commands/queue` with `dry_run: true`, then poll command status. |
| 3.5 | `frontend/src/components/views/RemediationView.jsx` | 141–144 | Hardcoded `<option>` elements: `Node.js (x64) — Upgrade to v20.18.0 LTS (CVSS 8.2 Fix)`, `Python 3.10`, `Realtek Audio — Pnputil Driver Fix (Code 28)` | **(a) Replace** | Populate from fleet software + driver data with real versions. |
| 3.6 | `frontend/src/components/views/ReportsView.jsx` | 12–16 | Hardcoded CSV export content with fake hostnames (`CS-LAB1-WS01`, `CS-LAB1-WS02`, `CS-LAB1-WS03`), fake versions, fake risk levels | **(a) Replace** | Generate CSV from real DB data via server-side export endpoint. |
| 3.7 | `frontend/src/components/views/ReportsView.jsx` | 160–200 | Static HTML compliance table with fake device names, risk levels, CVEs | **(a) Replace** | Report table rendered from real fleet data. |
| 3.8 | `frontend/src/components/views/SettingsView.jsx` | 215–223 | Hardcoded org hierarchy: "System Revamp University Lab", "Main Campus (Block A)", "Computer Lab 1 (Subnet: 192.168.1.0/24) — 45 Workstations", "Computer Lab 2 (Subnet: 192.168.2.0/24) — 32 Workstations" | **(a) Replace** | Fetch from `/api/v2/admin/orgs`, `/sites`, `/labs`. |
| 3.9 | `frontend/src/components/views/OverviewView.jsx` | 126–127, 136–137, 147–148, 158, 168 | `sparklineData` arrays are fabricated from the current KPI value with hardcoded offsets (e.g., `[onlineDevices - 2, onlineDevices - 1, ...]`, `[92, 94, 95, 94.5, ...]`) — fake history | **(a) Replace** | Sparkline data from real scan snapshot history (SQL query over `scan_snapshots`). If <2 points, show "Not enough history yet". |
| 3.10 | `frontend/src/components/views/OverviewView.jsx` | 128, 137–138 | Hardcoded deltas: `+2% vs yesterday`, `+1.2%`, `-0.8%` | **(a) Replace** | Compute from real historical snapshots. |
| 3.11 | `frontend/src/components/views/OverviewView.jsx` | 244 | Fallback subnet `'192.168.1.0/24'` when `lab.network_subnet` is empty | **(b) Config** | Show "No subnet configured" or empty, not a fake subnet. |
| 3.12 | `frontend/src/components/views/EnrollmentView.jsx` | 69 | Fallback token display `'sr_enroll_sample_token_8f9a2b1c'` | **(d) Delete** | Show real created token or nothing. A sample token string is misleading. |
| 3.13 | `frontend/src/components/views/EnrollmentView.jsx` | 187 | Fallback subnet `'192.168.1.0/24'` display | **(b) Config** | Same as 3.11 — show real data or "Not configured". |
| 3.14 | `frontend/src/components/views/DeviceDetailView.jsx` | 493 | Hardcoded command log string with fake device ID, "Node.js", fake timestamps | **(a) Replace** | Log comes from real command result `execution_log` field. |

---

## 4. Default Admin Credentials / Secrets in Source

| # | File | Line(s) | What is hardcoded | Classification | Planned Replacement |
|---|---|---|---|---|---|
| 4.1 | `server/main.py` | 77, 83 | Default SuperAdmin password `Admin@123456` and email `admin@systemrevamp.local` auto-seeded on every startup | **(b) Config** | Remove auto-seed. First run requires admin creation via CLI (`python -m server.setup init-admin`) or a setup wizard. |
| 4.2 | `server/main.py` | 57–68 | Hardcoded org `"System Revamp University Lab"`, site `"Main Campus"`, lab `"Computer Lab 1"`, subnet `"192.168.1.0/24"` auto-seeded | **(d) Delete** | Remove seed data. Admin creates org/site/lab in setup flow. |
| 4.3 | `server/app/core/config.py` | 28–29 | Default `SECRET_KEY` = `"system-revamp-super-secure-production-jwt-secret-key-change-in-env"` | **(b) Config** | Fail fast at startup if `SECRET_KEY` env is not set (except in `development` mode where a generated random key is used). |
| 4.4 | `server/app/core/config.py` | 36–38 | Default `DEVICE_SIGNING_KEY` = `"system-revamp-device-signing-secret-key-change-in-env"` | **(b) Config** | Same — fail fast if not set in production. |
| 4.5 | `frontend/src/components/views/LoginView.jsx` | 6–7 | Pre-filled login form: email `admin@systemrevamp.local`, password `Admin@123456` | **(d) Delete** | Empty fields. No default credentials in any UI. |
| 4.6 | `frontend/src/components/views/LoginView.jsx` | 35–39 | Fallback login bypass: if email/password match the hardcoded default, set a `demo_access_token` session — **bypasses all server auth** | **(d) Delete** | Remove entirely. Auth errors surface as errors. |
| 4.7 | `frontend/src/App.js` | 34 | Fallback user object `{ name: 'Fleet Administrator', email: 'admin@systemrevamp.local', role: 'SuperAdmin' }` | **(d) Delete** | Use only `api.user` from actual session. If null, redirect to login. |
| 4.8 | `.env.example` | 23–24 | `INTERNAL_API_KEY=system-revamp-internal-key-change-me` and `REACT_APP_INTERNAL_API_KEY=system-revamp-internal-key-change-me` | **(b) Config** | Values are placeholder examples — acceptable in `.env.example` but must be documented as "CHANGE ME". Add startup validation that rejects defaults in production. |
| 4.9 | `frontend/src/components/InstalledAppsTable.jsx` | 110 | Hardcoded fallback key `"system-revamp-internal-key-change-me"` in frontend JS bundle | **(d) Delete** | API keys must never appear in frontend code. Internal service auth is server→server only. |
| 4.10 | `scripts/demo/start_server.ps1` | 54 | Prints default credentials `admin@systemrevamp.local / Admin@123456` to console | **(d) Delete** | Remove credential printing. Setup flow generates unique credentials. |
| 4.11 | `README.md` | 54 | Documents default admin credentials as `admin@systemrevamp.local / Admin@123456` | **(b) Config** | Replace with "Run setup wizard to create admin" instructions. |
| 4.12 | `MIGRATION.md` | 43 | Documents default admin credentials | **(b) Config** | Same as 4.11. |

---

## 5. Hardcoded Driver Impact Classification (Name-Based, Not Class/GUID)

| # | File | Line(s) | What is hardcoded | Classification | Planned Replacement |
|---|---|---|---|---|---|
| 5.1 | `agent/collectors/drivers.py` | 21–29 | `_classify_impact()` uses string token matching on device names ("storage", "disk", "net", "display", etc.) — not based on Windows device class GUID | **(a) Replace** | Classify by `PNPClass` or device setup class GUID from `Win32_PnPEntity`. Maintain a config mapping of class GUID → impact level. Unrecognized class → "Unclassified" (not a made-up impact). |
| 5.2 | `backend/drivers_api.py` | 56–64 | Duplicate `_classify_impact()` function with same name-based approach | **(a) Replace** | Same — use device class/GUID from CIM. This entire legacy backend module may be superseded by the v2 server. |
| 5.3 | `agent/collectors/drivers.py` | 32–38 | `_impact_score()` — hardcoded numeric scores (95, 75, 50, 25) | **(b) Config** | Move to config module with documented thresholds. |

---

## 6. Hardcoded Config Values (URLs, Ports, Paths, Timeouts)

| # | File | Line(s) | What is hardcoded | Classification | Planned Replacement |
|---|---|---|---|---|---|
| 6.1 | `agent/config.py` | 41 | Default `server_url = "http://127.0.0.1:8000"` | **(b) Config** | Acceptable as development default; document in `CONFIGURATION.md`. |
| 6.2 | `agent/main.py` | 200 | Enroll `--server` default = `"http://127.0.0.1:8000"` | **(b) Config** | Same — acceptable CLI default for dev. |
| 6.3 | `frontend/src/api/client.js` | 1 | `API_BASE_URL` default = `"http://127.0.0.1:8000"` | **(b) Config** | Acceptable via `REACT_APP_SERVER_URL` env. Document. |
| 6.4 | `server/app/core/config.py` | 17–18 | Default `HOST = "0.0.0.0"`, `PORT = 8000` | **(b) Config** | Acceptable env-overridable defaults. Document. |
| 6.5 | `server/main.py` | 35 | CORS `allow_origins=["*"]` | **(b) Config** | Move allowed origins to config. Wildcard only in dev mode. |
| 6.6 | `backend/drivers_api.py` | 33–39 | CORS `allow_origins=["*"]` | **(b) Config** | Same. |

---

## 7. Fake Success Paths / Error Swallowing

| # | File | Line(s) | What is hardcoded | Classification | Planned Replacement |
|---|---|---|---|---|---|
| 7.1 | `agent/commands/executor.py` | 12–15 | `execute_rescan()` returns `True, {"status": "completed"}` without verifying the scan actually ran or produced results | **(a) Replace** | Rescan should trigger `run_full_scan()`, verify output was produced, and only report success if the report was successfully sent. |
| 7.2 | `agent/main.py` | 125–127 | `poll_and_execute_commands()` catches all exceptions with `pass` — silently ignores all network errors including auth failures | **(a) Replace** | Log errors. Distinguish transient network errors from auth failures (which should trigger re-enrollment). |
| 7.3 | `agent/main.py` | 145–146 | `send_heartbeat()` catches all exceptions with `pass` | **(a) Replace** | Log at debug level. Track consecutive failures. |
| 7.4 | `backend/drivers_api.py` | 264–280 | `download_missing_drivers()` returns `"success": all_ok or not access_denied` — this evaluates to `True` even when commands fail, as long as "access denied" is not in the output | **(a) Replace** | Report actual exit codes. Success only when verification scan shows improvement. |

---

## 8. Fixtures / Seed Data Leaking into Production Runtime

| # | File | Line(s) | What is hardcoded | Classification | Planned Replacement |
|---|---|---|---|---|---|
| 8.1 | `server/main.py` | 51–88 | `seed_initial_admin()` runs on every server startup — creates default org, site, lab, and admin user | **(b) Config** | Run only via explicit CLI command `python -m server.setup init-admin`. In production, fail fast if no admin exists and prompt operator. |
| 8.2 | `server/app/api/exposure_api.py` | 42 | `seed_vulnerability_catalog(db)` called inside SSE handler on every exposure assessment request | **(d) Delete** | Vulnerability catalog populated by real CVE sync. |
| 8.3 | `backend/routes/simulate_attack.py` | 1–136 | Entire attack simulator module — generates fake "reconnaissance", "privilege escalation", fake CVEs, fake exfiltration IPs | **(c) Test-only** | Move behind `--simulated-data` flag. Must show persistent "Simulated data" banner. Refuse in `ENV=production`. |
| 8.4 | `backend/latest_versions.json` | all | Static version catalog with wrong data (Python `3.18.0`) | **(d) Delete** | Unused and incorrect. |
| 8.5 | `agent/collectors/drivers.py` | 92–96 | `Select-Object -First 30` — arbitrarily limits to first 30 signed drivers (not a filter, just truncation) | **(a) Replace** | Report all drivers. If performance is a concern, paginate in the server. |

---

## 9. Docs/Examples with Invented Values Presented as Real

| # | File | Line(s) | What is hardcoded | Classification | Planned Replacement |
|---|---|---|---|---|---|
| 9.1 | `README.md` | 54 | States `admin@systemrevamp.local / Admin@123456` as the production credential | **(b) Config** | Mark as "Development-only" or replace with setup instructions. |
| 9.2 | `MIGRATION.md` | 43 | Same default credential documentation | **(b) Config** | Same. |
| 9.3 | `docs/setup_and_installation.md` | various | May contain hardcoded paths, IPs, example outputs presented as real | **(b) Config** | Audit and label examples as "Example only" or update to show setup wizard instructions. |

---

## 10. Missing Provenance / Staleness Metadata

| # | File | Line(s) | What is missing | Classification | Planned Replacement |
|---|---|---|---|---|---|
| 10.1 | All API responses | — | No `source`, `fetched_at`, or `stale` fields on data-bearing responses | **(a) Replace** | Add provenance fields to fleet overview, software, drivers, threats, and exposure APIs. |
| 10.2 | `server/app/services/risk_engine.py` | 74–102 | `evaluate_software_risk()` returns `(latest_version, risk)` with no indication of where the version came from or how old it is | **(a) Replace** | Return `(latest_version, risk, source, fetched_at, is_stale)`. |
| 10.3 | Frontend KPI tiles, tables | — | No UI indication of data source, age, or staleness | **(a) Replace** | Show "from Winget, 2h ago" / "from offline bundle, 6 days old" / "Stale (>24h)" badges. |

---

## 11. Dashboard/Frontend Duplicated Codebase

| # | File | What is duplicated | Classification | Planned Replacement |
|---|---|---|---|---|
| 11.1 | `dashboard/src/` (entire directory) | Exact copy of `frontend/src/` — all the same hardcoded data issues exist in both | **(d) Delete** | Remove `dashboard/src/` duplicate. Single source of truth is `frontend/src/`. |

---

## Summary Statistics

| Category | Items Found | Replace (a) | Config (b) | Test-only (c) | Delete (d) |
|---|---|---|---|---|---|
| Fake CVEs / Vulnerability Data | 11 | 8 | 0 | 1 | 2 |
| Static Version Catalogs | 3 | 2 | 0 | 0 | 1 |
| Frontend Literal Data | 14 | 12 | 2 | 0 | 0 |
| Default Credentials / Secrets | 12 | 0 | 4 | 0 | 8 |
| Driver Impact Classification | 3 | 2 | 1 | 0 | 0 |
| Hardcoded Config | 6 | 0 | 6 | 0 | 0 |
| Fake Success Paths | 4 | 4 | 0 | 0 | 0 |
| Fixtures in Production | 5 | 1 | 1 | 1 | 2 |
| Docs with Invented Values | 3 | 0 | 3 | 0 | 0 |
| Missing Provenance | 3 | 3 | 0 | 0 | 0 |
| Duplicated Codebase | 1 | 0 | 0 | 0 | 1 |
| **TOTAL** | **65** | **32** | **17** | **2** | **14** |

---

## Phase 1 Plan Summary

### Connector Layer (Phase 3)
1. **Version Connector**: Winget (`winget search` / `winget show`) via connected agent or winget-pkgs repo, PyPI JSON API, endoflife.date API. Results → `latest_version_cache` table with `source`, `fetched_at`, `ttl_seconds`.
2. **CVE Connector**: OSV.dev API (purl-based matching) + NVD API (CPE matching). Results → `vulnerability_catalog` table. Rate limits respected, API keys from env.
3. **VirusTotal Queue**: Already partially implemented. Add fleet-wide hash dedup cache, configurable rate limit, missing-key degradation message.
4. **Winget ID Resolver**: Agent-side `winget search <name>` with confidence scoring → reported to server → stored in `app_winget_mappings`.

### Schema Changes (Phase 2–3)
1. Add `latest_version_cache` table: `app_name`, `latest_version`, `source`, `fetched_at`, `ttl_seconds`, `is_stale`.
2. Add provenance columns to `DeviceSoftware`: `version_source`, `version_fetched_at`.
3. Add `device_class_guid` column to `DeviceDriver` for class-based impact scoring.
4. Add `cve_source`, `cve_fetched_at` to `VulnerabilityCatalog`.
5. Remove auto-seed logic from `server/main.py`.
6. Add `first_run_completed` flag or admin-exists check to startup.

### UI Token Set (Phase 5)
1. Redesign `tokens.css` per Part 3 spec: Navy/Cyan/Emerald/Grey palette, new radius tokens (10/14/20px + pill), navy-tinted shadows, updated severity semantics.
2. Replace indigo accent with cyan throughout both themes.
3. Add warm coral/amber tokens scoped strictly to High/Critical risk badges.
4. Update all components to use new tokens — no inline hex colors.

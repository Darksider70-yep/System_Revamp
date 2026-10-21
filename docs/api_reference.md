# System Revamp v2.0 — Authoritative API Reference

<p align="center">
  <strong>Comprehensive REST & Real-Time Server-Sent Event (SSE) Specification for Enterprise Fleet Management</strong>
</p>

---

## 1. Architecture & Protocol Standards

The System Revamp v2.0 Central Fleet Server exposes a high-performance RESTful API and streaming SSE interface engineered with strict multi-tenancy, cryptographic payload verification, and zero fake or synthetic telemetry.

### 1.1 Base URLs
- **Production Central Server**: `https://<fleet-server-domain>/api/v2`
- **Default Local Ingestion / Admin**: `http://127.0.0.1:8000/api/v2`

### 1.2 Authentication Schemes

| Context | Header / Parameter | Token Format | Description |
|---|---|---|---|
| **Admin Console & REST API** | `Authorization: Bearer <JWT>` | Signed JWT (`HS256`, 1-hour access TTL) | Standard administrative bearer token issued upon login or token refresh. |
| **Endpoint Agent Daemon** | `X-Device-Token: <DEVICE_TOKEN>` | `sr_dev_<device_id>_<entropy>` | Unique, per-device token provisioned during one-time enrollment. |
| **Real-Time SSE Streaming** | Query parameter `?ticket=<TICKET>` | Ephemeral 30-second single-use token | Cryptographically bound ticket token burned immediately upon stream connection. |

### 1.3 Standard Error Responses
All endpoints return standard RFC-7807 compatible JSON error bodies on failure:
```json
{
  "detail": "Descriptive human-readable explanation of error condition"
}
```

Common HTTP status codes returned:
- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Invalid payload, shell metacharacter detected, or illegal transition.
- `401 Unauthorized`: Missing or invalid credentials / device token.
- `403 Forbidden`: Insufficient role-based access rights or deactivated account.
- `404 Not Found`: Target device, lab, command, or token does not exist.
- `422 Unprocessable Entity`: Validation failure against Pydantic request schema.
- `500 Internal Server Error`: Unhandled server exception.

---

## 2. Administrator Authentication & Profile API (`/api/v2/auth`)

### 2.1 Check Initial Setup Status
- **Method & Path**: `GET /api/v2/auth/setup-status`
- **Authentication**: None (Public)
- **Description**: Informs the Admin Console whether the server requires initial setup (zero admin accounts created).
- **Response `200 OK`**:
  ```json
  {
    "setup_required": false,
    "admin_count": 1,
    "app_name": "System Revamp Fleet Server",
    "app_version": "2.0.0"
  }
  ```

### 2.2 Initial Setup & SuperAdmin Bootstrapping
- **Method & Path**: `POST /api/v2/auth/setup`
- **Authentication**: None (Only active when `admin_count == 0`)
- **Description**: Creates the root Organization, default Site/Lab, and the initial SuperAdmin account.
- **Request Body**:
  ```json
  {
    "org_name": "University Computer Science Department",
    "admin_email": "admin@university.edu",
    "admin_password": "StrongPassword!2026",
    "admin_name": "Lead Systems Architect"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsIn...",
    "token_type": "bearer",
    "expires_in": 3600,
    "user": {
      "id": "1c7d24a9-...",
      "email": "admin@university.edu",
      "name": "Lead Systems Architect",
      "role": "SuperAdmin",
      "org_id": "8a01f56b-...",
      "totp_enabled": false
    }
  }
  ```

### 2.3 Administrator Login
- **Method & Path**: `POST /api/v2/auth/login`
- **Authentication**: None
- **Description**: Authenticates administrator credentials using PBKDF2-SHA256 and optional TOTP 2FA.
- **Request Body**:
  ```json
  {
    "email": "admin@university.edu",
    "password": "StrongPassword!2026",
    "totp_code": "482019"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1Ni...",
    "refresh_token": "eyJhbGciOiJIUzI1Ni...",
    "token_type": "bearer",
    "expires_in": 3600,
    "user": {
      "id": "1c7d24a9-...",
      "email": "admin@university.edu",
      "name": "Lead Systems Architect",
      "role": "SuperAdmin",
      "org_id": "8a01f56b-...",
      "totp_enabled": true
    }
  }
  ```

### 2.4 Token Refresh
- **Method & Path**: `POST /api/v2/auth/refresh`
- **Authentication**: None
- **Description**: Exchanges a valid refresh token for a newly issued access token and rotating refresh token.
- **Request Body**:
  ```json
  {
    "refresh_token": "eyJhbGciOiJIUzI1Ni..."
  }
  ```

### 2.5 2FA TOTP Provisioning
- **Method & Path**: `POST /api/v2/auth/totp/setup`
- **Authentication**: Bearer Token
- **Description**: Generates a random Base32 TOTP secret and standard `otpauth://` provisioning URI for Google Authenticator / 1Password.
- **Response `200 OK`**:
  ```json
  {
    "secret": "JBSWY3DPEHPK3PXP",
    "provisioning_uri": "otpauth://totp/System%20Revamp%20Fleet:admin@university.edu?secret=JBSWY3DPEHPK3PXP&issuer=System+Revamp+Fleet"
  }
  ```

### 2.6 2FA TOTP Verification & Activation
- **Method & Path**: `POST /api/v2/auth/totp/verify`
- **Authentication**: Bearer Token
- **Request Body**:
  ```json
  {
    "totp_code": "829401"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "message": "2FA TOTP successfully enabled"
  }
  ```

### 2.7 Current User Profile
- **Method & Path**: `GET /api/v2/auth/me`
- **Authentication**: Bearer Token
- **Response `200 OK`**:
  ```json
  {
    "id": "1c7d24a9-...",
    "org_id": "8a01f56b-...",
    "email": "admin@university.edu",
    "name": "Lead Systems Architect",
    "role": "SuperAdmin",
    "totp_enabled": true,
    "is_active": true,
    "created_at": "2026-10-01T10:00:00Z"
  }
  ```

---

## 3. Endpoint Agent Communication API (`/api/v2/agent`)

All agent communication endpoints are outbound-only from managed workstations. Agents never listen on network ports.

### 3.1 Device Enrollment
- **Method & Path**: `POST /api/v2/agent/enroll`
- **Authentication**: One-time enrollment token in request body
- **Description**: Exchanges an administrative enrollment token for an individual, permanent device token (`X-Device-Token`).
- **Request Body**:
  ```json
  {
    "enrollment_token": "sr_enroll_9f8e7d6c5b4a...",
    "hostname": "ENG-LAB-042",
    "os_name": "Windows",
    "os_version": "11 Pro (22631)",
    "ip_address": "10.0.14.42",
    "agent_version": "2.0.0"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "device_id": "4a719d2e-6f81-4b77-90c2-e192748a0912",
    "device_token": "sr_dev_4a719d2e-6f81-4b77-90c2-e192748a0912_a1b2c3d4e5f67890",
    "org_id": "8a01f56b-...",
    "lab_id": "f290d18e-...",
    "poll_interval_seconds": 300,
    "server_time": "2026-10-21T18:00:00Z"
  }
  ```

### 3.2 Agent Heartbeat
- **Method & Path**: `POST /api/v2/agent/heartbeat`
- **Authentication**: `X-Device-Token`
- **Description**: Lightweight keep-alive transmitted every 60–300 seconds. Updates online status, current IP address, and uptime.
- **Request Body**:
  ```json
  {
    "device_id": "4a719d2e-6f81-4b77-90c2-e192748a0912",
    "ip_address": "10.0.14.42",
    "uptime_seconds": 86400,
    "disk_free_gb": 342.5
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-10-21T18:05:00Z"
  }
  ```

### 3.3 Telemetry Ingestion
- **Method & Path**: `POST /api/v2/agent/telemetry`
- **Authentication**: `X-Device-Token`
- **Description**: Ingests comprehensive hardware specs, installed software registries, Authenticode signature audits, and PnP driver problem codes. Evaluates SemVer drift and schedules VirusTotal checks automatically.
- **Request Body**:
  ```json
  {
    "device_id": "4a719d2e-6f81-4b77-90c2-e192748a0912",
    "snapshot_type": "full",
    "software": [
      {
        "name": "Node.js",
        "version": "18.12.1",
        "publisher": "OpenJS Foundation",
        "install_path": "C:\\Program Files\\nodejs\\node.exe",
        "binary_sha256": "8f3b927c4d5e6a107382947192837465abcde901234567890abcdef123456789",
        "signature_status": "Valid",
        "signer_name": "OpenJS Foundation"
      },
      {
        "name": "Google Chrome",
        "version": "128.0.6613.120",
        "publisher": "Google LLC",
        "install_path": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "binary_sha256": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "signature_status": "Valid",
        "signer_name": "Google LLC"
      }
    ],
    "drivers": [
      {
        "device_name": "Intel Wi-Fi 6 AX201 160MHz",
        "device_id_pnp": "PCI\\VEN_8086&DEV_06F0&SUBSYS_00748086",
        "error_code": 10,
        "reason": "This device cannot start.",
        "impact": "High",
        "risk_score": 75,
        "status": "Error",
        "device_class_guid": "{4d36e972-e325-11ce-bfc1-08002be10318}",
        "manufacturer": "Intel Corporation",
        "is_disabled": false
      }
    ],
    "system_metrics": {
      "cpu_model": "13th Gen Intel(R) Core(TM) i7-13700",
      "cpu_cores": 16,
      "ram_total_gb": 32.0,
      "disk_total_gb": 512.0,
      "disk_free_gb": 342.5,
      "uptime_seconds": 86400
    }
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "snapshot_id": "scan-9021-...",
    "software_processed": 2,
    "drivers_processed": 1,
    "critical_software_count": 1,
    "high_software_count": 0
  }
  ```

### 3.4 Poll Dispatched Commands
- **Method & Path**: `GET /api/v2/agent/commands`
- **Authentication**: `X-Device-Token`
- **Description**: Endpoint agent polls for queued and approved remediation commands scoped to its device, lab, or organization.
- **Response `200 OK`**:
  ```json
  [
    {
      "id": "cmd-8821a-...",
      "command_type": "upgrade-package",
      "params": {
        "package_id": "OpenJS.NodeJS"
      },
      "dry_run": false,
      "signature": "hmac_sha256_hex_digest_of_payload"
    }
  ]
  ```

### 3.5 Report Command Execution Result
- **Method & Path**: `POST /api/v2/agent/commands/result`
- **Authentication**: `X-Device-Token`
- **Description**: Transmits execution outcome, exit return codes, and sanitized terminal stdout/stderr logs.
- **Request Body**:
  ```json
  {
    "command_id": "cmd-8821a-...",
    "status": "completed",
    "result": {
      "returncode": 0,
      "package_id": "OpenJS.NodeJS"
    },
    "log": "Successfully installed OpenJS.NodeJS v22.9.0"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "status": "acknowledged"
  }
  ```

---

## 4. Administrative Fleet Management API (`/api/v2/admin`)

Requires `Authorization: Bearer <JWT>` with appropriate role privileges (`SuperAdmin`, `OrgAdmin`, `LabAdmin`, `LabOperator`).

### 4.1 Topology & Hierarchy

#### `GET /api/v2/admin/orgs`
- **Role**: `SuperAdmin` (all orgs) or current org.
- **Response**: List of `OrgResponse` objects with `id`, `name`, `sites_count`, `devices_count`.

#### `POST /api/v2/admin/orgs`
- **Role**: `SuperAdmin`
- **Request**: `{"name": "Engineering Faculty"}`

#### `GET /api/v2/admin/sites`
- **Query Params**: `org_id` (optional for SuperAdmin).
- **Response**: List of sites including `id`, `name`, `location`, `labs_count`.

#### `POST /api/v2/admin/sites`
- **Role**: `SuperAdmin`, `OrgAdmin`
- **Request**: `{"org_id": "...", "name": "North Science Complex", "location": "Building B"}`

#### `GET /api/v2/admin/labs`
- **Query Params**: `site_id` (optional).
- **Response**: List of computer labs with `network_subnet` and `devices_count`.

#### `POST /api/v2/admin/labs`
- **Role**: `SuperAdmin`, `OrgAdmin`
- **Request**: `{"site_id": "...", "name": "Computer Graphics Lab 301", "network_subnet": "10.0.14.0/24"}`

#### `GET /api/v2/admin/hierarchy`
- **Description**: Returns the complete nested JSON tree: `Organization -> Sites -> Labs -> Devices count & online status`.

---

### 4.2 Enrollment Tokens

#### `POST /api/v2/admin/enrollment-tokens`
- **Role**: `SuperAdmin`, `OrgAdmin`, `LabAdmin`
- **Description**: Generates a scoped, multi-use enrollment token. The raw token string is returned **only once** on creation.
- **Request Body**:
  ```json
  {
    "org_id": "8a01f56b-...",
    "lab_id": "f290d18e-...",
    "name": "Graphics Lab 301 Fall Semester Deployment",
    "expires_days": 14,
    "max_uses": 60
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "id": "tok-9102-...",
    "token": "sr_enroll_9f8e7d6c5b4a3...",
    "name": "Graphics Lab 301 Fall Semester Deployment",
    "expires_at": "2026-11-04T18:00:00Z",
    "max_uses": 60,
    "used_count": 0,
    "is_revoked": false
  }
  ```

#### `GET /api/v2/admin/enrollment-tokens`
- **Description**: Lists active and expired enrollment tokens without revealing raw secret values.

#### `DELETE /api/v2/admin/enrollment-tokens/{token_id}`
- **Description**: Immediately revokes an enrollment token, blocking all further device enrollments.

---

### 4.3 Fleet Overview & Device Drilldown

#### `GET /api/v2/admin/fleet/overview`
- **Description**: Authoritative fleet-wide metrics for high-level dashboards.
- **Response `200 OK`**:
  ```json
  {
    "total_devices": 128,
    "online_devices": 124,
    "offline_devices": 4,
    "compliance_percent": 94.5,
    "critical_risk_devices": 7,
    "high_risk_devices": 18,
    "top_outdated_apps": [
      {
        "app_name": "Node.js",
        "latest_version": "22.9.0",
        "risk_level": "Critical",
        "affected_devices": 28
      }
    ],
    "top_missing_drivers": [
      {
        "device_name": "Intel Wi-Fi 6 AX201",
        "impact": "High",
        "affected_devices": 3
      }
    ],
    "threats_flagged": 0,
    "source": "fleet_telemetry",
    "fetched_at": "2026-10-21T18:00:00Z",
    "stale": false,
    "status_message": "Fleet telemetry active (128 devices)"
  }
  ```

#### `GET /api/v2/admin/devices`
- **Query Params**:
  - `lab_id`: UUID filter for specific lab.
  - `status_filter`: `online` or `offline`.
- **Response**: List of workstations with hardware specs, IP, online status, critical finding count, and driver error count.

#### `GET /api/v2/admin/devices/{device_id}`
- **Description**: Deep inspection of a single workstation. Returns full CPU/RAM/Disk metrics, installed software inventory with digital signature status and SHA-256 hashes, PnP driver states with problem codes, and recent command history.

---

### 4.4 Fleet Software & Driver Aggregations

#### `GET /api/v2/admin/fleet/software`
- **Query Params**: `risk_filter` (`all`, `Critical`, `High`, `Medium`, `Low`).
- **Description**: Aggregates identical software packages across all fleet endpoints. Calculates maximum risk level, lists distinct installed versions, and provides exact affected hostnames and device IDs.

#### `GET /api/v2/admin/fleet/drivers`
- **Query Params**: `errors_only` (default: `true`).
- **Description**: Aggregates PnP hardware devices across the fleet, grouping by `device_name` and `error_code`. Provides impact level, risk score, Microsoft Setup Class GUID, and list of affected workstations.

---

### 4.5 Compliance & Audit Reports

#### `GET /api/v2/admin/reports/compliance`
- **Description**: Generates fleet compliance posture statistics, risk breakdown (critical, high, medium, clean), and per-workstation summary rows.

#### `GET /api/v2/admin/reports/export`
- **Query Params**: `report_type` (`compliance`, `software`, `drivers`).
- **Description**: Streams a genuine RFC-4180 CSV export file with attachment headers for executive compliance auditing.

#### `GET /api/v2/admin/audit-logs`
- **Query Params**: `limit` (default: `50`).
- **Description**: Immutable administrative audit trail recording user logins, token creation, command dispatches, and approvals.

---

## 5. Command Dispatch & Remediation API (`/api/v2/commands`)

### 5.1 Queue Command
- **Method & Path**: `POST /api/v2/commands/queue`
- **Role**: `SuperAdmin`, `OrgAdmin`, `LabAdmin`
- **Description**: Queues a validated command against an allowlist. Supports dry-run simulation mode and multi-stage approval requirements. Cryptographically signs the payload with `DEVICE_SIGNING_KEY`.
- **Supported `command_type` values**:
  - `rescan`: Requests immediate inventory collection.
  - `scan-drivers`: Invokes `pnputil /scan-devices` to detect newly attached or resolved hardware.
  - `enable-device`: Invokes `Enable-PnpDevice` for disabled hardware components.
  - `upgrade-package`: Executes silent upgrade via Windows Package Manager (`winget`).
  - `run-protection-scan`: Performs SHA-256 and Authenticode validation across binaries.
- **Request Body**:
  ```json
  {
    "target_type": "device",
    "target_id": "4a719d2e-...",
    "command_type": "upgrade-package",
    "params": {
      "package_id": "OpenJS.NodeJS"
    },
    "dry_run": true,
    "requires_approval": false
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "command_id": "cmd-8821a-...",
    "status": "approved",
    "signature": "hmac_sha256_sig...",
    "dry_run": true,
    "message": "Command 'upgrade-package' queued successfully."
  }
  ```

### 5.2 Approve or Reject Command
- **Method & Path**: `POST /api/v2/commands/approve`
- **Role**: `SuperAdmin`, `OrgAdmin`
- **Request Body**:
  ```json
  {
    "command_id": "cmd-8821a-...",
    "approved": true
  }
  ```

### 5.3 List Dispatched Commands
- **Method & Path**: `GET /api/v2/commands/list` (alias: `/api/v2/commands/history`)
- **Query Params**: `status_filter` (`pending`, `approved`, `completed`, `failed`, `rejected`), `limit`.

---

## 6. Exposure Assessment & Streaming SSE API (`/api/v2/exposure`)

### 6.1 Issue Ephemeral Exposure Ticket
- **Method & Path**: `POST /api/v2/exposure/token`
- **Authentication**: Bearer Token
- **Query Params**: `device_id`
- **Description**: Generates a single-use, 30-second cryptographic ticket token permitting an SSE stream connection without exposing long-lived bearer tokens in URL query strings.
- **Response `200 OK`**:
  ```json
  {
    "ticket": "sr_tick_a89102c4b5...",
    "expires_in": 30
  }
  ```

### 6.2 Stream Real-Time Vulnerability Assessment
- **Method & Path**: `GET /api/v2/exposure/stream/{device_id}?ticket=<ticket>`
- **Response**: `text/event-stream`
- **Description**: Streams live vulnerability evaluation events matching installed software on the target workstation against OSV.dev and NVD 2.0 databases.
- **Event Stream Protocol**:
  ```http
  HTTP/1.1 200 OK
  Content-Type: text/event-stream
  Cache-Control: no-cache
  Connection: keep-alive

  data: {"step": 1, "progress": 10, "level": "INFO", "message": "Starting Exposure Assessment on ENG-LAB-042..."}

  data: {"step": 2, "progress": 30, "level": "INFO", "message": "Analyzing 48 installed packages against OSV.dev & NVD databases..."}

  data: {"step": 3, "progress": 60, "level": "WARN", "message": "Identified CVE-2023-32002 in Node.js v18.12.1 (CVSS 8.1) via osv.dev - Fixed in 18.17.1", "source": "osv.dev", "cve_id": "CVE-2023-32002"}

  event: summary
  data: {"device_id": "4a719d2e-...", "hostname": "ENG-LAB-042", "total_packages_audited": 48, "vulnerabilities_found": [...], "sources": ["osv.dev", "nvd.nist.gov"], "status": "Assessment Complete"}

  event: end
  data: {"done": true}
  ```

---

## 7. Air-Gapped Sync & Installer Cache API (`/api/v2/offline`)

### 7.1 Export Signed Intelligence Bundle
- **Method & Path**: `GET /api/v2/offline/export-intelligence-bundle`
- **Role**: `SuperAdmin`, `OrgAdmin`
- **Description**: Packs version catalogs, known CVE mappings, and VirusTotal threat reputations into an encrypted/signed ZIP bundle containing `manifest.json` and `signature.sig` (HMAC-SHA256).

### 7.2 Import Verified Intelligence Bundle
- **Method & Path**: `POST /api/v2/offline/import-intelligence-bundle`
- **Role**: `SuperAdmin`, `OrgAdmin`
- **Description**: Uploads a bundle to an air-gapped server. Validates cryptographic signature using `DEVICE_SIGNING_KEY` before ingesting CVEs and threat data.

### 7.3 Upload LAN Installer
- **Method & Path**: `POST /api/v2/offline/installers/upload`
- **Role**: `SuperAdmin`, `OrgAdmin`
- **Payload**: `multipart/form-data` with `app_name`, `version`, and `installer_file`. Calculates SHA-256 hash and persists binary to the central server cache.

### 7.4 List Cached Installers
- **Method & Path**: `GET /api/v2/offline/installers`
- **Description**: Lists all cached installation binaries available for LAN distribution.

---

## 8. Threat Intelligence API (`/api/v2/threats`)

### 8.1 Threat Intelligence Overview
- **Method & Path**: `GET /api/v2/threats/overview`
- **Description**: Returns fleet-wide binary reputation statistics (clean, suspicious, malicious, pending VT queue) and lists all flagged binaries mapped to affected workstations.
- **Response `200 OK`**:
  ```json
  {
    "total_unique_hashes": 340,
    "clean_hashes": 338,
    "suspicious_hashes": 2,
    "malicious_hashes": 0,
    "pending_vt_queue": 0,
    "flagged_threats": [],
    "vt_api_configured": true,
    "source": "virustotal_api",
    "status_message": "VirusTotal reputation feed active"
  }
  ```

### 8.2 Trigger VT Queue Processing
- **Method & Path**: `POST /api/v2/threats/process-queue`
- **Description**: Dispatches up to 4 pending binary SHA-256 hashes against the external VirusTotal API respecting the 4 req/min free-tier rate limit.

# System Revamp v2.0 — API Reference

Complete documentation of all REST endpoints and Server-Sent Event (SSE) streaming interfaces for the System Revamp Fleet Platform.

---

## 1. Authentication & Security

### Admin Authentication
Admin endpoints require a Bearer token in the `Authorization` header:
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

### Agent Authentication
Agent communication endpoints require an individual device token in the `X-Device-Token` header:
```http
X-Device-Token: sr_dev_<device_id>_<entropy>
```

---

## 2. Agent Communication Endpoints (`/api/v2/agent`)

### `POST /api/v2/agent/enroll`
- **Description**: Exchanges a one-time enrollment token for an individual device token.
- **Request Body**:
  ```json
  {
    "enrollment_token": "sr_enroll_...",
    "hostname": "LAB-PC-01",
    "os_name": "Windows",
    "os_version": "11 (22631)",
    "ip_address": "192.168.1.105",
    "agent_version": "2.0.0"
  }
  ```
- **Response**:
  ```json
  {
    "device_id": "8a329d91-...",
    "device_token": "sr_dev_8a329d91_...",
    "org_id": "7b119c82-...",
    "lab_id": "4c901a12-...",
    "poll_interval_seconds": 300,
    "server_time": "2026-10-06T12:00:00Z"
  }
  ```

### `POST /api/v2/agent/heartbeat`
- **Auth**: `X-Device-Token`
- **Description**: Periodic agent heartbeat updating online status, IP address, and uptime.
- **Request Body**:
  ```json
  {
    "device_id": "8a329d91-...",
    "ip_address": "192.168.1.105",
    "uptime_seconds": 14400,
    "disk_free_gb": 450.2
  }
  ```

### `POST /api/v2/agent/telemetry`
- **Auth**: `X-Device-Token`
- **Description**: Ingests full/delta software inventories, PnP driver error codes, and hardware metrics.
- **Request Body**:
  ```json
  {
    "device_id": "8a329d91-...",
    "snapshot_type": "full",
    "software": [
      {
        "name": "Node.js",
        "version": "20.10.0",
        "publisher": "OpenJS Foundation",
        "install_path": "C:\\Program Files\\nodejs\\node.exe",
        "binary_sha256": "4b5c7e3f89012a...",
        "signature_status": "Valid",
        "signer_name": "OpenJS Foundation"
      }
    ],
    "drivers": [
      {
        "device_name": "NVIDIA GPU",
        "device_id_pnp": "PCI\\VEN_10DE&DEV_1C82",
        "error_code": 28,
        "reason": "The drivers for this device are not installed.",
        "impact": "Medium",
        "risk_score": 50,
        "status": "Missing"
      }
    ],
    "system_metrics": {
      "cpu_model": "Intel Core i7-12700K",
      "cpu_cores": 12,
      "ram_total_gb": 32.0,
      "disk_free_gb": 450.0,
      "uptime_seconds": 14400
    }
  }
  ```

### `GET /api/v2/agent/commands`
- **Auth**: `X-Device-Token`
- **Description**: Agent polls for approved commands scoped to this device, its lab, or the fleet.
- **Response**:
  ```json
  [
    {
      "id": "cmd-12345",
      "command_type": "upgrade-package",
      "params": { "package_id": "OpenJS.NodeJS" },
      "signature": "hmac_sha256_sig...",
      "dry_run": true
    }
  ]
  ```

### `POST /api/v2/agent/commands/result`
- **Auth**: `X-Device-Token`
- **Description**: Agent reports command execution status and terminal logs.

---

## 3. Admin Fleet Management Endpoints (`/api/v2/admin`)

- `POST /api/v2/auth/login`: Admin login returning access & refresh JWT tokens.
- `GET /api/v2/admin/fleet/overview`: Fleet-wide KPIs, compliance percentage, top outdated software, and missing drivers.
- `GET /api/v2/admin/devices`: Lists managed endpoints with lab filters and risk tags.
- `GET /api/v2/admin/devices/{id}`: Detailed inspection of a single machine's specs, software, drivers, and history.
- `POST /api/v2/admin/enrollment-tokens`: Creates scoped, multi-use enrollment tokens with expiry.
- `GET /api/v2/admin/audit-logs`: Paginated administrative audit logs.

---

## 4. Commands & Remediation (`/api/v2/commands`)

- `POST /api/v2/commands/queue`: Queues a command (`rescan`, `scan-drivers`, `enable-device`, `upgrade-package`) with dry-run support.
- `POST /api/v2/commands/approve`: Approves or rejects a queued command requiring review.
- `GET /api/v2/commands/list`: Lists recent command dispatches.

---

## 5. Exposure Assessment & Real-Time SSE (`/api/v2/exposure`)

- `POST /api/v2/exposure/token`: Issues a single-use 30-second ticket token for SSE streaming.
- `GET /api/v2/exposure/stream/{device_id}?ticket=<token>`: Streams real-time vulnerability matching telemetry against NVD & OSV.dev databases.

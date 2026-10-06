# System Revamp v2.0 — Threat Model & Security Architecture

<p align="center">
  <strong>Comprehensive Security Analysis, Threat Vectors, Adversary Assumptions, and Platform Mitigations</strong>
</p>

---

## 1. Security Principles & Threat Boundaries

System Revamp v2.0 follows a **Zero-Trust Endpoint Communication** model. The central server assumes all managed network endpoints might operate in hostile lab environments where local machine users may possess local administrator access or attempt reverse engineering.

```
+---------------------------+             +---------------------------+
|      Managed Endpoint     |             |    Central Fleet Server   |
|  (Untrusted Environment)  |  (Outbound) |   (Isolated Admin Tier)   |
|   - Runs Agent Daemon     | ----------> |   - Role-Based Access     |
|   - Outbound Only (TLS)   |             |   - HMAC Signed Commands  |
|   - Local SQLite Buffer   |             |   - Strict Rate Limiters  |
+---------------------------+             +---------------------------+
```

---

## 2. Threat Analysis & Mitigations

### 2.1 Threat: Rogue or Compromised Endpoint Agent
- **Attack Vector**: An attacker gains root/admin on a lab PC, extracts agent binaries, and attempts to forge telemetry, impersonate other machines, or flood the server.
- **Mitigations Implemented**:
  1. **Per-Device HMAC Tokens**: Every machine receives a distinct `sr_dev_<id>_<entropy>` token upon enrollment. Compromising machine A provides zero access to machine B.
  2. **Device ID Bound Ingestion**: Ingestion endpoints verify that `report.device_id` strictly matches the device identity tied to the provided `X-Device-Token`.
  3. **No Inbound Ports**: Agents expose zero local listening network sockets. All communication is outbound only.

---

### 2.2 Threat: Stolen or Leaked Enrollment Token
- **Attack Vector**: An enrollment token is intercepted from an installation script or leaked by a user.
- **Mitigations Implemented**:
  1. **Strict Expiration & Max Usage Quotas**: Enrollment tokens enforce short lifespans (e.g. 7–30 days) and hard `max_uses` limits.
  2. **Instant Token Revocation**: Admins can revoke any compromised enrollment token immediately via `DELETE /api/v2/admin/enrollment-tokens/{id}`.
  3. **Audit Logging**: Every enrollment event logs the IP address, timestamp, and hardware identity.

---

### 2.3 Threat: Command Injection into System Subprocesses
- **Attack Vector**: An attacker attempts to inject shell metacharacters (`;&|` $ > <`) into package IDs or device IDs to execute arbitrary PowerShell or Bash scripts on managed endpoints.
- **Mitigations Implemented**:
  1. **Strict Command Allowlist**: Only 5 predefined commands are supported (`rescan`, `scan-drivers`, `enable-device`, `upgrade-package`, `run-protection-scan`). Arbitrary shell commands are rejected by the server schema.
  2. **Parameter Sanitization & Rejection**: The server rejects any parameters containing shell metacharacters (`[;|`$><\r\n]|&&`).
  3. **Cryptographic Command Signing**: Every command payload is signed server-side using `DEVICE_SIGNING_KEY`. The agent validates the HMAC signature before executing any subprocess.
  4. **Array-Based Subprocess Calls**: All agent handlers execute subprocesses using `subprocess.run(list_of_args, shell=False)` with strict timeouts (15s–300s).

---

### 2.4 Threat: Malicious or Compromised Administrator
- **Attack Vector**: A compromised admin account attempts to view unauthorized organizations or deploy destructive actions.
- **Mitigations Implemented**:
  1. **Multi-Tenant Isolation**: Queries enforce organization and lab filtering. Admins can never read or modify endpoints outside their assigned organization.
  2. **Role-Based Access Control (RBAC)**: SuperAdmin, OrgAdmin, LabAdmin, and LabOperator roles enforce least-privilege operations.
  3. **Mandatory Audit Logging**: Every admin action (login, token creation, command queueing, remediation approval) is permanently recorded in `audit_logs`.
  4. **Optional TOTP 2FA**: Protects admin credentials against credential stuffing and brute-force attacks.

---

### 2.5 Threat: Secret & API Key Leakage
- **Attack Vector**: API keys (VirusTotal, server signing keys, JWT secrets) are leaked in client bundles or log files.
- **Mitigations Implemented**:
  1. **Zero Client Secrets**: The React frontend contains zero static API keys. All state is retrieved via short-lived JWT sessions.
  2. **Server-Side VirusTotal Key**: Only the central server holds the VirusTotal API key. Binaries are hashed locally; only 64-character SHA-256 strings are sent across the LAN.
  3. **Automated Secret Scans**: Unit tests continuously verify that no secrets or passwords are written into logs or generated command outputs.

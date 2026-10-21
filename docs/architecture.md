# System Revamp v2.0 — Architecture & System Design Blueprint

<p align="center">
  <strong>Enterprise Fleet-Managed Endpoint Intelligence, PnP Driver Diagnostics, Binary Integrity & Vulnerability Platform</strong>
</p>

---

## 1. System Overview & Enterprise Architecture

**System Revamp v2.0** is an enterprise-scale endpoint intelligence, hardware diagnostics, and automated remediation platform engineered for university computer labs, academic workstations, and large corporate fleets (from 1 to 10,000+ endpoints).

The platform uses an **outbound-only background agent daemon** running across managed endpoints that continuously streams hardware health, software inventory, binary code signatures, and PnP driver problem codes to a centralized **Fleet Management Server**. Administrators manage the entire fleet through a unified, token-driven **React 18 Admin Console**.

```mermaid
flowchart TD
    subgraph Endpoints ["🖥️ Managed Endpoints (Computer Labs / Enterprise Fleet)"]
        AgentWin["Windows Endpoint<br/>• System Revamp Agent Daemon<br/>• Windows Service / Background Task<br/>• Outbound-Only TLS (:443)"]
        AgentLin["Linux Endpoint<br/>• System Revamp Agent Daemon<br/>• systemd Background Service<br/>• Outbound-Only TLS (:443)"]
    end

    subgraph Edge_Tier ["🛡️ Edge & Network Tier"]
        ReverseProxy["High-Performance Reverse Proxy / SSL Terminator<br/>(Nginx / Caddy / Cloudflare)<br/>• TLS 1.3 Termination<br/>• Rate Limiting & DoS Mitigation<br/>• SSE Long-Lived Buffering"]
    end

    subgraph Server_Tier ["🏛️ Central Fleet Management Server Cluster"]
        Ingest["📥 Telemetry & Ingestion Pipeline<br/>• Device Token Auth (X-Device-Token)<br/>• Heartbeat Ingestion<br/>• Local Queue De-duplication"]
        RiskEngine["⚙️ Authoritative Risk Engine<br/>• Deterministic SemVer Drift Evaluator<br/>• Keyless CVE Connectors (OSV / NVD)<br/>• Fleet VirusTotal Queue (4/min)"]
        CommandSigner["🔏 Cryptographic Command Signer<br/>• Allowlist Sanitization<br/>• HMAC-SHA256 Payload Signing"]
        DB[("🗄️ Relational Data Store<br/>• SQLite (WAL Mode) &lt;500 Hosts<br/>• PostgreSQL Cluster &gt;500 Hosts")]
        InstallerCache[("📦 Central LAN Installer Cache<br/>• Offline Air-Gapped Bundles<br/>• Verified Installer Binaries")]
    end

    subgraph Admin_Tier ["💻 Administrative Console"]
        AdminWeb["React 18 Admin Console (SPA)<br/>• Design Token System (tokens.css)<br/>• Zero Hard Edges & Zero Emojis<br/>• Live SSE Exposure Stream"]
        SysAdmin["Fleet Administrator<br/>(JWT Bearer Auth + TOTP 2FA)"]
    end

    AgentWin -- "Outbound TLS Only (Telemetry, Heartbeat, Command Poll)" --> ReverseProxy
    AgentLin -- "Outbound TLS Only (Telemetry, Heartbeat, Command Poll)" --> ReverseProxy
    ReverseProxy --> Ingest
    Ingest --> RiskEngine
    RiskEngine --> DB
    CommandSigner --> DB
    RiskEngine --> InstallerCache
    SysAdmin --> AdminWeb
    AdminWeb <-- "Admin REST API & SSE Exposure Stream" --> ReverseProxy
```

---

## 2. Core Subsystems & Responsibilities

| Subsystem | Component | Primary Technical Responsibilities |
|---|---|---|
| **Endpoint Agent** | `agent.main` | Outbound-only background daemon. Collects Windows Registry software, CIM PnP driver problem codes, and calculates local binary SHA-256 hashes with Authenticode signature status. Buffers reports in local SQLite queue if offline. |
| **Central Fleet Server** | `server.main` | Centralized FastAPI service. Manages multi-tenant Org/Site/Lab hierarchies, evaluates version drift risk, matches CVEs, queues commands with HMAC signatures, and manages the fleet-wide VirusTotal cache. |
| **Admin Console** | `frontend/` | React 18 SPA. Displays compliance gauges, lab health heatmaps, single-machine deep inspections, staged rollouts, and CSV compliance export. Built on authoritative CSS design tokens (`tokens.css`). |
| **Keyless Connectors** | `server.services` | Upstream version and vulnerability matching against OSV.dev, NVD 2.0, endoflife.date, and PyPI without requiring individual client API keys. |
| **Command Engine** | `agent.commands` | Allowlisted subprocess dispatcher. Validates server HMAC signatures before executing `winget`, `pnputil`, or CIM remediation calls. |

---

## 3. Communication Protocols & Workflows

### 3.1 Agent Enrollment Sequence
```mermaid
sequenceDiagram
    autonumber
    actor Admin as Fleet Administrator
    participant Console as Admin Console
    participant Server as Fleet Server
    participant Agent as Endpoint Agent
    participant Storage as Local Agent Storage

    Admin->>Console: Create Enrollment Token for Lab
    Console->>Server: POST /api/v2/admin/enrollment-tokens
    Server-->>Console: Return `sr_enroll_...` (Scoped to Lab, Max Uses, Expiry)
    
    Note over Admin,Agent: Deployed via GPO, Intune, or PowerShell
    Agent->>Server: POST /api/v2/agent/enroll { token, hostname, os_name, os_version, ip }
    Server->>Server: Validate token hash, verify expiry, decrement max_uses
    Server->>Server: Provision Device entity & generate individual token `sr_dev_<id>_<entropy>`
    Server-->>Agent: 200 OK { device_id, device_token, poll_interval }
    Agent->>Storage: Persist credentials securely in `agent_config.json`
```

---

### 3.2 Telemetry Ingestion & Local Queue State Machine

To survive campus network outages, Wi-Fi roaming drops, and maintenance blackouts, the agent never transmits telemetry synchronously without buffering. Every scan snapshot is queued in a local SQLite database (`agent_queue.db`) before transmission:

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Scanning : Scheduled Interval (e.g., 300s) / Command Rescan
    Scanning --> Enqueueing : Collect Hardware, Software & Signature Telemetry
    Enqueueing --> Buffered : Write to Local SQLite Queue (`agent_queue.db`)
    
    state Ingestion_Loop {
        Buffered --> Transmitting : Check Server Reachability
        Transmitting --> Success : POST /api/v2/agent/telemetry (200 OK)
        Success --> Purged : Delete Snapshot from Local SQLite Queue
        
        Transmitting --> Network_Partition : Connection Refused / Timeout / 5xx
        Network_Partition --> Exponential_Backoff : Increment Retry Count (Max 5)
        Exponential_Backoff --> Transmitting : Wait (10s, 20s, 40s, 80s...)
    }
    
    Purged --> Idle
    Exponential_Backoff --> Preserved_Offline : Max Retries Reached
    Preserved_Offline --> Transmitting : Next Network Availability Event
```

---

### 3.3 Authoritative Risk Classification Engine

To eliminate human subjectivity and discrepancies in compliance audits, System Revamp evaluates version drift using a mathematically deterministic classification matrix:

$$\text{Risk Level} = \begin{cases}
\mathbf{Critical}, & \text{if } \text{Major Drift} \ge 2 \text{ or known-vulnerable (CVSS } \ge 7.0\text{)} \\
\mathbf{High}, & \text{if } \text{Major Drift} = 1 \text{ or vendor deprecated} \\
\mathbf{Medium}, & \text{if } \text{Minor Drift} \ge 1 \\
\mathbf{Low}, & \text{if } \text{Patch Drift} \ge 1 \text{ or current } (\text{Current} \ge \text{Latest}) \\
\mathbf{Unknown}, & \text{if versions cannot be parsed or matched}
\end{cases}$$

```mermaid
flowchart TD
    Ingest["Installed Software Telemetry<br/>(Name, Installed Version, Publisher)"] --> Upstream["Upstream Connector Cache<br/>(endoflife.date / PyPI / OSV.dev)"]
    Upstream --> SemVerCheck{"SemVer Version Parsing"}

    SemVerCheck -- "Failed to Parse" --> Unknown["Risk Level: UNKNOWN"]
    SemVerCheck -- "Successfully Parsed" --> DriftCalc["Calculate Major & Minor Delta"]

    DriftCalc --> CVSSCheck{"Known CVE with CVSS >= 7.0?"}
    CVSSCheck -- "Yes" --> Critical["Risk Level: CRITICAL"]
    CVSSCheck -- "No" --> MajorCheck{"Major Delta >= 2?"}
    
    MajorCheck -- "Yes" --> Critical
    MajorCheck -- "No" --> HighCheck{"Major Delta == 1?"}
    
    HighCheck -- "Yes" --> High["Risk Level: HIGH"]
    HighCheck -- "No" --> MinorCheck{"Minor Delta >= 1?"}
    
    MinorCheck -- "Yes" --> Medium["Risk Level: MEDIUM"]
    MinorCheck -- "No" --> Low["Risk Level: LOW (Current / Patch Drift)"]
```

---

## 4. Relational Database Schema Architecture

The Central Fleet Server utilizes a normalized relational schema supporting high-throughput ingestion and multi-tenant isolation:

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ SITES : contains
    ORGANIZATIONS ||--o{ ADMIN_USERS : employs
    ORGANIZATIONS ||--o{ AUDIT_LOGS : records
    SITES ||--o{ LABS : houses
    LABS ||--o{ DEVICES : enrolls
    LABS ||--o{ ENROLLMENT_TOKENS : scopes
    
    DEVICES ||--o{ DEVICE_SOFTWARE : catalogs
    DEVICES ||--o{ DEVICE_DRIVERS : diagnoses
    DEVICES ||--o{ SCAN_SNAPSHOTS : histories
    DEVICES ||--o{ COMMANDS : targets

    ORGANIZATIONS {
        string id PK
        string name
        datetime created_at
    }

    SITES {
        string id PK
        string org_id FK
        string name
        string location
    }

    LABS {
        string id PK
        string site_id FK
        string name
        string network_subnet
    }

    DEVICES {
        string id PK
        string lab_id FK
        string hostname
        string os_name
        string os_version
        string ip_address
        string mac_address
        boolean is_online
        datetime last_heartbeat
        string cpu_model
        integer cpu_cores
        float ram_total_gb
        float disk_free_gb
    }

    DEVICE_SOFTWARE {
        string id PK
        string device_id FK
        string app_name
        string version
        string latest_version
        string risk_level
        string publisher
        string binary_sha256
        string signature_status
        string signer_name
    }

    DEVICE_DRIVERS {
        string id PK
        string device_id FK
        string device_name
        integer error_code
        string reason
        string impact
        integer risk_score
        string status
        string device_class_guid
        boolean is_disabled
    }

    COMMANDS {
        string id PK
        string org_id FK
        string target_type
        string target_id
        string command_type
        string params_json
        string signature
        boolean dry_run
        string status
        string created_by
        string approved_by
        string result_json
    }

    THREAT_REPUTATION {
        string sha256 PK
        string vt_status
        integer vt_score
        integer positives_count
        integer total_engines
        datetime last_checked_at
    }

    VULNERABILITY_CATALOG {
        string cve_id PK
        string app_name
        string affected_versions_expr
        float cvss_score
        string severity
        string fixed_in_version
    }
```

---

## 5. Scalability & Sizing Sizing Calculations

| Fleet Size Tier | Target Endpoints | Recommended Ingestion Cadence | Backing Database | Memory Footprint | Network Bandwidth |
|---|---|---|---|---|---|
| **Tier 1 (Lab)** | 1 – 150 PCs | Heartbeat 60s, Telemetry 300s | SQLite (WAL mode) | Server: 250MB, Agent: 25MB | < 50 KB/s |
| **Tier 2 (Faculty)** | 150 – 1,000 PCs | Heartbeat 120s, Telemetry 600s | SQLite / PostgreSQL | Server: 1GB, Agent: 25MB | < 250 KB/s |
| **Tier 3 (Campus)** | 1,000 – 5,000 PCs | Heartbeat 300s, Telemetry 1800s | PostgreSQL (Dedicated) | Server: 4GB, Agent: 25MB | < 1.2 MB/s |
| **Tier 4 (Enterprise)** | 5,000 – 20,000+ PCs | Heartbeat 300s, Staggered Telemetry | PostgreSQL Cluster + Read Replicas | Server: 8GB+, Agent: 25MB | < 4.5 MB/s |

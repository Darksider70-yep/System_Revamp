# System Revamp v2.0 — Architecture Decision Records (ADRs)

<p align="center">
  <strong>Authoritative Architectural Decision Records Documenting Core Engineering Choices, Trade-offs, and Security Rationale</strong>
</p>

---

## 1. Index of Architecture Decision Records

| ADR ID | Title | Status | Date | Primary Context |
|---|---|---|---|---|
| [**ADR-001**](#adr-001-outbound-only-agent-communication-architecture) | Outbound-Only Agent Communication Architecture | **Accepted** | 2026-10 | Network security & firewall traversal on endpoints |
| [**ADR-002**](#adr-002-dual-database-storage-strategy-sqlite-wal-vs-postgresql) | Dual Database Storage Strategy (SQLite WAL vs PostgreSQL) | **Accepted** | 2026-10 | Zero-friction dev/small lab vs Tier 4 enterprise scaling |
| [**ADR-003**](#adr-003-hmac-sha256-cryptographic-command-signing-with-strict-allowlist) | HMAC-SHA256 Command Signing with Strict Allowlist | **Accepted** | 2026-10 | Endpoint execution safety & replay attack prevention |
| [**ADR-004**](#adr-004-keyless-multi-source-upstream-vulnerability-intelligence) | Keyless Multi-Source Upstream Vulnerability Intelligence | **Accepted** | 2026-10 | Cost-free CVE enrichment across OSV.dev, NVD 2.0, endoflife.date |
| [**ADR-005**](#adr-005-ephemeral-single-use-ticket-authentication-for-sse-streams) | Ephemeral Single-Use Ticket Authentication for SSE Streams | **Accepted** | 2026-10 | Browser EventSource header limitations & token leakage prevention |

---

## ADR-001: Outbound-Only Agent Communication Architecture

### Context & Problem Statement
Traditional endpoint management tools (e.g. legacy remote agents, SSH daemons, WinRM listeners) open inbound TCP ports on managed workstations. In academic computer labs and enterprise networks:
1. Endpoints sit behind aggressive NATs, campus firewalls, and isolated VLANs.
2. Opening inbound listening sockets exposes workstations to lateral network movement and remote exploit attempts.
3. Managing bilateral firewall hole-punching across thousands of dynamic IP assignments imposes prohibitive operational costs.

### Decision
We decided that **all System Revamp Endpoint Agents operate in outbound-only mode**:
- Agents never open an inbound listening network socket on managed workstations (`0.0.0.0:*` is strictly forbidden).
- All network interactions (telemetry transmission, heartbeats, command polling) originate **outbound over TLS (TCP 443)** to the Central Fleet Server.
- When an administrator queues a remote command, the server holds the command in an internal queue; the agent pulls pending commands during its regular outbound poll cycle.

### Consequences & Trade-offs
- **Positive**: Zero endpoint attack surface; zero firewall reconfiguration on computer lab routers; agents function seamlessly across NAT, campus Wi-Fi, and home VPNs.
- **Negative**: Command execution is not instantaneous; execution latency is bound by the agent's poll interval (default 300s, configurable to 60s for expedited response).

---

## ADR-002: Dual Database Storage Strategy (SQLite WAL vs PostgreSQL)

### Context & Problem Statement
System Revamp targets both small departmental computer labs (10–200 PCs) managed by part-time lab assistants with minimal IT infrastructure, as well as university-wide fleets (10,000+ endpoints) requiring enterprise clustering. Enforcing an external PostgreSQL cluster for small single-server deployments creates excessive friction, while using standard SQLite for 10,000 endpoints causes write lock contention.

### Decision
We implemented a **Dual Database Storage Strategy** powered by SQLAlchemy ORM:
1. **Tier 1 & 2 Deployments ($\le 500$ nodes)**: Default to embedded **SQLite in WAL (Write-Ahead Logging) Mode** with `PRAGMA synchronous = NORMAL` and `PRAGMA busy_timeout = 5000`. Hot backups execute via non-blocking atomic `VACUUM INTO`.
2. **Tier 3 & 4 Deployments ($> 500$ nodes)**: Deploy on **PostgreSQL** with connection pooling (`pool_size=20`, `max_overflow=10`), streaming replication, and read-replica query routing.

### Consequences & Trade-offs
- **Positive**: Single-binary, zero-dependency installation for small labs; seamless configuration migration to PostgreSQL via environment variable (`DATABASE_URL=postgresql://...`).
- **Negative**: Developers must maintain schema compatibility across both SQLite and PostgreSQL dialects (e.g. avoiding vendor-specific JSON operators in native SQL).

---

## ADR-003: HMAC-SHA256 Cryptographic Command Signing with Strict Allowlist

### Context & Problem Statement
Allowing a central management server to execute shell commands on thousands of root/SYSTEM endpoints introduces a catastrophic risk: if the central server or database is compromised, an attacker could dispatch arbitrary destructive commands fleetwide (e.g. `rmdir /s /q C:\` or ransomware).

### Decision
We implemented **Two-Layer Execution Defense**:
1. **Cryptographic Payload Signing**: Every command is signed by the server's private `DEVICE_SIGNING_KEY` using HMAC-SHA256:
   $$\text{Signature} = \text{HMAC-SHA256}(\text{Key}, \text{command\_id} + \text{command\_type} + \text{params\_json\_sorted})$$
   Agents verify the signature before parsing.
2. **Strict Subprocess Allowlist**: Agents reject raw bash/PowerShell strings. Only pre-compiled allowlisted command handlers are accepted:
   - `run-package-update`: Executes only parameterized `winget upgrade --id <allowed_id> --silent`
   - `run-driver-repair`: Executes only parameterized `pnputil /scan-devices`
   - `run-protection-scan`: Executes local file hashing without network upload

### Consequences & Trade-offs
- **Positive**: Eliminates arbitrary remote code execution; protects against database tampering; prevents shell metacharacter injection.
- **Negative**: New operational tasks require explicit agent code handler updates rather than ad-hoc shell scripts.

---

## ADR-004: Keyless Multi-Source Upstream Vulnerability Intelligence

### Context & Problem Statement
Commercial vulnerability scanners require expensive per-endpoint subscriptions (e.g., Tenable, Qualys) or restrictive commercial API keys with strict query rate limits. University labs require comprehensive CVE matching and End-of-Life tracking without recurring SaaS license costs.

### Decision
We architected a **Keyless Upstream Intelligence Engine** aggregating open community and government databases:
1. **OSV.dev REST API**: Google's open vulnerability database for package ecosystems (PyPI, npm, Git).
2. **NVD 2.0 REST API**: National Vulnerability Database for official CVSS v3.1 scores.
3. **endoflife.date API**: Automated End-of-Life cycle tracking for runtime platforms (Node.js, Python, Windows OS).
4. **Intelligent Server-Side In-Memory & Relational TTL Caching**: CVE matches and product lifecycle data are cached for 24 hours to eliminate redundant external calls.

### Consequences & Trade-offs
- **Positive**: 100% free, unmetered, keyless operation; highly accurate SemVer range matching; zero vendor lock-in.
- **Negative**: Subject to public API availability; mitigated by offline fallback caches and graceful timeout handling.

---

## ADR-005: Ephemeral Single-Use Ticket Authentication for SSE Streams

### Context & Problem Statement
The Admin Console provides live vulnerability exposure streaming via Server-Sent Events (`/api/v2/exposure/stream/{device_id}`). However, the standard browser `EventSource` JavaScript API does not permit custom HTTP headers (such as `Authorization: Bearer <JWT>`). Transmitting persistent JWT tokens in URL query strings violates security best practices (tokens leak into proxy logs, browser histories, and referrer headers).

### Decision
We implemented an **Ephemeral Single-Use Ticket Token Architecture**:
1. When an administrator clicks "Live Exposure Assessment", the browser issues an authenticated `POST /api/v2/exposure/ticket` with its Bearer JWT.
2. The server generates a random 192-bit token (`sr_tkt_<entropy>`), records it in a short-lived cache with a **30-second TTL**, and returns it.
3. The browser opens the SSE connection using `?ticket=sr_tkt_...`.
4. The server validates the ticket, verifies the associated admin permissions, and **immediately deletes (burns) the ticket from memory**.
5. Any subsequent connection attempt using the same ticket string is rejected with `401 Unauthorized`.

### Consequences & Trade-offs
- **Positive**: Zero risk of long-lived JWT leakage in URLs or reverse proxy access logs; complete replay attack immunity.
- **Negative**: Requires a two-step handshake before establishing the streaming connection.

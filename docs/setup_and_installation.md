# System Revamp v2.0 — Production Setup & Deployment Guide

<p align="center">
  <strong>Enterprise Deployment Guide for Central Fleet Servers, Admin Consoles, and Managed Endpoint Agents</strong>
</p>

---

## 1. System Architecture & Topology

System Revamp v2.0 is engineered around an **asymmetric, outbound-only fleet architecture**:
- **Central Fleet Server**: A centralized FastAPI daemon providing multi-tenant organization/lab management, authoritative risk evaluation, real CVE database connectors (OSV.dev / NVD), rate-limited VirusTotal caching, and HMAC command dispatching.
- **Admin Console**: A React 18 single-page application built on CSS design tokens (`tokens.css`), featuring compliance health monitoring, deep hardware inspection, and staged rollouts.
- **Managed Endpoint Agents**: Lightweight background daemons (Windows Service or Linux systemd) that periodically audit installed applications, hardware problem codes, Authenticode signatures, and SHA-256 hashes. Agents communicate strictly outbound over TLS (`https://` or `http://` on LANs) and buffer telemetry in local SQLite queues during network outages.

```mermaid
flowchart TD
    subgraph Enterprise_Network ["🏢 University Campus / Corporate LAN"]
        subgraph Endpoints ["🖥️ Managed Endpoints (Computer Labs & Workstations)"]
            WinAgent["Windows 10/11 Endpoint<br/>• Outbound Agent Daemon<br/>• Local SQLite Queue<br/>• Zero Inbound Listening Ports"]
            LinAgent["Linux Endpoint (Ubuntu / RHEL)<br/>• systemd Background Daemon<br/>• Local SQLite Queue<br/>• Zero Inbound Listening Ports"]
        end

        subgraph Core_Tier ["🏛️ Infrastructure Tier"]
            Proxy["Reverse Proxy / TLS Terminator<br/>(Nginx / Caddy / Traefik)<br/>Port 443 / 80"]
            Server["System Revamp Fleet Server (:8000)<br/>• FastAPI Application<br/>• Authoritative Risk Engine<br/>• HMAC Command Signer"]
            DB[("Persistent Storage<br/>• SQLite (WAL mode) &lt;500 hosts<br/>• PostgreSQL &gt;500 hosts")]
            LANCache[("📦 LAN Installer Cache<br/>(offline binaries & updates)")]
        end

        subgraph Admin_Tier ["🛡️ Administrative Management"]
            AdminWeb["Admin Console (React 18)<br/>Hosted via Nginx / Node / CDN"]
            SysAdmin["Systems Administrator<br/>(Web Browser with 2FA)"]
        end
    end

    WinAgent -- "Outbound TLS Polling & Telemetry (X-Device-Token)" --> Proxy
    LinAgent -- "Outbound TLS Polling & Telemetry (X-Device-Token)" --> Proxy
    Proxy --> Server
    Server --> DB
    Server --> LANCache
    SysAdmin --> AdminWeb
    AdminWeb -- "REST API & SSE Stream (Bearer JWT)" --> Proxy
```

---

## 2. Infrastructure Prerequisites

### 2.1 Central Fleet Server Host
- **Operating System**: Ubuntu 22.04/24.04 LTS, Debian 12, RHEL 9, or Windows Server 2019/2022.
- **Python Runtime**: Python 3.10+ (Python 3.11 or 3.12 recommended).
- **Hardware Specs**:
  - Small Fleet (1 – 150 endpoints): 2 vCPU, 2 GB RAM, 20 GB SSD.
  - Medium Fleet (150 – 1,000 endpoints): 4 vCPU, 8 GB RAM, 80 GB SSD.
  - Large Fleet (1,000 – 10,000+ endpoints): 8 vCPU, 16 GB RAM, 250 GB NVMe SSD with PostgreSQL backing store.
- **Network Ports**:
  - Inbound: Port `8000` (or `443` via reverse proxy).
  - Outbound (Optional): Access to `osv.dev`, `services.nvd.nist.gov`, and `virustotal.com` (if online threat scanning is desired). For air-gapped setups, zero internet access is required.

### 2.2 Managed Endpoints
- **Windows**: Windows 10 (1809+), Windows 11, or Windows Server 2019/2022.
  - PowerShell 5.1 or PowerShell 7+.
  - Optional: Windows Package Manager (`winget`) for automated software upgrades.
- **Linux**: Ubuntu 20.04+, Debian 11+, RHEL/CentOS 8+, or Fedora.
  - Systemd init system.
  - Python 3.10+.

---

## 3. Central Fleet Server Installation

### Step 1: Clone Repository & Virtual Environment
```bash
# Clone the repository
git clone https://github.com/organization/system-revamp.git /opt/system-revamp
cd /opt/system-revamp

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Install production dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 2: Configure Environment Variables
Create the production `.env` configuration file in `/opt/system-revamp/.env`:

```env
# Application Settings
APP_NAME="System Revamp Fleet Server"
APP_VERSION="2.0.0"
DEBUG=false
SERVER_HOST="0.0.0.0"
SERVER_PORT=8000

# Security & Cryptography (Generate strong keys with `openssl rand -hex 32`)
JWT_SECRET_KEY="c48e9102b37d45...YOUR_SECURE_JWT_SECRET..."
DEVICE_SIGNING_KEY="a19f20e4b85c12...YOUR_SECURE_HMAC_SIGNING_KEY..."
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

# Database Configuration
# Default: Local SQLite database with WAL mode enabled
DATABASE_URL="sqlite:///./server_data/fleet.db"
# Or for PostgreSQL in large fleets:
# DATABASE_URL="postgresql://sr_user:sr_password@127.0.0.1:5432/system_revamp"

# Optional Upstream Threat Intelligence
# Leave empty for keyless operation without external VirusTotal lookups
VT_API_KEY=""
VT_RATE_LIMIT_PER_MINUTE=4

# Storage Directories
INSTALLER_CACHE_DIR="./server_data/installers"
```

### Step 3: Run Database Migrations & Initial Setup
```bash
# Initialize schema and seed default catalogs
python3 -m server.main --init-only
```

### Step 4: Configure systemd Production Service (Linux)
Create `/etc/systemd/system/system-revamp-server.service`:

```ini
[Unit]
Description=System Revamp Central Fleet Server
After=network.target

[Service]
Type=simple
User=revamp
Group=revamp
WorkingDirectory=/opt/system-revamp
EnvironmentFile=/opt/system-revamp/.env
ExecStart=/opt/system-revamp/venv/bin/python -m server.main
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now system-revamp-server
sudo systemctl status system-revamp-server
```

---

## 4. Admin Console Installation

### Step 1: Build Production Frontend Assets
On a workstation or build server with Node.js 18+:

```bash
cd /opt/system-revamp/frontend
npm install --frozen-lockfile
npm run build
```
The compiled, production-optimized single-page application will be generated in `frontend/build/`.

### Step 2: Nginx Reverse Proxy & SSL Configuration
Configure Nginx (`/etc/nginx/sites-available/system-revamp.conf`) to serve both the React Admin Console and proxy the Fleet Server API under a single TLS origin:

```nginx
server {
    listen 80;
    server_name fleet.university.edu;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name fleet.university.edu;

    ssl_certificate /etc/letsencrypt/live/fleet.university.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fleet.university.edu/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Admin Console Static SPA
    root /opt/system-revamp/frontend/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Central Server API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE Streaming Settings (For Exposure Stream)
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }
}
```

Enable and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/system-revamp.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. Managed Endpoint Agent Deployment

### Step 1: Generate an Enrollment Token
1. Open the Admin Console at `https://fleet.university.edu`.
2. Complete the initial SuperAdmin setup wizard if launching for the first time.
3. Navigate to **Enrollment Tokens** $\rightarrow$ **Generate New Token**.
4. Select the target Organization and Computer Lab (e.g., `Science Building - Lab 102`).
5. Set token duration (e.g., 14 days) and maximum permitted uses (e.g., 50 machines).
6. Copy the generated enrollment token (e.g., `sr_enroll_4f92a10b...`).

---

### Step 2: Windows Endpoint Installation

#### Method A: Direct PowerShell Script Installation
Run on the managed target workstation with Administrator privileges:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\installer\windows\install-agent.ps1 `
    -ServerUrl "https://fleet.university.edu" `
    -EnrollToken "sr_enroll_4f92a10b..."
```

#### Method B: Unattended Active Directory GPO Deployment
For computer labs joined to an Active Directory domain, deploy via **Group Policy Object (GPO) Startup Script**:
1. Copy `agent/` and `installer/windows/install-agent.ps1` to your domain `SYSVOL` share (`\\domain\SYSVOL\scripts\SystemRevamp\`).
2. In **Group Policy Management Console (GPMC)**, create a GPO linked to the Computer Lab Organizational Unit (OU).
3. Under **Computer Configuration** $\rightarrow$ **Policies** $\rightarrow$ **Windows Settings** $\rightarrow$ **Scripts (Startup/Shutdown)** $\rightarrow$ **Startup**:
   - Script Name: `powershell.exe`
   - Script Parameters: `-ExecutionPolicy Bypass -File "\\domain\SYSVOL\scripts\SystemRevamp\install-agent.ps1" -ServerUrl "https://fleet.university.edu" -EnrollToken "sr_enroll_..."`
4. The agent will silently enroll upon computer reboot and begin reporting telemetry.

---

### Step 3: Linux Endpoint Installation

Run on the target Linux workstation with `sudo` permissions:

```bash
sudo bash ./installer/linux/install-agent.sh \
    --server "https://fleet.university.edu" \
    --token "sr_enroll_4f92a10b..."
```

This script:
1. Installs the agent into `/opt/system-revamp-agent`.
2. Creates an unprivileged service user.
3. Automatically writes the `/etc/systemd/system/system-revamp-agent.service` unit file.
4. Performs immediate initial enrollment and triggers the first hardware & package audit.
5. Enables and starts the background daemon.

---

## 6. Production Verification & Integrity Check

After completing installation, execute the integrated verification suite to guarantee zero mock data, zero hard edges, and full test suite passing:

```powershell
# 1. Verify zero mock keywords or placeholder CVEs leak into production
python scripts/verify_no_mocks.py

# 2. Run the complete unit and integration test suite
python -m pytest tests/ -v -p no:cacheprovider

# 3. Check live agent connectivity via Admin Console
# Navigate to "Workstations & Labs" in the web UI. Newly enrolled machines
# will transition from "Enrolling" to "Online" with complete hardware specifications.
```

---

## 7. Operational Troubleshooting

| Symptom | Root Cause | Remediation |
|---|---|---|
| **Agent shows "Enrolling..." but fails to appear online** | Network firewall blocking outbound traffic to server port. | Confirm managed endpoint can reach `https://fleet.university.edu/api/v2/auth/setup-status` via curl or PowerShell `Invoke-WebRequest`. |
| **`401 Unauthorized` during telemetry upload** | Device token was revoked or `agent_config.json` was deleted. | Delete local `agent_config.json` and re-run enrollment with a fresh enrollment token. |
| **Vulnerability evaluation shows "Zero CVEs"** | Offline air-gapped server without CVE database bundle imported. | Download a signed intelligence bundle from an internet bastion and import via **Air-Gapped Sync** in the Admin Console. |
| **PnP Driver displays Code 28** | Hardware driver missing from Windows system image. | Dispatch an automated driver update command (`pnputil /scan-devices` or Windows Update scan) via **Remediation Console**. |

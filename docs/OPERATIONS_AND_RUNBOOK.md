# System Revamp v2.0 — Production Operations & Maintenance Runbook

<p align="center">
  <strong>Standard Operating Procedures (SOP), Backup & Disaster Recovery, Health Monitoring, and Incident Response</strong>
</p>

---

## 1. Daily Health Checks & System Monitoring

To ensure fleet stability and continuous telemetry ingestion across university computer labs and enterprise endpoints, operators should monitor key health indicators daily.

### 1.1 Automated Health Check Endpoint
The Central Fleet Server provides an instantaneous setup and health inspection endpoint:
```bash
curl -f -s https://fleet.university.edu/api/v2/auth/setup-status | jq .
```

Expected output:
```json
{
  "setup_required": false,
  "admin_count": 2,
  "app_name": "System Revamp Fleet Server",
  "app_version": "2.0.0"
}
```

### 1.2 System Service Status Checks
- **Central Server (Linux systemd)**:
  ```bash
  sudo systemctl status system-revamp-server --no-pager
  ```
- **Nginx Reverse Proxy**:
  ```bash
  sudo systemctl status nginx --no-pager
  ```
- **Local Agent Daemon (Windows PowerShell as Admin)**:
  ```powershell
  Get-Process -Name python* | Where-Object { $_.CommandLine -like "*agent.main*" }
  ```
- **Local Agent Daemon (Linux systemd)**:
  ```bash
  sudo systemctl status system-revamp-agent --no-pager
  ```

---

## 2. Backup & Disaster Recovery (BDR)

The Central Fleet Server persists state in its relational database (`server_data/fleet.db` or PostgreSQL) and the LAN installer cache (`server_data/installers/`).

### 2.1 SQLite Hot Backup Procedure (Default Deployment)
SQLite allows hot backups without stopping the central server using the atomic `VACUUM INTO` command:

```bash
#!/usr/bin/env bash
# /opt/system-revamp/scripts/backup_db.sh
set -euo pipefail

BACKUP_DIR="/var/backups/system-revamp"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TARGET_FILE="${BACKUP_DIR}/fleet_${TIMESTAMP}.db"

mkdir -p "${BACKUP_DIR}"

# Execute atomic SQLite hot backup
python3 -c "
import sqlite3
con = sqlite3.connect('/opt/system-revamp/server_data/fleet.db')
con.execute(\"VACUUM INTO '${TARGET_FILE}'\")
con.close()
"

# Compress backup
gzip -9 "${TARGET_FILE}"

# Retain last 30 daily backups
find "${BACKUP_DIR}" -name "fleet_*.db.gz" -mtime +30 -delete

echo "[OK] Backup completed: ${TARGET_FILE}.gz"
```

Configure a daily cron job (`/etc/cron.daily/system-revamp-backup`):
```bash
0 2 * * * root /opt/system-revamp/scripts/backup_db.sh > /var/log/system-revamp-backup.log 2>&1
```

### 2.2 PostgreSQL Backup Procedure (Enterprise Tier)
For installations utilizing PostgreSQL:
```bash
pg_dump -U sr_user -h 127.0.0.1 -Fc system_revamp > "/var/backups/system-revamp/pg_dump_$(date +%Y%m%d_%H%M%S).dump"
```

### 2.3 Disaster Recovery Restore Procedure
1. Stop the Central Fleet Server:
   ```bash
   sudo systemctl stop system-revamp-server
   ```
2. Restore the database file:
   ```bash
   gunzip -c /var/backups/system-revamp/fleet_YYYYMMDD_HHMMSS.db.gz > /opt/system-revamp/server_data/fleet.db
   chmod 600 /opt/system-revamp/server_data/fleet.db
   chown revamp:revamp /opt/system-revamp/server_data/fleet.db
   ```
3. Restart the Central Fleet Server:
   ```bash
   sudo systemctl start system-revamp-server
   ```

---

## 3. Log Management & Rotation

### 3.1 Central Server Logs
Central server logs are written to systemd journal. Configure journald retention or stream to syslog:
```bash
# View recent server activity
journalctl -u system-revamp-server -n 100 -f

# View errors only
journalctl -u system-revamp-server -p err..emerg
```

### 3.2 Endpoint Agent Logs
On Windows endpoints, agent logs are located in the agent directory:
- Path: `C:\ProgramData\SystemRevamp\logs\agent.log`
- Queue database: `C:\ProgramData\SystemRevamp\agent_queue.db`

---

## 4. Key Management & Rotation Procedures

### 4.1 Rotating Admin JWT Signing Secret
If `JWT_SECRET_KEY` is compromised:
1. Generate a new 256-bit secret:
   ```bash
   openssl rand -hex 32
   ```
2. Update `JWT_SECRET_KEY` in `/opt/system-revamp/.env`.
3. Restart the server service:
   ```bash
   sudo systemctl restart system-revamp-server
   ```
4. *Effect*: All current admin sessions will be terminated and require re-login. Managed endpoint communication remains unaffected.

### 4.2 Rotating Device Signing Key (`DEVICE_SIGNING_KEY`)
`DEVICE_SIGNING_KEY` signs remediation commands and offline intelligence bundles.
1. Generate a new key and update `.env`.
2. Update the corresponding configuration across deployed agents or reinstall agents via updated GPO script.
3. Restart the central server.

---

## 5. Incident Response Playbooks

### Playbook A: Detected Malicious Hash Fleetwide
1. **Identify Affected Hosts**:
   - In Admin Console, navigate to **Threat Intelligence** $\rightarrow$ Click on the flagged SHA-256 hash to view all affected workstations.
2. **Isolate Workstations**:
   - Use lab network controls or firewall rules to quarantine affected endpoints.
3. **Queue Investigation Command**:
   - Dispatch `run-protection-scan` command to gather updated file paths and signature statuses.
4. **Remediate**:
   - Dispatch an approved silent uninstaller or package upgrade via the **Remediation Console**.

### Playbook B: Massive Offline Agent Ingestion Backlog
1. **Verify Network Connectivity**:
   - Ensure managed endpoints can resolve and reach the Central Server reverse proxy (`curl -I https://fleet.university.edu`).
2. **Inspect Agent Local Queue**:
   - Check `agent_queue.db` on a sample workstation to verify records are buffered and not lost.
3. **Stagger Ingestion Intervals**:
   - If server CPU spikes during sudden campus power recovery, adjust `poll_interval_seconds` in `server_config` to 600 seconds to ease ingestion pressure.

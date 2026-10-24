#!/usr/bin/env bash
# ==============================================================================
# System Revamp v2.0 — Production SQLite Hot Backup Script
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/system-revamp}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TARGET_FILE="${BACKUP_DIR}/fleet_${TIMESTAMP}.db"
DB_PATH="${DB_PATH:-/opt/system-revamp/server_data/fleet.db}"

mkdir -p "${BACKUP_DIR}"

echo "[+] Initiating atomic SQLite VACUUM INTO hot backup..."
python3 -c "
import sqlite3
con = sqlite3.connect('${DB_PATH}')
con.execute(\"VACUUM INTO '${TARGET_FILE}'\")
con.close()
"

echo "[+] Compressing backup archive..."
gzip -9 "${TARGET_FILE}"

echo "[+] Enforcing 30-day retention pruning..."
find "${BACKUP_DIR}" -name "fleet_*.db.gz" -mtime +30 -delete

echo "[OK] Backup completed successfully: ${TARGET_FILE}.gz"

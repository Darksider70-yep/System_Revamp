#!/bin/bash
# ==========================================================
#   ⚡ System Revamp Endpoint Agent Installer (Linux systemd)
# ==========================================================

set -e

SERVER_URL=""
ENROLL_TOKEN=""
INSTALL_DIR="/opt/system-revamp-agent"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --server) SERVER_URL="$2"; shift ;;
        --token) ENROLL_TOKEN="$2"; shift ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

if [ -z "$SERVER_URL" ] || [ -z "$ENROLL_TOKEN" ]; then
    echo "Usage: sudo bash install-agent.sh --server <SERVER_URL> --token <ENROLL_TOKEN>"
    exit 1
fi

echo "[+] Creating agent directory: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
mkdir -p /var/log/system-revamp

echo "[+] Enrolling agent with $SERVER_URL..."
python3 -m agent.main enroll --server "$SERVER_URL" --token "$ENROLL_TOKEN"

echo "[+] Creating systemd service unit: /etc/systemd/system/system-revamp-agent.service"
cat <<EOF > /etc/systemd/system/system-revamp-agent.service
[Unit]
Description=System Revamp Endpoint Agent Daemon
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/python3 -m agent.main run-daemon
Restart=always
RestartSec=15

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable system-revamp-agent
systemctl restart system-revamp-agent

echo "[✓] System Revamp Agent successfully installed and started via systemd!"

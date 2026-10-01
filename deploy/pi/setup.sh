#!/usr/bin/env bash
# One-off set-up of a Raspberry Pi to run the game server, deployed to by
# GitHub Actions (.github/workflows/pi.yml). Run it on the Pi, as the user the
# GitHub runner will run as:
#
#   sudo ./deploy/pi/setup.sh            # or: sudo ./deploy/pi/setup.sh someuser
#
# It makes the folders, installs the pmc-firefight service, and lets that user
# restart the service (and read its log) without a password — nothing else.
# Registering the runner itself is in deploy/pi/README.md.
set -euo pipefail

RUN_AS="${1:-${SUDO_USER:-}}"
PORT="${PORT:-8787}"
# 127.0.0.1: reached only through nginx (https://<host>/pmc/). HOST=0.0.0.0 to
# reach it directly on the home network instead, at http://<pi>.local:8787
HOST="${HOST:-127.0.0.1}"
BASE=/opt/pmc-firefight
DATA=/var/lib/pmc-firefight

if [ "$(id -u)" -ne 0 ]; then echo "Run it with sudo." >&2; exit 1; fi
if [ -z "$RUN_AS" ] || ! id "$RUN_AS" >/dev/null 2>&1; then
  echo "Say which user runs the server and the runner: sudo $0 <user>" >&2; exit 1
fi

NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then
  echo "Node.js is not installed. Node 20 or later:" >&2
  echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs" >&2
  exit 1
fi
MAJOR="$("$NODE" -p 'process.versions.node.split(".")[0]')"
if [ "$MAJOR" -lt 20 ]; then echo "Node $MAJOR is too old; 20 or later, please." >&2; exit 1; fi

apt-get update -qq
apt-get install -y rsync curl >/dev/null

# the code (replaced by every deploy) and the saved campaigns (never touched by one)
mkdir -p "$BASE/app" "$DATA/campaigns"
chown -R "$RUN_AS:" "$BASE" "$DATA"

SYSTEMCTL="$(command -v systemctl)"
JOURNALCTL="$(command -v journalctl)"

cat > /etc/systemd/system/pmc-firefight.service <<EOF
[Unit]
Description=PMC 2670 Firefight game server
After=network-online.target
Wants=network-online.target

[Service]
User=$RUN_AS
WorkingDirectory=$BASE/app
ExecStart=$NODE $BASE/app/server.js
Environment=PORT=$PORT
Environment=HOST=$HOST
Environment=CAMPAIGNS_DIR=$DATA/campaigns
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

# the deploy restarts the service and, if it fails to come up, reads its log
cat > /etc/sudoers.d/pmc-firefight <<EOF
$RUN_AS ALL=(root) NOPASSWD: $SYSTEMCTL restart pmc-firefight, $JOURNALCTL -u pmc-firefight -n 40 --no-pager
EOF
chmod 440 /etc/sudoers.d/pmc-firefight
visudo -cf /etc/sudoers.d/pmc-firefight >/dev/null

systemctl daemon-reload
systemctl enable pmc-firefight >/dev/null
echo "Set up: the service listens on $HOST:$PORT and starts with the first deploy."
echo "Next: register the runner (deploy/pi/README.md, step 2)."

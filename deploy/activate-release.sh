#!/usr/bin/env bash
set -euo pipefail
umask 077

release_id="${1:?Release ID required}"
[[ "$release_id" =~ ^[a-f0-9]{40}-[0-9]+-[0-9]+$ ]] || exit 1
[[ "$(id -un)" == humarizer ]] || { echo 'Run as humarizer'; exit 1; }
base=/home/humarizer/apps/humanizer
incoming="$base/incoming/$release_id"
release="$base/releases/$release_id"
node_bin="$(command -v node)"
"$node_bin" -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 12)) process.exit(1)'
command -v curl >/dev/null
sudo -n true
mkdir -p "$base/releases"
test ! -e "$release"
mkdir "$release"
tar -xzf "$incoming/humanizer.tgz" -C "$release"
app="$release/apps/client"
test -f "$app/server.js"
install -m 600 "$incoming/runtime.json" "$app/runtime.json"
cat > "$app/runtime-env.cjs" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
Object.assign(process.env, JSON.parse(fs.readFileSync(path.join(__dirname, 'runtime.json'), 'utf8')));
NODE

service_file="$(mktemp)"
trap 'rm -f "$service_file"' EXIT
cat > "$service_file" <<SERVICE
[Unit]
Description=Humanizer Next.js
After=network-online.target
Wants=network-online.target

[Service]
User=humarizer
WorkingDirectory=$base/current/apps/client
Environment=NODE_ENV=production
Environment=HOSTNAME=127.0.0.1
Environment=PORT=3000
Environment=NODE_OPTIONS=--max-old-space-size=512
ExecStart=$node_bin --require ./runtime-env.cjs server.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
UMask=0077

[Install]
WantedBy=multi-user.target
SERVICE
sudo -n install -m 644 "$service_file" /etc/systemd/system/humanizer.service
sudo -n systemctl daemon-reload
previous="$(readlink -f "$base/current" || true)"
ln -s "$release" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
sudo -n systemctl enable humanizer.service

healthy() {
  for attempt in {1..30}; do
    if sudo -n systemctl is-active --quiet humanizer.service && curl --fail --silent --max-time 5 http://127.0.0.1:3000/api/auth/ok >/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

if sudo -n systemctl restart humanizer.service && healthy; then
  rm -f "$incoming/runtime.json" "$incoming/humanizer.tgz" "$incoming/activate-release.sh"
  rmdir "$incoming"
  echo "Deployed $release_id"
else
  echo 'Deployment health check failed.'
  if [[ -n "$previous" && "$previous" != "$release" && -d "$previous" ]]; then
    ln -s "$previous" "$base/current.rollback"
    mv -Tf "$base/current.rollback" "$base/current"
    sudo -n systemctl restart humanizer.service
    echo 'Restored previous release.'
  else
    sudo -n systemctl stop humanizer.service
  fi
  exit 1
fi

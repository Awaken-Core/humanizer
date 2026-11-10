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
pm2_bin="$(command -v pm2)"
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

# PM2 runs as the SSH user, never as root. Configure its boot hook once.
if ! sudo -n systemctl cat pm2-humarizer.service >/dev/null 2>&1; then
  sudo -n env PATH="$PATH" "$pm2_bin" startup systemd -u humarizer --hp /home/humarizer
fi
sudo -n systemctl enable pm2-humarizer.service

# One-time migration: release port 3000 from the former app-specific service.
if sudo -n systemctl cat humanizer.service >/dev/null 2>&1; then
  sudo -n systemctl disable --now humanizer.service
fi
previous="$(readlink -f "$base/current" || true)"
ln -s "$release" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"

start_release() {
  local target="$1/apps/client"
  if "$pm2_bin" describe humanizer >/dev/null 2>&1; then
    "$pm2_bin" delete humanizer
  fi
  NODE_ENV=production HOSTNAME=127.0.0.1 PORT=3000 \
    "$pm2_bin" start "$target/server.js" --name humanizer \
    --cwd "$target" --interpreter "$node_bin" \
    --node-args="--max-old-space-size=512 --require ./runtime-env.cjs" \
    --restart-delay 5000 --time
}

healthy() {
  for attempt in {1..30}; do
    if curl --fail --silent --max-time 5 http://127.0.0.1:3000/api/auth/ok >/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

if start_release "$release" && healthy; then
  "$pm2_bin" save
  rm -f "$incoming/runtime.json" "$incoming/humanizer.tgz" "$incoming/activate-release.sh"
  rmdir "$incoming"
  echo "Deployed $release_id"
else
  echo 'Deployment health check failed.'
  if [[ -n "$previous" && "$previous" != "$release" && -d "$previous" ]]; then
    ln -s "$previous" "$base/current.rollback"
    mv -Tf "$base/current.rollback" "$base/current"
    if start_release "$previous" && healthy; then
      "$pm2_bin" save
      echo 'Restored previous release.'
    else
      echo 'Previous release also failed its health check.'
    fi
  else
    if "$pm2_bin" describe humanizer >/dev/null 2>&1; then "$pm2_bin" delete humanizer; fi
    "$pm2_bin" save --force
  fi
  exit 1
fi

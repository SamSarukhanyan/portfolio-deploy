# Chaos scenarios (contracts/scenarios.md). Sourced by the lab-scenario SSM document,
# which then calls: run_step <scenario> <break|oracle>. Reset is lab-provision.

site_ok() { # / and the bundle it references answer 200, /api/health answers 200 within $1 seconds
  local max=${1:-5} html bundle t
  html=$(curl -fsS -m "$max" http://127.0.0.1/) || { echo "/ not 200"; return 1; }
  bundle=$(grep -o 'src="/app\.[^"]*"' <<<"$html" | cut -d'"' -f2)
  curl -fsS -o /dev/null -m "$max" "http://127.0.0.1$bundle" || { echo "bundle $bundle not 200"; return 1; }
  t=$(curl -fsS -o /dev/null -m "$max" -w '%{time_total}' http://127.0.0.1/api/health) || { echo "/api/health not 200"; return 1; }
  echo "site ok, /api/health ${t}s"
}

break_nginx-stopped() { systemctl stop nginx; }
oracle_nginx-stopped() { systemctl is-active -q nginx && site_ok; }

break_disk-full() {
  # Fill the /var/lab filesystem (a 256 MB image, see provision.sh) to the last block.
  # The system disk is untouched, so the SSM agent and the reset keep working.
  dd if=/dev/zero of=/var/lab/cache/tmp-export.bin bs=1M status=none 2>/dev/null || true
  sync
}
oracle_disk-full() {
  [ "$(df --output=pcent /var/lab | tail -1 | tr -dc 0-9)" -lt 90 ] || { echo "/var/lab still full"; return 1; }
  site_ok
}

break_bad-release() {
  local sha=9c0ffee dir=/var/www/lab/releases/9c0ffee
  mkdir -p "$dir"
  sed "s|/app\.[0-9a-f]*\.js|/app.$sha.js|" /var/www/lab/current/index.html > "$dir/index.html" # bundle never shipped
  ln -sfn "releases/$sha" /var/www/lab/current.next && mv -T /var/www/lab/current.next /var/www/lab/current
  echo "$(date -u +%FT%TZ) deploy $sha" >> /var/lab/changes.log
}
oracle_bad-release() {
  [ "$(readlink /var/www/lab/current)" != "releases/9c0ffee" ] || { echo "bad release still current"; return 1; }
  site_ok
}

break_bad-config() {
  echo 'proxy_bufer_size 4k;  # hand edit' >> /etc/nginx/sites-available/lab
  echo "$(date -u +%FT%TZ) config nginx sites-available/lab edited" >> /var/lab/changes.log
  systemctl restart nginx || true
}
oracle_bad-config() { nginx -t -q 2>/dev/null && systemctl is-active -q nginx && site_ok; }

break_cpu-hog() {
  # One process group: a leader plus busy children, so a single kill_process stops all of it.
  local n=$(( $(nproc) * 8 ))
  runuser -u labapp -- setsid bash -c 'for i in $(seq '"$n"'); do bash -c "while :; do :; done" lab-hog & done; wait' lab-hog \
    </dev/null >/dev/null 2>&1 &
  sleep 2
}
oracle_cpu-hog() {
  ! pgrep -u labapp -f lab-hog >/dev/null || { echo "hog still running"; return 1; }
  site_ok 1
}

run_step() { # scenario step
  "$2_$1"
}

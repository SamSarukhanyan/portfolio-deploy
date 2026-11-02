#!/bin/bash
# Golden state of the Incident Lab sandbox. Idempotent: running it again undoes any incident.
# Layout is described in contracts/scenarios.md.
set -euo pipefail

GOOD_RELEASES=(1a2b3c4 5d6e7f8)   # oldest first; the last one is current
WWW=/var/www/lab

command -v nginx >/dev/null || { apt-get update -q; apt-get install -y -q nginx; }

id labapp >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin labapp

# /var/lab is its own small filesystem, so "disk full" can never fill the system disk.
if ! mountpoint -q /var/lab; then
  [ -f /var/lab.img ] || { fallocate -l 256M /var/lab.img; mkfs.ext4 -q -m 0 /var/lab.img; }
  grep -q '^/var/lab.img ' /etc/fstab || echo '/var/lab.img /var/lab ext4 loop,nofail 0 2' >> /etc/fstab
  rm -rf /var/lab && mkdir /var/lab && mount /var/lab
fi
install -d -o root -g root -m 755 /var/lab /opt/lab "$WWW/releases" /etc/nginx/lab-known-good
install -d -o labapp -g labapp -m 755 /var/lab/data /var/lab/cache

# --- releases ---
make_release() { # sha bundle-to-reference
  local dir="$WWW/releases/$1"
  mkdir -p "$dir"
  cat > "$dir/app.$1.js" <<JS
document.getElementById("v").textContent = "release $1";
fetch("/api/health").then(r => r.json()).then(h => document.getElementById("h").textContent = h.ok ? "healthy" : "unhealthy");
JS
  cat > "$dir/index.html" <<HTML
<!doctype html><meta charset="utf-8"><title>Incident Lab</title>
<h1>Incident Lab sandbox</h1><p id="v">loading…</p><p>API: <span id="h">…</span></p>
<script src="/app.$2.js"></script>
HTML
}
for sha in "${GOOD_RELEASES[@]}"; do make_release "$sha" "$sha"; done
current=${GOOD_RELEASES[-1]}
{ ls -1 "$WWW/releases" | grep -vxF -f <(printf '%s\n' "${GOOD_RELEASES[@]}") || true; } |
  sed "s|^|$WWW/releases/|" | xargs -r rm -rf --
touch -d '2 days ago' "$WWW/releases/${GOOD_RELEASES[0]}"
touch -d '1 day ago' "$WWW/releases/$current"
ln -sfn "releases/$current" "$WWW/current.next" && mv -T "$WWW/current.next" "$WWW/current"

# --- app: /api/health writes a heartbeat, so a full disk breaks it ---
cat > /opt/lab/app.py <<'PY'
import hashlib, json, os, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

class H(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/api/health":
            return self.reply(404, {"ok": False})
        try:
            # New file, then rename: needs fresh blocks even while the old heartbeat exists.
            with open("/var/lab/data/heartbeat.new", "w") as f:
                f.write(str(time.time()) + "\n" * 4096)
                f.flush(); os.fsync(f.fileno())
            os.replace("/var/lab/data/heartbeat.new", "/var/lab/data/heartbeat")
        except OSError as e:
            print(f"health: cannot write heartbeat: {e.strerror}", file=sys.stderr, flush=True)
            return self.reply(500, {"ok": False, "error": e.strerror})
        d = b"lab"
        for _ in range(150000):  # ~0.1 s of real work, so CPU starvation shows up as seconds of latency
            d = hashlib.sha256(d).digest()
        self.reply(200, {"ok": True})

    def reply(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *a):
        pass

ThreadingHTTPServer(("127.0.0.1", 3000), H).serve_forever()
PY
cat > /etc/systemd/system/lab-app.service <<'UNIT'
[Unit]
Description=Incident Lab demo app
After=network.target

[Service]
User=labapp
ExecStart=/usr/bin/python3 /opt/lab/app.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT

# --- nginx ---
cat > /etc/nginx/lab-known-good/lab <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    root /var/www/lab/current;
    index index.html;
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_read_timeout 15s;
    }
}
NGINX
install -m 644 /etc/nginx/lab-known-good/lab /etc/nginx/sites-available/lab
ln -sfn /etc/nginx/sites-available/lab /etc/nginx/sites-enabled/lab
rm -f /etc/nginx/sites-enabled/default

# --- clean up whatever an incident left behind ---
pkill -9 -u labapp -f 'lab-hog' || true
find /var/lab/cache /var/lab/data -mindepth 1 -delete
: > /var/lab/changes.log.new
echo "$(date -u -d '2 days ago' +%FT%TZ) deploy ${GOOD_RELEASES[0]}" >> /var/lab/changes.log.new
echo "$(date -u -d '1 day ago' +%FT%TZ) deploy $current" >> /var/lab/changes.log.new
mv /var/lab/changes.log.new /var/lab/changes.log

systemctl daemon-reload
systemctl reset-failed lab-app nginx 2>/dev/null || true # restarts in a burst may have hit the start limit
systemctl enable -q lab-app nginx
systemctl restart lab-app
nginx -t -q
systemctl restart nginx
echo "golden state: release $current"

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
# The page watches its own server: every 2 s it re-fetches /, the JS bundle that / references and
# /api/health, and shows HEALTHY / DEGRADED / DOWN / RECOVERED with a history bar. The monitor is
# inline on purpose, so it keeps running when a bad release ships a missing bundle, and it reads
# a fresh / on every check, so it notices the rollback. The bundle only marks the release as loaded.
read -r -d '' PAGE <<'HTML' || true
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Incident Lab · sandbox status</title>
<style>
  :root { --bg:#0a0b0d; --card:#13151a; --line:#23262d; --text:#eef0f3; --muted:#8b919c;
          --ok:#3ddc84; --warn:#f5c542; --bad:#ff5d5d; --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  * { box-sizing:border-box }
  body { margin:0; min-height:100vh; background:radial-gradient(1200px 600px at 50% -10%, #1a1d24 0%, var(--bg) 60%);
         color:var(--text); font:15px/1.5 Inter,"Segoe UI",Roboto,system-ui,sans-serif; display:grid; place-items:center; padding:24px 16px; }
  main { width:min(720px,100%) }
  .top { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:18px; color:var(--muted); font-size:13px }
  .brand { display:flex; align-items:center; gap:10px; color:var(--text); font-weight:650; letter-spacing:.01em }
  .logo { width:26px; height:26px; border-radius:8px; background:linear-gradient(135deg,#f5c542,#ff9d3d); display:grid; place-items:center; color:#111; font-weight:800; font-size:13px }
  .card { background:var(--card); border:1px solid var(--line); border-radius:20px; padding:28px; box-shadow:0 30px 60px rgba(0,0,0,.35) }
  .hero { display:flex; align-items:center; gap:22px }
  .orb { flex:none; width:84px; height:84px; border-radius:50%; background:var(--c); position:relative; transition:background .4s }
  .orb::after { content:""; position:absolute; inset:-10px; border-radius:50%; border:2px solid var(--c); opacity:.35; animation:ring 1.8s ease-out infinite }
  @keyframes ring { from { transform:scale(.85); opacity:.5 } to { transform:scale(1.25); opacity:0 } }
  .state { font-size:clamp(28px,7vw,44px); font-weight:800; letter-spacing:-.02em; line-height:1.05; color:var(--c); transition:color .4s }
  .detail { margin-top:6px; color:var(--muted) }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:24px 0 18px }
  .metric { border:1px solid var(--line); border-radius:14px; padding:12px 14px }
  .metric b { display:block; font:600 18px/1.3 var(--mono) }
  .metric span { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.06em }
  .bars { display:flex; gap:3px; height:34px; align-items:flex-end }
  .bars i { flex:1; border-radius:3px; background:var(--line); min-height:6px; transition:height .3s }
  .legend { display:flex; justify-content:space-between; color:var(--muted); font-size:12px; margin-top:6px }
  .foot { margin-top:18px; color:var(--muted); font-size:13px; text-align:center }
  .foot a { color:#f5c542; text-decoration:none } .foot a:hover { text-decoration:underline }
  body[data-s=healthy] { --c:var(--ok) } body[data-s=degraded] { --c:var(--warn) }
  body[data-s=down] { --c:var(--bad) } body[data-s=recovered] { --c:var(--ok) } body[data-s=checking] { --c:var(--muted) }
  @media (max-width:520px) { .hero { flex-direction:column; text-align:center } .grid { grid-template-columns:1fr 1fr } }
  @media (prefers-reduced-motion:reduce) { .orb::after { animation:none } }
</style>
</head>
<body data-s="checking">
<main>
  <div class="top"><span class="brand"><span class="logo">IL</span>Incident Lab sandbox</span><span id="clock">live · every 2 s</span></div>
  <section class="card" aria-live="polite">
    <div class="hero">
      <div class="orb" aria-hidden="true"></div>
      <div><div class="state" id="state">Checking…</div><div class="detail" id="detail">Running the first health check.</div></div>
    </div>
    <div class="grid">
      <div class="metric"><span>Response time</span><b id="lat">–</b></div>
      <div class="metric"><span>Live release</span><b id="rel">–</b></div>
      <div class="metric"><span>Uptime (this page)</span><b id="up">–</b></div>
    </div>
    <div class="bars" id="bars" aria-label="Last 60 checks"></div>
    <div class="legend"><span>2 minutes ago</span><span>now</span></div>
  </section>
  <p class="foot">This server is broken on purpose by visitors and repaired by an AI on-call engineer.
    Watch it live on <a href="https://samsarukhanyan.com/lab">samsarukhanyan.com/lab</a>.</p>
</main>
<script>
(() => {
  const $ = (id) => document.getElementById(id);
  const N = 60, history = [];
  let downSince = null, recoveredAt = null, recoveredAfter = 0, ok = 0, total = 0;
  for (let i = 0; i < N; i++) $("bars").appendChild(document.createElement("i"));

  async function timed(url) {
    const t = performance.now();
    try {
      const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      return { status: r.status, ms: Math.round(performance.now() - t), text: url === "/" ? await r.text() : "" };
    } catch { return { status: 0, ms: Math.round(performance.now() - t), text: "" }; }
  }

  async function check() {
    const home = await timed("/");
    let state = "healthy", detail = "All checks pass.", ms = null, release = "–";
    if (home.status !== 200) {
      state = "down"; detail = home.status ? "The website answers with error " + home.status + "." : "The website does not answer at all.";
    } else {
      const src = (home.text.match(/src="(\/app\.[^"]+\.js)"/) || [])[1];
      release = src ? src.split(".")[1] : "unknown";
      const [bundle, api] = await Promise.all([src ? timed(src) : Promise.resolve({ status: 0 }), timed("/api/health")]);
      ms = api.ms;
      if (bundle.status !== 200) { state = "down"; detail = "The page loads, but its program file is missing (error " + (bundle.status || "no answer") + ")."; }
      else if (api.status !== 200) { state = "down"; detail = "The back end fails: /api/health answers " + (api.status || "nothing") + "."; }
      else if (api.ms > 1000) { state = "degraded"; detail = "Working, but slow: the back end took " + (api.ms / 1000).toFixed(1) + " s."; }
    }

    const now = Date.now();
    if (state === "healthy") {
      if (downSince) { recoveredAfter = Math.round((now - downSince) / 1000); recoveredAt = now; downSince = null; }
      if (recoveredAt && now - recoveredAt < 30000) { state = "recovered"; detail = "Back to normal after " + recoveredAfter + " s of trouble."; }
    } else {
      downSince = downSince || now; recoveredAt = null;
      detail += " Trouble for " + Math.round((now - downSince) / 1000) + " s.";
    }

    total++; if (state === "healthy" || state === "recovered") ok++;
    document.body.dataset.s = state;
    $("state").textContent = { healthy: "Healthy", degraded: "Degraded", down: "Down", recovered: "Recovered" }[state];
    $("detail").textContent = detail;
    $("lat").textContent = ms === null ? "–" : ms + " ms";
    $("rel").textContent = release;
    $("up").textContent = Math.round((ok / total) * 100) + "%";
    $("clock").textContent = "live · checked " + new Date().toLocaleTimeString();
    document.title = { healthy: "🟢", degraded: "🟡", down: "🔴", recovered: "🟢" }[state] + " Incident Lab sandbox";

    history.push({ state, ms });
    if (history.length > N) history.shift();
    const bars = $("bars").children;
    for (let i = 0; i < N; i++) {
      const h = history[i - (N - history.length)];
      bars[i].style.height = h ? (h.state === "down" ? 100 : Math.min(100, 25 + (h.ms || 0) / 15)) + "%" : "";
      bars[i].style.background = h ? ({ healthy: "var(--ok)", recovered: "var(--ok)", degraded: "var(--warn)", down: "var(--bad)" }[h.state]) : "";
    }
  }

  check();
  setInterval(check, 2000);
})();
</script>
<script src="/app.__BUNDLE__.js"></script>
</body>
</html>
HTML

make_release() { # sha bundle-to-reference
  local dir="$WWW/releases/$1"
  mkdir -p "$dir"
  echo "window.labRelease = \"$1\"; // the monitor itself is inline in index.html" > "$dir/app.$1.js"
  printf '%s\n' "${PAGE//__BUNDLE__/$2}" > "$dir/index.html"
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
sleep 1
date +%s > /var/lab/reset-at # read_logs starts here
echo "golden state: release $current"

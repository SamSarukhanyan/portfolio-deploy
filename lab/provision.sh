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
  <div class="top"><span class="brand"><span class="logo">IL</span><span id="brand">Incident Lab sandbox</span></span><span id="clock">live · every 2 s</span></div>
  <section class="card" aria-live="polite">
    <div class="hero">
      <div class="orb" aria-hidden="true"></div>
      <div><div class="state" id="state">Checking…</div><div class="detail" id="detail">Running the first health check.</div></div>
    </div>
    <div class="grid">
      <div class="metric"><span id="l-lat">Response time</span><b id="lat">–</b></div>
      <div class="metric"><span id="l-rel">Live release</span><b id="rel">–</b></div>
      <div class="metric"><span id="l-up">Uptime (this page)</span><b id="up">–</b></div>
    </div>
    <div class="bars" id="bars" aria-label="Last 60 checks"></div>
    <div class="legend"><span id="l-ago">2 minutes ago</span><span id="l-now">now</span></div>
  </section>
  <p class="foot"><span id="foot">This server is broken on purpose by visitors and repaired by an AI on-call engineer. Watch it live on</span>
    <a id="watch" href="https://samsarukhanyan.com/lab">samsarukhanyan.com/lab</a></p>
</main>
<script>
(() => {
  const $ = (id) => document.getElementById(id);
  // English, Russian, Armenian: ?lang=, else the browser language. Technical ids stay as they are.
  const T = {
    en: { brand: "Incident Lab sandbox", every: "live · every 2 s", checked: "live · checked ", checking: "Checking…", first: "Running the first health check.",
          lat: "Response time", rel: "Live release", up: "Uptime (this page)", ago: "2 minutes ago", now: "now",
          foot: "This server is broken on purpose by visitors and repaired by an AI on-call engineer. Watch it live on",
          healthy: "Healthy", degraded: "Degraded", down: "Down", recovered: "Recovered",
          ok: "All checks pass.", err: "The website answers with error {c}.", none: "The website does not answer at all.",
          bundle: "The page loads, but its program file is missing (error {c}).", api: "The back end fails: /api/health answers {c}.",
          slow: "Working, but slow: the back end took {s} s.", trouble: " Trouble for {n} s.", back: "Back to normal after {n} s of trouble.", noans: "no answer" },
    ru: { brand: "Песочница Incident Lab", every: "в эфире · каждые 2 с", checked: "в эфире · проверено ", checking: "Проверка…", first: "Выполняется первая проверка.",
          lat: "Время ответа", rel: "Текущая версия", up: "Доступность (на этой странице)", ago: "2 минуты назад", now: "сейчас",
          foot: "Этот сервер специально ломают посетители, а чинит дежурный AI-инженер. Смотрите в прямом эфире на",
          healthy: "Исправен", degraded: "Работает медленно", down: "Не работает", recovered: "Восстановлен",
          ok: "Все проверки пройдены.", err: "Сайт отвечает ошибкой {c}.", none: "Сайт вообще не отвечает.",
          bundle: "Страница загружается, но файла её программы нет (ошибка {c}).", api: "Серверная часть не работает: /api/health отвечает {c}.",
          slow: "Работает, но медленно: серверная часть ответила за {s} с.", trouble: " Проблема длится {n} с.", back: "Снова в норме после {n} с проблем.", noans: "нет ответа" },
    hy: { brand: "Incident Lab ավազարկղ", every: "ուղիղ · ամեն 2 վ", checked: "ուղիղ · ստուգված ", checking: "Ստուգում…", first: "Կատարվում է առաջին ստուգումը։",
          lat: "Արձագանքման ժամանակ", rel: "Գործող տարբերակ", up: "Հասանելիություն (այս էջում)", ago: "2 րոպե առաջ", now: "հիմա",
          foot: "Այս սերվերը միտումնավոր կոտրում են այցելուները, իսկ վերանորոգում է հերթապահ AI ինժեները։ Դիտեք ուղիղ եթերում՝",
          healthy: "Աշխատում է", degraded: "Դանդաղում է", down: "Չի աշխատում", recovered: "Վերականգնված է",
          ok: "Բոլոր ստուգումներն անցել են։", err: "Կայքը պատասխանում է {c} սխալով։", none: "Կայքն ընդհանրապես չի պատասխանում։",
          bundle: "Էջը բեռնվում է, բայց դրա ծրագրային ֆայլը բացակայում է ({c} սխալ)։", api: "Սերվերային մասը չի աշխատում․ /api/health-ը պատասխանում է {c}։",
          slow: "Աշխատում է, բայց դանդաղ․ սերվերային մասը պատասխանեց {s} վայրկյանում։", trouble: " Խնդիրը տևում է {n} վ։", back: "Կրկին նորմալ է {n} վայրկյան տևած խնդրից հետո։", noans: "պատասխան չկա" },
  };
  const q = new URLSearchParams(location.search).get("lang");
  const nav = (navigator.language || "en").toLowerCase();
  const lang = T[q] ? q : nav.startsWith("hy") ? "hy" : nav.startsWith("ru") ? "ru" : "en";
  const L = T[lang];
  const f = (s, v) => s.replace(/\{(\w)\}/g, (_, k) => v[k]);
  document.documentElement.lang = lang;
  for (const id of ["brand", "lat", "rel", "up", "ago", "now", "foot"]) $(id === "brand" || id === "foot" ? id : "l-" + id).textContent = L[id];
  $("clock").textContent = L.every; $("state").textContent = L.checking; $("detail").textContent = L.first;
  $("watch").href = "https://samsarukhanyan.com/lab?lang=" + lang;
  const N = 60, history = [];
  let downSince = null, recoveredAt = null, recoveredAfter = 0, ok = 0, total = 0;
  for (let i = 0; i < N; i++) $("bars").appendChild(document.createElement("i"));
  // Opened while the server was down? The proxy's down page sends us here with ?recovered=<s>.
  const rec = Number(new URLSearchParams(location.search).get("recovered"));
  if (rec > 0) { recoveredAt = Date.now(); recoveredAfter = rec; window.history.replaceState(null, "", "/?lang=" + lang); }

  async function timed(url) {
    const t = performance.now();
    try {
      const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      return { status: r.status, ms: Math.round(performance.now() - t), text: url === "/" ? await r.text() : "" };
    } catch { return { status: 0, ms: Math.round(performance.now() - t), text: "" }; }
  }

  async function check() {
    const home = await timed("/");
    let state = "healthy", detail = L.ok, ms = null, release = "–";
    if (home.status !== 200) {
      state = "down"; detail = home.status ? f(L.err, { c: home.status }) : L.none;
    } else {
      const src = (home.text.match(/src="(\/app\.[^"]+\.js)"/) || [])[1];
      release = src ? src.split(".")[1] : "unknown";
      const [bundle, api] = await Promise.all([src ? timed(src) : Promise.resolve({ status: 0 }), timed("/api/health")]);
      ms = api.ms;
      if (bundle.status !== 200) { state = "down"; detail = f(L.bundle, { c: bundle.status || L.noans }); }
      else if (api.status !== 200) { state = "down"; detail = f(L.api, { c: api.status || L.noans }); }
      else if (api.ms > 1000) { state = "degraded"; detail = f(L.slow, { s: (api.ms / 1000).toFixed(1) }); }
    }

    const now = Date.now();
    if (state === "healthy") {
      if (downSince) { recoveredAfter = Math.round((now - downSince) / 1000); recoveredAt = now; downSince = null; }
      if (recoveredAt && now - recoveredAt < 30000) { state = "recovered"; detail = f(L.back, { n: recoveredAfter }); }
    } else {
      downSince = downSince || now; recoveredAt = null;
      detail += f(L.trouble, { n: Math.round((now - downSince) / 1000) });
    }

    total++; if (state === "healthy" || state === "recovered") ok++;
    document.body.dataset.s = state;
    $("state").textContent = L[state];
    $("detail").textContent = detail;
    $("lat").textContent = ms === null ? "–" : ms + " ms";
    $("rel").textContent = release;
    $("up").textContent = Math.round((ok / total) * 100) + "%";
    $("clock").textContent = L.checked + new Date().toLocaleTimeString(lang);
    document.title = { healthy: "🟢", degraded: "🟡", down: "🔴", recovered: "🟢" }[state] + " " + L.brand;

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

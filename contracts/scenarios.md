# Chaos scenarios

All scenarios live in `lab/scenarios.sh` as `break_<id>` / `oracle_<id>` functions, run on the
lab through the `lab-scenario` SSM document (`Scenario`, `Step` = `break` | `oracle`):

| Step | Contract |
|---|---|
| `break` | causes the failure; exit 0 when it is in place |
| `oracle` | exit 0 only when the site is healthy **and** this scenario's cause is gone; the agent never sees it |
| reset | one for all: the `lab-provision` document (`lab/provision.sh`) rebuilds the golden state no matter what the agent did |

Shared lab layout (owned by Chaos, provisioned by Infra):

- site: nginx serves `/var/www/lab/current` → `releases/<sha>`; the app (`lab-app.service`,
  user `labapp`) answers `/api/health` on 127.0.0.1:3000 behind nginx.
- `/var/lab/` is its own 256 MB filesystem (loop image, no root reserve), the only writable
  junk area, so `disk-full` can never fill the system disk; known-good nginx config is kept in
  `/etc/nginx/lab-known-good/`.
- `/var/lab/changes.log` gets one line per deploy or config edit (read by `recent_changes`).

| id | break | what the prober / agent sees | expected fix | oracle checks |
|---|---|---|---|---|
| `nginx-stopped` | `systemctl stop nginx` | connection refused; `service_status nginx` = inactive | `restart_service nginx` | nginx active, `/` = 200 |
| `disk-full` | write `/var/lab/cache/tmp-export.bin` until `/var/lab` is full; app starts failing writes | 500 on `/api/health`; "No space left on device" in app logs; `disk_usage` shows the file | `delete_file <that file>` (+ `restart_service app` if still failing) | `/var/lab` < 90%, `/api/health` = 200 |
| `bad-release` | deploy a release whose `index.html` loads a missing JS bundle; logged in `changes.log` | `/` = 200 but health check of the bundle URL = 404; `recent_changes` shows the deploy | `rollback <previous sha>` | current is not the bad release, bundle = 200 |
| `bad-config` | append a syntax error to the nginx site config, `systemctl restart nginx` (fails); logged in `changes.log` | connection refused; `nginx_config_test` shows the error | `restore_config nginx` | `nginx -t` ok, `/` = 200 |
| `cpu-hog` | start `stress`-like busy loops as user `labapp` on all cores | `/api/health` slow (it does real CPU work); `get_metrics` CPU ≈ 100%; `list_processes` shows the hog | `kill_process <pid>` (kills the whole hog group) | no `lab-hog` process left, `/api/health` < 1 s |

Detection: the prober checks `/`, the bundle and `/api/health`, plus CPU via `lab-get_metrics`; an alert fires after 2 bad
checks in a row. A check is bad when a probe fails, `/api/health` is slower than 1.2 s, CPU is
≥ 90% (`cpu-hog`: a starved 2-vCPU lab can still answer quickly), or `/var/lab` is ≥ 95% full.

Surprise mode picks a scenario at random; its id is revealed only in `incident.revealed`.

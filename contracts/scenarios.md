# Chaos scenarios

Each scenario lives in `lab/scenarios/<id>/` with three idempotent scripts run on the lab
instance through SSM:

| Script | Contract |
|---|---|
| `break.sh` | causes the failure; exit 0 when it is in place |
| `oracle.sh` | exit 0 only when the site is healthy **and** this scenario's cause is gone; the agent never sees it |
| `reset.sh` | brings the lab back to the golden state no matter what the agent did; exit 0 when done |

Shared lab layout (owned by Chaos, provisioned by Infra):

- site: nginx serves `/var/www/lab/current` → `releases/<sha>`; the app (`app.service`,
  user `labapp`) answers `/api/health` on 127.0.0.1:3000 behind nginx.
- `/var/lab/` is the only writable junk area; known-good nginx config is kept in
  `/etc/nginx/lab-known-good/`.
- `/var/lab/changes.log` gets one line per deploy or config edit (read by `recent_changes`).

| id | break | what the prober / agent sees | expected fix | oracle checks |
|---|---|---|---|---|
| `nginx-stopped` | `systemctl stop nginx` | connection refused; `service_status nginx` = inactive | `restart_service nginx` | nginx active, `/` = 200 |
| `disk-full` | `fallocate` a file in `/var/lab/cache/` until disk ≥ 97%; app starts failing writes | 500 on `/api/health`; "No space left on device" in app logs; `disk_usage` shows the file | `delete_file <that file>` (+ `restart_service app` if still failing) | disk < 90%, `/api/health` = 200 |
| `bad-release` | deploy a release whose `index.html` loads a missing JS bundle; logged in `changes.log` | `/` = 200 but health check of the bundle URL = 404; `recent_changes` shows the deploy | `rollback <previous sha>` | current = previous release, bundle = 200 |
| `bad-config` | append a syntax error to the nginx site config, `systemctl restart nginx` (fails); logged in `changes.log` | connection refused; `nginx_config_test` shows the error | `restore_config nginx` | `nginx -t` ok, `/` = 200 |
| `cpu-hog` | start `stress`-like busy loops as user `labapp` on all cores | `/` slow (> 2 s); `get_metrics` CPU ≈ 100%; `list_processes` shows the hog | `kill_process <pid>` for each hog | no labapp process > 50% CPU, `/` < 500 ms |

Detection: the prober checks `/` and `/api/health` every 5 s; an alert fires after 2 failed
checks (or latency > 2 s twice for `cpu-hog`).

Surprise mode picks a scenario at random; its id is revealed only in `incident.revealed`.

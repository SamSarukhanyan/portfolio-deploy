# Agent tools that run on the lab (contracts/tools.ts, runner "ssm"). Sourced by each lab-<tool>
# SSM document, which validates parameters and then calls: tool_<name> <args...>.
# Every action appends to changes.log so recent_changes and the postmortem see it.

SVC_UNIT() { [ "$1" = nginx ] && echo nginx || echo lab-app; }
# Never fails: with /var/lab full the log can't be written, but the action itself still succeeded.
log_change() { echo "$(date -u +%FT%TZ) $*" >> /var/lab/changes.log 2>/dev/null || true; }

tool_get_metrics() {
  local a b
  a=($(head -1 /proc/stat)); sleep 1; b=($(head -1 /proc/stat))
  local idle=$(( b[4] - a[4] )) total=0 i
  for i in 1 2 3 4 5 6 7 8; do total=$(( total + b[i] - a[i] )); done
  echo "cpu_pct=$(( total > 0 ? 100 * (total - idle) / total : 0 ))"
  free -m | awk '/^Mem:/{printf "mem_pct=%d\n", 100*$3/$2}'
  echo "disk_pct=$(df --output=pcent / | tail -1 | tr -dc 0-9) lab_disk_pct=$(df --output=pcent /var/lab | tail -1 | tr -dc 0-9)"
  echo "load=$(cut -d' ' -f1-3 /proc/loadavg)"
}

tool_service_status() {
  local u; u=$(SVC_UNIT "$1")
  echo "$u: $(systemctl is-active "$u")"
  systemctl status "$u" --no-pager -n 0 2>&1 | sed -n '2,4p'
}

# Only what happened since the last reset: the reset's own restarts would read like a crash loop.
tool_read_logs() {
  local since; since=$(cat /var/lab/reset-at 2>/dev/null || echo 0)
  journalctl -u "$(SVC_UNIT "$1")" --since "@$since" -n "$2" --no-pager -o short-iso 2>&1
}

tool_disk_usage() {
  df -h / /var/lab
  echo "largest files under /var/lab:"
  find /var/lab -xdev -type f -printf '%s\t%p\n' 2>/dev/null | sort -rn | head -10 |
    awk -F'\t' '{printf "%8.1f MB  %s\n", $1/1048576, $2}'
}

tool_list_processes() { ps -eo pid,user,pcpu,pmem,args --sort=-pcpu | head -11 | cut -c1-120; }

tool_list_releases() {
  echo "current -> $(readlink /var/www/lab/current)"
  ls -1t /var/www/lab/releases
}

tool_nginx_config_test() { nginx -t 2>&1; }

tool_recent_changes() { tail -10 /var/lab/changes.log; }

tool_restart_service() {
  local u; u=$(SVC_UNIT "$1")
  systemctl restart "$u" 2>&1 && echo "$u restarted" || { echo "$u failed to start:"; journalctl -u "$u" -n 5 --no-pager -o cat; return 1; }
  log_change "restart $u"
}

tool_rollback() {
  [ -d "/var/www/lab/releases/$1" ] || { echo "no such release: $1"; return 1; }
  ln -sfn "releases/$1" /var/www/lab/current.next && mv -T /var/www/lab/current.next /var/www/lab/current
  log_change "rollback $1"
  echo "current -> releases/$1"
}

tool_delete_file() {
  local p; p=$(realpath -e -- "$1" 2>/dev/null) || { echo "no such file: $1"; return 1; }
  case "$p" in /var/lab/*) ;; *) echo "refused: outside /var/lab"; return 1 ;; esac
  [ -f "$p" ] || { echo "refused: not a regular file"; return 1; }
  [ "$p" != /var/lab/changes.log ] || { echo "refused: changes.log is evidence"; return 1; }
  rm -f -- "$p" && log_change "delete $p" && echo "deleted $p"
}

tool_kill_process() {
  local owner; owner=$(ps -o user= -p "$1" 2>/dev/null | tr -d ' ')
  [ -n "$owner" ] || { echo "no such process: $1"; return 1; }
  [ "$owner" = labapp ] || { echo "refused: pid $1 belongs to $owner, not labapp"; return 1; }
  [ "$(systemctl show -p MainPID --value lab-app)" != "$1" ] || { echo "refused: that is the app itself, use restart_service app"; return 1; }
  # Kill the whole process group when every member is labapp's, so a forking hog dies at once.
  local pgid others
  pgid=$(ps -o pgid= -p "$1" | tr -d ' ')
  others=$(ps -eo pgid=,user= | awk -v g="$pgid" '$1 == g && $2 != "labapp"' | wc -l)
  if [ "$others" -eq 0 ] && [ "$pgid" != "$(ps -o pgid= -p "$(systemctl show -p MainPID --value lab-app)" | tr -d ' ')" ]; then
    local n; n=$(ps -eo pgid= | awk -v g="$pgid" '$1 == g' | wc -l)
    kill -9 -- "-$pgid" && log_change "kill group $pgid" && echo "killed process group $pgid ($n processes)"
  else
    kill -9 "$1" && log_change "kill $1" && echo "killed $1"
  fi
}

tool_restore_config() {
  install -m 644 /etc/nginx/lab-known-good/lab /etc/nginx/sites-available/lab
  nginx -t 2>&1 && systemctl restart nginx && log_change "restore config nginx" && echo "nginx config restored and restarted"
}

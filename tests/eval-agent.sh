#!/bin/bash
# Agent eval: every scenario RUNS times through a local Control Plane with the given agent.
# Usage: AWS_PROFILE=portfolio AGENT=ollama|claude [RUNS=2] tests/eval-agent.sh [scenario...]
# Prints one row per incident and the totals; leaves the lab asleep.
set -uo pipefail

here=$(cd "$(dirname "$0")/.." && pwd)
RUNS=${RUNS:-2}
ALL=(nginx-stopped disk-full bad-release bad-config cpu-hog)
SCENARIOS=("${@:-${ALL[@]}}")
data=$(mktemp -d)
api=http://127.0.0.1:3100

(cd "$here/server" && npm run -s lab:build) || exit 1
LAB_INSTANCE_ID=$(terraform -chdir="$here/infra" output -raw lab_instance_id) LAB_DATA_DIR="$data" \
  node "$here/server/dist-lab/server/src/lab/main.js" > "$data/control-plane.log" 2>&1 &
cp=$!
trap 'kill $cp 2>/dev/null' EXIT
until curl -sf "$api/api/lab/status" >/dev/null; do sleep 1; done

n=0
for r in $(seq "$RUNS"); do
  for s in "${SCENARIOS[@]}"; do
    n=$((n + 1))
    # A different client IP per request, so the per-IP cooldown does not throttle the eval.
    curl -sf -X POST "$api/api/incidents" -H "X-Forwarded-For: 198.51.100.$n" \
      -H 'Content-Type: application/json' -d "{\"scenario\":\"$s\"}" >/dev/null || echo "could not queue $s"
  done
done

until [ "$(curl -s "$api/api/incidents?limit=50" | jq length)" -ge "$n" ]; do sleep 10; done

printf '%-14s %-9s %6s %6s %8s  %s\n' scenario result secs steps tokens actions
for id in $(curl -s "$api/api/incidents?limit=50" | jq -r 'reverse | .[].id'); do
  curl -s "$api/api/incidents/$id" | jq -r '[.scenarioId, .status, (.durationMs/1000|floor), .steps,
      ((.usage.inputTokens // 0) + (.usage.outputTokens // 0)),
      ([.events[] | select(.type=="agent.tool_call") | .data.tool] | join(">"))] | @tsv' |
    awk -F'\t' '{printf "%-14s %-9s %6s %6s %8s  %s\n", $1, $2, $3, $4, $5, $6}'
done
curl -s "$api/api/incidents?limit=50" | jq -r '"resolved \([.[]|select(.status=="resolved")]|length)/\(length), avg \(([.[].durationMs]|add/length/1000)|floor)s, avg steps \(([.[].steps]|add/length*10|floor)/10)"'

kill $cp
aws ec2 stop-instances --instance-ids "$(terraform -chdir="$here/infra" output -raw lab_instance_id)" >/dev/null && echo "lab stopped"
echo "events kept in $data"

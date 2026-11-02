#!/bin/bash
# Stage-2 acceptance test, no AI: for every scenario
#   break -> oracle must FAIL -> the expected fix via the agent's own tool docs -> oracle must PASS
#   -> reset (lab-provision) -> oracle must PASS.
# Usage: AWS_PROFILE=portfolio tests/lab-scenarios.sh [scenario...]   (leaves the lab stopped)
set -uo pipefail

LAB=$(terraform -chdir="$(dirname "$0")/../infra" output -raw lab_instance_id)
ALL=(nginx-stopped disk-full bad-release bad-config cpu-hog)
SCENARIOS=("${@:-${ALL[@]}}")
fails=0

doc() { # name [Key=Value ...] -> prints output, returns 0 if the command succeeded
  local name=$1; shift
  local params='{}' kv
  for kv in "$@"; do params=$(jq -c --arg k "${kv%%=*}" --arg v "${kv#*=}" '. + {($k): [$v]}' <<<"$params"); done
  local id; id=$(aws ssm send-command --instance-ids "$LAB" --document-name "$name" \
    --parameters "$params" --query Command.CommandId --output text) || return 1
  aws ssm wait command-executed --command-id "$id" --instance-id "$LAB" 2>/dev/null
  local r; r=$(aws ssm get-command-invocation --command-id "$id" --instance-id "$LAB" \
    --query '[Status,StandardOutputContent,StandardErrorContent]' --output json)
  jq -r '.[1], .[2]' <<<"$r" | sed '/^$/d; s/^/      | /' | tail -8
  [ "$(jq -r '.[0]' <<<"$r")" = Success ]
}

expect() { # pass|fail label command...
  local want=$1 label=$2; shift 2
  if "$@"; then got=pass; else got=fail; fi
  if [ "$got" = "$want" ]; then echo "  ok   $label ($got)"; else echo "  FAIL $label: expected $want, got $got"; fails=$((fails + 1)); fi
}

fix() {
  case $1 in
    nginx-stopped) doc lab-restart_service Service=nginx ;;
    disk-full)     doc lab-delete_file Path=/var/lab/cache/tmp-export.bin ;;
    bad-release)   doc lab-rollback Release=5d6e7f8 ;;
    bad-config)    doc lab-restore_config Name=nginx ;;
    cpu-hog)
      local pid; pid=$(doc lab-list_processes | awk '$3 == "labapp" && /lab-hog/ {print $2; exit}')
      [ -n "$pid" ] && doc lab-kill_process Pid="$pid" ;;
  esac
}

echo "waking lab $LAB"
aws ec2 start-instances --instance-ids "$LAB" >/dev/null
aws ec2 wait instance-running --instance-ids "$LAB"
until [ "$(aws ssm describe-instance-information --filters "Key=InstanceIds,Values=$LAB" \
  --query 'InstanceInformationList[0].PingStatus' --output text)" = Online ]; do sleep 5; done

echo "golden state"
expect pass "provision" doc lab-provision
for s in "${SCENARIOS[@]}"; do expect pass "oracle $s on golden" doc lab-scenario Scenario="$s" Step=oracle; done

for s in "${SCENARIOS[@]}"; do
  echo "== $s"
  expect pass "break"            doc lab-scenario Scenario="$s" Step=break
  expect fail "oracle sees it"   doc lab-scenario Scenario="$s" Step=oracle
  expect pass "expected fix"     fix "$s"
  expect pass "oracle after fix" doc lab-scenario Scenario="$s" Step=oracle
  expect pass "reset"            doc lab-provision
  expect pass "oracle after reset" doc lab-scenario Scenario="$s" Step=oracle
done

aws ec2 stop-instances --instance-ids "$LAB" >/dev/null && echo "lab stopped"
echo "failures: $fails"
exit $((fails > 0))

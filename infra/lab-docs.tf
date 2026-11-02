# SSM documents the Control Plane runs on the lab (allowed by the lab-* rule in lab.tf).
# Scripts live in lab/ (Chaos role); here they are only wrapped and their parameters validated
# against the same patterns as contracts/tools.ts. SSM runs commands with sh, so each
# document feeds its script to bash through a quoted heredoc.

locals {
  lab_dir = "${path.module}/../lab"

  lab_service = { type = "String", allowedValues = ["nginx", "app"] }

  # name => { params, call }. call is the bash line run after tools.sh is sourced.
  lab_tools = {
    get_metrics       = { params = {}, call = "tool_get_metrics" }
    service_status    = { params = { Service = local.lab_service }, call = "tool_service_status '{{ Service }}'" }
    read_logs         = { params = { Service = local.lab_service, Lines = { type = "String", allowedPattern = "^([1-9]|[1-9][0-9]|100)$" } }, call = "tool_read_logs '{{ Service }}' '{{ Lines }}'" }
    disk_usage        = { params = {}, call = "tool_disk_usage" }
    list_processes    = { params = {}, call = "tool_list_processes" }
    list_releases     = { params = {}, call = "tool_list_releases" }
    nginx_config_test = { params = {}, call = "tool_nginx_config_test" }
    recent_changes    = { params = {}, call = "tool_recent_changes" }
    restart_service   = { params = { Service = local.lab_service }, call = "tool_restart_service '{{ Service }}'" }
    rollback          = { params = { Release = { type = "String", allowedPattern = "^[0-9a-f]{7,40}$" } }, call = "tool_rollback '{{ Release }}'" }
    delete_file       = { params = { Path = { type = "String", allowedPattern = "^/var/lab(/[A-Za-z0-9_-][A-Za-z0-9._-]*)+$" } }, call = "tool_delete_file '{{ Path }}'" }
    kill_process      = { params = { Pid = { type = "String", allowedPattern = "^([2-9]|[1-9][0-9]{1,6})$" } }, call = "tool_kill_process '{{ Pid }}'" }
    restore_config    = { params = { Name = { type = "String", allowedValues = ["nginx"] } }, call = "tool_restore_config" }
  }
}

resource "aws_ssm_document" "lab_tool" {
  for_each        = local.lab_tools
  name            = "lab-${each.key}"
  document_type   = "Command"
  document_format = "YAML"

  content = yamlencode({
    schemaVersion = "2.2"
    description   = "Incident Lab agent tool: ${each.key}"
    parameters    = each.value.params
    mainSteps = [{
      action = "aws:runShellScript"
      name   = "run"
      inputs = {
        timeoutSeconds = "30"
        runCommand     = ["bash <<'LAB_EOF'\n${file("${local.lab_dir}/tools.sh")}\n${each.value.call}\nLAB_EOF"]
      }
    }]
  })
}

resource "aws_ssm_document" "lab_scenario" {
  name            = "lab-scenario"
  document_type   = "Command"
  document_format = "YAML"

  content = yamlencode({
    schemaVersion = "2.2"
    description   = "Incident Lab: break a scenario, or check it is fixed (oracle)."
    parameters = {
      Scenario = { type = "String", allowedValues = ["nginx-stopped", "disk-full", "bad-release", "bad-config", "cpu-hog"] }
      Step     = { type = "String", allowedValues = ["break", "oracle"] }
    }
    mainSteps = [{
      action = "aws:runShellScript"
      name   = "run"
      inputs = {
        timeoutSeconds = "60"
        runCommand     = ["bash <<'LAB_EOF'\n${file("${local.lab_dir}/scenarios.sh")}\nrun_step '{{ Scenario }}' '{{ Step }}'\nLAB_EOF"]
      }
    }]
  })
}

resource "aws_ssm_document" "lab_provision" {
  name            = "lab-provision"
  document_type   = "Command"
  document_format = "YAML"

  content = yamlencode({
    schemaVersion = "2.2"
    description   = "Incident Lab: (re)build the golden state. Also the reset after every incident."
    mainSteps = [{
      action = "aws:runShellScript"
      name   = "run"
      inputs = {
        timeoutSeconds = "300"
        runCommand     = ["bash <<'LAB_EOF'\n${file("${local.lab_dir}/provision.sh")}\nLAB_EOF"]
      }
    }]
  })
}

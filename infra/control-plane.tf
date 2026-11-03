# Incident Lab Control Plane on the portfolio server (server/src/lab, docs/ai-oncall/PLAN.md).
# GitHub Actions builds it and ships it like the site: S3 artifact + SSM document below.
# The Claude API key lives in SSM Parameter Store as a SecureString; the app reads it at start.
# Create it once, outside Terraform so the secret never enters the state:
#   aws ssm put-parameter --name /incident-lab/anthropic-api-key --type SecureString --value ...

locals {
  api_key_param = "/incident-lab/anthropic-api-key"
}

data "aws_iam_policy_document" "control_plane_secret" {
  statement {
    sid       = "ReadClaudeApiKey"
    actions   = ["ssm:GetParameter"]
    resources = ["arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter${local.api_key_param}"]
  }
}

resource "aws_iam_role_policy" "control_plane_secret" {
  name   = "incident-lab-secret"
  role   = aws_iam_role.server.id
  policy = data.aws_iam_policy_document.control_plane_secret.json
}

resource "aws_ssm_document" "control_plane" {
  name            = "portfolio-control-plane"
  document_type   = "Command"
  document_format = "YAML"

  content = yamlencode({
    schemaVersion = "2.2"
    description   = "Install or update the Incident Lab Control Plane on the portfolio server."
    parameters = {
      Release = {
        type           = "String"
        description    = "Git commit SHA of the build."
        allowedPattern = "^[0-9a-f]{7,40}$"
      }
      ArtifactUrl = {
        type           = "String"
        description    = "Presigned S3 URL of the control-plane tarball."
        allowedPattern = "^https://${local.artifacts}\\.s3\\.${var.region}\\.amazonaws\\.com/[^\\s'\"]+$"
      }
    }
    mainSteps = [{
      action = "aws:runShellScript"
      name   = "install"
      inputs = {
        timeoutSeconds = "600"
        runCommand = [templatefile("${path.module}/control-plane.sh.tftpl", {
          region          = var.region
          lab_instance_id = try(aws_instance.lab[0].id, "none")
          lab_private_ip  = local.lab_private_ip
          api_key_param   = local.api_key_param
        })]
      }
    }]
  })
}

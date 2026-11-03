# Keyless deploys: GitHub Actions → (OIDC) → IAM role → S3 artifact + SSM command → server.
# The role can run exactly one thing on the server: the portfolio-deploy document below.

locals {
  github_repo   = "SamSarukhanyan/portfolio-deploy"
  artifacts     = "samsarukhanyan-artifacts-${data.aws_caller_identity.current.account_id}"
  releases_kept = 5
}

data "aws_caller_identity" "current" {}

# ---------- Build artifacts ----------

resource "aws_s3_bucket" "artifacts" {
  bucket = local.artifacts
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket                  = aws_s3_bucket.artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    id     = "expire-old-builds"
    status = "Enabled"
    filter {}
    expiration {
      days = 30
    }
  }
}

# ---------- GitHub OIDC ----------

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "github_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Only workflows running on main of this repo — not forks, PRs or other branches.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${local.github_repo}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name                 = "portfolio-github-deploy"
  assume_role_policy   = data.aws_iam_policy_document.github_trust.json
  max_session_duration = 3600
}

data "aws_iam_policy_document" "github_deploy" {
  statement {
    sid       = "UploadBuilds"
    actions   = ["s3:PutObject", "s3:GetObject"]
    resources = ["${aws_s3_bucket.artifacts.arn}/*"]
  }

  statement {
    sid     = "RunDeployDocumentOnServer"
    actions = ["ssm:SendCommand"]
    resources = [
      aws_instance.portfolio.arn,
      aws_ssm_document.deploy.arn,
      aws_ssm_document.control_plane.arn,
    ]
  }

  statement {
    sid       = "ReadCommandResult"
    actions   = ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}

# ---------- Server identity (SSM agent; also replaces SSH via Session Manager) ----------

data "aws_iam_policy_document" "ec2_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "server" {
  name               = "portfolio-server"
  assume_role_policy = data.aws_iam_policy_document.ec2_trust.json
}

resource "aws_iam_role_policy_attachment" "server_ssm" {
  role       = aws_iam_role.server.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "server" {
  name = "portfolio-server"
  role = aws_iam_role.server.name
}

# ---------- Atomic deploy / rollback on the server ----------
# Layout: /var/www/portfolio/releases/<sha>/  and  current -> releases/<sha>  (nginx root).
# The server needs no AWS permissions: the workflow passes a short-lived presigned URL.

resource "aws_ssm_document" "deploy" {
  name            = "portfolio-deploy"
  document_type   = "Command"
  document_format = "YAML"

  content = yamlencode({
    schemaVersion = "2.2"
    description   = "Atomically switch samsarukhanyan.com to a release (deploy or rollback)."
    parameters = {
      Action = {
        type          = "String"
        allowedValues = ["deploy", "rollback"]
      }
      Release = {
        type           = "String"
        description    = "Git commit SHA of the build."
        allowedPattern = "^[0-9a-f]{7,40}$"
      }
      ArtifactUrl = {
        type           = "String"
        default        = "none"
        description    = "Presigned S3 URL of the build tarball (deploy only)."
        allowedPattern = "^(none|https://${local.artifacts}\\.s3\\.${var.region}\\.amazonaws\\.com/[^\\s'\"]+)$"
      }
    }
    mainSteps = [{
      action = "aws:runShellScript"
      name   = "switchRelease"
      inputs = {
        timeoutSeconds = "300"
        runCommand = [templatefile("${path.module}/deploy.sh.tftpl", {
          releases_kept = local.releases_kept
        })]
      }
    }]
  })
}

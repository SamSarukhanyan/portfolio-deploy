# Incident Lab sandbox: the server visitors break and the agent fixes (docs/ai-oncall/PLAN.md).
# Isolated from production: own security group, own role with no AWS permissions beyond SSM.
# It sleeps when idle; the Control Plane on the portfolio server starts and stops it.
# Visitors reach it only through the portfolio nginx (lab.samsarukhanyan.com -> private IP),
# so it needs no Elastic IP and no inbound internet access.

resource "aws_security_group" "lab" {
  name        = "portfolio-lab"
  description = "Incident Lab sandbox: HTTP from the portfolio server only"
  vpc_id      = data.aws_vpc.default.id
}

resource "aws_vpc_security_group_ingress_rule" "lab_http_from_portfolio" {
  security_group_id            = aws_security_group.lab.id
  ip_protocol                  = "tcp"
  from_port                    = 80
  to_port                      = 80
  referenced_security_group_id = aws_security_group.web.id
}

# Outbound for the SSM agent and apt.
resource "aws_vpc_security_group_egress_rule" "lab_all" {
  security_group_id = aws_security_group.lab.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_iam_role" "lab" {
  name               = "portfolio-lab"
  assume_role_policy = data.aws_iam_policy_document.ec2_trust.json
}

resource "aws_iam_role_policy_attachment" "lab_ssm" {
  role       = aws_iam_role.lab.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "lab" {
  name = "portfolio-lab"
  role = aws_iam_role.lab.name
}

resource "aws_instance" "lab" {
  ami                    = aws_instance.portfolio.ami
  instance_type          = var.lab_instance_type
  subnet_id              = data.aws_subnet.default_a.id
  vpc_security_group_ids = [aws_security_group.lab.id]
  iam_instance_profile   = aws_iam_instance_profile.lab.name

  # Fixed, so a rebuilt lab keeps the proxy_pass target in docs/nginx-lab.conf.example.
  private_ip = "172.31.24.229"

  # Public IPv4 only for outbound traffic; billed only while running. No key pair: shell is SSM only.
  associate_public_ip_address = true

  credit_specification {
    cpu_credits = "standard"
  }

  metadata_options {
    http_tokens = "required"
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = 10
    tags = {
      Name = "portfolio-lab-root"
    }
  }

  # Placeholder until the Chaos role ships the lab app (stage 2).
  user_data = <<-EOF
    #!/bin/bash
    set -e
    apt-get update
    apt-get install -y nginx
    echo '<!doctype html><title>Incident Lab</title><h1>Incident Lab sandbox is up</h1>' > /var/www/html/index.html
    systemctl enable --now nginx
  EOF

  tags = {
    Name = "portfolio-lab"
  }

  lifecycle {
    # A stopped instance has no public IP, so AWS reports false; without this every plan
    # while the lab sleeps would replace it.
    ignore_changes = [ami, user_data, associate_public_ip_address]
  }
}

# ---------- What the Control Plane (on the portfolio server) may do to the lab ----------

data "aws_iam_policy_document" "control_plane" {
  statement {
    sid       = "WakeAndSleepLab"
    actions   = ["ec2:StartInstances", "ec2:StopInstances"]
    resources = [aws_instance.lab.arn]
  }

  statement {
    sid       = "SeeLabState"
    actions   = ["ec2:DescribeInstances", "ec2:DescribeInstanceStatus", "ssm:DescribeInstanceInformation"]
    resources = ["*"]
  }

  # Only lab-* documents (stage 2) and only on the lab instance.
  statement {
    sid     = "RunLabDocuments"
    actions = ["ssm:SendCommand"]
    resources = [
      aws_instance.lab.arn,
      "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:document/lab-*",
    ]
  }

  statement {
    sid       = "ReadLabCommandResult"
    actions   = ["ssm:GetCommandInvocation"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "control_plane" {
  name   = "incident-lab-control-plane"
  role   = aws_iam_role.server.id
  policy = data.aws_iam_policy_document.control_plane.json
}

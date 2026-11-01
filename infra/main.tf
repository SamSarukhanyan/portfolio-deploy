data "aws_vpc" "default" {
  default = true
}

data "aws_subnet" "default_a" {
  vpc_id            = data.aws_vpc.default.id
  availability_zone = "${var.region}a"
  default_for_az    = true
}

resource "aws_key_pair" "portfolio" {
  key_name   = "portfolio-key"
  public_key = var.ssh_public_key

  # AWS doesn't return the key on import; without this Terraform would recreate it.
  lifecycle {
    ignore_changes = [public_key]
  }
}

resource "aws_security_group" "web" {
  name        = "portfolio-web"
  description = "Web server for samsarukhanyan.com"
  vpc_id      = data.aws_vpc.default.id
}

resource "aws_vpc_security_group_ingress_rule" "http" {
  security_group_id = aws_security_group.web.id
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "https" {
  security_group_id = aws_security_group.web.id
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "ssh" {
  for_each = toset(var.ssh_allowed_cidrs)

  security_group_id = aws_security_group.web.id
  ip_protocol       = "tcp"
  from_port         = 22
  to_port           = 22
  cidr_ipv4         = each.value
}

resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.web.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_instance" "portfolio" {
  # Ubuntu 26.04 LTS (Canonical). Pinned: a new AMI must never silently replace the server.
  ami                    = "ami-04a0530fbdaac2fd6"
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnet.default_a.id
  vpc_security_group_ids = [aws_security_group.web.id]
  key_name               = aws_key_pair.portfolio.key_name

  # "standard" = never pay for CPU bursts beyond the t3 baseline.
  credit_specification {
    cpu_credits = "standard"
  }

  metadata_options {
    http_tokens = "required"
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = 10
  }

  tags = {
    Name = "portfolio"
  }

  lifecycle {
    ignore_changes = [ami]
  }
}

resource "aws_eip" "portfolio" {
  domain = "vpc"

  tags = {
    Name = "portfolio"
  }
}

resource "aws_eip_association" "portfolio" {
  allocation_id = aws_eip.portfolio.id
  instance_id   = aws_instance.portfolio.id
}

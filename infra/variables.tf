variable "region" {
  type    = string
  default = "eu-central-1"
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "lab_instance_type" {
  type    = string
  default = "t3.micro"
}

variable "ssh_allowed_cidrs" {
  description = "Emergency only: open port 22 to these IPs, e.g. [\"203.0.113.10/32\"]. Normally empty — use `ssh portfolio` (tunnelled through SSM)."
  type        = list(string)
  default     = []
}

variable "ssh_public_key" {
  description = "Public half of ~/.ssh/portfolio-key.pem."
  type        = string
  default     = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEVsn1npe9CISleElUSrA6jQUe2z1gJLnT8jXt1bZsJL portfolio-key"
}

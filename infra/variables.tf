variable "region" {
  type    = string
  default = "eu-central-1"
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "ssh_allowed_cidrs" {
  description = "Who may SSH to the server, e.g. [\"5.77.128.6/32\"]. Your home IP changes — update and re-apply."
  type        = list(string)
}

variable "ssh_public_key" {
  description = "Public half of ~/.ssh/portfolio-key.pem."
  type        = string
  default     = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEVsn1npe9CISleElUSrA6jQUe2z1gJLnT8jXt1bZsJL portfolio-key"
}

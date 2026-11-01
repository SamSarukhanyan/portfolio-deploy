terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.71"
    }
  }

  # State bucket is created once by hand (see infra/README.md) — Terraform cannot
  # create the bucket that stores its own state.
  backend "s3" {
    bucket       = "samsarukhanyan-tfstate-358871394134"
    key          = "portfolio/terraform.tfstate"
    region       = "eu-central-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = "portfolio"
      ManagedBy = "terraform"
    }
  }
}

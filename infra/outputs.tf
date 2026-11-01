output "public_ip" {
  description = "Put this in both A records (@ and www) at name.am."
  value       = aws_eip.portfolio.public_ip
}

output "instance_id" {
  value = aws_instance.portfolio.id
}

output "github_deploy_role_arn" {
  description = "Used by .github/workflows/deploy-portfolio.yml (aws-actions/configure-aws-credentials)."
  value       = aws_iam_role.github_deploy.arn
}

output "artifacts_bucket" {
  value = aws_s3_bucket.artifacts.bucket
}

output "shell" {
  description = "Port 22 is closed; both go through SSM (see infra/README.md)."
  value       = "ssh portfolio   # or: aws ssm start-session --target ${aws_instance.portfolio.id}"
}

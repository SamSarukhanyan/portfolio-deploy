output "public_ip" {
  description = "Put this in both A records (@ and www) at name.am."
  value       = aws_eip.portfolio.public_ip
}

output "instance_id" {
  value = aws_instance.portfolio.id
}

output "ssh" {
  value = "ssh -i ~/.ssh/portfolio-key.pem ubuntu@${aws_eip.portfolio.public_ip}"
}

# Infrastructure (Terraform)

Everything that runs samsarukhanyan.com in AWS (`eu-central-1`, account `358871394134`):
EC2 `t3.micro` (Ubuntu 26.04), Elastic IP, security group, SSH key pair.
The resources were first created by hand on 2026-10-31 and adopted with the `import` blocks in `imports.tf`.

## One-time setup on a new machine

1. Install `terraform` (>= 1.10) and AWS CLI v2.
2. `~/.aws/config`:
   ```ini
   [profile portfolio]
   region = eu-central-1
   ```
3. Sign in as the IAM user `sam-admin` (no access keys — short-lived credentials via the browser):
   ```bash
   aws login --profile portfolio
   ```
4. `cp terraform.tfvars.example terraform.tfvars` and put your current IP in it.
5. `AWS_PROFILE=portfolio terraform init`

## Everyday use

```bash
export AWS_PROFILE=portfolio
terraform plan     # what would change — read it before applying
terraform apply    # make it so
```

**Home IP changed and SSH stopped working?** Update `terraform.tfvars` with `curl -s https://api.ipify.org` and `terraform apply`.

## State

Stored in the S3 bucket `samsarukhanyan-tfstate-358871394134` (versioned, encrypted, private, S3-native locking).
The bucket itself was created once with the AWS CLI — Terraform can't create the bucket that holds its own state:

```bash
B=samsarukhanyan-tfstate-358871394134
aws s3api create-bucket --bucket $B --create-bucket-configuration LocationConstraint=eu-central-1
aws s3api put-bucket-versioning --bucket $B --versioning-configuration Status=Enabled
aws s3api put-public-access-block --bucket $B --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

## Not managed here

- DNS — A records `@` and `www` → Elastic IP, at name.am.
- Software on the server (nginx, certbot, deploy) — see `docs/ec2-setup.md`.
- Budgets, MFA, IAM users — set up in the console.

# Infrastructure (Terraform)

Everything that runs samsarukhanyan.com in AWS (`eu-central-1`, account `358871394134`):
EC2 `t3.micro` (Ubuntu 26.04), Elastic IP, security group (80/443 only), SSH key pair,
keyless GitHub deploys (`deploy.tf`: OIDC role, artifacts bucket, SSM deploy document) and daily snapshots (`backup.tf`).
How deploys work: `docs/ec2-setup.md`.
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
4. `AWS_PROFILE=portfolio terraform init`

## Shell on the server (port 22 is closed)

Install the [Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html), then add to `~/.ssh/config`:

```
Host portfolio
    HostName i-0d3df0c9c0dbc8e1c
    HostKeyAlias 3.75.98.233
    User ubuntu
    IdentityFile ~/.ssh/portfolio-key.pem
    ProxyCommand sh -c "AWS_PROFILE=portfolio aws ssm start-session --region eu-central-1 --target %h --document-name AWS-StartSSHSession --parameters portNumber=%p"
```

`ssh portfolio` / `scp file portfolio:` now work from any network — your home IP no longer matters.
If SSM itself is broken, temporarily open port 22 via `ssh_allowed_cidrs` in `terraform.tfvars`.

## Everyday use

```bash
export AWS_PROFILE=portfolio
terraform plan     # what would change — read it before applying
terraform apply    # make it so
```

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

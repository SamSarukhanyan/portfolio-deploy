# samsarukhanyan.com — how it runs and how to rebuild it

```
git push (client/**) ─► GitHub Actions (ubuntu-latest): npm ci, vite build
                        │  OIDC → IAM role portfolio-github-deploy (main branch only)
                        ├─► s3://samsarukhanyan-artifacts-…/builds/<sha>.tgz
                        └─► SSM document portfolio-deploy on the EC2 server
                              unpack → /var/www/portfolio/releases/<sha>
                              atomic: current → releases/<sha>   (nginx root)
                              keep last 5 releases
                        └─► smoke test https://samsarukhanyan.com and www
```

- AWS account `358871394134`, region `eu-central-1`, all resources in `infra/` (Terraform).
- Free plan ends **30 Apr 2027** — upgrade to the paid plan before that (Billing → Upgrade plan), or the account is closed again.
- Uptime: UptimeRobot (email + iPhone push). Costs: Budgets `monthly-15usd`.
- Port 22 is closed. Shell: `ssh portfolio` (SSH tunnelled through SSM, see `infra/README.md`).
- Backups: daily EBS snapshots at 02:00 UTC, last 7 kept (EC2 → Snapshots).

## Everyday

| Task | How |
|---|---|
| Deploy | push to `main` (changes in `client/`), or Actions → Deploy portfolio → Run workflow → `deploy` |
| Roll back | Actions → Deploy portfolio → Run workflow → `rollback`, release = commit SHA (one of the last 5) |
| Shell on the server | `aws login --profile portfolio`, then `ssh portfolio` |
| Change infrastructure | edit `infra/*.tf`, `terraform plan`, `terraform apply` |

## Rebuild from zero (server lost)

1. `cd infra && terraform apply` — remove the `import` blocks first if the old resources no longer exist.
   A new Elastic IP is printed as `public_ip`.
2. At name.am → Նեյմսերվեր և DNS: point the A records `@` and `www` to `public_ip` (Cloudflare proxy off).
3. Wait until the server shows up in SSM (`aws ssm describe-instance-information`), then `ssh portfolio` and run:
   ```bash
   sudo apt update && sudo apt -y upgrade
   sudo apt -y install nginx certbot python3-certbot-nginx unattended-upgrades
   sudo dpkg-reconfigure -plow unattended-upgrades
   sudo mkdir -p /var/www/portfolio/releases
   sudo nano /etc/nginx/sites-available/portfolio      # paste docs/nginx-portfolio.conf.example
   sudo ln -sf /etc/nginx/sites-available/portfolio /etc/nginx/sites-enabled/portfolio
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t && sudo systemctl reload nginx
   ```
4. Update `INSTANCE_ID` in `.github/workflows/deploy-portfolio.yml` if the instance changed, then
   Actions → Deploy portfolio → Run workflow → `deploy`.
5. Once DNS resolves to the new IP:
   ```bash
   sudo certbot --nginx -d samsarukhanyan.com -d www.samsarukhanyan.com
   sudo certbot renew --dry-run
   ```

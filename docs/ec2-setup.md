# Новый EC2 для samsarukhanyan.com — с нуля

Старый аккаунт AWS (796807913100) закрыт 11.10.2026 вместе с сервером. Этот гайд поднимает всё заново.
Итог: Ubuntu на EC2 + Elastic IP + nginx + Let's Encrypt + self-hosted GitHub runner, деплой по `git push`.

---

## 1. Регистрация аккаунта

1. **Email — другой** (не `sarukhanyansam@gmail.com`: на него AWS больше не даст создать аккаунт).
2. Contact Information — реальные данные: Country **Armenia**, телефон +374…, адрес как в банке/карте.
3. Карта (Visa/Master), SMS/звонок для подтверждения телефона.
4. Plan: **Paid plan** — кредиты всё равно начисляются, но аккаунт не закроют через 6 месяцев.
   Если выбрали Free — **обязательно** перейдите на Paid до конца 6 месяцев (Billing → Upgrade plan).
5. Support plan — **Basic (free)**.

## 2. Безопасность и деньги (сразу после входа)

1. Правый верх → имя аккаунта → **Security credentials** → **Assign MFA** (Google Authenticator и т.п.) для root.
2. **Billing and Cost Management → Budgets → Create budget**:
   - шаблон **Zero spend budget** (письмо при любом списании);
   - шаблон **Monthly cost budget** на `15 USD`, alert на 80%.
   Создание бюджета ещё и даёт кредиты (Explore AWS / Earn credits).
3. Регион (правый верх): **Europe (Frankfurt) eu-central-1** — ближе всего к Армении. Всё ниже создавать в одном регионе.

## 3. Key pair

EC2 → **Key Pairs** → Create key pair:
- Name: `portfolio-key`, type **ED25519**, format **.pem** → скачается файл.

```bash
mkdir -p ~/.ssh && mv ~/Downloads/portfolio-key.pem ~/.ssh/ && chmod 400 ~/.ssh/portfolio-key.pem
```

Храните файл и сделайте копию (например, в менеджере паролей). Без него SSH не войти.

## 4. Security group

EC2 → **Security Groups** → Create:
- Name: `portfolio-web`
- Inbound:
  | Type  | Port | Source |
  |-------|------|--------|
  | SSH   | 22   | **My IP** |
  | HTTP  | 80   | Anywhere-IPv4 (0.0.0.0/0) |
  | HTTPS | 443  | Anywhere-IPv4 (0.0.0.0/0) |
- Outbound: оставить по умолчанию (всё разрешено).

Если домашний IP сменился и SSH перестал пускать — обновите правило SSH → My IP.

## 5. Launch instance

EC2 → **Launch instance**:
- Name: `portfolio`
- AMI: **Ubuntu Server 24.04 LTS**, архитектура **64-bit (x86)**
- Instance type: **t3.micro** (Free tier eligible) или **t3.small**, если планируете бэкенд + MySQL
- Key pair: `portfolio-key`
- Network: Select existing security group → `portfolio-web`
- Storage: **10 GiB gp3** (хватает для статики + runner; диск оплачивается за каждый GiB)
- Launch → дождаться `Running` и `2/2 checks passed`.

## 6. Elastic IP (постоянный IP)

EC2 → **Elastic IPs** → Allocate → Allocate.
Выделить новый IP → Actions → **Associate** → Instance `portfolio` → Associate.

Запишите этот IP — дальше он `NEW_IP`.
(Публичный IPv4 в AWS платный, ~3.6 USD/мес, покрывается кредитами.)

## 7. Первый вход и базовая настройка сервера

```bash
ssh -i ~/.ssh/portfolio-key.pem ubuntu@NEW_IP
```

На сервере:

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install nginx git curl unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades   # ответить Yes — автоустановка security-обновлений

# swap 2 GB: на t3.micro (1 GB RAM) иначе npm ci / vite build может упасть по памяти
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

## 8. nginx

```bash
sudo mkdir -p /var/www/portfolio
sudo nano /etc/nginx/sites-available/portfolio
```
Вставить содержимое `docs/nginx-portfolio.conf.example` из репозитория, сохранить (Ctrl+O, Enter, Ctrl+X).

```bash
sudo ln -sf /etc/nginx/sites-available/portfolio /etc/nginx/sites-enabled/portfolio
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 9. DNS в name.am

name.am → samsarukhanyan.com → **Նեյմսերվեր և DNS**:
- A `samsarukhanyan.com` → ✏️ → `NEW_IP`
- A `www.samsarukhanyan.com` → ✏️ → `NEW_IP`
- Cloudflare-прокси (облачко) — **выключен**, иначе certbot не выпустит сертификат.
- TXT `google-site-verification` не трогать.

Проверка (локально, через 1–10 мин):
```bash
dig +short samsarukhanyan.com @1.1.1.1
dig +short www.samsarukhanyan.com @1.1.1.1
```
Оба должны показать `NEW_IP`.

## 10. GitHub self-hosted runner

1. GitHub → `SamSarukhanyan/portfolio-deploy` → Settings → Actions → **Runners**.
   Старый runner (offline) → **Remove**.
2. **New self-hosted runner** → Linux → x64. Выполнить на сервере команды из раздела *Download*
   (в папке `~/actions-runner-portfolio` вместо `actions-runner`).
3. `./config.sh ...` из раздела *Configure*. На вопросы:
   - runner group: Enter
   - name: `portfolio-ec2`
   - **additional labels: `portfolio`** (обязательно — workflow ждёт `[self-hosted, portfolio]`)
   - work folder: Enter
4. Как сервис:
   ```bash
   cd ~/actions-runner-portfolio
   sudo ./svc.sh install ubuntu
   sudo ./svc.sh start
   sudo ./svc.sh status   # active (running)
   ```
   В GitHub runner должен стать **Idle** (зелёный).

У пользователя `ubuntu` на Ubuntu AMI уже есть sudo без пароля — workflow сможет копировать файлы и перезагружать nginx.

## 11. Первый деплой

GitHub → Actions → **Deploy portfolio (static)** → Run workflow (или `git push origin main`).
После зелёной галочки на сервере:

```bash
ls /var/www/portfolio
curl -sS -H "Host: samsarukhanyan.com" http://127.0.0.1/ | head
```

## 12. HTTPS (Let's Encrypt)

```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d samsarukhanyan.com -d www.samsarukhanyan.com
#   email: ваш, Agree: Y, redirect HTTP→HTTPS: да (если спросит)
sudo certbot renew --dry-run
systemctl list-timers | grep certbot   # автообновление сертификата
```

Откройте https://samsarukhanyan.com.
Пока нет сертификата, Chrome может не открыть http:// версию из-за запомненного HSTS — это нормально, проверяйте `curl`.

## 13. Чтобы это не повторилось

- [ ] Paid plan включён до конца 6 месяцев (дата — в Billing → Free tier / Credits).
- [ ] Budgets с email-оповещениями созданы.
- [ ] Письма от AWS приходят на почту, которую вы читаете.
- [ ] Снапшоты диска: EC2 → Lifecycle Manager → policy, ежедневный снапшот EBS, хранить 7.
- [ ] Бесплатный мониторинг доступности: UptimeRobot на https://samsarukhanyan.com — письмо, если сайт упал.
- [ ] Если на сервере появится БД — регулярный `mysqldump` за пределы сервера.

# GA4 Production Setup (Portfolio)

This guide documents a production-grade Google Analytics 4 setup for this portfolio, with separate local and server workflows.

## 1) What is already implemented in code

- GA4 bootstrap module: `client/src/analytics/ga.ts`
- Consent banner UI: `client/src/components/AnalyticsConsentBanner.tsx`
- SPA pageview tracking on route change in `client/src/App.tsx`
- Key interaction events in:
  - `client/src/components/Hero.tsx`
  - `client/src/components/Navigation.tsx`
  - `client/src/components/ContactSection.tsx`
  - `client/src/components/Footer.tsx`
  - `client/src/components/ArtPage.tsx`
- Environment variables documented in `client/.env.example`

Implementation details:
- Tracking is enabled only for production builds (`import.meta.env.PROD`).
- GA script loads dynamically from `googletagmanager.com`.
- Auto pageview is disabled (`send_page_view: false`) and sent manually for SPA route transitions.
- IP anonymization is enabled.
- Ads personalization/storage is denied by default.
- Analytics storage is denied by default and enabled only after explicit consent.

## 2) Google Analytics property setup (UI)

1. Open [Google Analytics](https://analytics.google.com/).
2. Admin -> Create Account (or use existing account).
3. Create Property:
   - Property name: `Samsarukhanyan Portfolio`
   - Reporting time zone: your business timezone
   - Currency: your primary currency
4. In the property, create a Web Data Stream:
   - Website URL: your production domain (`https://...`)
   - Stream name: `portfolio-web-prod`
5. Copy the Measurement ID (`G-XXXXXXXXXX`).
6. (Recommended) Admin -> Data Settings -> Data Collection:
   - Keep Google Signals disabled unless you explicitly need demographic reports.
7. (Recommended) Data Retention:
   - Set event data retention to `14 months`.

## 3) Local environment setup

1. In `client/.env` set:

```bash
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_GA4_DEBUG_MODE=true
```

2. Run frontend locally:

```bash
cd client
npm install
npm run dev
```

3. Open the site, accept analytics consent in the banner.
4. In GA4 open Admin -> DebugView and verify incoming events.

Notes:
- Local dev (`npm run dev`) does not send production analytics events because tracking is gated by production mode.
- For realistic checks, use a production build preview:

```bash
cd client
npm run build
npm run preview
```

## 4) GitHub / CI secrets for production

If deployment pipeline builds frontend from GitHub Actions, add repository secret:

- Name: `VITE_GA4_MEASUREMENT_ID`
- Value: `G-XXXXXXXXXX`

Optional:
- `VITE_GA4_DEBUG_MODE=false`

Important:
- Never commit real GA IDs to repository if you treat them as environment-managed config.
- For Vite, only variables prefixed with `VITE_` are exposed to frontend bundle.

## 5) Server deployment (AWS + Nginx + PM2)

Use whichever deployment style you run now.

### A. Build on server directly

1. SSH into server.
2. Go to frontend directory.
3. Create/update environment file used before frontend build:

```bash
cat > .env.production <<'EOF'
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_GA4_DEBUG_MODE=false
EOF
```

4. Build frontend with this env:

```bash
npm ci
cp .env.production .env
npm run build
```

5. Deploy `dist` to Nginx served directory.
6. Reload Nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### B. Build in CI and ship artifacts

1. Inject `VITE_GA4_MEASUREMENT_ID` during CI build.
2. Upload built `dist` to server (rsync/scp/deploy action).
3. Keep Nginx as static host + SPA fallback.

## 6) Nginx checks (must-have)

Ensure your portfolio site block has:

- SPA fallback:
  - `try_files $uri $uri/ /index.html;`
- HTTPS enabled (Let's Encrypt / ACM / Cloudflare edge).
- Correct caching strategy:
  - immutable long cache for fingerprinted assets (`/assets/*`)
  - short/no-cache for `index.html`

This guarantees fresh config rollout after each deploy while keeping static performance.

## 7) PM2 notes

GA runs in frontend only, so PM2 usually does not need GA-specific changes.
If your PM2 process handles API only, keep it as is:

```bash
pm2 status
pm2 logs <api-process-name> --lines 100
```

Use PM2 only for backend validation after deployment if needed.

## 8) Validation checklist (production)

1. Open production site in private window.
2. Confirm consent banner appears once.
3. Click `Decline`:
   - Navigate around pages
   - In GA Realtime, no events should appear for this browser session.
4. Clear site storage/cookies and reopen site.
5. Click `Accept analytics`.
6. Verify in GA4 Realtime / DebugView:
   - `page_view`
   - `navigation_click`
   - `cta_click`
   - `contact_click`
   - `outbound_click`
   - `artwork_open`
7. Validate key funnels:
   - Home -> Art page
   - Home -> Contact CTA
   - Contact -> social links/email

## 9) Recommended “pro” tooling (free and paid mix)

- **Google Tag Manager (free):**
  - Optional layer for non-code event management.
  - Keep direct `gtag` for baseline reliability; move marketing tags to GTM if needed.
- **GA4 custom dimensions (free):**
  - Register useful params (`section`, `placement`, `cta`, `target`) for better reports.
- **Looker Studio (free):**
  - Build stakeholder dashboards from GA4.
- **BigQuery Export (paid at scale):**
  - Recommended for advanced product analytics and raw SQL analysis.
- **Session replay (paid tools like Hotjar/FullStory):**
  - Optional; only after privacy review and explicit consent model extension.

## 10) Next production hardening (recommended)

1. Add strict Content Security Policy and include:
   - `https://www.googletagmanager.com`
   - `https://www.google-analytics.com`
2. Add internal traffic filtering in GA4 (your own IP/team traffic).
3. Add annotation process for major releases and campaigns.
4. Define KPI dashboard:
   - Unique users
   - CTA conversion rate
   - Contact intent events
   - Art page engagement
5. Add runbook for incident response (if analytics drops unexpectedly).

## 11) Cursor prompt for server session

Use this prompt in a new Cursor session on the server:

```text
You are working on my production server deployment for portfolio GA4 rollout.

Context:
- Frontend is Vite React app.
- Nginx serves static frontend.
- PM2 runs backend API process.
- I want GA4 production setup with no skipped steps.

Tasks:
1) Detect frontend project path and confirm `package.json` scripts.
2) Create/update frontend env file for production build:
   - VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
   - VITE_GA4_DEBUG_MODE=false
3) Install deps with npm ci.
4) Build frontend and verify dist output exists.
5) Deploy dist to the Nginx web root used by this domain.
6) Validate Nginx config has SPA fallback:
   - try_files $uri $uri/ /index.html;
7) Run:
   - sudo nginx -t
   - sudo systemctl reload nginx
8) Validate site responds over HTTPS and static assets load.
9) Keep PM2 API process healthy (show pm2 status and relevant logs).
10) Provide final report:
   - exact files changed
   - commands executed
   - any warnings or follow-up tasks

Constraints:
- Do not skip checks.
- Ask before any destructive command.
- Keep everything production-safe and reversible.
```

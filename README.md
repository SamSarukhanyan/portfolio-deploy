# Samsarukhanyan Portfolio

Production-focused portfolio website with a React frontend and an optional Express + MySQL translation API.

This repository is designed as a clean, deployable portfolio surface that also demonstrates practical engineering around configuration, API fallback behavior, and server deployment.

## Overview

The project has two runtime parts:

- `client/` - public portfolio UI (React 19 + Vite + TypeScript)
- `server/` - lightweight i18n API (Express + MySQL), used to override bundled text content when needed

If the API or database is unavailable, the frontend continues to work using local bundled translations. This keeps the portfolio stable in static-hosting or degraded backend scenarios.

##ё Tech Stack

## Frontend

- React 19
- Vite 6
- TypeScript
- CSS Modules + global design system variables
- IntersectionObserver-based scroll reveal animations

## Backend

- Node.js
- Express 4
- MySQL (`mysql2`)
- TypeScript + `tsx` for development

### Infrastructure / Ops (project context)

- Nginx static serving + SPA fallback
- AWS EC2 hosting
- Domain + HTTPS via Certbot
- CI/CD-oriented deployment workflow (documented under `docs/`)

## Repository Structure

```text
.
├── client/                     # Portfolio frontend (Vite + React)
│   ├── public/                 # Favicons, web manifest
│   └── src/
│       ├── components/         # UI sections and navigation
│       ├── i18n/               # Bundled translation defaults + provider
│       └── config/site.ts      # Personal links and contact metadata
├── server/                     # Optional i18n API
│   ├── src/routes/             # API endpoints
│   ├── src/seed/               # DB seed script
│   └── sql/                    # Provision + schema SQL
└── docs/                       # Deployment and Nginx references
```

## Features

- Modern, responsive portfolio layout and sectioned content structure
- Mobile-friendly navigation drawer and smooth menu transitions
- Reusable reveal animations triggered on viewport entry/exit
- Local-first translation model with optional DB overrides
- Graceful backend fallback: frontend remains usable if DB/API is down
- Domain-ready static deployment support (`docs/nginx-portfolio.conf.example`)

### Getting Started

## 1) Prerequisites

- Node.js 20+ (recommended)
- npm 10+
- MySQL 8+ (only required if using the server with DB-backed translations)

## 2) Install dependencies

```bash
cd client && npm install
cd ../server && npm install
```

## 3) Configure environment variables

Frontend (`client/.env`):

```bash
# Optional absolute API URL; otherwise frontend uses same-origin /api
VITE_API_BASE_URL=http://127.0.0.1:4004

# Set true to disable remote translation fetch (pure static mode)
VITE_SKIP_SERVER_I18N=false
```

Backend (`server/.env`):

```bash
PORT=4004
NODE_ENV=production
CORS_ORIGIN=http://localhost:5173,https://samsarukhanyan.com

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=samsarukhanyan_portfolio
DB_USER=app_user_prod
DB_PASSWORD=your_password
```

You can copy from:

- `client/.env.example`
- `server/.env.example`

## 4) Run locally

Start API:

```bash
cd server
npm run dev
```

Start frontend:

```bash
cd client
npm run dev
```

Build frontend:

```bash
cd client
npm run build
```

## API Endpoints

Base path: `/api`

- `GET /api/translations` - returns merged translation bundles  
  - base: `client/src/i18n/bundles.default.json`
  - optional overlay: MySQL records (when DB is connected)
- `GET /api/health` - basic service health check

## Content and Personalization

Update personal links and contact metadata in:

- `client/src/config/site.ts`

Default copy lives in:

- `client/src/i18n/bundles.default.json`

When backend translation storage is configured, remote bundle keys can override local defaults without rebuilding the frontend.

## Deployment Notes

Deployment references are included in:

- `docs/deploy-order.txt`
- `docs/nginx-portfolio.conf.example`

The intended production model is:

1. Build frontend static assets
2. Serve via Nginx with SPA fallback
3. Run optional i18n API as a separate Node service
4. Secure domain with HTTPS (Certbot)

## Professional Context

This portfolio is built to present practical full-stack capabilities, including:

- frontend delivery and UI system ownership
- API design and fallback architecture
- production configuration management
- operational readiness for domain, HTTPS, and server deployment

---

If you use this repository as a base template, replace personal data in `client/src/config/site.ts` and translation copy in `client/src/i18n/bundles.default.json` before publishing.


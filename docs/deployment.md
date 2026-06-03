# Deployment

## Overview

| Target | Package | Config | Trigger |
|--------|---------|--------|---------|
| **Frontend** | `client/` | `vercel.json` (repo root) | Push to `main` |
| **API** | `server/` | `render.yaml` | Push to `main` |

Run [CI](ci-cd.md) on PRs before merging to `main`. Optionally gate Vercel/Render deploys on green CI.

---

## Vercel (Angular SPA)

Deploy from the **repository root** (Root Directory empty in the Vercel dashboard).

`vercel.json` runs:

- Install: `cd client && npm ci`
- Build: `cd client && npm run build`
- Output: `client/dist/client/browser`

Set production env vars in Vercel (same names as `client/.env.example`). `prebuild` regenerates `environment.config.ts`.

| Variable | Example |
|----------|---------|
| `GRAPHQL_HTTP_URI` | `https://your-api.onrender.com/graphql` |
| `GRAPHQL_WS_URI` | `wss://your-api.onrender.com/graphql` |
| `AUTH0_DOMAIN` | `your-tenant.us.auth0.com` |
| `AUTH0_CLIENT_ID` | SPA client ID |
| `AUTH0_AUDIENCE` | `https://task-dashboard-api` |

In **Auth0**, add the Vercel URL to callback, logout, and web origins.

CLI: `vercel` from the repo root.

---

## Render (GraphQL API)

Use a **Web Service** (not Static Site). Prefer `render.yaml` or match these settings:

| Setting | Value |
|---------|--------|
| Root Directory | `server` |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check | `/health` |

`--include=dev` is required when `NODE_ENV=production` so TypeScript and `@types/node` install for the build.

### Environment (Render dashboard)

| Variable | Notes |
|----------|--------|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `PORT` | Set by Render (or explicit) |
| `DATABASE_URL` | Hosted PostgreSQL |
| `DATABASE_SSL` | `auto` or `true` |
| `CORS_ORIGINS` | Your Vercel URL |
| `AUTH0_DOMAIN` / `AUTH0_AUDIENCE` | Match client |
| `BLOB_READ_WRITE_TOKEN` | If using avatar upload |

### Migrations

After first deploy (or each release), run once in Render Shell:

```bash
npm run migrate
```

---

## Wiring client → API

Point Vercel env vars at the Render service URL (`https` / `wss`). Ensure `CORS_ORIGINS` on Render includes the Vercel origin.

# CI / CD

This repo separates **continuous integration** (GitHub Actions) from **continuous deployment** (Vercel + Render).

## What runs where

| Trigger | CI (GitHub Actions) | CD (Vercel / Render) |
|---------|-------------------|----------------------|
| Pull request → `main` | Yes — build, test, codegen check | No |
| Push to `main` | Yes | Yes — auto-deploy |

### CI jobs (`.github/workflows/ci.yml`)

1. **Server** — `npm ci`, TypeScript build, `node --test` (in-memory PostgreSQL via `pg-mem`; no secrets or live DB).
2. **Client** — `npm ci`, production Angular build (`prebuild` generates `environment.config.ts` from defaults; no `client/.env` required).
3. **GraphQL codegen** — regenerates types and fails if `graphql.ts` would change (run `npm run codegen --prefix client` locally before pushing).

### CD (your current setup)

- **Vercel** — builds `client/` per `vercel.json` when `main` updates.
- **Render** — builds and runs `server/` when `main` updates.

CI does not replace those deploys; it catches broken builds and tests **before** or **alongside** deploy.

## Recommended GitHub settings

1. **Branch protection** on `main`:
   - Require status checks: **Server — build & test**, **Client — production build**, **GraphQL — codegen in sync**.
   - Require pull request reviews (optional but typical).
2. **Do not commit** `server/.env`, `client/.env`, or tokens. CI never needs them for the current jobs.

## Run CI locally

From the repository root (Node 20+, same as `.nvmrc`):

```bash
npm run ci
```

Codegen drift check (matches the third CI job):

```bash
npm run codegen --prefix client
git diff --exit-code client/src/app/graphql/generated/graphql.ts
```

## Optional next steps

- **Deploy gates**: In Vercel/Render, enable “wait for GitHub checks” so production deploy only runs after CI passes on `main`.
- **Client unit tests**: Add a Karma headless job when `ng test` is configured for CI (`ChromeHeadless`).
- **Preview deploys**: Vercel preview URLs per PR (CD for previews; CI still runs on the PR).

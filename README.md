# Real-Time Collaborative Task Management Dashboard

Enterprise Angular reference architecture for GraphQL, WebSocket subscriptions, Auth0 SSO, optimistic mutations, and Vercel deployment — built per the Internal R&D assignment specification.

## Live deployment

| Environment | URL |
|-------------|-----|
| **Vercel (frontend)** | _Set after deploy — see [Deploy to Vercel](#deploy-to-vercel)_ |
| **GraphQL API** | _Host `server/` on Render/Railway/Fly — see [API hosting](#api-hosting)_ |

## Prerequisites

- **Node.js** 20+ and npm 10+
- **Auth0** tenant (free tier) — required locally and in production
- **PostgreSQL** (Supabase, Neon, or local) for the API
- **Vercel** account for frontend CI/CD

## Quick start

### 1. Install dependencies

```bash
npm install              # root: concurrently
npm run install:all      # client + server
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
# Fill DATABASE_URL, Auth0 domain/audience, and client Auth0 SPA values
```

### 3. Run database migrations

```bash
cd server && npm run migrate
```

### 4. Start API + UI

From the repository root:

```bash
npm run dev
```

- API: `http://localhost:4000/graphql` (WebSocket: `ws://localhost:4000/graphql`)
- UI: `http://localhost:4200/` — sign in with Auth0 before using the board

Or in two terminals: `npm run server` and `npm run client`.

## Project structure

```
├── client/                          # Angular 19 SPA
│   ├── src/app/
│   │   ├── core/                    # Auth, Apollo, HTTP interceptor, theme, toasts
│   │   ├── features/
│   │   │   ├── auth/pages/          # Login + Auth0 callback (lazy)
│   │   │   └── board/               # Trello-style board feature
│   │   │       ├── components/      # Canvas, lists, cards, modal (OnPush)
│   │   │       ├── data-access/     # BoardFacade (Apollo + signals)
│   │   │       ├── models/          # View-model types
│   │   │       └── pages/           # Board page shell
│   │   └── graphql/
│   │       ├── operations/board.graphql
│   │       └── generated/graphql.ts # graphql-codegen output
│   ├── src/styles/                  # Design tokens, motion, utilities
│   └── codegen.ts
├── server/                          # GraphQL Yoga + graphql-ws
│   ├── src/
│   │   ├── auth/                    # Auth0 JWT verification
│   │   ├── config/                  # Environment loading
│   │   ├── db/                      # Pool, migrations runner, SQL files
│   │   ├── domain/                  # Board/task repository + tests
│   │   ├── graphql/                 # Request context
│   │   ├── subscriptions/           # PostgreSQL LISTEN/NOTIFY streams
│   │   ├── resolvers.ts
│   │   └── schema.graphql
│   └── README.md                    # API contract for frontend
├── docs/assignment.md               # Original R&D assignment brief
└── vercel.json                      # SPA deploy from client build
```

## Environment variables

Angular does **not** read `.env` in the browser at runtime. Values are loaded at **build/serve time** from `client/.env` and baked into the bundle via `scripts/generate-environment.mjs`.

### Client (`client/.env`)

| Variable | Description |
|----------|-------------|
| `GRAPHQL_HTTP_URI` | GraphQL HTTP endpoint |
| `GRAPHQL_WS_URI` | WebSocket endpoint (subscriptions) |
| `AUTH0_DOMAIN` | Auth0 tenant domain |
| `AUTH0_CLIENT_ID` | Auth0 SPA client ID |
| `AUTH0_AUDIENCE` | Auth0 API identifier |
| `DEV_AUTH_BYPASS` | Must be `false`; backend requires real Auth0 JWTs |

Generated file: `src/environments/environment.config.ts` (do not edit by hand; run `npm run env`).

### Server (`server/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Runtime mode |
| `PORT` | `4000` | HTTP + WebSocket port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATABASE_URL` | _(required)_ | PostgreSQL connection string |
| `DATABASE_SSL` | `auto` | SSL mode for PostgreSQL |
| `CORS_ORIGINS` | _(all)_ | Comma-separated frontend origins |
| `AUTH0_DOMAIN` | _(required)_ | Auth0 tenant domain |
| `AUTH0_AUDIENCE` | _(required)_ | Auth0 API audience |
| `BLOB_READ_WRITE_TOKEN` | _(required for avatar upload)_ | Vercel Blob token used by API to store profile images |

See `server/README.md` for the GraphQL API contract.

## GraphQL Codegen

```bash
cd client
npm run codegen
```

Generates typed Apollo documents from `server/src/schema.graphql` and `src/app/graphql/operations/*.graphql`.

## Architectural decision records (ADR)

### State management: Signals + Apollo Cache (not NgRx)

| Choice | Rationale |
|--------|-----------|
| **Signals** | Local UI state (selection, conflicts, loading) with minimal boilerplate and OnPush integration. |
| **Apollo InMemoryCache** | Server truth for the board; optimistic local patches keep drag-and-drop and edits instant. |
| **No NgRx** | Single board feature; a global store would add ceremony without proportional benefit. |

`BoardFacade` coordinates Apollo operations; presentation components stay dumb and OnPush.

### HTTP vs WebSocket (protocol switching)

- **Queries & mutations** → `HttpLink` with `setContext` auth link (JWT + refresh via `TokenService`).
- **Subscriptions** → `GraphQLWsLink` via `split()` on operation type.
- **Single WS client** in `create-apollo.ts`; `disposeApolloWs()` on app destroy prevents duplicate connections.
- `takeUntilDestroyed()` on all subscription streams in `BoardFacade`.

### Authentication

- Apollo link attaches `Authorization: Bearer` to HTTP and `connectionParams` for WebSocket.
- `authInterceptor` mirrors token injection for any future REST calls.
- `authGuard` protects `/dashboard`.
- Tokens refreshed through Auth0 `getAccessTokenSilently` with in-memory cache and 60s skew buffer.

### Optimistic UI & rollback

1. Mutations apply optimistic local state in `BoardFacade` before the network responds.
2. On **error**, the facade restores the prior snapshot and shows a non-blocking toast.
3. **Simulate network drop** (header button) triggers a server-side failure window for demo/testing.

### Real-time sync & conflict resolution

- `boardChanged` subscription refetches the board view on external changes.
- If the user has a card open and a remote update arrives with a higher `version`, a conflict banner appears in the card modal.
- Mutations send `expectedVersion`; the server returns `conflict: true` on version mismatch.

### Performance

- `ChangeDetectionStrategy.OnPush` on all presentation components.
- Lazy-loaded routes: `login`, `callback`, `dashboard`.
- Production budgets in `angular.json`; tree-shaking via Angular CLI production build.

## API hosting

1. Deploy `server/` to **Render** as a **Web Service** (not Static Site). Use `render.yaml` or set **Root Directory** to `server`, **Build Command** to `npm ci --include=dev && npm run build`, **Start Command** to `npm start`. If `NODE_ENV=production` is set in Render, you must use `--include=dev` on install so TypeScript and `@types/node` are available for the build.
2. Set `DATABASE_URL`, Auth0, `PORT`, and `CORS_ORIGINS` in the API host environment.
3. Run `npm run migrate` during setup or release.
4. Point client `GRAPHQL_HTTP_URI` / `GRAPHQL_WS_URI` at the deployed API (`wss://` for WS).

## Deploy to Vercel

```bash
vercel   # from repository root; reads vercel.json
```

Set production env vars in Vercel (see [Environment variables](#environment-variables)). The build runs `prebuild`, which regenerates `environment.config.ts` from those values.

**Vercel project settings:**

| Root Directory | Config file | Install / build | Output Directory |
|----------------|-------------|-----------------|------------------|
| *(empty — repo root)* | `/vercel.json` | `cd client && npm ci` | `client/dist/client/browser` |
| `client` | `client/vercel.json` | `npm ci` | `dist/client/browser` |

Use **one** of the rows above. Do not use `npm ci --prefix client` when Root Directory is already `client` — npm will look for `client/client/package-lock.json` and fail. Clear any dashboard overrides for Build / Install / Output so `vercel.json` applies.

## CI / CD

- **CI** — GitHub Actions on every PR and push to `main`: server tests, client production build, GraphQL codegen drift check. See [docs/ci-cd.md](docs/ci-cd.md).
- **CD** — Vercel (frontend) and Render (API) deploy automatically when `main` is updated.

Enable branch protection on `main` and require the three CI jobs to pass before merge. Locally: `npm run ci` from the repo root.

## Scripts reference

| Location | Command | Purpose |
|----------|---------|---------|
| root | `npm run dev` | API + Angular dev servers |
| root | `npm run ci` | Same checks as GitHub Actions (server test + client build) |
| `server/` | `npm run dev` | API + WebSocket |
| `server/` | `npm run migrate` | Apply SQL migrations |
| `server/` | `npm test` | Repository + resolver tests |
| `client/` | `npm start` | Dev server |
| `client/` | `npm run build` | Production bundle |
| `client/` | `npm run codegen` | GraphQL TypeScript types |

## License

Internal R&D assignment — company use.

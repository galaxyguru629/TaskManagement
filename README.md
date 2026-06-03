# Real-Time Collaborative Task Management Dashboard

Enterprise Angular reference app: GraphQL, WebSocket subscriptions, Auth0, optimistic mutations, Vercel + Render deployment.

## Live deployment

| Environment | URL |
|-------------|-----|
| **Frontend (Vercel)** | _Your production URL_ |
| **GraphQL API (Render)** | _Your Render service URL_ |

## Quick start

```bash
npm install && npm run install:all
cp server/.env.example server/.env
cp client/.env.example client/.env
cd server && npm run migrate && cd ..
npm run dev
```

- API: `http://localhost:4000/graphql`
- UI: `http://localhost:4200/`

Full setup, env tables, and scripts: **[docs/development.md](docs/development.md)**

## Documentation

| Topic | Link |
|-------|------|
| All docs | [docs/README.md](docs/README.md) |
| Local development | [docs/development.md](docs/development.md) |
| Architecture | [docs/architecture.md](docs/architecture.md) |
| GraphQL API contract | [docs/api.md](docs/api.md) |
| Deploy (Vercel + Render) | [docs/deployment.md](docs/deployment.md) |
| CI / CD | [docs/ci-cd.md](docs/ci-cd.md) |

## Repository layout

```
├── client/          # Angular 19 SPA
├── server/          # GraphQL Yoga API + PostgreSQL
├── docs/            # Project documentation
├── .github/         # CI workflow
├── vercel.json      # Frontend deploy
└── render.yaml      # API deploy blueprint
```

## CI

```bash
npm run ci
```

GitHub Actions runs server tests, client build, and GraphQL codegen drift checks on every PR and push to `main`. See [docs/ci-cd.md](docs/ci-cd.md).

## License

Internal R&D assignment — company use.

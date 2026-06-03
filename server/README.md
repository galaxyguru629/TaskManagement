# GraphQL API (`server/`)

Node.js GraphQL Yoga service with WebSocket subscriptions and PostgreSQL.

**Full API contract, auth, schema examples, and subscription guidance:** [docs/api.md](../docs/api.md)

## Quick commands

```bash
npm install
cp .env.example .env   # fill DATABASE_URL, Auth0, etc.
npm run migrate
npm run dev            # http://localhost:4000/graphql
npm test
```

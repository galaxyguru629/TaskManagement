# GraphQL API contract

GraphQL Yoga backend for the Real-Time Collaborative Task Management Dashboard. PostgreSQL is the source of truth, Auth0 JWTs are required for task operations, and WebSocket subscriptions are backed by PostgreSQL `LISTEN/NOTIFY`.

## Local Endpoints

```text
HTTP health:      GET  http://localhost:4000/health
GraphQL HTTP:     POST http://localhost:4000/graphql
GraphQL WS:       ws://localhost:4000/graphql
```

Production uses the same paths on the deployed API host. Use `https://` for HTTP and `wss://` for subscriptions.

## Environment

Copy `server/.env.example` to `server/.env` and fill every value.

| Variable | Example | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | Use `production` in deployed API environments. |
| `PORT` | `4000` | HTTP and WebSocket port. |
| `HOST` | `0.0.0.0` | Bind address. |
| `DATABASE_URL` | `postgresql://USER:PASSWORD@HOST:5432/DATABASE` | Supabase, Neon, or any PostgreSQL-compatible URL. |
| `DATABASE_SSL` | `auto` | `auto` enables SSL for non-local DB hosts. |
| `DATABASE_POOL_MAX` | `5` | Keep this below hosted session-pool limits; the API avoids per-request query fan-out. |
| `CORS_ORIGINS` | `http://localhost:4200,https://app.example.com` | Comma-separated frontend origins. |
| `AUTH0_DOMAIN` | `tenant.us.auth0.com` | Auth0 tenant domain. |
| `AUTH0_AUDIENCE` | `https://task-dashboard-api` | Must match the Auth0 API audience used by the frontend. |

Do not commit real `.env` secrets. If a database URL has been exposed, rotate that password.

## Auth Contract

All task queries, mutations, and subscriptions require an Auth0 access token.

HTTP:

```http
Authorization: Bearer <Auth0 access token>
```

WebSocket `connectionParams`:

```json
{
  "authorization": "Bearer <Auth0 access token>"
}
```

Unauthenticated task operations return a GraphQL error with:

```json
{
  "extensions": {
    "code": "UNAUTHENTICATED"
  }
}
```

## Board Schema Overview

The Trello-style frontend uses `boardView` and `boardChanged` as its primary contract:

```graphql
query DefaultBoard {
  defaultBoard { id title background version }
}

query BoardView($boardId: ID!) {
  boardView(boardId: $boardId) {
    board { id title description background version }
    lists {
      id
      title
      status
      position
      version
      cards {
        id
        listId
        title
        description
        status
        priority
        assignee
        position
        dueDate
        coverColor
        version
        labels { id name color }
        checklist { id text checked position }
        comments { id body author createdAt }
      }
    }
    labels { id name color }
    activity { id taskId type message actor createdAt }
  }
}

mutation CreateList($input: CreateListInput!) {
  createList(input: $input) { id boardId title position version }
}

mutation CreateTask($input: CreateTaskInput!) {
  createTask(input: $input) { id boardId listId title position version }
}

mutation MoveTask($input: MoveTaskInput!) {
  moveTask(input: $input) {
    success
    conflict
    task { id listId position status version }
  }
}

subscription BoardChanged($boardId: ID!) {
  boardChanged(boardId: $boardId) {
    type
    boardId
    clientMutationId
    actorId
    actorName
    task { id title version }
    list { id title version }
    comment { id taskId body author createdAt }
  }
}
```

Legacy `tasks`, `task`, and `taskChanged` remain available for compatibility. New frontend code should use board operations.

Task statuses are `TODO`, `IN_PROGRESS`, and `DONE`. Positions are floating-point ordering keys; clients can place a card between neighbors by sending the midpoint.

## Query Variables

Pagination, filtering, and sorting example:

```json
{
  "page": 1,
  "pageSize": 20,
  "filter": {
    "status": "IN_PROGRESS",
    "search": "release"
  },
  "sort": [
    { "field": "priority", "direction": "ASC" },
    { "field": "updatedAt", "direction": "DESC" }
  ]
}
```

Supported sort fields: `title`, `status`, `priority`, `assignee`, `updatedAt`. Unknown fields fall back to `updatedAt`.

## Conflict Handling

Tasks include a monotonic `version`. Frontend updates should pass the version seen by the user as `expectedVersion`.

Stale update/delete response:

```json
{
  "success": false,
  "conflict": true,
  "task": {
    "id": "task-id",
    "version": 3
  }
}
```

Use the returned `task` as the current server version for conflict UI. Successful updates/deletes return `success: true`, `conflict: false`, and the affected task.

## Rollback Errors

`simulateNetworkFailure` enables a five-second failure window for subsequent mutations. During that window, mutation errors use:

```json
{
  "extensions": {
    "code": "SIMULATED_NETWORK_FAILURE"
  }
}
```

Frontend optimistic updates should restore the exact previous Apollo cache state and show a non-blocking toast.

Validation errors use `BAD_USER_INPUT`, for example empty titles or priority values outside `1..5`.

## Subscription Events

`boardChanged` publishes:

```json
{
  "type": "CARD_CREATED | CARD_UPDATED | CARD_MOVED | CARD_ARCHIVED | LIST_CREATED | LIST_UPDATED | COMMENT_CREATED",
  "boardId": "board-id",
  "clientMutationId": "optional-client-generated-id",
  "actorId": "auth0-user-sub",
  "actorName": "Display Name",
  "task": {
    "id": "task-id",
    "version": 2
  }
}
```

Frontend cache guidance:

- Apply `boardChanged` events incrementally in local state — do **not** refetch `boardView` on every event.
- `CARD_CREATED`: insert the card into the target list using `task` fields.
- `CARD_MOVED`: move the card between lists by `listId` and `position`.
- `CARD_UPDATED`: merge scalar card fields; if the open modal has an older `version`, show conflict UI.
- `CARD_ARCHIVED`: remove the card from visible lists.
- `COMMENT_CREATED`: append `comment` to the card; prepend `activity` when present.
- `CHECKLIST_UPDATED`: upsert `checklistItem` on the affected card.
- `LABEL_UPDATED`: merge `label` into board labels; bump card version when `task` is present.

For optimistic writes, send a unique `clientMutationId` on `UpdateTaskInput`, `MoveTaskInput`, and `UpdateListInput`. The backend echoes it on `boardChanged`; clients should ignore conflict UI for events with their own pending mutation id and use foreign newer versions for conflict banners.

## Commands

See [development.md](development.md) for install, migrate, dev, and test commands. Migrations apply SQL from `server/src/db/migrations` and record versions in `schema_migrations`.

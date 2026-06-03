# Architecture

## State management: Signals + Apollo Cache (not NgRx)

| Choice | Rationale |
|--------|-----------|
| **Signals** | Local UI state (selection, conflicts, loading) with minimal boilerplate and OnPush integration. |
| **Apollo InMemoryCache** | Server truth for the board; optimistic local patches keep drag-and-drop instant. |
| **No NgRx** | Single board feature; a global store would add ceremony without proportional benefit. |

`BoardFacade` coordinates Apollo operations; presentation components stay dumb and OnPush.

## HTTP vs WebSocket

- **Queries & mutations** → `HttpLink` with auth context (JWT + refresh via `TokenService`).
- **Subscriptions** → `GraphQLWsLink` via `split()` on operation type.
- **Single WS client** in `create-apollo.ts`; `disposeApolloWs()` on destroy avoids duplicate connections.
- `takeUntilDestroyed()` on subscription streams in `BoardFacade`.

## Authentication

- Apollo link attaches `Authorization: Bearer` to HTTP and `connectionParams` for WebSocket.
- `authInterceptor` mirrors token injection for REST calls.
- `authGuard` and `profileGuard` protect routes.
- Tokens refreshed via Auth0 `getAccessTokenSilently` with in-memory cache and 60s skew buffer.

## Optimistic UI & rollback

1. Mutations apply optimistic local state in `BoardFacade` before the network responds.
2. On error, the facade restores the prior snapshot and shows a non-blocking toast.
3. **Simulate network drop** (header control) triggers a server-side failure window for demo/testing.

## Real-time sync & conflicts

- `boardChanged` subscription drives incremental cache updates.
- Open card modal shows a conflict banner when a remote update has a higher `version`.
- Mutations send `expectedVersion`; the server returns `conflict: true` on mismatch.

See [api.md](api.md) for subscription event shapes and cache merge rules.

## Performance

- `ChangeDetectionStrategy.OnPush` on presentation components.
- Lazy-loaded routes: login, callback, dashboard, profile flows.
- Production budgets in `client/angular.json`.

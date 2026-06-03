# Internal R&D Assignment: Enterprise Angular Real-Time Blueprint

## 1. Project Overview

As we scale our tech stack, we need a standardized, highly optimized architectural blueprint for real-time applications. Your task is to build a **Real-Time Collaborative Task Management Dashboard** that will serve as our internal reference architecture for future Angular (v17+) projects utilizing GraphQL and secure authentication.

This project must demonstrate production-ready patterns, flawless state management, and strict performance guardrails, culminating in a fully automated deployment pipeline on Vercel.

## 2. Infrastructure & Tooling

- **Frontend Framework:** Angular 17+ (Strict mode, Standalone components, Signals for local reactive state).
- **API Layer:** Apollo Angular.
- **Target API:** You are required to provision your own free, instant GraphQL backend that supports CRUD and Subscriptions.
  - **Recommended option:** Spin up a free instance on Supabase (utilizing their GraphQL extension) or a free cloud project on Hasura Cloud connected to a free Neon PostgreSQL database.
  - **Alternative option:** If preferred, you may use a local or self-hosted mock server (e.g., Node.js with graphql-yoga or apollo-server), provided that the WebSocket server is fully accessible and deployment on Vercel can securely connect to a live database endpoint.
- **Authentication:** Integrate Auth0 or Firebase Auth (Free tier), simulating our enterprise Single Sign-On (SSO).
- **CI/CD & Hosting:** Vercel.

## 3. Core Epics & Deliverables

### Epic 1: Secure Connection & Protocol Handshake

#### 1.1 Dynamic Interceptors
Implement a robust authentication flow where JWT tokens are managed securely. Write a custom Angular Interceptor / Apollo Link that handles token injection and auto-refresh on expiration.

#### 1.2 Protocol Switching
Ensure the setup dynamically switches between HTTP (for Queries and Mutations) and WebSockets (for Subscriptions) without producing memory leaks or duplicate connections.

### Epic 2: High-Performance Data Grid & Real-Time Sync

#### 2.1 Server-Side Capabilities
Build a dashboard view with server-side pagination, multi-column sorting, and complex filtering (e.g., filtering tasks by status: Todo, In Progress, Done).

#### 2.2 The "Google Docs" Effect
Implement GraphQL Subscriptions. When data is altered by another session or user, the UI must update smoothly and instantly.

#### 2.3 Conflict Resolution
Implement a basic strategy or visual indicator handling data collision (e.g., what happens if an item is updated externally while the user is actively viewing or interacting with it).

### Epic 3: Bulletproof Mutations & UX Optimization

#### 3.1 CRUD Operations
Create a responsive, reactive form (inside a modal or side-drawer) to Create, Edit, and Delete tasks.

#### 3.2 Optimistic Execution
All CRUD operations must feel instantaneous. The UI must speculatively update via the Apollo Cache before the network response arrives.

#### 3.3 Transactional Error Rollback
Implement a rollback mechanism. If a mutation fails (e.g., due to a simulated network drop), the UI must gracefully revert to its exact prior state and alert the user via a non-blocking toast notification.

### Epic 4: Operational Excellence & CI/CD

#### 4.1 Advanced Performance
Enforce ChangeDetectionStrategy.OnPush across all presentation components. Streamline memory management using takeUntilDestroyed or the async pipe to ensure zero WebSocket leaks.

#### 4.2 Strict Typing
No use of any. Utilize graphql-codegen to automatically generate TypeScript types from the GraphQL schema.

#### 4.3 Zero-Config Deployment
Deploy the application to Vercel. Ensure the production build utilizes advanced tree-shaking and component lazy-loading, keeping the main bundle optimized.

## 4. Evaluation & Review Criteria

| Criteria | Weight | Deliverable Expectations |
|----------|--------|--------------------------|
| Angular Architecture | 25% | Signals usage, OnPush strategy, clean folder structures, and custom interceptors. |
| GraphQL Proficiency | 25% | Separation of Queries/Mutations/Subscriptions, Apollo cache handling, and Optimistic UI. |
| State & RxJS Management | 20% | Clean stream manipulation, error handling, preventing memory leaks in WebSockets. |
| Security & Auth | 15% | Robust route protection and secure token handling across HTTP and WS. |
| Deployment & DevOps | 15% | Correct Vercel configuration, environment variables security, and optimized build. |

## 5. Submission Guidelines

1. **Repository:** Push your code to a private company repository or a public GitHub link.

2. **Architectural Decision Records (ADR):** In the README.md, you must document:
   - Prerequisites and commands to run the project locally.
   - Why you chose specific state strategies (e.g., pure Signals vs. NgRx).
   - How you prevented memory leaks in WebSockets and your strategy for error rollbacks.
   - The live Vercel deployment URL.

3. **Timeline:** You have **5 business days** to complete this assignment and submit the repository link.

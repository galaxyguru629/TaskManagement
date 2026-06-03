import { createServer, type Server as HttpServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { useServer } from 'graphql-ws/use/ws';
import { createYoga } from 'graphql-yoga';
import { WebSocketServer } from 'ws';
import { authenticateConnectionParams } from './auth/auth.js';
import { env } from './config/env.js';
import { runMigrations } from './db/migrations.js';
import { closePool, pool } from './db/pool.js';
import { createHttpContext, createWsContext, type GraphQLContext } from './graphql/context.js';
import { schema } from './resolvers.js';
import { taskEventStream } from './subscriptions/task-events.js';

/** Lifecycle methods on Node’s HTTP server (declared here for stable typing across tooling). */
interface NodeHttpListener {
  close(callback?: (err?: Error) => void): void;
  listen(port: number, hostname: string, listeningListener?: () => void): void;
}

const expressCorsOrigin: string | string[] | boolean = env.corsOrigins.length ? env.corsOrigins : true;
const yogaCorsOrigin: string | string[] | undefined = env.corsOrigins.length ? env.corsOrigins : undefined;

const yoga = createYoga<GraphQLContext>({
  schema,
  graphqlEndpoint: '/graphql',
  landingPage: env.nodeEnv !== 'production',
  cors: {
    origin: yogaCorsOrigin,
    credentials: true,
  },
  context: ({ request }) => createHttpContext(request),
});

const app = express();
app.use(
  cors({
    origin: expressCorsOrigin,
    credentials: true,
  }),
);
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
app.use(yoga as unknown as express.RequestHandler);

const httpServer: HttpServer = createServer(app);
const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql',
});

const wsCleanup = useServer(
  {
    schema,
    context: (ctx) => createWsContext(ctx.connectionParams),
    onConnect: async (ctx) => {
      const user = await authenticateConnectionParams(ctx.connectionParams);
      if (!user) {
        throw new Error('Authentication required');
      }
      return true;
    },
  },
  wsServer,
);

let shuttingDown = false;

function closeHttpServer(server: NodeHttpListener): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err?: Error) => (err ? reject(err) : resolve()));
  });
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`Received ${signal}. Shutting down API server.`);

  await wsCleanup.dispose();
  await new Promise<void>((resolve, reject) => {
    wsServer.close((error?: Error) => (error ? reject(error) : resolve()));
  });
  await closeHttpServer(httpServer as unknown as NodeHttpListener);
  await taskEventStream.stop();
  await closePool();
}

process.on('SIGINT', () => {
  void shutdown('SIGINT').then(() => process.exit(0));
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM').then(() => process.exit(0));
});

await runMigrations(pool);
await taskEventStream.start();

(httpServer as unknown as NodeHttpListener).listen(env.port, env.host, () => {
  console.log(`GraphQL API ready at http://${env.host}:${env.port}/graphql`);
  console.log(`WebSocket subscriptions at ws://${env.host}:${env.port}/graphql`);
});

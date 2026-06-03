import { Client } from 'pg';
import { env } from '../config/env.js';
import type { BoardEvent, TaskEvent } from '../domain/index.js';

export const TASK_EVENTS_CHANNEL = 'task_events';

const RECONNECT_DELAY_MS = 1_000;
const SUBSCRIBER_TIMEOUT_MS = 120_000;

type StreamValue = { taskChanged?: TaskEvent; boardChanged?: BoardEvent };

interface Subscriber<T> {
  queue: T[];
  waiters: Array<(result: IteratorResult<T>) => void>;
  active: boolean;
  filter: (event: StreamValue) => T | null;
  lastActivity: number;
}

export async function publishTaskEvent(
  client: { query: (sql: string, values?: unknown[]) => Promise<unknown> },
  event: TaskEvent,
): Promise<void> {
  await client.query('SELECT pg_notify($1, $2)', [TASK_EVENTS_CHANNEL, JSON.stringify({ taskChanged: event })]);
}

export async function publishBoardEvent(
  client: { query: (sql: string, values?: unknown[]) => Promise<unknown> },
  event: BoardEvent,
): Promise<void> {
  await client.query('SELECT pg_notify($1, $2)', [TASK_EVENTS_CHANNEL, JSON.stringify({ boardChanged: event })]);
}

export class TaskEventStream {
  private listener: Client | null = null;
  private subscribers = new Set<Subscriber<unknown>>();
  private connecting: Promise<void> | null = null;
  private generation = 0;
  private abortController: AbortController | null = null;
  private healthTimer: ReturnType<typeof setInterval> | null = null;

  private readonly registry = new FinalizationRegistry<string>((id) => {
    for (const subscriber of this.subscribers) {
      const sub = subscriber as Subscriber<unknown> & { _registryId?: string };
      if (sub._registryId === id) {
        subscriber.active = false;
        this.subscribers.delete(subscriber);
        this.flushSubscriber(subscriber);
        break;
      }
    }
  });

  async start(): Promise<void> {
    if (this.listener) return;
    if (this.connecting) {
      await this.connecting;
      return;
    }
    this.connecting = this.connect();
    await this.connecting;
  }

  subscribeTasks(): AsyncIterable<{ taskChanged: TaskEvent }> {
    return this.subscribe((event) => (event.taskChanged ? { taskChanged: event.taskChanged } : null));
  }

  subscribeBoard(boardId: string): AsyncIterable<{ boardChanged: BoardEvent }> {
    return this.subscribe((event) =>
      event.boardChanged?.boardId === boardId ? { boardChanged: event.boardChanged } : null,
    );
  }

  async stop(): Promise<void> {
    this.stopHealthCheck();
    this.abortCurrentConnection();
    for (const subscriber of this.subscribers) {
      subscriber.active = false;
      this.flushSubscriber(subscriber);
    }
    this.subscribers.clear();
    if (this.listener) {
      try {
        await this.listener.query(`UNLISTEN ${TASK_EVENTS_CHANNEL}`);
        await this.listener.end();
      } catch {
        // Connection is already broken.
      }
      this.listener = null;
    }
  }

  private startHealthCheck(): void {
    if (this.healthTimer) return;
    this.healthTimer = setInterval(() => this.purgeStaleSubscribers(), SUBSCRIBER_TIMEOUT_MS);
    this.healthTimer.unref();
  }

  private stopHealthCheck(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  private purgeStaleSubscribers(): void {
    const now = Date.now();
    for (const subscriber of this.subscribers) {
      if (now - subscriber.lastActivity > SUBSCRIBER_TIMEOUT_MS * 2) {
        subscriber.active = false;
        this.subscribers.delete(subscriber);
        this.flushSubscriber(subscriber);
      }
    }
  }

  private subscribe<T>(filter: (event: StreamValue) => T | null): AsyncIterable<T> {
    const subscriber: Subscriber<T> = { queue: [], waiters: [], active: true, filter, lastActivity: Date.now() };
    this.subscribers.add(subscriber as Subscriber<unknown>);
    void this.startHealthCheck();
    void this.start();

    const registryId = crypto.randomUUID();
    (subscriber as Subscriber<unknown> & { _registryId?: string })._registryId = registryId;
    const target = {};
    this.registry.register(target, registryId);

    return {
      [Symbol.asyncIterator]: () => ({
        next: () => this.next(subscriber),
        return: async () => {
          subscriber.active = false;
          this.subscribers.delete(subscriber as Subscriber<unknown>);
          this.flushSubscriber(subscriber);
          this.registry.unregister(target);
          return { done: true, value: undefined };
        },
        throw: async (error?: unknown) => {
          subscriber.active = false;
          this.subscribers.delete(subscriber as Subscriber<unknown>);
          this.flushSubscriber(subscriber);
          this.registry.unregister(target);
          throw error;
        },
      }),
    };
  }

  private abortCurrentConnection(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private async connect(connectGeneration?: number): Promise<void> {
    const gen = connectGeneration ?? this.generation;

    if (this.listener) {
      try {
        await this.listener.end();
      } catch {
        // Connection is already broken.
      }
      this.listener = null;
    }

    const abortController = new AbortController();
    this.abortController = abortController;

    const listener = new Client({
      connectionString: env.databaseUrl,
      ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 10_000,
    });

    listener.on('notification', (message) => {
      if (message.channel !== TASK_EVENTS_CHANNEL || !message.payload) return;
      try {
        this.push(JSON.parse(message.payload) as StreamValue);
      } catch (error) {
        console.error('Failed to parse task event notification.', error);
      }
    });

    listener.on('error', (error) => {
      console.error('Task event listener error.', error);
      void this.reconnect();
    });

    listener.on('end', () => {
      if (this.listener === listener) {
        this.listener = null;
      }
    });

    try {
      if (abortController.signal.aborted) return;
      await listener.connect();
      if (this.generation !== gen || abortController.signal.aborted) {
        await listener.end().catch(() => undefined);
        return;
      }
      await listener.query(`LISTEN ${TASK_EVENTS_CHANNEL}`);
      this.listener = listener;
      this.abortController = null;
    } catch (error) {
      console.error('Failed to connect task event listener.', error);
      if (this.generation === gen) {
        setTimeout(() => void this.reconnect(), RECONNECT_DELAY_MS);
      }
    }
  }

  private async reconnect(): Promise<void> {
    if (this.listener) {
      try {
        await this.listener.end();
      } catch {
        // Connection is already broken.
      }
      this.listener = null;
    }

    this.generation++;
    const gen = this.generation;

    if (!this.subscribers.size) return;

    this.abortCurrentConnection();
    this.connecting = this.connect(gen);
    try {
      await this.connecting;
    } finally {
      if (this.generation === gen) {
        this.connecting = null;
      }
    }
  }

  private push(event: StreamValue): void {
    for (const subscriber of this.subscribers) {
      if (!subscriber.active) continue;
      subscriber.lastActivity = Date.now();
      const value = subscriber.filter(event);
      if (!value) continue;
      const waiter = subscriber.waiters.shift();
      if (waiter) {
        waiter({ done: false, value });
      } else {
        subscriber.queue.push(value);
      }
    }
  }

  private next<T>(subscriber: Subscriber<T>): Promise<IteratorResult<T>> {
    if (!subscriber.active) return Promise.resolve({ done: true, value: undefined });
    subscriber.lastActivity = Date.now();
    const event = subscriber.queue.shift();
    if (event) return Promise.resolve({ done: false, value: event });
    return new Promise((resolve) => subscriber.waiters.push(resolve));
  }

  private flushSubscriber<T>(subscriber: Subscriber<T>): void {
    for (const waiter of subscriber.waiters.splice(0)) {
      waiter({ done: true, value: undefined });
    }
    subscriber.queue.length = 0;
  }
}

export const taskEventStream = new TaskEventStream();

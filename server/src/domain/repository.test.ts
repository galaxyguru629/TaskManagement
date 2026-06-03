import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import { DataType, newDb } from 'pg-mem';
import type { AuthUser } from '../auth/auth.js';
import { SortDirection } from '../types.js';
import { createTask, deleteTask, listTasks, updateTask } from './repository.js';

const user: AuthUser = {
  id: 'auth0|test-user',
  name: 'Test User',
  email: 'test@example.com',
  pictureUrl: null,
  emailVerified: true,
};

async function createTestPool(): Promise<Pool> {
  const db = newDb();
  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    impure: true,
    implementation: randomUUID,
  });
  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool() as unknown as Pool;
  await pool.query(`
    CREATE TABLE boards (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      description text,
      background text NOT NULL DEFAULT 'linear-gradient(135deg, #0c66e4 0%, #5e4db2 100%)',
      logo_url text,
      created_by_auth0_sub text NOT NULL DEFAULT 'system',
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by text NOT NULL DEFAULT 'system'
    );
    CREATE TABLE task_lists (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      title text NOT NULL,
      position numeric NOT NULL DEFAULT 0,
      archived boolean NOT NULL DEFAULT false,
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by text NOT NULL DEFAULT 'system'
    );
    CREATE TABLE tasks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      list_id uuid NOT NULL REFERENCES task_lists(id) ON DELETE SET NULL,
      title text NOT NULL,
      description text,
      priority integer NOT NULL CHECK (priority BETWEEN 1 AND 5),
      assignee text,
      position numeric NOT NULL DEFAULT 0,
      due_date date,
      cover_color text,
      archived boolean NOT NULL DEFAULT false,
      version integer NOT NULL DEFAULT 1 CHECK (version > 0),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by text NOT NULL
    );
    CREATE TABLE task_assignees (
      task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      auth0_sub text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (task_id, auth0_sub)
    );
    CREATE TABLE labels (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      name text NOT NULL DEFAULT '',
      color text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE task_labels (
      task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      label_id uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, label_id)
    );
    CREATE TABLE checklist_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      text text NOT NULL,
      checked boolean NOT NULL DEFAULT false,
      position numeric NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE task_comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      body text NOT NULL,
      author text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE task_activity (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
      type text NOT NULL,
      message text NOT NULL,
      actor text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE user_profiles (
      auth0_sub text PRIMARY KEY,
      display_name text NOT NULL,
      email text,
      picture_url text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE board_members (
      board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      auth0_sub text NOT NULL,
      role text NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),
      invited_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (board_id, auth0_sub)
    );
    INSERT INTO boards (id, title, updated_by) VALUES ('00000000-0000-4000-8000-000000000001', 'Test Board', 'system');
    INSERT INTO board_members (board_id, auth0_sub, role, invited_by)
    VALUES ('00000000-0000-4000-8000-000000000001', 'auth0|test-user', 'OWNER', 'auth0|test-user');
    INSERT INTO task_lists (id, board_id, title, position, updated_by)
    VALUES
      ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'To Do', 1024, 'system'),
      ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'In Progress', 2048, 'system'),
      ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'Done', 3072, 'system');
  `);
  return pool;
}

test('createTask validates and normalizes task input', async () => {
  const pool = await createTestPool();

  const task = await createTask(
    pool,
    {
      title: '  Build API  ',
      description: '  Use Postgres  ',
      priority: 3,
      assignees: [`  ${user.id}  `],
    },
    user,
  );

  assert.equal(task.title, 'Build API');
  assert.equal(task.description, 'Use Postgres');
  assert.deepEqual(task.assignees, [user.id]);
  assert.equal(task.boardId, '00000000-0000-4000-8000-000000000001');
  assert.equal(task.version, 1);

  await assert.rejects(() => createTask(pool, { title: '   ' }, user), /Task title is required/);
  await pool.end();
});

test('updateTask increments versions and reports stale expectedVersion conflicts', async () => {
  const pool = await createTestPool();
  const task = await createTask(pool, { title: 'Original' }, user);

  const updated = await updateTask(pool, task.id, { title: 'Changed' }, task.version, user);
  assert.equal(updated.conflict, false);
  assert.equal(updated.task?.title, 'Changed');
  assert.equal(updated.task?.version, 2);

  const conflict = await updateTask(pool, task.id, { title: 'Stale write' }, task.version, user);
  assert.equal(conflict.conflict, true);
  assert.equal(conflict.task?.title, 'Changed');
  assert.equal(conflict.task?.version, 2);

  await pool.end();
});

test('deleteTask supports successful deletes and version conflicts', async () => {
  const pool = await createTestPool();
  const first = await createTask(pool, { title: 'Delete me' }, user);
  const second = await createTask(pool, { title: 'Conflict delete' }, user);
  const updated = await updateTask(pool, second.id, { priority: 5 }, second.version, user);

  const removed = await deleteTask(pool, first.id, first.version);
  assert.equal(removed.conflict, false);
  assert.equal(removed.task?.id, first.id);
  assert.equal(removed.task?.archived, true);

  const conflict = await deleteTask(pool, second.id, second.version);
  assert.equal(conflict.conflict, true);
  assert.equal(conflict.task?.version, updated.task?.version);

  await pool.end();
});

test('listTasks applies pagination, filtering, and multi-column sorting', async () => {
  const pool = await createTestPool();
  await pool.query(
    `INSERT INTO board_members (board_id, auth0_sub, role, invited_by) VALUES
      ('00000000-0000-4000-8000-000000000001', 'Lee', 'MEMBER', $1),
      ('00000000-0000-4000-8000-000000000001', 'Kim', 'MEMBER', $1)`,
    [user.id],
  );
  await createTask(pool, { title: 'Beta', priority: 3, assignees: ['Lee'] }, user);
  await createTask(pool, { title: 'Alpha', priority: 1, assignees: ['Lee'] }, user);
  await createTask(pool, { title: 'Done', priority: 1, assignees: ['Kim'] }, user);

  const result = await listTasks(
    pool,
    1,
    1,
    { search: 'Lee' },
    [
      { field: 'priority', direction: SortDirection.ASC },
      { field: 'title', direction: SortDirection.ASC },
    ],
  );

  assert.equal(result.totalCount, 2);
  assert.equal(result.nodes.length, 1);
  assert.equal(result.nodes[0]?.title, 'Alpha');

  await pool.end();
});

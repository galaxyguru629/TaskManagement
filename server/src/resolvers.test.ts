import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql, parse, subscribe } from 'graphql';
import type { Pool } from 'pg';
import { DataType, newDb } from 'pg-mem';
import type { AuthUser } from './auth/auth.js';
import type { BoardEvent, TaskEvent } from './domain/repository.js';
import { TaskEventType } from './types.js';

process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.HOST = '127.0.0.1';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.DATABASE_SSL = 'false';
process.env.AUTH0_DOMAIN = 'example.auth0.com';
process.env.AUTH0_AUDIENCE = 'https://task-dashboard-api';

const { authenticateHeader, setJwtVerifierForTests } = await import('./auth/auth.js');
const { createExecutableTaskSchema } = await import('./resolvers.js');

const user: AuthUser = {
  id: 'auth0|integration-user',
  name: 'Integration User',
  email: 'integration@example.com',
  pictureUrl: null,
  emailVerified: true,
};

const unverifiedUser: AuthUser = {
  ...user,
  id: 'auth0|unverified',
  email: 'unverified@example.com',
  emailVerified: false,
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
      is_onboarded boolean NOT NULL DEFAULT true,
      last_seen_at timestamptz,
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
    CREATE TABLE board_invitations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      email text NOT NULL,
      role text NOT NULL CHECK (role IN ('ADMIN', 'MEMBER')),
      status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED')),
      invited_by text NOT NULL,
      accepted_by text,
      expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO boards (id, title, updated_by) VALUES ('00000000-0000-4000-8000-000000000001', 'Test Board', 'system');
    INSERT INTO task_lists (id, board_id, title, position, updated_by)
    VALUES
      ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'To Do', 1024, 'system'),
      ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'In Progress', 2048, 'system'),
      ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'Done', 3072, 'system');
    INSERT INTO board_members (board_id, auth0_sub, role, invited_by)
    VALUES ('00000000-0000-4000-8000-000000000001', 'auth0|integration-user', 'OWNER', 'auth0|integration-user');
  `);
  return pool;
}

async function completeProfile(pool: Pool, displayName = 'Profile Name'): Promise<void> {
  await pool.query(
    `
      INSERT INTO user_profiles (auth0_sub, display_name, email, picture_url)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (auth0_sub) DO UPDATE SET display_name = excluded.display_name
    `,
    [user.id, displayName, user.email, user.pictureUrl],
  );
  await pool.query(
    `
      INSERT INTO board_members (board_id, auth0_sub, role, invited_by)
      VALUES ('00000000-0000-4000-8000-000000000001', $1, 'OWNER', $1)
      ON CONFLICT (board_id, auth0_sub) DO NOTHING
    `,
    [user.id],
  );
}

function emptyStreams() {
  return {
    subscribeTasks: async function* (): AsyncIterable<{ taskChanged: TaskEvent }> {},
    subscribeBoard: async function* (): AsyncIterable<{ boardChanged: BoardEvent }> {},
  };
}

test('authenticateHeader accepts a valid mocked Auth0 JWT payload', async () => {
  setJwtVerifierForTests(async (token) => {
    assert.equal(token, 'valid-token');
    return {
      sub: user.id,
      name: user.name,
      email: user.email,
      picture: user.pictureUrl,
      email_verified: true,
      aud: 'https://task-dashboard-api',
      iss: 'https://example.auth0.com/',
    };
  });

  const authenticated = await authenticateHeader('Bearer valid-token');
  assert.deepEqual(authenticated, user);
  setJwtVerifierForTests(null);
});

test('authenticateHeader rejects token payloads without subjects', async () => {
  setJwtVerifierForTests(async () => ({
    name: 'Missing Subject',
    aud: 'https://task-dashboard-api',
    iss: 'https://example.auth0.com/',
  }));

  await assert.rejects(() => authenticateHeader('Bearer no-sub'), /Invalid or expired token/);
  setJwtVerifierForTests(null);
});

test('task queries reject unauthenticated GraphQL context', async () => {
  const pool = await createTestPool();
  const schema = createExecutableTaskSchema({
    db: pool,
    publishTaskEvent: async () => undefined,
    publishBoardEvent: async () => undefined,
    taskEvents: emptyStreams(),
  });

  const result = await graphql({
    schema,
    source: '{ tasks { totalCount } }',
    contextValue: { user: null },
  });

  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
  await pool.end();
});

test('me auto-creates profile shell and stores email before onboarding', async () => {
  const pool = await createTestPool();
  const schema = createExecutableTaskSchema({
    db: pool,
    publishTaskEvent: async () => undefined,
    publishBoardEvent: async () => undefined,
    taskEvents: emptyStreams(),
  });

  const before = await graphql({
    schema,
    source: '{ me { displayName email isOnboarded } }',
    contextValue: { user },
  });
  assert.ifError(before.errors?.[0]);
  const meBefore = (before.data as { me: { displayName: string; email: string; isOnboarded: boolean } }).me;
  assert.equal(meBefore.email, user.email);
  assert.equal(meBefore.isOnboarded, false);

  const saved = await graphql({
    schema,
    source: 'mutation { updateMyProfile(input: { displayName: "  Board Operator  " }) { auth0Sub displayName email } }',
    contextValue: { user },
  });
  assert.ifError(saved.errors?.[0]);
  const savedProfile = (saved.data as { updateMyProfile: { auth0Sub: string; displayName: string; email: string } }).updateMyProfile;
  assert.equal(savedProfile.auth0Sub, user.id);
  assert.equal(savedProfile.displayName, 'Board Operator');
  assert.equal(savedProfile.email, user.email);

  const after = await graphql({
    schema,
    source: '{ me { displayName isOnboarded } }',
    contextValue: { user },
  });
  const meAfter = (after.data as { me: { displayName: string; isOnboarded: boolean } }).me;
  assert.equal(meAfter.displayName, 'Board Operator');
  assert.equal(meAfter.isOnboarded, true);
  await pool.end();
});

test('updateMyProfile rejects empty and overlong display names', async () => {
  const pool = await createTestPool();
  const schema = createExecutableTaskSchema({
    db: pool,
    publishTaskEvent: async () => undefined,
    publishBoardEvent: async () => undefined,
    taskEvents: emptyStreams(),
  });

  const empty = await graphql({
    schema,
    source: 'mutation { updateMyProfile(input: { displayName: "   " }) { displayName } }',
    contextValue: { user },
  });
  assert.equal(empty.errors?.[0]?.extensions?.code, 'BAD_USER_INPUT');

  const long = await graphql({
    schema,
    source: `mutation { updateMyProfile(input: { displayName: "${'A'.repeat(81)}" }) { displayName } }`,
    contextValue: { user },
  });
  assert.equal(long.errors?.[0]?.extensions?.code, 'BAD_USER_INPUT');
  await pool.end();
});

test('board operations reject authenticated users without completed profiles', async () => {
  const pool = await createTestPool();
  const schema = createExecutableTaskSchema({
    db: pool,
    publishTaskEvent: async () => undefined,
    publishBoardEvent: async () => undefined,
    taskEvents: emptyStreams(),
  });

  const result = await graphql({
    schema,
    source: '{ defaultBoard { id } }',
    contextValue: { user },
  });

  assert.equal(result.errors?.[0]?.extensions?.code, 'PROFILE_REQUIRED');
  await pool.end();
});

test('unverified users can proceed to profile onboarding until verification flow is enabled', async () => {
  const pool = await createTestPool();
  const schema = createExecutableTaskSchema({
    db: pool,
    publishTaskEvent: async () => undefined,
    publishBoardEvent: async () => undefined,
    taskEvents: emptyStreams(),
  });
  const result = await graphql({
    schema,
    source: '{ defaultBoard { id } }',
    contextValue: { user: unverifiedUser },
  });
  assert.equal(result.errors?.[0]?.extensions?.code, 'PROFILE_REQUIRED');
  await pool.end();
});

test('authenticated CRUD mutations return conflict-aware GraphQL shapes', async () => {
  const pool = await createTestPool();
  await completeProfile(pool, 'Stored Display Name');
  const events: TaskEvent[] = [];
  const boardEvents: BoardEvent[] = [];
  const schema = createExecutableTaskSchema({
    db: pool,
    publishTaskEvent: async (event) => {
      events.push(event);
    },
    publishBoardEvent: async (event) => {
      boardEvents.push(event);
    },
    taskEvents: emptyStreams(),
  });

  const created = await graphql({
    schema,
    source: 'mutation { createTask(input: { title: "GraphQL task", priority: 2 }) { id title version } }',
    contextValue: { user },
  });
  assert.ifError(created.errors?.[0]);

  const createdTask = (created.data as { createTask: { id: string; version: number } }).createTask;
  const updated = await graphql({
    schema,
    source:
      'mutation($id: ID!, $version: Int!) { updateTask(id: $id, expectedVersion: $version, input: { title: "Updated" }) { success conflict task { title version } } }',
    variableValues: { id: createdTask.id, version: createdTask.version },
    contextValue: { user },
  });
  assert.ifError(updated.errors?.[0]);
  const updateResult = (updated.data as { updateTask: { success: boolean; conflict: boolean } }).updateTask;
  assert.equal(updateResult.success, true);
  assert.equal(updateResult.conflict, false);

  const staleDelete = await graphql({
    schema,
    source:
      'mutation($id: ID!, $version: Int!) { deleteTask(id: $id, expectedVersion: $version) { success conflict task { id version } } }',
    variableValues: { id: createdTask.id, version: createdTask.version },
    contextValue: { user },
  });
  assert.ifError(staleDelete.errors?.[0]);
  assert.equal((staleDelete.data as { deleteTask: { conflict: boolean } }).deleteTask.conflict, true);
  assert.deepEqual(
    events.map((event) => event.type),
    [TaskEventType.CREATED, TaskEventType.UPDATED],
  );
  assert.equal(boardEvents[0]?.actorName, 'Stored Display Name');

  const comment = await graphql({
    schema,
    source: 'mutation($id: ID!) { addComment(taskId: $id, body: "Looks good") { author body } }',
    variableValues: { id: createdTask.id },
    contextValue: { user },
  });
  assert.ifError(comment.errors?.[0]);
  assert.equal((comment.data as { addComment: { author: string } }).addComment.author, 'Stored Display Name');

  await pool.end();
});

test('non-members cannot access board details', async () => {
  const pool = await createTestPool();
  await completeProfile(pool, 'Stored Display Name');
  const schema = createExecutableTaskSchema({
    db: pool,
    publishTaskEvent: async () => undefined,
    publishBoardEvent: async () => undefined,
    taskEvents: emptyStreams(),
  });
  await pool.query(
    `
      INSERT INTO user_profiles (auth0_sub, display_name, email, picture_url)
      VALUES ('auth0|other-user', 'Other User', 'other@example.com', null)
    `,
  );
  const outsider: AuthUser = {
    id: 'auth0|other-user',
    name: 'Other User',
    email: 'other@example.com',
    pictureUrl: null,
    emailVerified: true,
  };
  const result = await graphql({
    schema,
    source: '{ board(id: "00000000-0000-4000-8000-000000000001") { id } }',
    contextValue: { user: outsider },
  });
  assert.equal((result.data as { board: null }).board, null);
  await pool.end();
});

test('non-members cannot read task data from other boards', async () => {
  const pool = await createTestPool();
  await completeProfile(pool, 'Stored Display Name');
  const schema = createExecutableTaskSchema({
    db: pool,
    publishTaskEvent: async () => undefined,
    publishBoardEvent: async () => undefined,
    taskEvents: emptyStreams(),
  });
  const created = await graphql({
    schema,
    source: 'mutation { createTask(input: { title: "Secret task", priority: 2 }) { id } }',
    contextValue: { user },
  });
  assert.ifError(created.errors?.[0]);
  const taskId = (created.data as { createTask: { id: string } }).createTask.id;

  await pool.query(
    `INSERT INTO user_profiles (auth0_sub, display_name, email, picture_url) VALUES ($1, $2, $3, $4)`,
    ['auth0|outsider-task', 'Outsider', 'outsider@example.com', null],
  );
  const outsider: AuthUser = {
    id: 'auth0|outsider-task',
    name: 'Outsider',
    email: 'outsider@example.com',
    pictureUrl: null,
    emailVerified: true,
  };

  const taskResult = await graphql({
    schema,
    source: 'query($id: ID!) { task(id: $id) { id } }',
    variableValues: { id: taskId },
    contextValue: { user: outsider },
  });
  assert.equal((taskResult.data as { task: null }).task, null);

  const tasksResult = await graphql({
    schema,
    source: '{ tasks { totalCount nodes { id } } }',
    contextValue: { user: outsider },
  });
  assert.equal((tasksResult.data as { tasks: { totalCount: number } }).tasks.totalCount, 0);

  await pool.end();
});

test('updateTask rejects assignees who are not board members', async () => {
  const pool = await createTestPool();
  await completeProfile(pool);
  const schema = createExecutableTaskSchema({
    db: pool,
    publishTaskEvent: async () => undefined,
    publishBoardEvent: async () => undefined,
    taskEvents: emptyStreams(),
  });

  const created = await graphql({
    schema,
    source: 'mutation { createTask(input: { title: "Assignee test" }) { id version } }',
    contextValue: { user },
  });
  assert.ifError(created.errors?.[0]);
  const task = (created.data as { createTask: { id: string; version: number } }).createTask;

  const rejected = await graphql({
    schema,
    source:
      'mutation($id: ID!, $version: Int!, $assignees: [String!]) { updateTask(id: $id, expectedVersion: $version, input: { assignees: $assignees }) { success } }',
    variableValues: { id: task.id, version: task.version, assignees: ['auth0|stranger'] },
    contextValue: { user },
  });
  assert.equal(rejected.errors?.[0]?.extensions?.code, 'BAD_USER_INPUT');

  const accepted = await graphql({
    schema,
    source:
      'mutation($id: ID!, $version: Int!, $assignees: [String!]) { updateTask(id: $id, expectedVersion: $version, input: { assignees: $assignees }) { success conflict task { assignees version } } }',
    variableValues: { id: task.id, version: task.version, assignees: [user.id] },
    contextValue: { user },
  });
  assert.ifError(accepted.errors?.[0]);
  const result = (accepted.data as { updateTask: { success: boolean; task: { assignees: string[] } } }).updateTask;
  assert.equal(result.success, true);
  assert.deepEqual(result.task.assignees, [user.id]);

  await pool.end();
});

test('createChecklistItem returns checklist item for board task', async () => {
  const pool = await createTestPool();
  await completeProfile(pool);
  const schema = createExecutableTaskSchema({
    db: pool,
    publishTaskEvent: async () => undefined,
    publishBoardEvent: async () => undefined,
    taskEvents: emptyStreams(),
  });

  const created = await graphql({
    schema,
    source: 'mutation { createTask(input: { title: "Checklist task" }) { id } }',
    contextValue: { user },
  });
  assert.ifError(created.errors?.[0]);
  const taskId = (created.data as { createTask: { id: string } }).createTask.id;

  const checklist = await graphql({
    schema,
    source:
      'mutation($taskId: ID!, $text: String!, $clientMutationId: String) { createChecklistItem(taskId: $taskId, text: $text, clientMutationId: $clientMutationId) { id taskId text checked } }',
    variableValues: { taskId, text: 'Ship checklist', clientMutationId: 'test-checklist' },
    contextValue: { user },
  });
  assert.ifError(checklist.errors?.[0]);
  const item = (checklist.data as { createChecklistItem: { taskId: string; text: string } }).createChecklistItem;
  assert.equal(item.taskId, taskId);
  assert.equal(item.text, 'Ship checklist');

  await pool.end();
});

test('invitation accept flow grants board membership', async () => {
  const pool = await createTestPool();
  await completeProfile(pool, 'Owner');
  const schema = createExecutableTaskSchema({
    db: pool,
    publishTaskEvent: async () => undefined,
    publishBoardEvent: async () => undefined,
    taskEvents: emptyStreams(),
  });

  const invite = await graphql({
    schema,
    source:
      'mutation($input: InviteMemberInput!) { inviteMember(input: $input) { id boardId email role status } }',
    variableValues: {
      input: {
        boardId: '00000000-0000-4000-8000-000000000001',
        email: 'invitee@example.com',
        role: 'MEMBER',
      },
    },
    contextValue: { user },
  });
  assert.ifError(invite.errors?.[0]);
  const invitationId = (invite.data as { inviteMember: { id: string } }).inviteMember.id;

  const invitee: AuthUser = {
    id: 'auth0|invitee',
    name: 'Invitee',
    email: 'invitee@example.com',
    pictureUrl: null,
    emailVerified: true,
  };
  await pool.query(
    `INSERT INTO user_profiles (auth0_sub, display_name, email, picture_url) VALUES ($1, $2, $3, $4)`,
    [invitee.id, 'Invitee', invitee.email, null],
  );

  const accepted = await graphql({
    schema,
    source: 'mutation($id: ID!) { acceptInvitation(id: $id) { id status acceptedBy } }',
    variableValues: { id: invitationId },
    contextValue: { user: invitee },
  });
  assert.ifError(accepted.errors?.[0]);
  assert.equal((accepted.data as { acceptInvitation: { status: string } }).acceptInvitation.status, 'ACCEPTED');

  const memberList = await graphql({
    schema,
    source: 'query($boardId: ID!) { boardMembers(boardId: $boardId) { auth0Sub role } }',
    variableValues: { boardId: '00000000-0000-4000-8000-000000000001' },
    contextValue: { user },
  });
  assert.ifError(memberList.errors?.[0]);
  const members = (memberList.data as { boardMembers: Array<{ auth0Sub: string }> }).boardMembers;
  assert.equal(members.some((member) => member.auth0Sub === invitee.id), true);
  await pool.end();
});

test('createBoard stores immutable creator identity', async () => {
  const pool = await createTestPool();
  await completeProfile(pool, 'Owner');
  const schema = createExecutableTaskSchema({
    db: pool,
    publishTaskEvent: async () => undefined,
    publishBoardEvent: async () => undefined,
    taskEvents: emptyStreams(),
  });
  const result = await graphql({
    schema,
    source: 'mutation { createBoard(input: { title: "Creator board" }) { id createdByAuth0Sub } }',
    contextValue: { user },
  });
  assert.ifError(result.errors?.[0]);
  assert.equal((result.data as { createBoard: { createdByAuth0Sub: string } }).createBoard.createdByAuth0Sub, user.id);
  await pool.end();
});

test('taskChanged subscriptions reject missing auth and yield events when authenticated', async () => {
  const pool = await createTestPool();
  await completeProfile(pool);
  const task = await import('./domain/repository.js').then((repo) => repo.createTask(pool, { title: 'Event task' }, user));
  const event: TaskEvent = { type: TaskEventType.CREATED, task };
  const schema = createExecutableTaskSchema({
    db: pool,
    publishTaskEvent: async () => undefined,
    publishBoardEvent: async () => undefined,
    taskEvents: {
      subscribeTasks: async function* () {
        yield { taskChanged: event };
      },
      subscribeBoard: async function* () {},
    },
  });
  const document = parse('subscription { taskChanged { type task { id title } } }');

  const rejected = await subscribe({
    schema,
    document,
    contextValue: { user: null },
  });
  assert.equal(Symbol.asyncIterator in rejected, false);
  if (!('next' in rejected)) {
    assert.equal(rejected.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
  }

  const accepted = await subscribe({
    schema,
    document,
    contextValue: { user },
  });
  assert.equal(Symbol.asyncIterator in accepted, true);
  if (Symbol.asyncIterator in accepted) {
    const next = await accepted[Symbol.asyncIterator]().next();
    assert.equal(next.done, false);
    const value = next.value as { data?: { taskChanged: { type: TaskEventType; task: { title: string } } } };
    assert.equal(value.data?.taskChanged.type, TaskEventType.CREATED);
    assert.equal(value.data?.taskChanged.task.title, 'Event task');
  }

  await pool.end();
});

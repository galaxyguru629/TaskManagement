import { GraphQLError } from 'graphql';
import type { AuthUser } from '../auth/auth.js';
import type { DbClient } from '../db/pool.js';
import { BoardRole, CreateTaskInput, UpdateTaskInput, MoveTaskInput, type Task } from '../types.js';
import { SqlBuilder } from './helpers/sql-builder.js';
import { cleanOptional, cleanTitle, cleanPriority, cleanColor } from './helpers/validators.js';
import { toTask, toChecklist, toComment, actor } from './helpers/mappers.js';
import type { TaskRow, ChecklistRow, CommentRow } from './helpers/db-types.js';
import { loadAssigneesForTasks, replaceTaskAssignees, assertAssigneesAreBoardMembers, normalizeAssigneeList } from './task-assignee.repository.js';
import { recordActivity } from './activity.repository.js';
import { getDefaultBoard } from './board.repository.js';

export { loadAssigneesForTasks };

export interface TaskMutationResult {
  task: Task | null;
  conflict: boolean;
}

export interface TaskListResult {
  nodes: Task[];
  totalCount: number;
}

export interface TaskEvent {
  type: string;
  task: Task;
}

const SORT_FIELDS: Record<string, string> = {
  title: 'title',
  priority: 'priority',
  assignee: 'assignee',
  position: 'position',
  updatedAt: 'updated_at',
};

function listWhere(filter: { search?: string | null } | null | undefined): { sql: string; values: unknown[] } {
  const clauses = ['archived = false'];
  const values: unknown[] = [];
  const search = filter?.search?.trim();
  if (search) {
    values.push(search);
    const param = `$${values.length}`;
    clauses.push(`(
      title ILIKE '%' || ${param} || '%'
      OR coalesce(description, '') ILIKE '%' || ${param} || '%'
      OR coalesce(assignee, '') ILIKE '%' || ${param} || '%'
    )`);
  }
  return { sql: `WHERE ${clauses.join(' AND ')}`, values };
}

function orderBy(sort: Array<{ field: string; direction: string }> | null | undefined): string {
  const rules = sort?.length ? sort : [{ field: 'position', direction: 'ASC' }];
  const clauses = rules.map((rule) => {
    const column = SORT_FIELDS[rule.field] ?? SORT_FIELDS.position;
    const direction = rule.direction === 'DESC' ? 'DESC' : 'ASC';
    return `${column} ${direction} NULLS LAST`;
  });
  return `ORDER BY ${clauses.join(', ')}, id ASC`;
}

export async function getTask(db: DbClient, id: string): Promise<Task | null> {
  const result = await db.query<TaskRow>(
    `SELECT id, board_id, list_id, title, description, priority, assignee, position, due_date, cover_color, archived, version, updated_at
     FROM tasks WHERE id = $1`,
    [id],
  );
  if (!result.rows[0]) return null;
  const assignees = (await loadAssigneesForTasks(db, [id])).get(id) ?? [];
  return toTask(result.rows[0], assignees);
}

export async function getTaskForUser(db: DbClient, id: string, userSub: string): Promise<Task | null> {
  const result = await db.query<TaskRow>(
    `SELECT t.id, t.board_id, t.list_id, t.title, t.description, t.priority, t.assignee, t.position, t.due_date, t.cover_color, t.archived, t.version, t.updated_at
     FROM tasks t
     JOIN board_members bm ON bm.board_id = t.board_id
     WHERE t.id = $1 AND bm.auth0_sub = $2`,
    [id, userSub],
  );
  if (!result.rows[0]) return null;
  const assignees = (await loadAssigneesForTasks(db, [id])).get(id) ?? [];
  return toTask(result.rows[0], assignees);
}

async function resolveCreateTarget(db: DbClient, input: CreateTaskInput): Promise<{ boardId: string; listId: string; position: number }> {
  const boardId = input.boardId ?? (await getDefaultBoard(db))?.id;
  if (!boardId) {
    throw new GraphQLError('A board is required before creating cards.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  const listResult = await db.query<{ id: string; board_id: string; title: string; position: number; archived: boolean; version: number; created_at: Date; updated_at: Date }>(
    `SELECT id, board_id, title, position, archived, version, created_at, updated_at
     FROM task_lists
     WHERE board_id = $1 AND archived = false AND ($2::uuid IS NULL OR id = $2::uuid)
     ORDER BY position ASC
     LIMIT 1`,
    [boardId, input.listId ?? null],
  );
  const list = listResult.rows[0] ?? null;
  if (!list) {
    throw new GraphQLError('Target list was not found.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  const positionResult = await db.query<{ next_position: string }>(
    'SELECT coalesce(max(position), 0) + 1024 AS next_position FROM tasks WHERE list_id = $1 AND archived = false',
    [list.id],
  );
  return {
    boardId,
    listId: list.id,
    position: input.position ?? Number(positionResult.rows[0]?.next_position ?? 1024),
  };
}

export async function createTask(db: DbClient, input: CreateTaskInput, user: AuthUser): Promise<Task> {
  const target = await resolveCreateTarget(db, input);
  const assignees = normalizeAssigneeList(input.assignees);
  await assertAssigneesAreBoardMembers(db, target.boardId, assignees);
  const result = await db.query<TaskRow>(
    `INSERT INTO tasks (board_id, list_id, title, description, priority, assignee, position, due_date, cover_color, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, board_id, list_id, title, description, priority, assignee, position, due_date, cover_color, archived, version, updated_at`,
    [
      target.boardId, target.listId, cleanTitle(input.title), cleanOptional(input.description),
      cleanPriority(input.priority), assignees[0] ?? null, target.position,
      input.dueDate ?? null, cleanColor(input.coverColor), actor(user),
    ],
  );
  const task = toTask(result.rows[0], assignees);
  await replaceTaskAssignees(db, task.id, assignees);
  void recordActivity(db, task.boardId, task.id, 'CARD_CREATED', `created "${task.title}"`, user)
    .catch((err) => console.error('Activity recording failed:', err));
  return task;
}

export async function updateTask(
  db: DbClient,
  id: string,
  input: UpdateTaskInput,
  expectedVersion: number | null | undefined,
  user: AuthUser,
): Promise<TaskMutationResult> {
  const sql = new SqlBuilder();

  sql.addOptional('list_id', input.listId);
  sql.addOptional('title', input.title, (v) => cleanTitle(v as string));
  sql.addOptional('description', input.description, (v) => cleanOptional(v as string | null | undefined));
  sql.addOptional('priority', input.priority, (v) => cleanPriority(v as number | null | undefined));

  let assigneesToSet: string[] | null = null;
  if (input.assignees !== undefined) {
    assigneesToSet = normalizeAssigneeList(input.assignees);
  }

  sql.addOptional('position', input.position);
  sql.addOptional('due_date', input.dueDate);
  sql.addOptional('cover_color', input.coverColor, (v) => cleanColor(v as string | null | undefined));

  if (input.archived !== undefined && input.archived !== null) {
    sql.add('archived', input.archived);
  }

  if (assigneesToSet !== null) {
    sql.add('assignee', assigneesToSet[0] ?? null);
  }

  if (!sql.hasSets) {
    const current = await getTask(db, id);
    return { task: current, conflict: false };
  }

  if (assigneesToSet !== null) {
    const boardIdResult = await db.query<{ board_id: string }>('SELECT board_id FROM tasks WHERE id = $1', [id]);
    const boardId = boardIdResult.rows[0]?.board_id;
    if (!boardId) {
      throw new GraphQLError('Task not found.', { extensions: { code: 'NOT_FOUND' } });
    }
    await assertAssigneesAreBoardMembers(db, boardId, assigneesToSet);
  }

  sql.add('updated_by', actor(user));
  sql.sets.push('version = version + 1', 'updated_at = now()');

  const allValues = [...sql.values, id];
  const idParam = sql.values.length + 1;
  let where = `id = $${idParam}`;
  if (expectedVersion != null) {
    allValues.push(expectedVersion);
    where += ` AND version = $${idParam + 1}`;
  }

  const result = await db.query<TaskRow>(
    `UPDATE tasks
     SET ${sql.setClause}
     WHERE ${where}
     RETURNING id, board_id, list_id, title, description, priority, assignee, position, due_date, cover_color, archived, version, updated_at`,
    allValues,
  );
  if (result.rows[0]) {
    if (assigneesToSet !== null) {
      await replaceTaskAssignees(db, id, assigneesToSet);
    }
    const assignees = assigneesToSet ?? (await loadAssigneesForTasks(db, [id])).get(id) ?? [];
    const task = toTask(result.rows[0], assignees);
    void recordActivity(db, task.boardId, task.id, input.archived ? 'CARD_ARCHIVED' : 'CARD_UPDATED', `updated "${task.title}"`, user)
      .catch((err) => console.error('Activity recording failed:', err));
    return { task, conflict: false };
  }
  const current = await getTask(db, id);
  return { task: current, conflict: Boolean(current && expectedVersion != null) };
}

export async function moveTask(db: DbClient, input: MoveTaskInput, user: AuthUser): Promise<TaskMutationResult> {
  const list = await db.query<{ id: string; board_id: string }>('SELECT id, board_id FROM task_lists WHERE id = $1', [input.toListId]);
  if (!list.rows[0] || list.rows[0].board_id !== input.boardId) {
    throw new GraphQLError('Target list was not found.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  return updateTask(db, input.taskId, { listId: input.toListId, position: input.position }, input.expectedVersion, user);
}

export async function deleteTask(db: DbClient, id: string, expectedVersion: number | null | undefined, user: AuthUser): Promise<TaskMutationResult> {
  return updateTask(db, id, { archived: true }, expectedVersion, user);
}

export async function listTasks(
  db: DbClient,
  page: number,
  pageSize: number,
  filter?: { search?: string | null } | null,
  sort?: Array<{ field: string; direction: string }> | null,
): Promise<TaskListResult> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const offset = (safePage - 1) * safePageSize;
  const where = listWhere(filter);
  const count = await db.query<{ count: string }>(`SELECT count(*)::text AS count FROM tasks ${where.sql}`, where.values);
  const rows = await db.query<TaskRow>(
    `SELECT id, board_id, list_id, title, description, priority, assignee, position, due_date, cover_color, archived, version, updated_at
     FROM tasks ${where.sql} ${orderBy(sort)}
     LIMIT $${where.values.length + 1} OFFSET $${where.values.length + 2}`,
    [...where.values, safePageSize, offset],
  );
  const assigneesByTask = await loadAssigneesForTasks(db, rows.rows.map((row) => row.id));
  return {
    nodes: rows.rows.map((row) => toTask(row, assigneesByTask.get(row.id) ?? [])),
    totalCount: Number(count.rows[0]?.count ?? 0),
  };
}

export async function listTasksForUser(
  db: DbClient,
  userSub: string,
  page: number,
  pageSize: number,
  filter?: { search?: string | null } | null,
  sort?: Array<{ field: string; direction: string }> | null,
): Promise<TaskListResult> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const offset = (safePage - 1) * safePageSize;
  const where = listWhere(filter);
  const count = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count
     FROM tasks t JOIN board_members bm ON bm.board_id = t.board_id
     WHERE bm.auth0_sub = $1 AND ${where.sql.replace(/^WHERE\s+/i, '')}`,
    [userSub, ...where.values],
  );
  const rows = await db.query<TaskRow>(
    `SELECT t.id, t.board_id, t.list_id, t.title, t.description, t.priority, t.assignee, t.position, t.due_date, t.cover_color, t.archived, t.version, t.updated_at
     FROM tasks t JOIN board_members bm ON bm.board_id = t.board_id
     WHERE bm.auth0_sub = $1 AND ${where.sql.replace(/^WHERE\s+/i, '')}
     ${orderBy(sort)}
     LIMIT $${where.values.length + 2} OFFSET $${where.values.length + 3}`,
    [userSub, ...where.values, safePageSize, offset],
  );
  const assigneesByTask = await loadAssigneesForTasks(db, rows.rows.map((row) => row.id));
  return {
    nodes: rows.rows.map((row) => toTask(row, assigneesByTask.get(row.id) ?? [])),
    totalCount: Number(count.rows[0]?.count ?? 0),
  };
}

export async function setTaskLabels(db: DbClient, taskId: string, labelIds: string[], user: AuthUser): Promise<Task | null> {
  const task = await getTask(db, taskId);
  if (!task) return null;
  await db.query('DELETE FROM task_labels WHERE task_id = $1', [taskId]);
  for (const labelId of labelIds) {
    await db.query('INSERT INTO task_labels (task_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [taskId, labelId]);
  }
  await recordActivity(db, task.boardId, taskId, 'LABEL_UPDATED', `updated labels on "${task.title}"`, user);
  return getTask(db, taskId);
}

export async function createChecklistItem(db: DbClient, taskId: string, text: string, user: AuthUser): Promise<import('../types.js').ChecklistItem> {
  const taskMeta = await db.query<{ board_id: string; title: string }>('SELECT board_id, title FROM tasks WHERE id = $1', [taskId]);
  const meta = taskMeta.rows[0];
  if (!meta) throw new GraphQLError('Task not found.', { extensions: { code: 'BAD_USER_INPUT' } });
  const position = await db.query<{ next_position: string }>(
    'SELECT coalesce(max(position), 0) + 1024 AS next_position FROM checklist_items WHERE task_id = $1',
    [taskId],
  );
  const result = await db.query<import('./helpers/db-types.js').ChecklistRow>(
    'INSERT INTO checklist_items (task_id, text, position) VALUES ($1, $2, $3) RETURNING id, task_id, text, checked, position',
    [taskId, cleanTitle(text, 'Checklist item'), Number(position.rows[0]?.next_position ?? 1024)],
  );
  void recordActivity(db, meta.board_id, taskId, 'CHECKLIST_UPDATED', `added a checklist item to "${meta.title}"`, user)
    .catch((err) => console.error('Activity recording failed:', err));
  return toChecklist(result.rows[0]);
}

export async function updateChecklistItem(db: DbClient, id: string, text: string | null | undefined, checked: boolean | null | undefined, user: AuthUser): Promise<import('../types.js').ChecklistItem | null> {
  const current = await db.query<{ task_id: string; board_id: string; title: string }>(
    'SELECT ci.task_id, t.board_id, t.title FROM checklist_items ci JOIN tasks t ON t.id = ci.task_id WHERE ci.id = $1',
    [id],
  );
  if (!current.rows[0]) return null;
  const sql = new SqlBuilder();
  sql.addSkipNull('text', text, (v) => cleanTitle(v as string, 'Checklist item'));
  sql.addSkipNull('checked', checked);
  if (!sql.hasSets) return null;
  const result = await db.query<import('./helpers/db-types.js').ChecklistRow>(
    `UPDATE checklist_items SET ${sql.setClause} WHERE id = $${sql.values.length + 1} RETURNING id, task_id, text, checked, position`,
    [...sql.values, id],
  );
  void recordActivity(db, current.rows[0].board_id, current.rows[0].task_id, 'CHECKLIST_UPDATED', `updated checklist on "${current.rows[0].title}"`, user)
    .catch((err) => console.error('Activity recording failed:', err));
  return result.rows[0] ? toChecklist(result.rows[0]) : null;
}

export async function addComment(db: DbClient, taskId: string, body: string, user: AuthUser): Promise<import('../types.js').TaskComment> {
  const taskMeta = await db.query<{ board_id: string; title: string }>('SELECT board_id, title FROM tasks WHERE id = $1', [taskId]);
  const meta = taskMeta.rows[0];
  if (!meta) throw new GraphQLError('Task not found.', { extensions: { code: 'BAD_USER_INPUT' } });
  const result = await db.query<import('./helpers/db-types.js').CommentRow>(
    'INSERT INTO task_comments (task_id, body, author) VALUES ($1, $2, $3) RETURNING id, task_id, body, author, created_at',
    [taskId, cleanTitle(body, 'Comment'), actor(user)],
  );
  const comment = toComment(result.rows[0]);
  void recordActivity(db, meta.board_id, taskId, 'COMMENT_CREATED', `commented on "${meta.title}"`, user)
    .catch((err) => console.error('Activity recording failed:', err));
  return comment;
}

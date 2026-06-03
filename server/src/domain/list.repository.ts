import type { AuthUser } from '../auth/auth.js';
import type { DbClient } from '../db/pool.js';
import { CreateListInput, UpdateListInput, TaskList } from '../types.js';
import { SqlBuilder } from './helpers/sql-builder.js';
import { cleanTitle } from './helpers/validators.js';
import { toList, actor } from './helpers/mappers.js';
import type { ListRow } from './helpers/db-types.js';
import { recordActivity } from './activity.repository.js';

export interface ListMutationResult {
  list: TaskList | null;
  conflict: boolean;
}

export async function getList(db: DbClient, id: string): Promise<TaskList | null> {
  const result = await db.query<ListRow>(
    'SELECT id, board_id, title, position, archived, version, created_at, updated_at FROM task_lists WHERE id = $1',
    [id],
  );
  return result.rows[0] ? toList(result.rows[0]) : null;
}

export async function createList(db: DbClient, input: CreateListInput, user: AuthUser): Promise<TaskList> {
  const positionResult = await db.query<{ next_position: string }>(
    'SELECT coalesce(max(position), 0) + 1024 AS next_position FROM task_lists WHERE board_id = $1 AND archived = false',
    [input.boardId],
  );
  const result = await db.query<ListRow>(
    `INSERT INTO task_lists (board_id, title, position, updated_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, board_id, title, position, archived, version, created_at, updated_at`,
    [input.boardId, cleanTitle(input.title, 'List'), input.position ?? Number(positionResult.rows[0]?.next_position ?? 1024), actor(user)],
  );
  const list = toList(result.rows[0]);
  void recordActivity(db, input.boardId, null, 'LIST_CREATED', `created list "${list.title}"`, user)
    .catch((err) => console.error('Activity recording failed:', err));
  return list;
}

export async function updateList(db: DbClient, id: string, input: UpdateListInput, expectedVersion: number | null | undefined, user: AuthUser): Promise<ListMutationResult> {
  const sql = new SqlBuilder();

  sql.addSkipNull('title', input.title, (v) => cleanTitle(v as string, 'List'));
  sql.addOptional('position', input.position);
  if (input.archived !== undefined && input.archived !== null) {
    sql.add('archived', input.archived);
  }

  if (!sql.hasSets) return { list: await getList(db, id), conflict: false };

  sql.add('updated_by', actor(user));
  sql.sets.push('version = version + 1', 'updated_at = now()');

  const allValues = [...sql.values, id];
  const idParam = sql.values.length + 1;
  let where = `id = $${idParam}`;
  if (expectedVersion != null) {
    allValues.push(expectedVersion);
    where += ` AND version = $${idParam + 1}`;
  }

  const result = await db.query<ListRow>(
    `UPDATE task_lists SET ${sql.setClause} WHERE ${where} RETURNING id, board_id, title, position, archived, version, created_at, updated_at`,
    allValues,
  );
  if (result.rows[0]) {
    const list = toList(result.rows[0]);
    void recordActivity(db, list.boardId, null, list.archived ? 'LIST_ARCHIVED' : 'LIST_UPDATED', `updated list "${list.title}"`, user)
      .catch((err) => console.error('Activity recording failed:', err));
    return { list, conflict: false };
  }
  return { list: await getList(db, id), conflict: expectedVersion != null };
}

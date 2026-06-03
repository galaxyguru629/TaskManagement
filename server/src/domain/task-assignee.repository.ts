import { GraphQLError } from 'graphql';
import type { DbClient } from '../db/pool.js';
import { normalizeAssigneeList } from './helpers/validators.js';

export { normalizeAssigneeList };

export async function loadAssigneesForTasks(db: DbClient, taskIds: string[]): Promise<Map<string, string[]>> {
  if (!taskIds.length) return new Map();
  const result = await db.query<{ task_id: string; auth0_sub: string }>(
    `SELECT task_id, auth0_sub
     FROM task_assignees
     WHERE task_id = ANY($1::uuid[])
     ORDER BY created_at ASC`,
    [taskIds],
  );
  const map = new Map<string, string[]>();
  for (const row of result.rows) {
    map.set(row.task_id, [...(map.get(row.task_id) ?? []), row.auth0_sub]);
  }
  return map;
}

export async function replaceTaskAssignees(db: DbClient, taskId: string, assignees: string[]): Promise<void> {
  await db.query('DELETE FROM task_assignees WHERE task_id = $1', [taskId]);
  for (const auth0Sub of assignees) {
    await db.query(
      'INSERT INTO task_assignees (task_id, auth0_sub) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [taskId, auth0Sub],
    );
  }
  await db.query('UPDATE tasks SET assignee = $2 WHERE id = $1', [taskId, assignees[0] ?? null]);
}

export async function assertAssigneesAreBoardMembers(db: DbClient, boardId: string, assignees: string[]): Promise<void> {
  if (!assignees.length) return;
  const result = await db.query<{ ok: number }>(
    'SELECT 1 AS ok FROM board_members WHERE board_id = $1 AND auth0_sub = ANY($2::text[])',
    [boardId, assignees],
  );
  if (result.rows.length !== assignees.length) {
    throw new GraphQLError('All assignees must be board members.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
}

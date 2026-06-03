import type { AuthUser } from '../auth/auth.js';
import type { DbClient } from '../db/pool.js';
import type { ActivityItem } from '../types.js';
import { actor } from './helpers/mappers.js';
import type { ActivityRow } from './helpers/db-types.js';
import { toActivity } from './helpers/mappers.js';

export async function recordActivity(db: DbClient, boardId: string, taskId: string | null, type: string, message: string, user: AuthUser): Promise<ActivityItem> {
  const displayActor = actor(user);
  const recent = await db.query<ActivityRow>(
    `SELECT id, task_id, type, message, actor, created_at
     FROM task_activity
     WHERE board_id = $1
       AND ($2::uuid IS NULL OR task_id = $2::uuid)
       AND type = $3
       AND actor = $4
       AND message = $5
       AND created_at > now() - interval '60 seconds'
     ORDER BY created_at DESC
     LIMIT 1`,
    [boardId, taskId, type, displayActor, message],
  );
  if (recent.rows[0]) {
    return toActivity(recent.rows[0]);
  }

  const result = await db.query<ActivityRow>(
    `INSERT INTO task_activity (board_id, task_id, type, message, actor)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, task_id, type, message, actor, created_at`,
    [boardId, taskId, type, message, displayActor],
  );
  return toActivity(result.rows[0]);
}

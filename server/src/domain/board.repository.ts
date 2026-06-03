import { GraphQLError } from 'graphql';
import { put } from '@vercel/blob';
import type { AuthUser } from '../auth/auth.js';
import { env } from '../config/env.js';
import type { DbClient } from '../db/pool.js';
import {
  Board, BoardView, BoardCard, BoardList, Label, CreateBoardInput, UpdateBoardInput,
  BoardEventType, BoardRole, TaskList, type TaskComment, type ChecklistItem,
} from '../types.js';
import { SqlBuilder } from './helpers/sql-builder.js';
import { cleanOptional, cleanTitle, parseDataImage, extensionForMimeType } from './helpers/validators.js';
import { toBoard, toList, toTask, toLabel, toChecklist, toComment, toActivity, groupBy, actor } from './helpers/mappers.js';
import type { BoardRow, ListRow, TaskRow, LabelRow, ChecklistRow, CommentRow, ActivityRow } from './helpers/db-types.js';
import { loadAssigneesForTasks } from './task-assignee.repository.js';

export function toBoardCard(row: TaskRow, assignees: string[], labels: Label[], checklist: ChecklistItem[], comments: TaskComment[]): BoardCard {
  return {
    ...toTask(row, assignees),
    labels,
    checklist,
    comments,
  };
}

export async function listBoards(db: DbClient): Promise<Board[]> {
  const result = await db.query<BoardRow>(
    'SELECT id, title, description, background, logo_url, created_by_auth0_sub, version, created_at, updated_at FROM boards ORDER BY updated_at DESC',
  );
  return result.rows.map(toBoard);
}

export async function listBoardsForUser(db: DbClient, userSub: string): Promise<Board[]> {
  const result = await db.query<BoardRow>(
    `SELECT b.id, b.title, b.description, b.background, b.logo_url, b.created_by_auth0_sub, b.version, b.created_at, b.updated_at
     FROM boards b
     JOIN board_members bm ON bm.board_id = b.id
     WHERE bm.auth0_sub = $1
     ORDER BY b.updated_at DESC`,
    [userSub],
  );
  return result.rows.map(toBoard);
}

export async function getBoard(db: DbClient, id: string): Promise<Board | null> {
  const result = await db.query<BoardRow>(
    'SELECT id, title, description, background, logo_url, created_by_auth0_sub, version, created_at, updated_at FROM boards WHERE id = $1',
    [id],
  );
  return result.rows[0] ? toBoard(result.rows[0]) : null;
}

export async function getBoardForUser(db: DbClient, id: string, userSub: string): Promise<Board | null> {
  const result = await db.query<BoardRow>(
    `SELECT b.id, b.title, b.description, b.background, b.logo_url, b.created_by_auth0_sub, b.version, b.created_at, b.updated_at
     FROM boards b
     JOIN board_members bm ON bm.board_id = b.id
     WHERE b.id = $1 AND bm.auth0_sub = $2`,
    [id, userSub],
  );
  return result.rows[0] ? toBoard(result.rows[0]) : null;
}

export async function getDefaultBoard(db: DbClient): Promise<Board | null> {
  const result = await db.query<BoardRow>(
    'SELECT id, title, description, background, logo_url, created_by_auth0_sub, version, created_at, updated_at FROM boards ORDER BY created_at ASC LIMIT 1',
  );
  return result.rows[0] ? toBoard(result.rows[0]) : null;
}

export async function getDefaultBoardForUser(db: DbClient, userSub: string): Promise<Board | null> {
  const result = await db.query<BoardRow>(
    `SELECT b.id, b.title, b.description, b.background, b.logo_url, b.created_by_auth0_sub, b.version, b.created_at, b.updated_at
     FROM boards b
     JOIN board_members bm ON bm.board_id = b.id
     WHERE bm.auth0_sub = $1
     ORDER BY b.created_at ASC
     LIMIT 1`,
    [userSub],
  );
  return result.rows[0] ? toBoard(result.rows[0]) : null;
}

export async function getBoardRole(db: DbClient, boardId: string, userSub: string): Promise<BoardRole | null> {
  const result = await db.query<{ role: BoardRole }>('SELECT role FROM board_members WHERE board_id = $1 AND auth0_sub = $2', [boardId, userSub]);
  return result.rows[0]?.role ?? null;
}

export async function listBoardIdsForUser(db: DbClient, userSub: string): Promise<string[]> {
  const result = await db.query<{ board_id: string }>(
    'SELECT bm.board_id FROM board_members bm WHERE bm.auth0_sub = $1',
    [userSub],
  );
  return result.rows.map((row) => row.board_id);
}

export async function createBoard(db: DbClient, input: CreateBoardInput, user: AuthUser): Promise<Board> {
  let background = cleanOptional(input.background) ?? 'linear-gradient(135deg, #0c66e4 0%, #5e4db2 100%)';
  let logoUrl: string | null = null;
  if (input.logoImageData && input.logoImageData.trim()) {
    const parsedImage = parseDataImage(input.logoImageData);
    if (!parsedImage) {
      throw new GraphQLError('Board image must be valid image data.', { extensions: { code: 'BAD_USER_INPUT' } });
    }
    if (!env.blobReadWriteToken) {
      throw new GraphQLError('BLOB_READ_WRITE_TOKEN is required for board image uploads.', { extensions: { code: 'INTERNAL_SERVER_ERROR' } });
    }
    if (parsedImage.data.byteLength > 2_500_000) {
      throw new GraphQLError('Board image must be 2.5 MB or smaller.', { extensions: { code: 'BAD_USER_INPUT' } });
    }
    const extension = extensionForMimeType(parsedImage.mimeType);
    const blob = await put(`boards/${user.id}/${crypto.randomUUID()}.${extension}`, parsedImage.data, {
      access: 'public',
      token: env.blobReadWriteToken,
      contentType: parsedImage.mimeType,
      addRandomSuffix: false,
    });
    logoUrl = blob.url;
  }
  const result = await db.query<BoardRow>(
    `INSERT INTO boards (title, description, background, logo_url, created_by_auth0_sub, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, title, description, background, logo_url, created_by_auth0_sub, version, created_at, updated_at`,
    [cleanTitle(input.title, 'Board'), cleanOptional(input.description), background, logoUrl, user.id, actor(user)],
  );
  const board = toBoard(result.rows[0]);
  await db.query(
    `INSERT INTO board_members (board_id, auth0_sub, role, invited_by)
     VALUES ($1, $2, 'OWNER', $2)
     ON CONFLICT (board_id, auth0_sub) DO NOTHING`,
    [board.id, user.id],
  );
  return board;
}

export async function updateBoard(db: DbClient, id: string, input: UpdateBoardInput, expectedVersion: number | null | undefined, user: AuthUser): Promise<{ board: Board | null; conflict: boolean }> {
  const sql = new SqlBuilder();

  sql.addSkipNull('title', input.title, (v) => cleanTitle(v as string, 'Board'));
  sql.addOptional('description', input.description, (v) => cleanOptional(v as string | null | undefined));
  sql.addOptional('background', input.background, (v) => cleanOptional(v as string | null | undefined) ?? 'linear-gradient(135deg, #0c66e4 0%, #5e4db2 100%)');

  if (!sql.hasSets) return { board: await getBoard(db, id), conflict: false };

  sql.add('updated_by', actor(user));
  sql.sets.push('version = version + 1', 'updated_at = now()');

  const allValues = [...sql.values, id];
  const idParam = sql.values.length + 1;
  let where = `id = $${idParam}`;
  if (expectedVersion != null) {
    allValues.push(expectedVersion);
    where += ` AND version = $${idParam + 1}`;
  }

  const result = await db.query<BoardRow>(
    `UPDATE boards SET ${sql.setClause} WHERE ${where} RETURNING id, title, description, background, created_by_auth0_sub, version, created_at, updated_at`,
    allValues,
  );
  if (result.rows[0]) return { board: toBoard(result.rows[0]), conflict: false };
  return { board: await getBoard(db, id), conflict: expectedVersion != null };
}

export interface BoardEvent {
  type: BoardEventType;
  boardId: string;
  clientMutationId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  task?: import('../types.js').Task | null;
  list?: TaskList | null;
  label?: Label | null;
  comment?: TaskComment | null;
  checklistItem?: ChecklistItem | null;
  activity?: import('../types.js').ActivityItem | null;
}

export async function getBoardView(db: DbClient, boardId: string): Promise<BoardView | null> {
  const board = await getBoard(db, boardId);
  if (!board) return null;

  const listsResult = await db.query<ListRow>(
    'SELECT id, board_id, title, position, archived, version, created_at, updated_at FROM task_lists WHERE board_id = $1 AND archived = false ORDER BY position ASC, created_at ASC',
    [boardId],
  );
  const tasksResult = await db.query<TaskRow>(
    `SELECT id, board_id, list_id, title, description, priority, assignee, position, due_date, cover_color, archived, version, updated_at
     FROM tasks
     WHERE board_id = $1 AND archived = false
     ORDER BY position ASC, updated_at DESC`,
    [boardId],
  );
  const labelsResult = await db.query<LabelRow>('SELECT id, board_id, name, color FROM labels WHERE board_id = $1 ORDER BY name ASC, id ASC', [boardId]);
  const taskLabelsResult = await db.query<{ task_id: string; label_id: string }>(
    `SELECT tl.task_id, tl.label_id
     FROM task_labels tl
     JOIN tasks t ON t.id = tl.task_id
     WHERE t.board_id = $1`,
    [boardId],
  );
  const checklistResult = await db.query<ChecklistRow>(
    `SELECT ci.id, ci.task_id, ci.text, ci.checked, ci.position
     FROM checklist_items ci
     JOIN tasks t ON t.id = ci.task_id
     WHERE t.board_id = $1
     ORDER BY ci.position ASC, ci.created_at ASC`,
    [boardId],
  );
  const commentsResult = await db.query<CommentRow>(
    `SELECT tc.id, tc.task_id, tc.body, tc.author, tc.created_at
     FROM task_comments tc
     JOIN tasks t ON t.id = tc.task_id
     WHERE t.board_id = $1
     ORDER BY tc.created_at DESC`,
    [boardId],
  );
  const activityResult = await db.query<ActivityRow>(
    'SELECT id, task_id, type, message, actor, created_at FROM task_activity WHERE board_id = $1 ORDER BY created_at DESC LIMIT 100',
    [boardId],
  );

  const labels = labelsResult.rows.map(toLabel);
  const labelsById = new Map(labels.map((label) => [label.id, label]));
  const labelIdsByTask = new Map<string, string[]>();
  for (const row of taskLabelsResult.rows) {
    labelIdsByTask.set(row.task_id, [...(labelIdsByTask.get(row.task_id) ?? []), row.label_id]);
  }

  const checklistByTask = groupBy(checklistResult.rows.map(toChecklist), (item) => item.taskId);
  const commentsByTask = groupBy(commentsResult.rows.map(toComment), (comment) => comment.taskId);
  const assigneesByTask = await loadAssigneesForTasks(db, tasksResult.rows.map((row) => row.id));

  const cards = tasksResult.rows.map((row): BoardCard => {
    const task = toTask(row, assigneesByTask.get(row.id) ?? []);
    return {
      ...task,
      labels: (labelIdsByTask.get(task.id) ?? []).map((id) => labelsById.get(id)).filter((label): label is Label => Boolean(label)),
      checklist: checklistByTask.get(task.id) ?? [],
      comments: commentsByTask.get(task.id) ?? [],
    };
  });
  const cardsByList = groupBy(cards, (card) => card.listId);

  return {
    board,
    labels,
    activity: activityResult.rows.map(toActivity),
    lists: listsResult.rows.map((row): BoardList => {
      const list = toList(row);
      return { ...list, cards: cardsByList.get(list.id) ?? [] };
    }),
  };
}

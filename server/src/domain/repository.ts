import { GraphQLError } from 'graphql';
import { put } from '@vercel/blob';
import type { AuthUser } from '../auth/auth.js';
import { env } from '../config/env.js';
import type { DbClient } from '../db/pool.js';
import {
  Board,
  BoardCard,
  BoardEventType,
  BoardList,
  BoardView,
  ChecklistItem,
  CreateBoardInput,
  InviteMemberInput,
  CreateListInput,
  CreateTaskInput,
  InvitationStatus,
  Label,
  MoveTaskInput,
  BoardMember,
  BoardInvitation,
  BoardRole,
  SortDirection,
  Task,
  TaskComment,
  TaskEventType,
  TaskFilterInput,
  TaskList,
  TaskSortInput,
  UpdateBoardInput,
  UpdateListInput,
  UpdateTaskInput,
  UserProfile,
  type ActivityItem,
  type UpdateMyProfileInput,
} from '../types.js';

interface BoardRow {
  id: string;
  title: string;
  description: string | null;
  background: string;
  logo_url: string | null;
  created_by_auth0_sub: string;
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ListRow {
  id: string;
  board_id: string;
  title: string;
  position: string | number;
  archived: boolean;
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface TaskRow {
  id: string;
  board_id: string;
  list_id: string;
  title: string;
  description: string | null;
  priority: number;
  assignee: string | null;
  position: string | number;
  due_date: Date | string | null;
  cover_color: string | null;
  archived: boolean;
  version: number;
  updated_at: Date | string;
}

interface LabelRow {
  id: string;
  board_id: string;
  name: string;
  color: string;
}

interface ChecklistRow {
  id: string;
  task_id: string;
  text: string;
  checked: boolean;
  position: string | number;
}

interface CommentRow {
  id: string;
  task_id: string;
  body: string;
  author: string;
  created_at: Date | string;
}

interface ActivityRow {
  id: string;
  task_id: string | null;
  type: string;
  message: string;
  actor: string;
  created_at: Date | string;
}

interface UserProfileRow {
  auth0_sub: string;
  display_name: string;
  email: string | null;
  picture_url: string | null;
  is_onboarded: boolean;
  last_seen_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface BoardMemberRow {
  board_id: string;
  auth0_sub: string;
  role: BoardRole;
  display_name: string | null;
  email: string | null;
  picture_url: string | null;
  invited_by: string | null;
  created_at: Date | string;
}

interface BoardInvitationRow {
  id: string;
  board_id: string;
  board_title: string;
  board_background: string;
  email: string;
  role: BoardRole;
  status: InvitationStatus;
  invited_by: string;
  accepted_by: string | null;
  expires_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface TaskListResult {
  nodes: Task[];
  totalCount: number;
}

export interface TaskMutationResult {
  task: Task | null;
  conflict: boolean;
}

export interface ListMutationResult {
  list: TaskList | null;
  conflict: boolean;
}

export interface BoardMutationResult {
  board: Board | null;
  conflict: boolean;
}

export interface TaskEvent {
  type: TaskEventType;
  task: Task;
}

export interface BoardEvent {
  type: BoardEventType;
  boardId: string;
  clientMutationId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  task?: Task | null;
  list?: TaskList | null;
  label?: Label | null;
  comment?: TaskComment | null;
  checklistItem?: ChecklistItem | null;
  activity?: ActivityItem | null;
}

const SORT_FIELDS: Record<string, string> = {
  title: 'title',
  priority: 'priority',
  assignee: 'assignee',
  position: 'position',
  updatedAt: 'updated_at',
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function dateOnly(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function numeric(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function actor(user: Pick<AuthUser, 'name' | 'email'>): string {
  return user.name ?? user.email ?? 'User';
}

function cleanOptional(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function cleanTitle(value: string, entity = 'Task'): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new GraphQLError(`${entity} title is required.`, { extensions: { code: 'BAD_USER_INPUT' } });
  }
  if (trimmed.length > 120) {
    throw new GraphQLError(`${entity} title must be 120 characters or fewer.`, { extensions: { code: 'BAD_USER_INPUT' } });
  }
  return trimmed;
}

function cleanPriority(value: number | null | undefined): number {
  const priority = value ?? 2;
  if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
    throw new GraphQLError('Task priority must be an integer from 1 to 5.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  return priority;
}

function cleanColor(value: string | null | undefined): string | null {
  const cleaned = cleanOptional(value);
  if (!cleaned) return null;
  if (!/^#[0-9a-f]{6}$/i.test(cleaned)) {
    throw new GraphQLError('Color must be a six-digit hex value.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  return cleaned;
}

function cleanDisplayName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new GraphQLError('Display name is required.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  if (trimmed.length > 80) {
    throw new GraphQLError('Display name must be 80 characters or fewer.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  if (!/^[\p{L}\p{N} _.'-]+$/u.test(trimmed)) {
    throw new GraphQLError('Display name contains unsupported characters.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  return trimmed;
}

function defaultDisplayName(user: AuthUser): string {
  const fromName = user.name?.trim();
  if (fromName) return fromName.slice(0, 80);
  const fromEmail = user.email?.trim();
  if (fromEmail) {
    const local = fromEmail.split('@')[0]?.trim();
    if (local) return local.slice(0, 80);
  }
  return 'User';
}

function parseDataImage(value: string): { mimeType: string; data: Buffer } | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(value.trim());
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const payload = match[2].replace(/\s+/g, '');
  return { mimeType, data: Buffer.from(payload, 'base64') };
}

function extensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'bin';
  }
}

function cleanEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
    throw new GraphQLError('Invalid email format.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  return normalized;
}

function cleanInviteRole(value: BoardRole | null | undefined): BoardRole {
  if (!value || value === BoardRole.MEMBER) return BoardRole.MEMBER;
  if (value === BoardRole.ADMIN) return BoardRole.ADMIN;
  throw new GraphQLError('Invitations can only assign ADMIN or MEMBER role.', { extensions: { code: 'BAD_USER_INPUT' } });
}

function toBoard(row: BoardRow): Board {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    background: row.background,
    logoUrl: row.logo_url,
    createdByAuth0Sub: row.created_by_auth0_sub,
    version: row.version,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function toList(row: ListRow): TaskList {
  return {
    id: row.id,
    boardId: row.board_id,
    title: row.title,
    position: numeric(row.position),
    archived: row.archived,
    version: row.version,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function toTask(row: TaskRow, assignees: string[] = []): Task {
  const resolved =
    assignees.length > 0 ? assignees : row.assignee ? [row.assignee] : [];
  return {
    id: row.id,
    boardId: row.board_id,
    listId: row.list_id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    assignees: resolved,
    position: numeric(row.position),
    dueDate: dateOnly(row.due_date),
    coverColor: row.cover_color,
    archived: row.archived,
    version: row.version,
    updatedAt: iso(row.updated_at),
  };
}

function normalizeAssigneeList(assignees?: string[] | null): string[] {
  if (!assignees?.length) return [];
  const unique = new Set<string>();
  for (const entry of assignees) {
    const cleaned = cleanOptional(entry);
    if (cleaned) unique.add(cleaned);
  }
  return [...unique];
}

async function loadAssigneesForTasks(db: DbClient, taskIds: string[]): Promise<Map<string, string[]>> {
  if (!taskIds.length) return new Map();
  const result = await db.query<{ task_id: string; auth0_sub: string }>(
    `
      SELECT task_id, auth0_sub
      FROM task_assignees
      WHERE task_id = ANY($1::uuid[])
      ORDER BY created_at ASC
    `,
    [taskIds],
  );
  const map = new Map<string, string[]>();
  for (const row of result.rows) {
    map.set(row.task_id, [...(map.get(row.task_id) ?? []), row.auth0_sub]);
  }
  return map;
}

async function replaceTaskAssignees(db: DbClient, taskId: string, assignees: string[]): Promise<void> {
  await db.query('DELETE FROM task_assignees WHERE task_id = $1', [taskId]);
  for (const auth0Sub of assignees) {
    await db.query(
      'INSERT INTO task_assignees (task_id, auth0_sub) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [taskId, auth0Sub],
    );
  }
  await db.query('UPDATE tasks SET assignee = $2 WHERE id = $1', [taskId, assignees[0] ?? null]);
}

function toLabel(row: LabelRow): Label {
  return { id: row.id, boardId: row.board_id, name: row.name, color: row.color };
}

function toChecklist(row: ChecklistRow): ChecklistItem {
  return {
    id: row.id,
    taskId: row.task_id,
    text: row.text,
    checked: row.checked,
    position: numeric(row.position),
  };
}

function toComment(row: CommentRow): TaskComment {
  return {
    id: row.id,
    taskId: row.task_id,
    body: row.body,
    author: row.author,
    createdAt: iso(row.created_at),
  };
}

function toActivity(row: ActivityRow): ActivityItem {
  return {
    id: row.id,
    taskId: row.task_id,
    type: row.type,
    message: row.message,
    actor: row.actor,
    createdAt: iso(row.created_at),
  };
}

function toUserProfile(row: UserProfileRow): UserProfile {
  return {
    auth0Sub: row.auth0_sub,
    displayName: row.display_name,
    email: row.email,
    pictureUrl: row.picture_url,
    isOnboarded: row.is_onboarded,
    lastSeenAt: row.last_seen_at ? iso(row.last_seen_at) : null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function toBoardMember(row: BoardMemberRow): BoardMember {
  return {
    boardId: row.board_id,
    auth0Sub: row.auth0_sub,
    role: row.role,
    displayName: row.display_name,
    email: row.email,
    pictureUrl: row.picture_url,
    invitedBy: row.invited_by,
    createdAt: iso(row.created_at),
  };
}

function toBoardInvitation(row: BoardInvitationRow): BoardInvitation {
  return {
    id: row.id,
    boardId: row.board_id,
    boardTitle: row.board_title,
    boardBackground: row.board_background,
    email: row.email,
    role: row.role,
    status: row.status,
    invitedBy: row.invited_by,
    acceptedBy: row.accepted_by,
    expiresAt: iso(row.expires_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function profileActor(profile: UserProfile): AuthUser {
  return {
    id: profile.auth0Sub,
    name: profile.displayName,
    email: profile.email,
    pictureUrl: profile.pictureUrl,
    emailVerified: true,
  };
}

export async function getUserProfile(db: DbClient, user: AuthUser): Promise<UserProfile | null> {
  const result = await db.query<UserProfileRow>(
    `
      INSERT INTO user_profiles (auth0_sub, display_name, email, picture_url, is_onboarded, last_seen_at)
      VALUES ($1, $2, $3, $4, false, now())
      ON CONFLICT (auth0_sub) DO UPDATE
      SET email = excluded.email,
          picture_url = COALESCE(user_profiles.picture_url, excluded.picture_url),
          last_seen_at = now(),
          updated_at = now()
      RETURNING auth0_sub, display_name, email, picture_url, is_onboarded, last_seen_at, created_at, updated_at
    `,
    [user.id, defaultDisplayName(user), user.email, user.pictureUrl],
  );
  return result.rows[0] ? toUserProfile(result.rows[0]) : null;
}

export async function updateUserProfile(db: DbClient, user: AuthUser, input: UpdateMyProfileInput): Promise<UserProfile> {
  const displayName = cleanDisplayName(input.displayName);
  let pictureUrl = user.pictureUrl;
  if (input.pictureUrl !== undefined) {
    if (input.pictureUrl === null || input.pictureUrl.trim() === '') {
      pictureUrl = null;
    } else {
      const parsedImage = parseDataImage(input.pictureUrl);
      if (parsedImage) {
        if (!env.blobReadWriteToken) {
          throw new GraphQLError('BLOB_READ_WRITE_TOKEN is required for avatar uploads.', { extensions: { code: 'INTERNAL_SERVER_ERROR' } });
        }
        if (parsedImage.data.byteLength > 1_500_000) {
          throw new GraphQLError('Avatar image must be 1.5 MB or smaller.', { extensions: { code: 'BAD_USER_INPUT' } });
        }
        const extension = extensionForMimeType(parsedImage.mimeType);
        try {
          const blob = await put(`avatars/${user.id}/${crypto.randomUUID()}.${extension}`, parsedImage.data, {
            access: 'public',
            token: env.blobReadWriteToken,
            contentType: parsedImage.mimeType,
            addRandomSuffix: false,
          });
          pictureUrl = blob.url;
        } catch (cause) {
          const detail = cause instanceof Error ? cause.message : 'Unknown error';
          throw new GraphQLError(`Avatar upload failed: ${detail}`, {
            extensions: { code: 'BAD_GATEWAY' },
            originalError: cause instanceof Error ? cause : undefined,
          });
        }
      } else {
        const trimmed = input.pictureUrl.trim();
        if (!/^https?:\/\/[^\s]+$/i.test(trimmed)) {
          throw new GraphQLError('Avatar must be an image URL or uploaded image data.', { extensions: { code: 'BAD_USER_INPUT' } });
        }
        pictureUrl = trimmed;
      }
    }
  }
  const result = await db.query<UserProfileRow>(
    `
      INSERT INTO user_profiles (auth0_sub, display_name, email, picture_url)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (auth0_sub) DO UPDATE
      SET display_name = excluded.display_name,
          email = excluded.email,
          picture_url = excluded.picture_url,
          is_onboarded = true,
          last_seen_at = now(),
          updated_at = now()
      RETURNING auth0_sub, display_name, email, picture_url, is_onboarded, last_seen_at, created_at, updated_at
    `,
    [user.id, displayName, user.email, pictureUrl],
  );
  return toUserProfile(result.rows[0]);
}

async function recordActivity(db: DbClient, boardId: string, taskId: string | null, type: string, message: string, user: AuthUser): Promise<ActivityItem> {
  const displayActor = actor(user);
  const recent = await db.query<ActivityRow>(
    `
      SELECT id, task_id, type, message, actor, created_at
      FROM task_activity
      WHERE board_id = $1
        AND ($2::uuid IS NULL OR task_id = $2::uuid)
        AND type = $3
        AND actor = $4
        AND message = $5
        AND created_at > now() - interval '60 seconds'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [boardId, taskId, type, displayActor, message],
  );
  if (recent.rows[0]) {
    return toActivity(recent.rows[0]);
  }

  const result = await db.query<ActivityRow>(
    `
      INSERT INTO task_activity (board_id, task_id, type, message, actor)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, task_id, type, message, actor, created_at
    `,
    [boardId, taskId, type, message, displayActor],
  );
  return toActivity(result.rows[0]);
}

export async function listBoards(db: DbClient): Promise<Board[]> {
  const result = await db.query<BoardRow>(
    'SELECT id, title, description, background, logo_url, created_by_auth0_sub, version, created_at, updated_at FROM boards ORDER BY updated_at DESC',
  );
  return result.rows.map(toBoard);
}

export async function listBoardsForUser(db: DbClient, userSub: string): Promise<Board[]> {
  const result = await db.query<BoardRow>(
    `
      SELECT b.id, b.title, b.description, b.background, b.logo_url, b.created_by_auth0_sub, b.version, b.created_at, b.updated_at
      FROM boards b
      JOIN board_members bm ON bm.board_id = b.id
      WHERE bm.auth0_sub = $1
      ORDER BY b.updated_at DESC
    `,
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
    `
      SELECT b.id, b.title, b.description, b.background, b.logo_url, b.created_by_auth0_sub, b.version, b.created_at, b.updated_at
      FROM boards b
      JOIN board_members bm ON bm.board_id = b.id
      WHERE b.id = $1 AND bm.auth0_sub = $2
    `,
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
    `
      SELECT b.id, b.title, b.description, b.background, b.logo_url, b.created_by_auth0_sub, b.version, b.created_at, b.updated_at
      FROM boards b
      JOIN board_members bm ON bm.board_id = b.id
      WHERE bm.auth0_sub = $1
      ORDER BY b.created_at ASC
      LIMIT 1
    `,
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
    `
      SELECT bm.board_id
      FROM board_members bm
      WHERE bm.auth0_sub = $1
    `,
    [userSub],
  );
  return result.rows.map((row) => row.board_id);
}

export async function getBoardView(db: DbClient, boardId: string): Promise<BoardView | null> {
  const board = await getBoard(db, boardId);
  if (!board) return null;

  const listsResult = await db.query<ListRow>(
    'SELECT id, board_id, title, position, archived, version, created_at, updated_at FROM task_lists WHERE board_id = $1 AND archived = false ORDER BY position ASC, created_at ASC',
    [boardId],
  );
  const tasksResult = await db.query<TaskRow>(
    `
      SELECT id, board_id, list_id, title, description, priority, assignee, position, due_date, cover_color, archived, version, updated_at
      FROM tasks
      WHERE board_id = $1 AND archived = false
      ORDER BY position ASC, updated_at DESC
    `,
    [boardId],
  );
  const labelsResult = await db.query<LabelRow>('SELECT id, board_id, name, color FROM labels WHERE board_id = $1 ORDER BY name ASC, id ASC', [boardId]);
  const taskLabelsResult = await db.query<{ task_id: string; label_id: string }>(
    `
      SELECT tl.task_id, tl.label_id
      FROM task_labels tl
      JOIN tasks t ON t.id = tl.task_id
      WHERE t.board_id = $1
    `,
    [boardId],
  );
  const checklistResult = await db.query<ChecklistRow>(
    `
      SELECT ci.id, ci.task_id, ci.text, ci.checked, ci.position
      FROM checklist_items ci
      JOIN tasks t ON t.id = ci.task_id
      WHERE t.board_id = $1
      ORDER BY ci.position ASC, ci.created_at ASC
    `,
    [boardId],
  );
  const commentsResult = await db.query<CommentRow>(
    `
      SELECT tc.id, tc.task_id, tc.body, tc.author, tc.created_at
      FROM task_comments tc
      JOIN tasks t ON t.id = tc.task_id
      WHERE t.board_id = $1
      ORDER BY tc.created_at DESC
    `,
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
  const assigneesByTask = await loadAssigneesForTasks(
    db,
    tasksResult.rows.map((row) => row.id),
  );
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

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const groupKey = key(item);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), item]);
  }
  return groups;
}

function listWhere(filter: TaskFilterInput | null | undefined): { sql: string; values: unknown[] } {
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

function orderBy(sort: TaskSortInput[] | null | undefined): string {
  const rules = sort?.length ? sort : [{ field: 'position', direction: SortDirection.ASC }];
  const clauses = rules.map((rule) => {
    const column = SORT_FIELDS[rule.field] ?? SORT_FIELDS.position;
    const direction = rule.direction === SortDirection.DESC ? 'DESC' : 'ASC';
    return `${column} ${direction} NULLS LAST`;
  });
  return `ORDER BY ${clauses.join(', ')}, id ASC`;
}

export async function listTasks(
  db: DbClient,
  page: number,
  pageSize: number,
  filter?: TaskFilterInput | null,
  sort?: TaskSortInput[] | null,
): Promise<TaskListResult> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const offset = (safePage - 1) * safePageSize;
  const where = listWhere(filter);
  const count = await db.query<{ count: string }>(`SELECT count(*)::text AS count FROM tasks ${where.sql}`, where.values);
  const rows = await db.query<TaskRow>(
    `
      SELECT id, board_id, list_id, title, description, priority, assignee, position, due_date, cover_color, archived, version, updated_at
      FROM tasks
      ${where.sql}
      ${orderBy(sort)}
      LIMIT $${where.values.length + 1}
      OFFSET $${where.values.length + 2}
    `,
    [...where.values, safePageSize, offset],
  );
  const assigneesByTask = await loadAssigneesForTasks(
    db,
    rows.rows.map((row) => row.id),
  );
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
  filter?: TaskFilterInput | null,
  sort?: TaskSortInput[] | null,
): Promise<TaskListResult> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const offset = (safePage - 1) * safePageSize;
  const where = listWhere(filter);
  const count = await db.query<{ count: string }>(
    `
      SELECT count(*)::text AS count
      FROM tasks t
      JOIN board_members bm ON bm.board_id = t.board_id
      WHERE bm.auth0_sub = $1
        AND ${where.sql.replace(/^WHERE\s+/i, '')}
    `,
    [userSub, ...where.values],
  );
  const rows = await db.query<TaskRow>(
    `
      SELECT t.id, t.board_id, t.list_id, t.title, t.description, t.priority, t.assignee, t.position, t.due_date, t.cover_color, t.archived, t.version, t.updated_at
      FROM tasks t
      JOIN board_members bm ON bm.board_id = t.board_id
      WHERE bm.auth0_sub = $1
        AND ${where.sql.replace(/^WHERE\s+/i, '')}
      ${orderBy(sort)}
      LIMIT $${where.values.length + 2}
      OFFSET $${where.values.length + 3}
    `,
    [userSub, ...where.values, safePageSize, offset],
  );
  const assigneesByTask = await loadAssigneesForTasks(
    db,
    rows.rows.map((row) => row.id),
  );
  return {
    nodes: rows.rows.map((row) => toTask(row, assigneesByTask.get(row.id) ?? [])),
    totalCount: Number(count.rows[0]?.count ?? 0),
  };
}

export async function getTask(db: DbClient, id: string): Promise<Task | null> {
  const result = await db.query<TaskRow>(
    `
      SELECT id, board_id, list_id, title, description, priority, assignee, position, due_date, cover_color, archived, version, updated_at
      FROM tasks
      WHERE id = $1
    `,
    [id],
  );
  if (!result.rows[0]) return null;
  const assignees = (await loadAssigneesForTasks(db, [id])).get(id) ?? [];
  return toTask(result.rows[0], assignees);
}

export async function getTaskForUser(db: DbClient, id: string, userSub: string): Promise<Task | null> {
  const result = await db.query<TaskRow>(
    `
      SELECT t.id, t.board_id, t.list_id, t.title, t.description, t.priority, t.assignee, t.position, t.due_date, t.cover_color, t.archived, t.version, t.updated_at
      FROM tasks t
      JOIN board_members bm ON bm.board_id = t.board_id
      WHERE t.id = $1
        AND bm.auth0_sub = $2
    `,
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
  const listResult = await db.query<ListRow>(
    `
      SELECT id, board_id, title, position, archived, version, created_at, updated_at
      FROM task_lists
      WHERE board_id = $1 AND archived = false AND ($2::uuid IS NULL OR id = $2::uuid)
      ORDER BY position ASC
      LIMIT 1
    `,
    [boardId, input.listId ?? null],
  );
  const list = listResult.rows[0] ? toList(listResult.rows[0]) : null;
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

export async function assertAssigneesAreBoardMembers(db: DbClient, boardId: string, assignees: string[]): Promise<void> {
  for (const auth0Sub of assignees) {
    const result = await db.query<{ ok: number }>(
      'SELECT 1 AS ok FROM board_members WHERE board_id = $1 AND auth0_sub = $2',
      [boardId, auth0Sub],
    );
    if (!result.rows[0]) {
      throw new GraphQLError('All assignees must be board members.', { extensions: { code: 'BAD_USER_INPUT' } });
    }
  }
}

export async function createTask(db: DbClient, input: CreateTaskInput, user: AuthUser): Promise<Task> {
  const target = await resolveCreateTarget(db, input);
  const assignees = normalizeAssigneeList(input.assignees);
  await assertAssigneesAreBoardMembers(db, target.boardId, assignees);
  const result = await db.query<TaskRow>(
    `
      INSERT INTO tasks (board_id, list_id, title, description, priority, assignee, position, due_date, cover_color, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, board_id, list_id, title, description, priority, assignee, position, due_date, cover_color, archived, version, updated_at
    `,
    [
      target.boardId,
      target.listId,
      cleanTitle(input.title),
      cleanOptional(input.description),
      cleanPriority(input.priority),
      assignees[0] ?? null,
      target.position,
      input.dueDate ?? null,
      cleanColor(input.coverColor),
      actor(user),
    ],
  );
  const task = toTask(result.rows[0], assignees);
  await replaceTaskAssignees(db, task.id, assignees);
  void recordActivity(db, task.boardId, task.id, 'CARD_CREATED', `created "${task.title}"`, user).catch(() => undefined);
  return task;
}

export async function updateTask(
  db: DbClient,
  id: string,
  input: UpdateTaskInput,
  expectedVersion: number | null | undefined,
  user: AuthUser,
): Promise<TaskMutationResult> {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (input.listId !== undefined) {
    values.push(input.listId);
    sets.push(`list_id = $${values.length}`);
  }
  if (input.title !== undefined) {
    values.push(cleanTitle(input.title));
    sets.push(`title = $${values.length}`);
  }
  if (input.description !== undefined) {
    values.push(cleanOptional(input.description));
    sets.push(`description = $${values.length}`);
  }
  if (input.priority !== undefined) {
    values.push(cleanPriority(input.priority));
    sets.push(`priority = $${values.length}`);
  }
  let assigneesToSet: string[] | null = null;
  if (input.assignees !== undefined) {
    assigneesToSet = normalizeAssigneeList(input.assignees);
  }
  if (input.position !== undefined) {
    values.push(input.position);
    sets.push(`position = $${values.length}`);
  }
  if (input.dueDate !== undefined) {
    values.push(input.dueDate);
    sets.push(`due_date = $${values.length}`);
  }
  if (input.coverColor !== undefined) {
    values.push(cleanColor(input.coverColor));
    sets.push(`cover_color = $${values.length}`);
  }
  if (input.archived !== undefined && input.archived !== null) {
    values.push(input.archived);
    sets.push(`archived = $${values.length}`);
  }

  if (assigneesToSet !== null) {
    values.push(assigneesToSet[0] ?? null);
    sets.push(`assignee = $${values.length}`);
  }

  if (!sets.length) {
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

  values.push(actor(user));
  sets.push(`updated_by = $${values.length}`, 'version = version + 1', 'updated_at = now()');
  values.push(id);
  let where = `id = $${values.length}`;
  if (expectedVersion != null) {
    values.push(expectedVersion);
    where += ` AND version = $${values.length}`;
  }

  const result = await db.query<TaskRow>(
    `
      UPDATE tasks
      SET ${sets.join(', ')}
      WHERE ${where}
      RETURNING id, board_id, list_id, title, description, priority, assignee, position, due_date, cover_color, archived, version, updated_at
    `,
    values,
  );
  if (result.rows[0]) {
    if (assigneesToSet !== null) {
      await replaceTaskAssignees(db, id, assigneesToSet);
    }
    const assignees = assigneesToSet ?? (await loadAssigneesForTasks(db, [id])).get(id) ?? [];
    const task = toTask(result.rows[0], assignees);
    void recordActivity(db, task.boardId, task.id, input.archived ? 'CARD_ARCHIVED' : 'CARD_UPDATED', `updated "${task.title}"`, user).catch(() => undefined);
    return { task, conflict: false };
  }
  const current = await getTask(db, id);
  return { task: current, conflict: Boolean(current && expectedVersion != null) };
}

export async function moveTask(db: DbClient, input: MoveTaskInput, user: AuthUser): Promise<TaskMutationResult> {
  const list = await getList(db, input.toListId);
  if (!list || list.boardId !== input.boardId) {
    throw new GraphQLError('Target list was not found.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  return updateTask(
    db,
    input.taskId,
    {
      listId: input.toListId,
      position: input.position,
    },
    input.expectedVersion,
    user,
  );
}

export async function deleteTask(db: DbClient, id: string, expectedVersion?: number | null): Promise<TaskMutationResult> {
  return updateTask(db, id, { archived: true }, expectedVersion, { id: 'system', name: 'System', email: null, pictureUrl: null, emailVerified: true });
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
    `
      INSERT INTO boards (title, description, background, logo_url, created_by_auth0_sub, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, title, description, background, logo_url, created_by_auth0_sub, version, created_at, updated_at
    `,
    [
      cleanTitle(input.title, 'Board'),
      cleanOptional(input.description),
      background,
      logoUrl,
      user.id,
      actor(user),
    ],
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

export async function listBoardMembers(db: DbClient, boardId: string): Promise<BoardMember[]> {
  const result = await db.query<BoardMemberRow>(
    `SELECT bm.board_id, bm.auth0_sub, bm.role, up.display_name, up.email, up.picture_url, bm.invited_by, bm.created_at
     FROM board_members bm
     LEFT JOIN user_profiles up ON up.auth0_sub = bm.auth0_sub
     WHERE bm.board_id = $1
     ORDER BY bm.created_at ASC`,
    [boardId],
  );
  return result.rows.map(toBoardMember);
}

export async function listProjectUsers(db: DbClient): Promise<UserProfile[]> {
  const result = await db.query<UserProfileRow>(
    `SELECT auth0_sub, display_name, email, picture_url, is_onboarded, last_seen_at, created_at, updated_at
     FROM user_profiles
     WHERE email IS NOT NULL
     ORDER BY lower(display_name) ASC, created_at ASC`,
  );
  return result.rows.map(toUserProfile);
}

export async function listBoardInvitations(db: DbClient, boardId: string): Promise<BoardInvitation[]> {
  const result = await db.query<BoardInvitationRow>(
    `SELECT bi.id, bi.board_id, b.title AS board_title, b.background AS board_background, bi.email, bi.role, bi.status, bi.invited_by, bi.accepted_by, bi.expires_at, bi.created_at, bi.updated_at
     FROM board_invitations bi
     JOIN boards b ON b.id = bi.board_id
     WHERE board_id = $1
       AND bi.status = 'PENDING'
       AND bi.expires_at >= now()
     ORDER BY bi.created_at DESC`,
    [boardId],
  );
  return result.rows.map(toBoardInvitation);
}

export async function listMyPendingInvitations(db: DbClient, email: string): Promise<BoardInvitation[]> {
  const result = await db.query<BoardInvitationRow>(
    `SELECT bi.id, bi.board_id, b.title AS board_title, b.background AS board_background, bi.email, bi.role, bi.status, bi.invited_by, bi.accepted_by, bi.expires_at, bi.created_at, bi.updated_at
     FROM board_invitations bi
     JOIN boards b ON b.id = bi.board_id
     WHERE lower(bi.email) = $1
       AND bi.status = 'PENDING'
       AND bi.expires_at >= now()
     ORDER BY bi.created_at DESC`,
    [cleanEmail(email)],
  );
  return result.rows.map(toBoardInvitation);
}

async function getInvitationById(db: DbClient, invitationId: string): Promise<BoardInvitation | null> {
  const result = await db.query<BoardInvitationRow>(
    `SELECT bi.id, bi.board_id, b.title AS board_title, b.background AS board_background, bi.email, bi.role, bi.status, bi.invited_by, bi.accepted_by, bi.expires_at, bi.created_at, bi.updated_at
     FROM board_invitations bi
     JOIN boards b ON b.id = bi.board_id
     WHERE bi.id = $1`,
    [invitationId],
  );
  return result.rows[0] ? toBoardInvitation(result.rows[0]) : null;
}

export async function inviteMember(db: DbClient, input: InviteMemberInput, inviterSub: string): Promise<BoardInvitation> {
  const email = cleanEmail(input.email);
  const role = cleanInviteRole(input.role);
  const expiresInDays = Math.max(1, Math.min(30, input.expiresInDays ?? 7));
  const result = await db.query<{ id: string }>(
    `
      INSERT INTO board_invitations (board_id, email, role, invited_by, expires_at)
      VALUES ($1, $2, $3, $4, now() + ($5 || ' days')::interval)
      RETURNING id
    `,
    [input.boardId, email, role, inviterSub, String(expiresInDays)],
  );
  const invitation = await getInvitationById(db, result.rows[0].id);
  if (!invitation) {
    throw new GraphQLError('Invitation not found.', { extensions: { code: 'NOT_FOUND' } });
  }
  return invitation;
}

export async function acceptInvitation(db: DbClient, invitationId: string, user: AuthUser): Promise<BoardInvitation | null> {
  if (!user.email) {
    throw new GraphQLError('A verified email is required to accept invitations.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  const email = cleanEmail(user.email);
  const result = await db.query<{ id: string }>(
    `
      UPDATE board_invitations
      SET status = CASE
          WHEN status <> 'PENDING' THEN status
          WHEN expires_at < now() THEN 'EXPIRED'
          ELSE 'ACCEPTED'
        END,
        accepted_by = CASE
          WHEN status = 'PENDING' AND expires_at >= now() THEN $2
          ELSE accepted_by
        END,
        updated_at = now()
      WHERE id = $1 AND lower(email) = $3
      RETURNING id
    `,
    [invitationId, user.id, email],
  );
  const invitation = result.rows[0] ? await getInvitationById(db, result.rows[0].id) : null;
  if (!invitation) return null;
  if (invitation.status === InvitationStatus.ACCEPTED) {
    await db.query(
      `
        INSERT INTO board_members (board_id, auth0_sub, role, invited_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (board_id, auth0_sub) DO UPDATE
        SET role = EXCLUDED.role
      `,
      [invitation.boardId, user.id, invitation.role, invitation.invitedBy],
    );
  }
  return invitation;
}

export async function declineInvitation(db: DbClient, invitationId: string, user: AuthUser): Promise<BoardInvitation | null> {
  if (!user.email) return null;
  const email = cleanEmail(user.email);
  const result = await db.query<{ id: string }>(
    `
      UPDATE board_invitations
      SET status = CASE WHEN status = 'PENDING' THEN 'DECLINED' ELSE status END,
          updated_at = now()
      WHERE id = $1 AND lower(email) = $2
      RETURNING id
    `,
    [invitationId, email],
  );
  return result.rows[0] ? getInvitationById(db, result.rows[0].id) : null;
}

export async function updateBoard(db: DbClient, id: string, input: UpdateBoardInput, expectedVersion: number | null | undefined, user: AuthUser): Promise<BoardMutationResult> {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (input.title != null) {
    values.push(cleanTitle(input.title, 'Board'));
    sets.push(`title = $${values.length}`);
  }
  if (input.description !== undefined) {
    values.push(cleanOptional(input.description));
    sets.push(`description = $${values.length}`);
  }
  if (input.background !== undefined) {
    values.push(cleanOptional(input.background) ?? 'linear-gradient(135deg, #0c66e4 0%, #5e4db2 100%)');
    sets.push(`background = $${values.length}`);
  }
  if (!sets.length) return { board: await getBoard(db, id), conflict: false };
  values.push(actor(user));
  sets.push(`updated_by = $${values.length}`, 'version = version + 1', 'updated_at = now()');
  values.push(id);
  let where = `id = $${values.length}`;
  if (expectedVersion != null) {
    values.push(expectedVersion);
    where += ` AND version = $${values.length}`;
  }
  const result = await db.query<BoardRow>(
    `UPDATE boards SET ${sets.join(', ')} WHERE ${where} RETURNING id, title, description, background, created_by_auth0_sub, version, created_at, updated_at`,
    values,
  );
  if (result.rows[0]) return { board: toBoard(result.rows[0]), conflict: false };
  return { board: await getBoard(db, id), conflict: expectedVersion != null };
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
    `
      INSERT INTO task_lists (board_id, title, position, updated_by)
      VALUES ($1, $2, $3, $4)
      RETURNING id, board_id, title, position, archived, version, created_at, updated_at
    `,
    [input.boardId, cleanTitle(input.title, 'List'), input.position ?? Number(positionResult.rows[0]?.next_position ?? 1024), actor(user)],
  );
  const list = toList(result.rows[0]);
  void recordActivity(db, input.boardId, null, 'LIST_CREATED', `created list "${list.title}"`, user).catch(() => undefined);
  return list;
}

export async function updateList(db: DbClient, id: string, input: UpdateListInput, expectedVersion: number | null | undefined, user: AuthUser): Promise<ListMutationResult> {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (input.title != null) {
    values.push(cleanTitle(input.title, 'List'));
    sets.push(`title = $${values.length}`);
  }
  if (input.position !== undefined) {
    values.push(input.position);
    sets.push(`position = $${values.length}`);
  }
  if (input.archived !== undefined && input.archived !== null) {
    values.push(input.archived);
    sets.push(`archived = $${values.length}`);
  }
  if (!sets.length) return { list: await getList(db, id), conflict: false };
  values.push(actor(user));
  sets.push(`updated_by = $${values.length}`, 'version = version + 1', 'updated_at = now()');
  values.push(id);
  let where = `id = $${values.length}`;
  if (expectedVersion != null) {
    values.push(expectedVersion);
    where += ` AND version = $${values.length}`;
  }
  const result = await db.query<ListRow>(
    `UPDATE task_lists SET ${sets.join(', ')} WHERE ${where} RETURNING id, board_id, title, position, archived, version, created_at, updated_at`,
    values,
  );
  if (result.rows[0]) {
    const list = toList(result.rows[0]);
    void recordActivity(db, list.boardId, null, list.archived ? 'LIST_ARCHIVED' : 'LIST_UPDATED', `updated list "${list.title}"`, user).catch(() => undefined);
    return { list, conflict: false };
  }
  return { list: await getList(db, id), conflict: expectedVersion != null };
}

export async function createLabel(db: DbClient, boardId: string, name: string | null | undefined, color: string, user: AuthUser): Promise<Label> {
  const result = await db.query<LabelRow>(
    'INSERT INTO labels (board_id, name, color) VALUES ($1, $2, $3) RETURNING id, board_id, name, color',
    [boardId, cleanOptional(name) ?? '', cleanColor(color)],
  );
  await recordActivity(db, boardId, null, 'LABEL_UPDATED', 'created a label', user);
  return toLabel(result.rows[0]);
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

export async function createChecklistItem(db: DbClient, taskId: string, text: string, user: AuthUser): Promise<ChecklistItem> {
  const taskMeta = await db.query<{ board_id: string; title: string }>(
    'SELECT board_id, title FROM tasks WHERE id = $1',
    [taskId],
  );
  const meta = taskMeta.rows[0];
  if (!meta) throw new GraphQLError('Task not found.', { extensions: { code: 'BAD_USER_INPUT' } });
  const position = await db.query<{ next_position: string }>(
    'SELECT coalesce(max(position), 0) + 1024 AS next_position FROM checklist_items WHERE task_id = $1',
    [taskId],
  );
  const result = await db.query<ChecklistRow>(
    'INSERT INTO checklist_items (task_id, text, position) VALUES ($1, $2, $3) RETURNING id, task_id, text, checked, position',
    [taskId, cleanTitle(text, 'Checklist item'), Number(position.rows[0]?.next_position ?? 1024)],
  );
  void recordActivity(db, meta.board_id, taskId, 'CHECKLIST_UPDATED', `added a checklist item to "${meta.title}"`, user).catch(() => undefined);
  return toChecklist(result.rows[0]);
}

export async function updateChecklistItem(db: DbClient, id: string, text: string | null | undefined, checked: boolean | null | undefined, user: AuthUser): Promise<ChecklistItem | null> {
  const current = await db.query<{ task_id: string; board_id: string; title: string }>(
    'SELECT ci.task_id, t.board_id, t.title FROM checklist_items ci JOIN tasks t ON t.id = ci.task_id WHERE ci.id = $1',
    [id],
  );
  if (!current.rows[0]) return null;
  const sets: string[] = [];
  const values: unknown[] = [];
  if (text != null) {
    values.push(cleanTitle(text, 'Checklist item'));
    sets.push(`text = $${values.length}`);
  }
  if (checked != null) {
    values.push(checked);
    sets.push(`checked = $${values.length}`);
  }
  if (!sets.length) return null;
  values.push(id);
  const result = await db.query<ChecklistRow>(
    `UPDATE checklist_items SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING id, task_id, text, checked, position`,
    values,
  );
  void recordActivity(db, current.rows[0].board_id, current.rows[0].task_id, 'CHECKLIST_UPDATED', `updated checklist on "${current.rows[0].title}"`, user).catch(() => undefined);
  return result.rows[0] ? toChecklist(result.rows[0]) : null;
}

export async function addComment(db: DbClient, taskId: string, body: string, user: AuthUser): Promise<TaskComment> {
  const taskMeta = await db.query<{ board_id: string; title: string }>(
    'SELECT board_id, title FROM tasks WHERE id = $1',
    [taskId],
  );
  const meta = taskMeta.rows[0];
  if (!meta) throw new GraphQLError('Task not found.', { extensions: { code: 'BAD_USER_INPUT' } });
  const result = await db.query<CommentRow>(
    'INSERT INTO task_comments (task_id, body, author) VALUES ($1, $2, $3) RETURNING id, task_id, body, author, created_at',
    [taskId, cleanTitle(body, 'Comment'), actor(user)],
  );
  const comment = toComment(result.rows[0]);
  void recordActivity(db, meta.board_id, taskId, 'COMMENT_CREATED', `commented on "${meta.title}"`, user).catch(() => undefined);
  return comment;
}

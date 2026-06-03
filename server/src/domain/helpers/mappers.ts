import type { AuthUser } from '../../auth/auth.js';
import { Board, BoardCard, BoardList, BoardView, ChecklistItem, Label, Task, TaskComment, ActivityItem, UserProfile, BoardMember, BoardInvitation, TaskList } from '../../types.js';
import type { BoardRow, ListRow, TaskRow, LabelRow, ChecklistRow, CommentRow, ActivityRow, UserProfileRow, BoardMemberRow, BoardInvitationRow } from './db-types.js';

export const SORT_FIELDS: Record<string, string> = {
  title: 'title',
  priority: 'priority',
  assignee: 'assignee',
  position: 'position',
  updatedAt: 'updated_at',
};

export function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function dateOnly(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

export function numeric(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

export function actor(user: Pick<AuthUser, 'name' | 'email'>): string {
  return user.name ?? user.email ?? 'User';
}

export function defaultDisplayName(user: AuthUser): string {
  const fromName = user.name?.trim();
  if (fromName) return fromName.slice(0, 80);
  const fromEmail = user.email?.trim();
  if (fromEmail) {
    const local = fromEmail.split('@')[0]?.trim();
    if (local) return local.slice(0, 80);
  }
  return 'User';
}

export function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const groupKey = key(item);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), item]);
  }
  return groups;
}

export function toBoard(row: BoardRow): Board {
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

export function toList(row: ListRow): TaskList {
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

export function toTask(row: TaskRow, assignees: string[] = []): Task {
  const resolved = assignees.length > 0 ? assignees : row.assignee ? [row.assignee] : [];
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

export function toLabel(row: LabelRow): Label {
  return { id: row.id, boardId: row.board_id, name: row.name, color: row.color };
}

export function toChecklist(row: ChecklistRow): ChecklistItem {
  return {
    id: row.id,
    taskId: row.task_id,
    text: row.text,
    checked: row.checked,
    position: numeric(row.position),
  };
}

export function toComment(row: CommentRow): TaskComment {
  return {
    id: row.id,
    taskId: row.task_id,
    body: row.body,
    author: row.author,
    createdAt: iso(row.created_at),
  };
}

export function toActivity(row: ActivityRow): ActivityItem {
  return {
    id: row.id,
    taskId: row.task_id,
    type: row.type,
    message: row.message,
    actor: row.actor,
    createdAt: iso(row.created_at),
  };
}

export function toUserProfile(row: UserProfileRow): UserProfile {
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

export function toBoardMember(row: BoardMemberRow): BoardMember {
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

export function toBoardInvitation(row: BoardInvitationRow): BoardInvitation {
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

export enum TaskEventType {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED',
}

export enum BoardEventType {
  BOARD_UPDATED = 'BOARD_UPDATED',
  LIST_CREATED = 'LIST_CREATED',
  LIST_UPDATED = 'LIST_UPDATED',
  LIST_ARCHIVED = 'LIST_ARCHIVED',
  CARD_CREATED = 'CARD_CREATED',
  CARD_UPDATED = 'CARD_UPDATED',
  CARD_MOVED = 'CARD_MOVED',
  CARD_ARCHIVED = 'CARD_ARCHIVED',
  CARD_DELETED = 'CARD_DELETED',
  LABEL_UPDATED = 'LABEL_UPDATED',
  CHECKLIST_UPDATED = 'CHECKLIST_UPDATED',
  COMMENT_CREATED = 'COMMENT_CREATED',
}

export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum BoardRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export interface Task {
  id: string;
  boardId: string;
  listId: string;
  title: string;
  description: string | null;
  priority: number;
  assignees: string[];
  position: number;
  dueDate: string | null;
  coverColor: string | null;
  archived: boolean;
  version: number;
  updatedAt: string;
}

export interface Board {
  id: string;
  title: string;
  description: string | null;
  background: string;
  logoUrl: string | null;
  createdByAuth0Sub: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskList {
  id: string;
  boardId: string;
  title: string;
  position: number;
  archived: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Label {
  id: string;
  boardId: string;
  name: string;
  color: string;
}

export interface ChecklistItem {
  id: string;
  taskId: string;
  text: string;
  checked: boolean;
  position: number;
}

export interface TaskComment {
  id: string;
  taskId: string;
  body: string;
  author: string;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  taskId: string | null;
  type: string;
  message: string;
  actor: string;
  createdAt: string;
}

export interface UserProfile {
  auth0Sub: string;
  displayName: string;
  email: string | null;
  pictureUrl: string | null;
  isOnboarded: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoardMember {
  boardId: string;
  auth0Sub: string;
  role: BoardRole;
  displayName: string | null;
  email: string | null;
  pictureUrl: string | null;
  invitedBy: string | null;
  createdAt: string;
}

export interface BoardInvitation {
  id: string;
  boardId: string;
  boardTitle: string;
  boardBackground: string;
  email: string;
  role: BoardRole;
  status: InvitationStatus;
  invitedBy: string;
  acceptedBy: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardCard extends Task {
  labels: Label[];
  checklist: ChecklistItem[];
  comments: TaskComment[];
}

export interface BoardList extends TaskList {
  cards: BoardCard[];
}

export interface BoardView {
  board: Board;
  lists: BoardList[];
  labels: Label[];
  activity: ActivityItem[];
}

export interface TaskFilterInput {
  search?: string | null;
}

export interface TaskSortInput {
  field: string;
  direction: SortDirection;
}

export interface CreateTaskInput {
  boardId?: string | null;
  listId?: string | null;
  title: string;
  description?: string | null;
  priority?: number;
  assignees?: string[] | null;
  position?: number | null;
  dueDate?: string | null;
  coverColor?: string | null;
  clientMutationId?: string | null;
}

export interface UpdateTaskInput {
  listId?: string | null;
  title?: string;
  description?: string | null;
  priority?: number;
  assignees?: string[] | null;
  position?: number | null;
  dueDate?: string | null;
  coverColor?: string | null;
  archived?: boolean | null;
  clientMutationId?: string | null;
}

export interface CreateBoardInput {
  title: string;
  description?: string | null;
  background?: string | null;
  logoImageData?: string | null;
}

export interface UpdateBoardInput {
  title?: string | null;
  description?: string | null;
  background?: string | null;
}

export interface CreateListInput {
  boardId: string;
  title: string;
  position?: number | null;
}

export interface UpdateListInput {
  title?: string | null;
  position?: number | null;
  archived?: boolean | null;
  clientMutationId?: string | null;
}

export interface MoveTaskInput {
  boardId: string;
  taskId: string;
  toListId: string;
  position: number;
  expectedVersion?: number | null;
  clientMutationId?: string | null;
}

export interface UpdateMyProfileInput {
  displayName: string;
  pictureUrl?: string | null;
}

export interface InviteMemberInput {
  boardId: string;
  email: string;
  role?: BoardRole | null;
  expiresInDays?: number | null;
}

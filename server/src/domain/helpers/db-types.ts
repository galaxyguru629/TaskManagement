import type { BoardRole, InvitationStatus } from '../../types.js';

export interface BoardRow {
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

export interface ListRow {
  id: string;
  board_id: string;
  title: string;
  position: string | number;
  archived: boolean;
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface TaskRow {
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

export interface LabelRow {
  id: string;
  board_id: string;
  name: string;
  color: string;
}

export interface ChecklistRow {
  id: string;
  task_id: string;
  text: string;
  checked: boolean;
  position: string | number;
}

export interface CommentRow {
  id: string;
  task_id: string;
  body: string;
  author: string;
  created_at: Date | string;
}

export interface ActivityRow {
  id: string;
  task_id: string | null;
  type: string;
  message: string;
  actor: string;
  created_at: Date | string;
}

export interface UserProfileRow {
  auth0_sub: string;
  display_name: string;
  email: string | null;
  picture_url: string | null;
  is_onboarded: boolean;
  last_seen_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface BoardMemberRow {
  board_id: string;
  auth0_sub: string;
  role: BoardRole;
  display_name: string | null;
  email: string | null;
  picture_url: string | null;
  invited_by: string | null;
  created_at: Date | string;
}

export interface BoardInvitationRow {
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

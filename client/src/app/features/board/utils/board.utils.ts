import { BoardMemberModel } from '../models/board.types';

export function memberInitials(member: BoardMemberModel | { displayName: string | null; email: string | null } | null): string {
  const value = member?.displayName || member?.email || 'U';
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function memberSingleInitial(member: BoardMemberModel | { displayName: string | null; email: string | null } | null): string {
  const value = member?.displayName || member?.email || 'U';
  return value.slice(0, 1).toUpperCase();
}

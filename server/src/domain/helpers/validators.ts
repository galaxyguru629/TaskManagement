import { GraphQLError } from 'graphql';
import { BoardRole } from '../../types.js';

export function cleanOptional(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function cleanTitle(value: string, entity = 'Task'): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new GraphQLError(`${entity} title is required.`, { extensions: { code: 'BAD_USER_INPUT' } });
  }
  if (trimmed.length > 120) {
    throw new GraphQLError(`${entity} title must be 120 characters or fewer.`, { extensions: { code: 'BAD_USER_INPUT' } });
  }
  return trimmed;
}

export function cleanPriority(value: number | null | undefined): number {
  const priority = value ?? 2;
  if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
    throw new GraphQLError('Task priority must be an integer from 1 to 5.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  return priority;
}

export function cleanColor(value: string | null | undefined): string | null {
  const cleaned = cleanOptional(value);
  if (!cleaned) return null;
  if (!/^#[0-9a-f]{6}$/i.test(cleaned)) {
    throw new GraphQLError('Color must be a six-digit hex value.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  return cleaned;
}

export function cleanDisplayName(value: string): string {
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

export function cleanEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
    throw new GraphQLError('Invalid email format.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  return normalized;
}

export function cleanInviteRole(value: BoardRole | null | undefined): BoardRole {
  if (!value || value === BoardRole.MEMBER) return BoardRole.MEMBER;
  if (value === BoardRole.ADMIN) return BoardRole.ADMIN;
  throw new GraphQLError('Invitations can only assign ADMIN or MEMBER role.', { extensions: { code: 'BAD_USER_INPUT' } });
}

export function parseDataImage(value: string): { mimeType: string; data: Buffer } | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(value.trim());
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const payload = match[2].replace(/\s+/g, '');
  return { mimeType, data: Buffer.from(payload, 'base64') };
}

export function extensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'image/gif': return 'gif';
    default: return 'bin';
  }
}

export function normalizeAssigneeList(assignees?: string[] | null): string[] {
  if (!assignees?.length) return [];
  const unique = new Set<string>();
  for (const entry of assignees) {
    const cleaned = cleanOptional(entry);
    if (cleaned) unique.add(cleaned);
  }
  return [...unique];
}

import { GraphQLError } from 'graphql';
import { put } from '@vercel/blob';
import type { AuthUser } from '../auth/auth.js';
import { env } from '../config/env.js';
import type { DbClient } from '../db/pool.js';
import { UserProfile, BoardMember, BoardInvitation, InvitationStatus, BoardRole, UpdateMyProfileInput, InviteMemberInput } from '../types.js';
import { cleanDisplayName, cleanOptional, cleanEmail, cleanInviteRole, parseDataImage, extensionForMimeType, cleanColor } from './helpers/validators.js';
import { toUserProfile, toBoardMember, toBoardInvitation, toLabel, defaultDisplayName } from './helpers/mappers.js';
import { recordActivity } from './activity.repository.js';
import type { UserProfileRow, BoardMemberRow, BoardInvitationRow } from './helpers/db-types.js';

export async function getUserProfile(db: DbClient, user: AuthUser): Promise<UserProfile | null> {
  const result = await db.query<UserProfileRow>(
    `INSERT INTO user_profiles (auth0_sub, display_name, email, picture_url, is_onboarded, last_seen_at)
     VALUES ($1, $2, $3, $4, false, now())
     ON CONFLICT (auth0_sub) DO UPDATE
     SET email = excluded.email,
         picture_url = COALESCE(user_profiles.picture_url, excluded.picture_url),
         last_seen_at = now(),
         updated_at = now()
     RETURNING auth0_sub, display_name, email, picture_url, is_onboarded, last_seen_at, created_at, updated_at`,
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
    `INSERT INTO user_profiles (auth0_sub, display_name, email, picture_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (auth0_sub) DO UPDATE
     SET display_name = excluded.display_name,
         email = excluded.email,
         picture_url = excluded.picture_url,
         is_onboarded = true,
         last_seen_at = now(),
         updated_at = now()
     RETURNING auth0_sub, display_name, email, picture_url, is_onboarded, last_seen_at, created_at, updated_at`,
    [user.id, displayName, user.email, pictureUrl],
  );
  return toUserProfile(result.rows[0]);
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
    `INSERT INTO board_invitations (board_id, email, role, invited_by, expires_at)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' days')::interval)
     RETURNING id`,
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
    `UPDATE board_invitations
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
     RETURNING id`,
    [invitationId, user.id, email],
  );
  const invitation = result.rows[0] ? await getInvitationById(db, result.rows[0].id) : null;
  if (!invitation) return null;
  if (invitation.status === InvitationStatus.ACCEPTED) {
    await db.query(
      `INSERT INTO board_members (board_id, auth0_sub, role, invited_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (board_id, auth0_sub) DO UPDATE
       SET role = EXCLUDED.role`,
      [invitation.boardId, user.id, invitation.role, invitation.invitedBy],
    );
  }
  return invitation;
}

export async function declineInvitation(db: DbClient, invitationId: string, user: AuthUser): Promise<BoardInvitation | null> {
  if (!user.email) return null;
  const email = cleanEmail(user.email);
  const result = await db.query<{ id: string }>(
    `UPDATE board_invitations
     SET status = CASE WHEN status = 'PENDING' THEN 'DECLINED' ELSE status END,
         updated_at = now()
     WHERE id = $1 AND lower(email) = $2
     RETURNING id`,
    [invitationId, email],
  );
  return result.rows[0] ? getInvitationById(db, result.rows[0].id) : null;
}

export async function createLabel(db: DbClient, boardId: string, name: string | null | undefined, color: string, user: AuthUser): Promise<import('../types.js').Label> {
  const result = await db.query<import('./helpers/db-types.js').LabelRow>(
    'INSERT INTO labels (board_id, name, color) VALUES ($1, $2, $3) RETURNING id, board_id, name, color',
    [boardId, cleanOptional(name) ?? '', cleanColor(color)],
  );
  await recordActivity(db, boardId, null, 'LABEL_UPDATED', 'created a label', user);
  return toLabel(result.rows[0]);
}

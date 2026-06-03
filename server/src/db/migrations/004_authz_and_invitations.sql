ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_onboarded boolean NOT NULL DEFAULT true;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE TABLE IF NOT EXISTS board_members (
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  auth0_sub text NOT NULL,
  role text NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),
  invited_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, auth0_sub)
);

CREATE INDEX IF NOT EXISTS idx_board_members_user ON board_members (auth0_sub, board_id);

CREATE TABLE IF NOT EXISTS board_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('ADMIN', 'MEMBER')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED')),
  invited_by text NOT NULL,
  accepted_by text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_invitations_board ON board_invitations (board_id, status);
CREATE INDEX IF NOT EXISTS idx_board_invitations_email ON board_invitations (lower(email), status);

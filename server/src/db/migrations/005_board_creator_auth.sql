ALTER TABLE boards
  ADD COLUMN IF NOT EXISTS created_by_auth0_sub text;

UPDATE boards b
SET created_by_auth0_sub = owner.auth0_sub
FROM (
  SELECT DISTINCT ON (bm.board_id) bm.board_id, bm.auth0_sub
  FROM board_members bm
  WHERE bm.role = 'OWNER'
  ORDER BY bm.board_id, bm.created_at ASC
) AS owner
WHERE b.id = owner.board_id
  AND b.created_by_auth0_sub IS NULL;

UPDATE boards
SET created_by_auth0_sub = 'system'
WHERE created_by_auth0_sub IS NULL;

ALTER TABLE boards
  ALTER COLUMN created_by_auth0_sub SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_boards_created_by_auth0_sub ON boards (created_by_auth0_sub, created_at DESC);

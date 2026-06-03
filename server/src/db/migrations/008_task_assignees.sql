CREATE TABLE IF NOT EXISTS task_assignees (
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  auth0_sub text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, auth0_sub)
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_sub ON task_assignees (auth0_sub, task_id);

INSERT INTO task_assignees (task_id, auth0_sub)
SELECT id, assignee
FROM tasks
WHERE assignee IS NOT NULL AND btrim(assignee) <> ''
ON CONFLICT DO NOTHING;

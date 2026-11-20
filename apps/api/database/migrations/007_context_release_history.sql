CREATE TABLE IF NOT EXISTS context_release_rollbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES connected_projects(id) ON DELETE CASCADE,
  from_commit_sha TEXT NOT NULL,
  to_commit_sha TEXT NOT NULL,
  branch TEXT NOT NULL,
  actor_user_id UUID NOT NULL REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS context_release_rollbacks_project_created_idx
  ON context_release_rollbacks(project_id, created_at DESC);

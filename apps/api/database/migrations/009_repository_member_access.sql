ALTER TABLE project_members
  ADD COLUMN IF NOT EXISTS repository_access_source TEXT
    CHECK (repository_access_source IN ('contextops', 'external')),
  ADD COLUMN IF NOT EXISTS repository_access_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS github_repository_invitation_id BIGINT;

COMMENT ON COLUMN project_members.repository_access_source IS
  'Whether repository access was granted by ContextOps or already existed in GitHub.';

COMMENT ON COLUMN project_members.github_repository_invitation_id IS
  'The pending GitHub collaborator invitation created by ContextOps, when present.';

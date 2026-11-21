CREATE TABLE IF NOT EXISTS project_members (
  project_id UUID NOT NULL REFERENCES connected_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'reviewer', 'contributor')),
  invited_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

INSERT INTO project_members (project_id, user_id, role, invited_by)
SELECT id, user_id, 'owner', user_id
FROM connected_projects
ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'owner';

CREATE INDEX IF NOT EXISTS project_members_user_id_idx
  ON project_members(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS project_members_one_project_per_user_idx
  ON project_members(user_id);

CREATE TABLE IF NOT EXISTS project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES connected_projects(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'contributor'
    CHECK (role IN ('reviewer', 'contributor')),
  created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_invitations_project_id_idx
  ON project_invitations(project_id, created_at DESC);

ALTER TABLE context_proposals
  DROP CONSTRAINT IF EXISTS context_proposals_user_project_fk;

COMMENT ON COLUMN context_proposals.user_id IS
  'The project member who authored the proposal. Project access is enforced through project_members.';

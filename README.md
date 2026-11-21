# ContextOps

ContextOps is a shared context layer for teams using different AI assistants. It preserves important project decisions and the reasoning behind them, then makes approved context available to teammates and their assistants.

## Architecture

- `apps/web`: Next.js dashboard with shadcn/ui.
- `apps/api`: NestJS REST API and MCP service.
- GitHub Markdown/YAML context repository: source of truth, pull-request review, and release history.
- Docker Compose: production-style local API validation.
- GitHub Actions: lint, build, and container checks before deployment.
- Vercel and Railway: managed frontend and API deployment targets.

See [the architecture](docs/architecture.md) and [the implementation plan](docs/implementation-plan.md).
See [the deployment guide](docs/deployment.md) for the DevOps workflow and environment setup.
Production availability is checked by the scheduled [production health workflow](.github/workflows/production-health.yml); the deployment guide also documents the release rollback procedure.

## Current progress

Phase 1 architecture and project skeleton are complete. Phase 2A established the record model and dashboard using sample Markdown. Phase 2B.2 replaces the sample data with approved records read from the signed-in user's connected GitHub repository, while preserving search, filters, and record details. The type-specific proposal workflow is implemented locally: each of the seven record types has its own fields, approval checks, GitHub YAML content, and MCP draft submission tool.

GitHub sign-in, one-repository selection, persistent project settings, and context-folder setup are implemented. The library reads the active approved context snapshot. Phase 3 provides typed human approval/rejection and GitHub publishing; Phase 4 adds MCP search over the active commit; Phase 5 adds project handoffs, release history, and restore. Apply migrations `006_typed_proposal_content.sql` and `007_context_release_history.sql` in Supabase if you have not already applied them. See [the proposal guide](docs/proposal-drafts.md) and [MCP setup](docs/mcp-proposals.md).

## Start the development servers

Install dependencies from the repository root:

```powershell
corepack pnpm install
```

Start the API and dashboard in separate terminals:

```powershell
corepack pnpm dev:api
```

```powershell
corepack pnpm dev:web
```

The dashboard uses port 3000; the API uses port 4000.

## Supabase database connection

The API reads its local environment from `apps/api/.env`. Copy `apps/api/.env.example` to `apps/api/.env`, then paste the Supabase PostgreSQL connection string after `DATABASE_URL=`. Keep `.env` private; it is ignored by Git. Apply the numbered files in `apps/api/database/migrations/` in order. Migration `008_shared_project_membership.sql` adds project invitations, member roles, and shared proposal review.

## GitHub App setup for onboarding

Create a GitHub App and fill its values in `apps/api/.env`:

- App slug, App ID, Client ID, and Client secret.
- Private key as PEM text. In `.env`, keep it on one line and replace each line break with `\n`.
- User authorization callback URL: `http://localhost:4000/api/auth/github/callback`.
- Setup URL: `http://localhost:4000/api/auth/github/install/callback`.
- Repository permissions: **Contents: Read and write** and **Metadata: Read-only**. Users choose which repositories to grant during installation.

Restart the API after filling in these settings. A project owner signs up, installs the GitHub App, and selects the repository. Invited members sign in through their invitation link and do not install the GitHub App themselves. If `context/` is missing, the owner can ask ContextOps to add `context/README.md` to the default branch.

## Account, repository, and UI behavior

- Each account belongs to one shared project in the current MVP. The owner can invite contributors; invited members can create their own MCP key, read approved context, and submit drafts to the same proposal queue.
- Owners and reviewers can edit, approve, or reject team drafts. Contributors can edit their own drafts. Approved records are published through the project owner's GitHub App installation, so members do not need direct GitHub write credentials.
- The browser receives a seven-day, HttpOnly session cookie. PostgreSQL stores only a hash of its session token. Signing out deletes that session; it does not delete the saved project or uninstall the GitHub App.
- ContextOps periodically checks the GitHub App installation and repository access. The dashboard and Settings show the saved repository and its connection state. The user can reconnect or revoke the app from GitHub.
- See [`docs/github-account-and-repository-connection.md`](docs/github-account-and-repository-connection.md) for the flow and security details, and [`docs/ui-guidelines.md`](docs/ui-guidelines.md) for the shared UI style teammates should follow.

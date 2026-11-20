# Deployment

ContextOps uses managed services so the project demonstrates a practical DevOps workflow without maintaining servers.

## Services

- **Vercel** deploys `apps/web` (the Next.js dashboard).
- **Railway** deploys the NestJS API and MCP endpoint from `apps/api/Dockerfile`.
- **Supabase** hosts PostgreSQL. SQL migrations remain versioned in `apps/api/database/migrations`.
- **GitHub Actions** runs lint, application builds, and a production container build on every pull request and push to `main`.
- **Production health workflow** checks the deployed frontend, API health endpoint, and GitHub authentication configuration after successful `main` CI runs and every six hours.

## Environment configuration

Copy the example files for local development. Never commit the filled files.

- API: `apps/api/.env.example` to `apps/api/.env`
- Web: `apps/web/.env.example` to `apps/web/.env.local`

In Railway, add the API values from `apps/api/.env.example`. Set both `API_ORIGIN` and `WEB_ORIGIN` to the public Vercel URL. The browser reaches the API through a same-origin Vercel rewrite, while Railway remains the API host.

In Vercel, set `NEXT_PUBLIC_CONTEXTOPS_API_URL` to `/api` and set the server-only `CONTEXTOPS_API_URL` to the Railway URL followed by `/api`. GitHub's callback and setup URLs must use the public Vercel URL followed by `/api/auth/github/callback` and `/api/auth/github/install/callback`. This same-origin setup lets the secure session cookie work with server-rendered dashboard pages.

## Local production-style API check

With `apps/api/.env` configured, run:

```sh
docker compose up --build api
```

The container is ready when `http://localhost:4000/api/health` returns a JSON response with `"status":"ok"`.

## Production smoke test

Run the same non-destructive checks used by GitHub Actions:

```sh
bash scripts/smoke-production.sh
```

The script verifies that the login page is reachable, the API reports `status: ok`, and GitHub authentication reports `configured: true`. It retries briefly because Vercel and Railway can finish deploying at different times. The **Production health** workflow also runs after successful CI on `main`, on a six-hour schedule, and manually from GitHub Actions.

## Release and rollback

Merge only after GitHub Actions passes. If **Production health** fails, first open its log to identify whether the frontend, API, or GitHub configuration failed. Do not change the database unless the failure is proven to be migration-related.

### Preferred rollback: revert the release commit

Use a Git revert so the recovery is recorded and no Git history is deleted:

```sh
git switch main
git pull --ff-only origin main
git revert <faulty-commit-sha>
git push origin main
```

The revert triggers CI and the managed deployments again. Wait for CI and **Production health** to pass.

### Emergency provider rollback

If production must recover before a rebuild finishes:

1. In Vercel, open the `contextops-web` project, select the last known-good production deployment, and promote or redeploy it.
2. In Railway, open the API service deployment history and redeploy the last known-good deployment.
3. Run `bash scripts/smoke-production.sh` and confirm all three checks pass.
4. Still create a Git revert afterward so the repository matches the running release.

Vercel and Railway rollbacks change application releases; they do not reverse Supabase migrations. Database migrations should be backward-compatible. If a data migration needs recovery, use a separately reviewed corrective migration rather than deleting migration history.

ContextOps also has an in-product restore feature for approved context versions. That restores project context in GitHub and is separate from rolling back application code.

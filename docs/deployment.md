# Deployment

ContextOps uses managed services so the project demonstrates a practical DevOps workflow without maintaining servers.

## Services

- **Vercel** deploys `apps/web` (the Next.js dashboard).
- **Railway** deploys the NestJS API and MCP endpoint from `apps/api/Dockerfile`.
- **Supabase** hosts PostgreSQL. SQL migrations remain versioned in `apps/api/database/migrations`.
- **GitHub Actions** runs lint, application builds, and a production container build on every pull request and push to `main`.

## Environment configuration

Copy the example files for local development. Never commit the filled files.

- API: `apps/api/.env.example` to `apps/api/.env`
- Web: `apps/web/.env.example` to `apps/web/.env.local`

In Railway, add the API values from `apps/api/.env.example`. Set `API_ORIGIN` to the public Railway URL and `WEB_ORIGIN` to the public Vercel URL. GitHub's callback and setup URLs must use the public Railway URL.

In Vercel, set `NEXT_PUBLIC_CONTEXTOPS_API_URL` to the Railway URL followed by `/api`.

## Local production-style API check

With `apps/api/.env` configured, run:

```sh
docker compose up --build api
```

The container is ready when `http://localhost:4000/api/health` returns a JSON response with `"status":"ok"`.

## Release and rollback

Merge only after GitHub Actions passes. Vercel and Railway retain previous deployments; if a production release fails its health check, redeploy the last known-good release from the provider dashboard. ContextOps also has a separate in-product restore feature for approved context versions; that does not roll back application code.

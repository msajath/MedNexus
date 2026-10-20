# MedNexus

Healthcare appointment platform with a React/Vite frontend and Express/MongoDB API.

See [DATABASE_SECURITY.md](DATABASE_SECURITY.md) for database checks and Atlas
security settings, and [SHOWCASE.md](SHOWCASE.md) for isolated demonstration accounts.

## Quick start with Docker

1. Copy root `.env.example` to `.env`.
2. Generate separate random values for `MONGO_PASSWORD`, `MONGO_APP_PASSWORD`, and `JWT_SECRET` using the
   command in `.env.example` and fill in the file.
3. Run `docker compose up --build --detach --wait`.
4. Open http://localhost:8080 and check http://localhost:8080/api/ready.

The browser calls `/api`; only the backend connects to MongoDB. Docker Compose
creates a restricted MongoDB application account on a new database volume.
Existing volumes retain their existing database users; verify their permissions
before deployment. To use MongoDB Atlas, configure `.env.atlas` from
`.env.atlas.example`, then run `docker compose --env-file .env.atlas -f
docker-compose.atlas.yml up --build --detach --wait`.

## Native development

Use Node 24 and a running MongoDB instance. Copy `backend/.env.example` to
`backend/.env` and set the database URI and JWT secret.

In separate terminals:

```sh
cd backend
npm ci
npm run dev
```

```sh
cd frontend
npm ci
npm run dev
```

Vite proxies `/api` to port 5000. Open http://localhost:5173.

## QA and security

Run `npm test` in each component and `npm run lint` / `npm run build` in the
frontend. Run `npm run audit:db` in the backend for read-only database checks.
Atlas dashboard settings still need the manual checks in
[DATABASE_SECURITY.md](DATABASE_SECURITY.md).

New passwords require at least 10 characters and no more than 72 UTF-8 bytes.
Common passwords and passwords matching the account name or email are rejected.
Password reset codes expire after five minutes.
Production sessions use Secure, HttpOnly cookies; serve the site and API through
the same HTTPS origin. Configure SMTP for production password recovery.

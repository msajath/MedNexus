# MedNexus

Healthcare appointment platform with a React/Vite frontend and Express/MongoDB API.

See [DEVOPS.md](DEVOPS.md) for setup, CI, container releases, deployment, rollback,
health checks, logs, and database backup/restore.

## Quick start with Docker

1. Copy root `.env.example` to `.env`.
2. Generate separate random values for `MONGO_PASSWORD`, `MONGO_APP_PASSWORD`, and `JWT_SECRET` using the
   command in `.env.example` and fill in the file.
3. Run `docker compose up --build --detach --wait`.
4. Open http://localhost:8080 and check http://localhost:8080/api/ready.

The browser calls `/api`; only the backend connects to MongoDB. Docker Compose
creates a restricted MongoDB application account on a new database volume.
For an existing volume, follow the migration steps in [DEVOPS.md](DEVOPS.md).
To deploy the container stack with MongoDB Atlas instead, use
`docker-compose.atlas.yml` and `.env.atlas.example` as described there.

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

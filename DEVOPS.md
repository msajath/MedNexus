# MedNexus operations

## Local container startup

Install Docker Engine/Desktop with Compose v2 and use Node 24 for native development.
From the repository root in PowerShell:

```powershell
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Generate two separate values and put them in root `.env` as `MONGO_PASSWORD` and
`JWT_SECRET`. The Compose file refuses to start with missing secrets. Use a hex
Mongo password (other passwords must be URI encoded). Set `MONGO_USERNAME`.
The root `.env` configures containers; `backend/.env` is only for native development
and is excluded from container images. Never place secrets in frontend assets.

```powershell
docker compose config --quiet
docker compose up --build --detach --wait
docker compose ps
```

Open http://localhost:8080. Nginx serves React routes and proxies `/api/` to the
backend. MongoDB and the backend have no host ports. Mongo data persists in the
`mongo_data` volume. No seed data is inserted automatically. `npm run seed` is an
explicit data-changing operation; inspect `backend/seeder.js` before using it.

Mongo initialization credentials apply only when the volume is first created.
Changing `.env` does not rotate credentials in an existing database. Use database
user management for rotation; retain a verified backup first.

## CI and releases

GitHub Actions runs backend tests, frontend tests/lint/build, then a full Compose
smoke test including database readiness, the API proxy and SPA deep links. Pushes
to main/master or `v*` tags publish both tested images to GHCR with immutable
`sha-<full-commit-sha>` tags. PRs and dev pushes never publish. Enable Actions and
allow the workflow token to write packages. Dependabot checks npm, Docker and
Actions weekly. Configure branch protection to require both component checks and
`containers`, and require reviews before merging.

## Server deployment

Provision a Docker host and copy `docker-compose.yml` and a filled root `.env` to
a restricted directory. Set `BACKEND_IMAGE` and `FRONTEND_IMAGE` to GHCR images
from the same tested commit. For private packages, authenticate Docker to GHCR
using a token with read:packages. Do not put that token in this repository.

```sh
docker compose pull
docker compose up --no-build --detach --wait
docker compose ps
curl --fail http://127.0.0.1:8080/api/ready
```

Keep `HTTP_BIND=127.0.0.1` and place a host HTTPS reverse proxy in front of port
8080. Configure a domain, TLS certificate, firewall and `ALLOWED_ORIGINS` with
the exact HTTPS origin. Set SMTP variables to enable password reset emails;
the reset request returns 503 in production when SMTP is absent.
This repository does not provision a cloud account, domain or TLS certificate.
Choose the hosting provider before adding provider-specific infrastructure or CD
credentials. Review database least-privilege access before handling patient data;
the bundled Mongo configuration currently connects using its initialization admin.

To roll back, restore both previous commit image references in `.env` and run the
same pull/up commands. App rollback does not undo database changes. Take and verify
a backup before releases that change stored data.

## Health, logs and shutdown

`/api/health` checks process liveness; `/api/ready` returns 503 when MongoDB is not
connected. `/healthz` checks Nginx. Compose waits for healthy dependencies on
startup; it does not automatically restart containers solely because they become
unhealthy. Monitor readiness externally and alert on sustained failures.

```sh
docker compose logs --tail=100 -f
docker compose restart backend
docker compose down
```

Logs rotate at 10 MB with three files per container. The backend handles SIGTERM
and SIGINT, stops accepting requests and closes MongoDB connections within the
30-second container grace period. `down` retains database data; **do not use
`down --volumes` on a deployed database**, since it deletes that data.

## Database backup and restore

Create a backup inside the database container and copy it out (works in
PowerShell without binary output redirection):

```sh
docker compose exec -T mongodb sh -c 'mongodump --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db medibook --archive=/tmp/mednexus.archive.gz --gzip'
docker compose cp mongodb:/tmp/mednexus.archive.gz ./mednexus.archive.gz
```

Store archives encrypted outside the server, restrict access, define retention,
and schedule backups using your host scheduler. Archives contain sensitive data;
never commit them. Restore into an isolated environment first and verify counts
and application behavior. Copy the archive into that environment's container:

```sh
docker compose cp ./mednexus.archive.gz mongodb:/tmp/mednexus.archive.gz
docker compose exec -T mongodb sh -c 'mongorestore --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive=/tmp/mednexus.archive.gz --gzip --nsInclude="medibook.*"'
```

Restore merges into existing collections and may encounter duplicate keys. Stop
writers and plan the target database state before recovery. Do not add `--drop`
unless deletion of the target collections is intended and authorized.

## Native development checks

```sh
cd backend
npm ci
npm test
cd ../frontend
npm ci
npm test
npm run lint
npm run build
```

On Windows where PowerShell blocks npm.ps1, use `npm.cmd` instead of `npm`.

Reference: [Compose health dependencies](https://docs.docker.com/compose/how-tos/startup-order/),
[GitHub image publishing](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).

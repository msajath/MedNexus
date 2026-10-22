# MedNexus

Healthcare appointment platform with a React/Vite frontend and Express/MongoDB API.

See [DATABASE_SECURITY.md](DATABASE_SECURITY.md) for database checks and Atlas security settings.
See [DEPLOYMENT.md](DEPLOYMENT.md) for production hosting, health checks, and outage recovery.

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

Run the local checks from PowerShell:

```powershell
Set-Location "D:\4th sem\MedNexus\backend"
npm ci
npm test
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
npm run audit:db

Set-Location "D:\4th sem\MedNexus\frontend"
npm ci
npm test
npm run lint
npm run build
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
```

Coverage is enforced by the test commands used in CI. The current unit-test
baselines and minimum global thresholds are:

| Component | Baseline (statements / branches / functions / lines) | Minimum threshold |
| --- | --- | --- |
| Backend | 62.21% / 53.18% / 50.50% / 64.60% | 58% / 48% / 45% / 62% |
| Frontend | 78.91% / 67.32% / 73.63% / 81.67% | 75% / 65% / 70% / 77% |

The backend baseline is unit-only when `MONGO_TEST_URI` is not configured.
Six MongoDB-backed integration suites (65 tests) remain unverified on a
machine without a disposable MongoDB service; CI runs them against an
ephemeral MongoDB service and fails if any suite or test is skipped. The
authentication middleware, MongoDB security utility, and payment model also
have stricter module-specific thresholds in `backend/jest.config.js`.

The required GitHub Actions `dependency-audit` job runs full and
production-only audits for both components. High and critical findings fail
the job; moderate and low findings remain visible in the audit output and
uploaded JSON artifacts. Audit failures caused by registry or network errors
also fail the job. Dependency updates are not applied automatically.

Backend integration tests run in GitHub Actions against an ephemeral MongoDB
service at `127.0.0.1`, never against Atlas. Locally, set `MONGO_TEST_URI`
only to a localhost database whose name ends in `_test`, `_ci`, or `_qa`, then
run:

```powershell
Set-Location "D:\4th sem\MedNexus\backend"
$env:NODE_ENV = "test"
$env:MONGO_TEST_URI = "mongodb://127.0.0.1:27017/mednexus_ci"
npx jest --runInBand --testPathPatterns=tests/integration
Remove-Item Env:MONGO_TEST_URI
Remove-Item Env:NODE_ENV
```

When Docker is unavailable, the backend also provides a disposable
`mongodb-memory-server` runner that requires no database setup:

```powershell
Set-Location "D:\4th sem\MedNexus\backend"
npm run test:qa -- --testPathPatterns=tests/integration --coverage=false
```

This runner creates synthetic data, uses a temporary database, and stops the
MongoDB process after Jest exits. It must not be configured with an Atlas URI.
Browser QA uses the same isolated strategy through `scripts/qaServer.js`:

```powershell
Set-Location "D:\4th sem\MedNexus\frontend"
npm run test:e2e
```

To inspect CI results, open the repository's **Actions** tab, select the
workflow run, and open `dependency-audit`, `backend-integration`, or `checks`.
Failed tests appear in the job log. Skipped tests appear in Jest's summary and
are not treated as successful integration coverage; the CI integration job
fails if any integration suite or test is skipped. Audit JSON reports are
available under the workflow run's **Artifacts** section.

To rerun a failed workflow, open the failed run, choose **Re-run failed jobs**,
and inspect the new run rather than assuming the previous result changed.
Never use `npm audit fix --force` without reviewing compatibility and a
separate dependency change.

Atlas dashboard settings still need the manual checks in
[DATABASE_SECURITY.md](DATABASE_SECURITY.md).

New passwords require at least 10 characters and no more than 72 UTF-8 bytes.
Common passwords and passwords matching the account name or email are rejected.
Password reset codes expire after five minutes.
Production sessions use Secure, HttpOnly cookies; serve the site and API through
the same HTTPS origin. Configure SMTP for production password recovery.

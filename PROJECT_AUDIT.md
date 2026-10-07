# MedNexus project audit

**Reviewed:** 7 October 2026 (Asia/Colombo)
**Revision:** local `main` at `9ea817a` (one commit ahead of `origin/main` when reviewed)
**Scope:** Express/Mongoose API, React/Vite client, tests, Docker Compose, CI, configuration and npm dependencies. This is a source and local-build audit, not a deployed-system penetration test or a legal/compliance certification.

## Remediation update (8 October 2026)

The findings below describe the original revision. The current working tree now
restricts doctor record access to confirmed/completed treatment relationships,
excludes private and soft-deleted records, and requires a matching appointment
before a doctor can write a record. Doctor plaintext password storage and API/UI
display were removed; startup deletes legacy `tempPassword` values. Existing
doctor passwords should still be rotated using Forgot Password because prior
plaintext copies may have existed in backups or logs.

MongoDB now enforces unique active booking slots and email addresses before the
API accepts traffic. Doctor deactivation preserves appointments and records and
invalidates access. Password changes invalidate prior JWTs. The demo seeder is
blocked in production. Docker Compose uses a database-scoped application user;
see [DEVOPS.md](DEVOPS.md) for the existing-volume migration. Production npm
audits reported zero vulnerabilities in both backend and frontend after dependency
updates; the backend development dependency tree still has moderate advisories.

Added route tests and a MongoDB-backed integration suite for authorization,
concurrent booking, deactivation, and email uniqueness. The integration suite and
container startup remain unverified locally because no MongoDB service or Docker
daemon is running on this machine. CI is configured to run those checks, but its
result has not been observed. The local test/build status is recorded in
`runtime-validation-report.md` and should be rerun after the final changes.

**Current decision:** Do not use real patient data yet. A live database and
staging deployment still need verification, including index migration on existing
data, SMTP delivery, HTTPS, backup restore, access-policy review, and operational
monitoring. This source review is not a compliance certification.

## Decision

**Not ready for real patient data or an internet-facing production deployment.** Local checks pass, but the access-control and data-integrity findings below need repair and verification with a real database. A passing test suite does not establish that every route is safe.

## Verification performed

| Check | Result |
| --- | --- |
| `backend: npm test` | Pass: 6 suites, 30 tests |
| `frontend: npm test` | Pass: 2 files, 4 tests |
| `frontend: npm run lint` | Pass |
| `frontend: npm run build` | Pass |
| `docker compose config --quiet` with temporary validation values | Pass |
| `npm audit --omit=dev` | Backend: 5 advisories (1 critical, 4 moderate); frontend: 5 high advisories |
| `npm audit` including development packages | Backend: 14 advisories (1 critical, 6 high, 7 moderate); frontend: 11 (8 high, 3 moderate) |
| `git ls-files` for `.env` files | No tracked `.env` file found |
| Container build and live integration test | **Not run:** Docker daemon unavailable on this machine |
| Live MongoDB index inspection, email delivery, TLS, backup restore, deployed CI | **Not verified:** no running target service or deployment was supplied |

The advisory counts reflect npm's database on the review date. An advisory does not prove that its exploit path is reachable in this application. In particular, the [proxy-addr advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) describes a specific trust-subnet configuration; this project uses a one-hop trust setting. The [React Router advisory](https://github.com/advisories/GHSA-qwww-vcr4-c8h2) concerns RSC mode, while this client is a Vite SPA. Upgrade and retest affected packages anyway.

## Findings, ordered by priority

### P0 — Patient record access is not scoped to a treating doctor

`backend/routes/medicalRecordRoutes.js:93-98` allows any authenticated user with the `doctor` role to read all records for any syntactically valid `patientId`. `:110-137` also lets any doctor create a record for any patient and attach an arbitrary appointment ID. The `isPrivate` field in `backend/models/MedicalRecord.js:54` is not checked in these routes. A doctor can therefore access or modify another doctor's patient's medical information if the patient ID is known. **Fix:** enforce a documented patient-doctor relationship or explicit consent in both routes, verify appointment ownership, and add deny-by-default tests using two doctors and two patients.

### P0 — Initial doctor passwords are stored in plaintext

`backend/models/Doctor.js:10-13` defines `tempPassword`; `backend/routes/adminRoutes.js:125-128` stores the supplied password there, and `:180` returns it from the admin list. This creates a second, unhashed password store even though `User.password` is hashed. **Fix:** remove the plaintext field and its API/UI use; create a single-use setup or password-reset flow. Plan deletion of existing stored plaintext values and rotation of affected credentials.

### P1 — Concurrent bookings can claim the same slot

`backend/routes/appointmentRoutes.js:65-76` checks `Appointment.findOne` before `Appointment.create`, but `backend/models/Appointment.js` has no unique slot constraint. Two simultaneous requests can both observe an empty slot and both insert. **Fix:** enforce slot uniqueness atomically in MongoDB, with a design that permits reuse after cancellation, then add a concurrent-request integration test. Decide whether an appointment may begin at the schedule end; the current check allows it.

### P1 — Email uniqueness is not guaranteed by the current database setup

`backend/models/User.js:15` declares `unique: true`, but `backend/config/db.js:14` connects with `autoIndex: false` and there is no explicit index migration in the repository. On a fresh database, the unique index may not exist. The application-level lookup in `backend/routes/authRoutes.js:72-80` is subject to a race. **Fix:** create and verify the unique email index through a controlled migration before accepting registrations; handle duplicate-key errors. Inspect existing data for duplicate emails first.

### P1 — Deleting a doctor also deletes patients' medical records

`backend/routes/adminRoutes.js:253-283` adds `{ doctor: doctor._id }` to the record deletion filter, then calls `MedicalRecord.deleteMany`. Removing a doctor therefore removes medical records belonging to patients, including records they may need to retain. **Fix:** define a retention and reassignment policy, preserve patient records, and make account deletion a reviewed operation with a recovery path and integration tests.

### P1 — Dependency advisories need triage and updates

The backend production audit reports a critical `proxy-addr` advisory plus moderate `body-parser`, `mongoose`, and `qs` advisories. The frontend production audit reports high `nanoid`, `postcss`, `react-router`, and `source-map-js` advisories. The full audit also flags development dependencies. Relevant primary advisories include [proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), [Mongoose](https://github.com/advisories/GHSA-664h-wqgq-64gw), and [React Router](https://github.com/advisories/GHSA-qwww-vcr4-c8h2). **Fix:** update lockfiles with compatible patched versions, rerun audit and all tests, and record any advisory judged not applicable with evidence. Do not assume npm severity equals exploitability here.

### P2 — Authentication and account recovery have deployment limits

`backend/routes/authRoutes.js:15-41` uses process-local Maps for reset limits; counters reset on restart and do not coordinate across replicas. Login has no equivalent attempt limit (`:127-181`). `backend/middleware/auth.js:20-30` accepts a signed JWT until expiry even after a password change or reset. `frontend/src/context/AuthContext.jsx:65,99` stores the bearer token in `localStorage`, which raises the impact of any client-side script injection. **Fix:** use a shared rate-limit store for a scaled deployment, add login protection, define token invalidation on password reset, and review token storage alongside a strict content-security policy.

### P2 — Doctor visibility and booking time validation are inconsistent

The doctor list filters verified users (`backend/routes/doctorRoutes.js:29-49`), but `GET /api/doctors/:id` at `:123-153` fetches by ID without a verification check and returns the doctor's email. `backend/routes/appointmentRoutes.js:20-35` checks calendar validity and weekly hours but does not reject past dates; it also accepts the exact schedule end as a start time. **Fix:** apply the same visibility policy to detail and booking routes, validate future dates in the intended time zone, and define appointment duration/end-time rules.

### P2 — Operational safeguards are incomplete

`docker-compose.yml:6-31` gives the API MongoDB's initialization root credentials. `DEVOPS.md` documents a manual backup but no scheduled job or verified restore result. `backend/seeder.js:291-295` deletes user, doctor, appointment and availability collections and contains published demo passwords at `:417-419`; a mistaken production run would destroy data. **Fix:** create an application-scoped Mongo user, schedule encrypted backups with restore drills, and block the destructive seeder when `NODE_ENV=production`.

### P2 — Current tests do not cover the highest-risk paths

Backend route tests mock models, so they cannot catch index creation, concurrent inserts, query authorization against real records, or transaction/cleanup behavior. The frontend has only four tests. CI's Compose smoke check exercises health and SPA routing, not login, booking, patient-record permissions, or email delivery (`.github/workflows/ci.yml:40-64`). **Fix:** add database-backed integration tests for record access, slot races, doctor deletion, and authentication; run them in CI against disposable MongoDB. Verify the full container stack and rollback on a staging host.

## What is working

- Public and private routes are separated in the API; admin routes use server-side role checks (`backend/routes/adminRoutes.js:15`).
- The current backend and frontend test suites, lint, and production asset build pass locally.
- Compose has health checks and MongoDB persistence; Nginx proxies `/api/` and handles SPA routes.
- The committed `.env.example` files document required settings, while real `.env` files are ignored by Git.
- CI runs tests and a container smoke test before publishing images. Its execution for the local `9ea817a` commit has not been observed because that commit has not been pushed.

## Recommended repair sequence

1. Restrict medical-record read/write access and remove plaintext doctor passwords. Treat existing data as sensitive during cleanup.
2. Add MongoDB indexes/migrations and atomic slot booking; verify behavior with a real database.
3. Prevent patient-record deletion on doctor removal and review retention requirements.
4. Update audited dependencies, then run full tests and a container smoke test.
5. Finish auth/operations hardening and expand CI integration coverage before using real patient information.

This report records the state reviewed on 7 October 2026. Re-run the checks after repairs and before every production release.

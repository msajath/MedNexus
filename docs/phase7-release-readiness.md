# MedNexus Phase 7 — production readiness report

Audit date: **22 October 2026**. Repository baseline: `a92e897390e60bc3ea29271d50db1ff54defd61b`, plus the preserved working changes and the local fixes described below. **Decision: NOT READY for production.** No commit, push, merge, workflow dispatch, infrastructure purchase, staging deployment, production deployment, provider setting change, or production patient-record access was performed.

## A. Executive summary

The authentication, role separation, clinical-record restrictions, MongoDB transport validation, manual receipt ledger, doctor earnings ownership, and leave/booking coordination are present in the actual repository. Local regression checks pass as recorded below. These results do not certify the deployed revision, Atlas privileges, backups, or hosted CI.

Release is blocked by a failed GitHub-hosted CI run, a confirmed incompatibility between the default Compose database connection and the production TLS policy, missing staging evidence, and unverified production configuration/Atlas/backup controls. The public API initially returned 502 and subsequently recovered; that is evidence of an availability interruption, not proof of lasting reliability or its exact cause.

Small confirmed defects were fixed locally. Working application flows were retained, and no production configuration or data was changed. Existing changes to the integration CI coverage command, README, real-browser report selector, and existing runtime report were preserved.

## B. Security verification

| Area | Verified implementation and practical limit |
| --- | --- |
| Authentication | JWT verification restricts algorithms to HS256, loads identity/role from the database, rejects inactive accounts and revoked token versions. A production JWT secret shorter than 32 characters fails startup. Registration cannot grant admin. Password hashes use bcrypt cost 12; password/reset fields are excluded by default. |
| Browser session | HttpOnly, production Secure, SameSite=Lax session cookie; the client uses credentials and a request-protection header, without storing a bearer token in localStorage. Mutations with cookie authentication require that header. Origin allowlisting and preflight prevent untrusted browser origins from supplying it. Non-browser callers still require valid authentication. |
| Password recovery | Cryptographically generated six-digit code, hashed storage, five-minute expiry, rate-limited endpoints, atomic single use, and token-version revocation. Production missing SMTP cannot disclose a reset code through a development logging fallback. Delivery through the real SMTP provider remains unverified. |
| Input and errors | Server-side validation/allowlisting, ObjectId checks, JSON/body limits, Mongo operator/prototype-key rejection, generic HTTP errors, Helmet headers, and no-store API caching are present. No raw connection string was printed during this audit. |
| Rate limiting | General and account-specific limits exist. Proxy trust is bounded to zero or one hop; raw Forwarded headers do not choose identity. The in-memory store is per process and resets on restart; multi-instance/global abuse protection is not established. Verify the actual Vercel/Render proxy chain before changing trust settings. |
| Medical privacy | Admin medical-record routes and attachments are denied server-side; frontend `/admin/records` redirects, while backend `/api/admin/records` returns 403. Administrative appointment serializers omit symptoms/clinical notes. Patient/doctor record ownership and treating relationships are tested. This is not field-level encryption or a healthcare regulatory certification. |
| Payments | Receipt/refund endpoints are behind admin authentication and authorization. Integer minor units, USD-only validation, amount/date/reference validation, server-assigned attribution, unique active-receipt and idempotency-key indexes, and atomic full-refund state transitions protect the ledger. No bank/card credentials are requested as structured fields. The free-text reference must still never contain sensitive financial data. |
| Earnings | The doctor summary derives the doctor from the authenticated user and returns totals only. Query parameters cannot select another doctor. Patients cannot read administrative finances. Appointment completion/fee changes do not create payments. Cancellation does not invent a refund. |
| Leave and booking | Read-only conflict preview; final recheck after publishing review intent; review-token compare-and-set; overlapping approved/reviewing leave protection; provisional booking/reschedule work; MongoDB-clock expiry checks; and preserved original bookings on failed reschedules. Interrupted reviews remain blocked for explicit admin recovery. Pending applications can overlap under a race, but both cannot be approved. |

### Confirmed defects fixed locally

1. Production startup now rejects an implicit database name and a fallback URI naming a different database, before opening a connection. This prevents silent default-database/dataset selection; it does not migrate data.
2. Doctor verification returns an explicit account-field allowlist, omitting DOB, blood type, address, token version, and other private fields.
3. A database failure during duplicate-payment recovery now returns a safe HTTP 500 instead of escaping the Express 4 async handler.
4. A keyed receipt retry returns the original receipt after cancellation, refund, or booking removal. It cannot create another financial effect. The original received timestamp is retained; retry metadata does not rewrite history.
5. The admin receipt UI supplies a UUID idempotency key, reuses it after an ambiguous failure, and changes it for edited receipt data. A refunded replay is described accurately. Keys persist within the mounted form, not across a closed tab/reload; the active-receipt unique index remains the independent duplicate guard.
6. UI-contract Playwright artifacts now have a separate directory. The first parallel UI/API browser runs collided in the previously shared trace directory; the UI run was repeated after separating artifacts. This was a test-runner artifact failure, not an application assertion failure.
7. The environment template documents the optional TLS fallback and corrects the stale statement that development email bodies are logged.

No schema/index deletion, TLS bypass, integration-test disabling, assertion weakening, or dependency-force installation was introduced.

## C. Local test results

Environment: Windows/PowerShell, Node **24.11.1**, npm **11.6.2**, installed Chrome for Playwright. Disposable MongoDB **7.0.14** was used; no test was pointed at `medibook` or Atlas.

| Executed command/check | Final result |
| --- | --- |
| Backend `npm run test:coverage -- --json --outputFile=coverage/unit-results.json` | **PASS: 169 unit tests, 20 suites.** The 6 integration suites/67 tests are intentionally skipped in this no-database invocation and are not counted as passes here. |
| Backend coverage | **PASS:** statements 63.90%, branches 55.30%, functions 52.34%, lines 66.34%. Global thresholds 58/48/45/62; auth, database-security, and Payment-specific thresholds also pass. |
| Backend `npm run test:qa -- --testPathPatterns=tests/integration --coverage=false --json --outputFile=coverage/integration-results.json` | **PASS: 67 tests, all 6 suites, zero skips**, 98.6 seconds. |
| Frontend `npm run test:coverage` | **PASS: 115 tests, 14 files.** |
| Frontend coverage | **PASS:** statements 79.04%, branches 67.40%, functions 73.63%, lines 81.80%; thresholds 75/65/70/77. |
| Frontend `npm run lint`, `npm run build` | **PASS**, Vite 8.3.5. Vitest and coverage provider both 4.1.12. |
| `QA_BROWSER_CHANNEL=chrome npm run test:e2e` | **PASS: 16 real-API browser tests**, desktop and mobile; isolated MongoDB. |
| `QA_BROWSER_CHANNEL=chrome npm run test:ui` | **PASS: 14 UI-contract browser tests**, desktop/mobile, after separating artifact directories. First concurrent attempt: 12 passed, 2 trace-artifact errors; those failures are not hidden. |
| Backend/frontend `npm audit --audit-level=high --json` | **PASS: zero reported vulnerabilities** in both complete installed dependency trees at audit time. This is a point-in-time advisory check, not a container/OS audit. |
| `npm audit --omit=dev --audit-level=high --json` | **PASS: zero vulnerabilities for backend and frontend.** Initial requests had TLS transport/timeout errors; the final frontend retry succeeded using IPv4-first DNS preference, a bounded timeout and no certificate-validation bypass. |
| Both `npm ci --dry-run --ignore-scripts --no-audit --no-fund` | **PASS.** Linux-target dry runs also passed. These validate resolution/lock consistency, not clean Linux lifecycle scripts/native binaries. |
| Actionlint 1.7.12 | **PASS**, official Windows binary with release SHA256 checked. |
| Gitleaks 8.30.1 | **PASS**, redacted scan of all reachable Git history: 160 commits, no findings; official release SHA256 checked. Ignored local secret files are not part of this history scan. |
| `npm run audit:db -- --config-only` | **PASS** for local URI syntax, explicit database, configured authentication, TLS and no certificate bypass. No connection made. Separate offline production-policy check confirms the locally configured database is explicitly `medibook`; deployed configuration remains unverified. |
| Built frontend secret-value comparison | Two configured local secret values checked against generated JS/CSS; **zero matches**. No tracked `.env`, private key, or PKCS file found. This is not proof against every possible secret format. |
| Local Docker/Compose runtime | **BLOCKED:** Docker Linux daemon unavailable. Static TLS incompatibility is independently confirmed. |

The six database suites exercise real Mongoose queries, unique indexes, retained audit documents, concurrent receipt/refund/booking/reset requests, token-fenced leave review, and expiry-boundary interleavings. They are not entirely mocked route tests. Some tests deliberately intercept one operation to force a race, while the surrounding persistence and assertions use real MongoDB. Their final counts are: workflows 19, leave/booking 20, admin payments 14, admin operations 6, doctor payments 4, security 4 — **67 total**. The two new payment lifecycle tests explain the increase from 65.

Coverage thresholds apply to instrumented/imported modules. Neither runner explicitly includes every source file in its coverage denominator. Passing coverage does not mean every function/page is covered; production SMTP, real provider proxy behavior, Atlas permissions, container runtime, and hosted staging remain outside these local results. Browser E2E does not replace the financial/leave integration and component tests.

Local evidence files are in ignored `backend/coverage`, `frontend/coverage`, `frontend/playwright-report`, and `frontend/playwright-report-ui` directories. Do not publish secret-bearing logs or real patient data as artifacts.

## D. GitHub Actions status

The actual [MedNexus CI run 39736955644](https://github.com/msajath/MedNexus/actions/runs/39736955644), for baseline `a92e897`, **failed** on 22 October 2026. Backend coverage and integration commands failed; frontend `npm ci` failed in checks, dependency-audit, and browser jobs. Secrets and backend audit passed; containers and publish were skipped. Authenticated detailed logs were unavailable, so the exact install/coverage failure causes are **unverified**. Do not attribute all failures to the old Vitest conflict: current local locks resolve successfully. The separate [CodeQL run](https://github.com/msajath/MedNexus/actions/runs/39736955668) passed; it is not evidence that the CI run passed.

The current working workflow has the intended branch/PR/tag/manual triggers, committed-lockfile `npm ci`, coverage tests, frontend lint/build, two audit scopes per component, six MongoDB suites against a disposable localhost database, both browser commands, container checks, and artifacts. Skipped integration tests/suites cause failure; the exact guard was exercised with synthetic results (clean exit 0, pending test/suite exit 1). High/critical audit failures propagate. Publishing requires **secrets, checks, dependency-audit, backend-integration, browser-qa, and containers**, not just an audit. Default permissions are contents-read; publishing alone gets packages-write. No pull_request_target or production service secret is supplied to untrusted PR jobs. CodeQL is separate and not a publish dependency.

The preserved workflow edit removes coverage only from the integration subset; the independent full coverage job remains required. This revised workflow has **no successful hosted run yet**. `main` is publicly reported **unprotected**, with no active branch rules found. Require review and successful checks before merging. Render/Vercel Git auto-deploy settings must also be checked: the Actions publish dependency graph does not itself gate provider auto-deployment.

Detailed job URLs and validation evidence: [CI audit appendix](phase7-ci-audit.md).

### User-operated hosted verification, after review approval

No commands below were dispatched by this audit. An owner first reviews the local diff, resolves the Compose TLS blocker, and explicitly approves committing/pushing the candidate. To run checks without image publication, use **GitHub → Actions → MedNexus CI and images → Run workflow → select the reviewed branch**. A manual dispatch runs verification; `publish` is deliberately push-only. Selecting the existing baseline will not test these uncommitted fixes.

If GitHub CLI is installed and authenticated, the equivalent commands are:

```powershell
gh workflow run ci.yml --repo msajath/MedNexus --ref <reviewed-branch>
gh run list --repo msajath/MedNexus --workflow ci.yml --limit 5
gh run watch <run-id> --repo msajath/MedNexus --exit-status
gh run view <run-id> --repo msajath/MedNexus --log-failed
gh run download <run-id> --repo msajath/MedNexus --dir <new-local-evidence-folder>
```

Confirm the exact head SHA, every required job, integration JSON with all six suites/zero skips, coverage artifacts, audits, and both browser reports. A green older SHA is insufficient. `gh` is not installed here; read-only public REST metadata was used, with no permission bypass.

## E. MongoDB security and production environment checklist

The application needs **readWrite on medibook only**: its runtime CRUD, index creation, and legacy tempPassword cleanup do not require atlasAdmin, user administration, or unrelated database privileges. MongoDB's [built-in role reference](https://www.mongodb.com/docs/manual/reference/built-in-roles/) includes createIndex in readWrite. A separately authorized backup operator may need different permissions; those do not belong in the application runtime credential.

Remote production SRV connections require TLS; standard URIs require explicit TLS, and insecure certificate/hostname options or duplicated/conflicting security options are rejected. Explicit localhost connections retain the existing local exception. Do not use that exception as a production Atlas workaround. No TLS verification was disabled.

The old `DATABASE_SECURITY.md` reports an atlasAdmin account and implicit `test` database on 20 October. These are **historical findings requiring recheck**, not current production facts. Offline local configuration now names medibook with TLS; the audit did not authenticate to Atlas or inspect records/roles.

| Variable | Required production expectation | Deployed value verified? |
| --- | --- | --- |
| `NODE_ENV` | `production`; Dockerfile supplies it. Missing/incorrect value changes cookie and validation behavior. | No |
| `MONGO_URI` | Explicit `/medibook`, intended Atlas cluster, dedicated database user; URL-encode credentials. Do not substitute a test/demo dataset. | No |
| `MONGO_STANDARD_URI` | Optional fallback to the **same dataset/database**, authenticated, `tls=true` with certificate verification. Omit if unnecessary. Matching names do not prove matching cluster/data. | No |
| `JWT_SECRET` | Independently generated high-entropy secret, at least 32 characters. No placeholder/reused test secret. | No |
| `JWT_EXPIRE` | Optional; defaults 7d. Review session lifetime; cookie maxAge is separately fixed at 7d. | No |
| `PORT` | Provider-injected Render port; defaults 5000; bind on 0.0.0.0. | No |
| `ALLOWED_ORIGINS` | Exact intended HTTPS frontend origins, normally `https://med-nexus-pi.vercel.app`; comma-separated if there are approved additional domains. Missing value falls back to local development origins, so it must be explicitly reviewed. | Tested origin works; full deployed list unknown |
| `TRUST_PROXY` | Render default one nearest hop when `RENDER=true`, or explicitly 1 after verifying topology; no blanket trust. | Full setting/chain unknown |
| `CLINIC_TIME_ZONE` | Asia/Colombo unless business rules require another IANA zone. | No |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Required for production reset/initial-admin email delivery; provider credentials in backend secrets only. | No |
| `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM` | Match mail provider; typically 587/false for STARTTLS or 465/true. Validate actual TLS and successful delivery in staging. | No |
| Frontend API configuration | Production `API_BASE` is empty; `/api` must be proxied by `frontend/vercel.json` to the intended Render backend. `VITE_API_URL` is development-only here. | Public rewrite exercised; project settings/SHA unknown |
| `ADMIN_EMAIL`, `ADMIN_NAME` | One-time bootstrap operator inputs, not routine service requirements. Do not rerun provisioning on an existing production database as an audit. | Not used |
| `SEED_PASSWORD`, `MONGO_TEST_URI`, `QA_MONGO_URI`, `QA_API_TARGET` | Development/test only; keep production runtime and build environment free of test routing/seed credentials. | No |

`ATLAS_MONGO_URI` is the **Compose interpolation variable** in `.env.atlas.example`, mapped to backend `MONGO_URI`; it is not the Render application variable. No gateway API secret is required for the current manual ledger, which does not charge or refund real money.

### Atlas owner verification — no changes performed

1. In the actual cluster's Atlas project, confirm database user roles show readWrite **only on medibook**; no atlasAdmin, dbOwner, readWriteAnyDatabase, or unrelated database grants. Confirm Render uses this user without copying its URI into an issue/chat.
2. Match every CIDR in **Render service → Connect → Outbound** to the correct project's Atlas IP access list. Render can use any IP in its [published service ranges](https://render.com/docs/outbound-ip-addresses). Use current dashboard values, not copied historical ranges. Review broad 0.0.0.0/0 entries and temporary developer entries; do not remove a functioning rule without a tested replacement/rollback.
3. Confirm active cluster, MFA/project membership, relevant alerts/audit availability, and credential rotation/access policy. Do not grant extra runtime privileges merely to run a security audit command.
4. Verify backup capability for the actual tier, newest successful backup, retention/RPO/RTO, and an isolated restore drill. Absence of a backup/restore record is a release blocker.
5. Record dated configuration evidence with credentials and patient information redacted. All dashboard checks remain **BLOCKED by unavailable management access** in this audit.

## F. Render and Vercel deployment compatibility

Backend startup is `node server.js`/`npm start`; `backend/Dockerfile` uses Node 24 Alpine and `npm ci --omit=dev`. It waits for MongoDB connection, required safety indexes, and legacy plaintext doctor-password removal before binding. `/api/health` is process liveness; `/api/ready` performs a bounded database ping. Configure the Render dashboard health check to `/api/ready`; Dockerfile HEALTHCHECK does not establish that setting. The frontend build is `npm ci` then `npm run build`, output `dist`, root directory `frontend`. SPA and `/api` rewrites plus security headers are present in vercel.json.

Node major 24 is used in CI and Docker. Exact Node/npm versions and base image digests are not pinned; clean Linux installs/native optional dependencies and image contents remain unverified locally. No container/OS vulnerability scan is configured. Current dry runs do not explain hosted frontend install failure.

Public read-only observations, 22 October UTC:

| Time | Request | Observed result |
| --- | --- | --- |
| 07:11 | Vercel `/api/ready` | **502**, `X-Render-Routing: no-deploy` |
| 07:11 | Direct Render `/api/ready` | Timeout after 25 seconds |
| 07:11 | Vercel `/contact` | **200**, index.html and CSP/HSTS/nosniff/frame-denial headers |
| 07:12:20 | Direct Render `/api/health` | **200**, API no-store and Helmet headers |
| 07:12:21 | Vercel proxied login preflight, intended origin | **204**, exact allowed origin and credentials |
| 07:12:38–39 | Direct and proxied `/api/ready` | **200** for both |
| 07:12:40 | Proxied login preflight, untrusted.example origin | **403**, no access grant |

Only public static/operational endpoints and preflight were requested; no login, patient records, or financial operations were performed in production. A recovery is not a verified deployment status, startup-log review, SLA, or idle-period stability test. Free instances [sleep after 15 idle minutes](https://render.com/docs/free); the user previously reported a Free instance. Cold start is plausible but **not established as the cause** of this particular no-deploy response. Check events/logs and instance type before diagnosing or purchasing a change.

The default `docker-compose.yml` is a **confirmed blocker**: production mode connects to hostname `mongodb` without TLS, and the validator rejects it. Do not exempt Docker hostnames, disable TLS validation, or set a production service to development. A correct self-hosted TLS path needs a server certificate covering the service hostname, trusted CA mounting/client configuration, and an executed container test. The Atlas Compose path preserves provider TLS but is not the disposable default-Compose CI path. No untested certificate deployment was added during this audit.

## G. Outstanding risks and release gates

Status meanings: PASS = executed/inspected with evidence; FAIL = executed or reproduced and failed; BLOCKED = access/infrastructure needed; NOT VERIFIED = not checked sufficiently. Plans do not count as executed controls.

| Release gate | Status | Evidence / remaining action |
| --- | --- | --- |
| Backend unit tests | **PASS** | 169 / 20 suites |
| Six MongoDB integration suites | **PASS** | 67 tests, zero skips; disposable Mongo, never medibook |
| Frontend tests | **PASS** | 115 / 14 files |
| Backend/frontend coverage thresholds | **PASS** | Percentages in C; imported-module scope limitation |
| Dependency audits | **PASS** | Zero reported advisories in all-dependency and production-only checks for both components |
| Frontend production build/lint | **PASS** | Final build/lint exit 0 |
| Browser QA | **PASS** | 16 real-API + 14 UI-contract tests; desktop/mobile, synthetic data |
| Workflow syntax and skip enforcement | **PASS** | Actionlint; synthetic skip guard failures verified |
| GitHub-hosted CI for release candidate | **FAIL / NOT VERIFIED candidate** | Baseline run failed; uncommitted candidate has no hosted run |
| Container runtime/production TLS compatibility | **FAIL**, runtime **BLOCKED** | Parser reproduction; stopped Docker engine |
| Staging smoke tests | **BLOCKED** | No separate online staging supplied or deployed |
| Production configuration review | Repository **PASS**, deployed **BLOCKED** | Public routing/headers checked; settings/SHA/logs not available |
| Atlas least privilege/network configuration | **BLOCKED** | Current dashboard/role evidence unavailable; historical admin privilege concern |
| Backup and rollback readiness | Written plan **PASS**, actual recovery evidence **BLOCKED** | Backup/restore and compatible rollback revision not verified |
| Enforced required CI/review | **FAIL** for observed main | Unprotected branch; provider auto-deploy gating unknown |
| No unresolved release-blocking findings | **FAIL** | TLS Compose path, hosted CI, staging and operational controls outstanding |

Further limits: manual payment records do not prove bank settlement; no gateway is implemented. Financial references/free-text, clinical data encryption/retention, operational monitoring, centralized rate limits, SMTP behavior, and access logging need business/security-owner review. No claim that all functions are bug-free or that a live service can never fail is supported.

## H. Isolated staging validation plan

Prepare, but do not deploy automatically:

1. Owner provisions a separate database **mednexus_staging** with a dedicated readWrite-only user and credentials that cannot read medibook; preferably use a separate Atlas project/cluster. Use synthetic identities/reports and no production backup copied with patient data. Local test runners must continue to use localhost test/CI/QA databases, not hosted staging or medibook.
2. Prepare a separate Render staging service and Vercel staging project/URL. Use test-only JWT and SMTP sandbox credentials, NODE_ENV=production, explicit staging URI, staging CORS origin, and readiness checks. Do not reuse production service secrets. Do not create paid resources without owner approval.
3. In the staging configuration, change the Vercel `/api` rewrite to the staging Render URL. **Setting VITE_API_URL will not do this in a production build.** Verify the target before exercising any write. Keep the production project/configuration untouched.
4. Seed only the isolated environment with controlled synthetic patient, doctor and admin identities. The development seeder is destructive and intentionally refuses remote databases; do not bypass that guard. Prepare fixtures through approved staging provisioning/API workflows. Use SMTP sandbox delivery for registration/reset tests and no real financial transactions.
5. Deploy the reviewed, hosted-CI-passing SHA to staging only after explicit owner authorization. Record both deployed SHAs, database isolation evidence, access rules, test time, outcomes, and sanitized artifacts.

| Staging smoke check | Acceptance criterion |
| --- | --- |
| Website, deep links, health, readiness | `/`, `/contact`, `/doctors` load; direct/proxied health and ready return 200; missing assets return 404; restart behavior is observed. |
| Registration/authentication | Synthetic registration/login/reload/logout; Secure/HttpOnly/SameSite cookie; invalid login rejected; password change/reset revokes old session; sandbox email code expires after five minutes and cannot be reused. |
| Patient/doctor/admin dashboards | Each role lands correctly; cross-role direct routes/APIs return redirect/401/403 as appropriate; admin cannot access reports/attachments or clinical notes. |
| Booking/rescheduling | Weekday slots visible, weekend booking rejected, occupied/leave slots rejected; two simultaneous attempts yield one booking; failed reschedule retains original slot; status counts/history agree. |
| Receipts/refunds/earnings | Only admin records a **synthetic already-received** receipt; lost-response retry preserves one ID; differing keyed payload rejected; non-admin requests rejected; two refunds cause one state change; totals/doctor ownership correct; no fee-derived fake earnings. |
| Leave | Doctor applies/cancels own pending request; admin previews conflicts and acknowledges review; active booking blocks approval; resolving synthetic booking permits approval; approved dates block slots; stale/concurrent decisions cannot overwrite final outcome. |
| Operations report | Download Operations Report is valid JSON with actual administrative counts/receipts and no clinical fields. |
| API failures/security | Controlled staging-only database outage gives safe 503/readiness failure; recovery works; never manufacture failures in production. Trusted origin preflight succeeds, untrusted origin fails; CSP/HSTS/nosniff/frame protections present; no cached private response. |
| Desktop/mobile | Run all flows at desktop and mobile widths, navigation, inputs, tables, error/retry states, keyboard labels, and download controls. |

This plan is prepared; none of these hosted staging checks has been executed.

## I. Production deployment plan — owner-operated after all gates pass

1. Identify the **actually working** backend and frontend SHAs in Render/Vercel deployment history and record them with timestamps. `git rev-parse HEAD` only identifies local code; the current baseline is not proven to be the working deployed release.
2. Review this diff and the blocking hosted logs. Resolve/execute the TLS Compose path, clean Linux lockfile installation, and every required hosted job. Configure required branch checks/review and inspect provider auto-deploy gating before any main push. Do not use force or legacy-peer-deps to suppress an unexplained install error.
3. Obtain dated Atlas privilege/network evidence and a successful backup/isolated restore record. Confirm acceptable recovery point/time and an incident owner. Do not proceed if a backup is assumed rather than verified.
4. Review schema/index changes against synthetic restored-format fixtures: active_doctor_slot, availability/email uniqueness, one_received_payment_per_appointment, one_payment_per_idempotency_key, and leave lookup indexes. Startup calls createIndexes (not drop/syncIndexes) and removes legacy tempPassword fields. Existing duplicates can prevent startup. Any production data inspection/remediation requires a separately approved operator procedure; never delete conflicts to make an index build pass.
5. After explicit review approval, commit the reviewed candidate and create an annotated release-candidate tag. Recommended message/tag are in K. Publish only the owner-approved revision; record exact SHA and immutable artifact/image references. This audit did not perform these Git actions.
6. Finish staging H and owner sign-off. Schedule the production release and monitoring/rollback coverage. Preserve intended database/dataset and provider settings; do not seed or run automated destructive tests against production.
7. Owner deploys backend candidate through Render's release controls using the backend context/Dockerfile and existing approved environment. Confirm startup logs, index completion, 0.0.0.0:$PORT binding, readiness health-check success and exact SHA before releasing the matching frontend. Never print URIs or credentials into a support log.
8. Owner deploys the matching frontend to Vercel with frontend root/build/output settings and the reviewed production API rewrite. Confirm deployment SHA/domain mapping and deep-link behavior.
9. Perform narrowly scoped production smoke checks: static pages, headers/CORS, direct/proxied health/readiness, and an explicitly approved non-patient test identity if permitted by policy. Financial/booking/record mutations stay in staging. Check provider logs, errors and metrics through the release window and after an idle period. Do not equate a one-time 200 with release stability.
10. Record acceptance, monitoring ownership, current release IDs and rollback links. If any required gate fails, stop rollout and follow J.

## J. Backup, rollback and incident recovery

Application rollback selects the previously recorded compatible release in **both Render and Vercel**. It does **not** undo receipt/refund history, booking/leave states, added indexes/fields, credential cleanup, or any other database change. Do not reset Git, wipe collections, drop indexes, restore a snapshot over live data, or replay financial mutations as an automatic recovery step.

Before release, prove the rollback build understands the current schema, provisional booking filters, idempotency indexes and payment history. An older pre-coordination build is not automatically compatible with new holds/intents. A rollback must not reopen admin clinical access or weaken TLS. If no compatible rollback revision exists, use an approved forward fix or maintenance response rather than guessing.

For a Render 502/no-deploy: capture timestamp/request ID, inspect Events for a healthy deployment and SHA, then build/startup logs. Check npm ci/build failures, crash/exit loops, explicit database/TLS configuration, Atlas cluster availability and outbound allowlist, required index failure, JWT configuration, port binding and dashboard readiness path. Compare direct Render `/api/health` and `/api/ready` with Vercel proxy readiness. If direct succeeds and proxy fails, inspect rewrite/domain routing; if health succeeds and ready fails, investigate database/connectivity. Check Free-instance cold starts without assuming they explain every 502. See [Render health checks](https://render.com/docs/health-checks).

For unexpected auth failures, stop further auth-related rollout, check cookie origin/Secure behavior, JWT secret/expiry and token-version effects without exposing values, and roll back only to a compatible secure version. Secret rotation may deliberately invalidate all sessions; never share/revert secrets casually. For database errors, stop write tests, preserve audit history, involve the database owner, and verify URI/dataset/TLS/network/index state. Do not bypass readiness or loosen Atlas access as an automatic fix.

Database recovery is a separate owner-approved operation: confirm backup recovery point, restore to an **isolated** target, validate integrity and financial/appointment state, assess post-backup writes, and choose an approved reconciliation/cutover plan. Document data-loss risk and permissions. Actual backup availability and restore success remain unverified.

## K. Git commit and release identification

No commit or tag was created and nothing was pushed. Recommended commit message:

`fix: close release audit gaps in MongoDB startup and payment retries`

Recommended candidate tag after review and successful hosted checks: `v2026.10.22-rc.1` (first verify it is unused). Do not tag this uncommitted work as a completed production release. Preserve existing user changes and separately review the CI/runtime documentation edits. Link the final test evidence and this report to the candidate SHA; re-run relevant checks if code or dependencies change.

After the owner has approved and committed the reviewed candidate, create the tag explicitly against its SHA:

```powershell
git status --short
git diff --check
git show --no-patch --format=fuller <candidate-sha>
git tag -l v2026.10.22-rc.1
git ls-remote --tags origin refs/tags/v2026.10.22-rc.1
# Only if the tag is unused and the SHA is the approved, tested candidate:
git tag -a v2026.10.22-rc.1 <candidate-sha> -m 'MedNexus reviewed staging candidate'
```

Publishing a `v*` tag also triggers the workflow's image-publication path; push/tag publication therefore needs its own explicit owner action and review of provider auto-deploy behavior. None was performed here.

## L. Production readiness decision

**NOT READY.** Local security and QA evidence is positive, and the isolated staging plan is ready for review. Production approval requires a successful hosted CI run for the exact candidate, a functioning TLS-compatible container verification path, completed staging smoke tests, current Render/Vercel and Atlas configuration evidence, enforced release gates, and demonstrated backup/rollback readiness. No local test count substitutes for those controls.

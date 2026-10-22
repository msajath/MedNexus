# MedNexus Phase 7.2 release verification

23 October 2026, Asia/Colombo. This report supersedes the Git-state and latest-run statements in the historical Phase 7/7.1 reports. Labels: **PASS**, **FAIL**, **BLOCKED**, **NOT VERIFIED**.

## Release state

**BLOCKED for Phase 7.3 / production release.** The current hosted revision has failed integration/browser jobs, container runtime checks have not executed, and main has no active protection. The targeted fixes below pass local regression checks but have no new commit, PR or hosted run yet.

The starting release branch was `release/phase-7-1-hardening`. During this work, external Git actions committed and merged the earlier repairs. No commit, push, merge, dispatch, provider deployment or repository-settings change was performed by this agent.

| History/state | Verified value |
| --- | --- |
| Preserved Phase 7 commit | `f2431c32b777e8bfad3ef39e356b60586c1a1764` |
| Phase 7.1 repair commit | `101416f3f67d382f5beeea4d982a036298062689` |
| Merged/reconciled main and origin/main | `17f69c2d671117a6edee4d1a2e00b4199812e9a6` |
| Existing PR | [#26](https://github.com/msajath/MedNexus/pull/26), merged 22 October 2026 at 16:29:45 UTC; not a draft |
| Remote original release branch | Also points to `17f69c2`; original proposed commit/PR is obsolete |
| New local corrective branch | `release/phase-7-2-ci-fixes`, based on `17f69c2` |
| New corrective commit / PR / hosted run | **NOT VERIFIED**: none created; changes remain unstaged |

The misleading f2431c3 title says authentication syntax, but its actual 20-file diff contains database, payment, admin, UI, regression and audit-documentation changes. It is an ancestor of origin/main and remains unmodified. There was no auth-module syntax repair in that diff. No amend, reset, discard or history rewrite was used.

`git status`, branch, ten-commit log, HEAD diff, cached names, untracked inventory and comparison with origin/main were reviewed. The index is empty. Two externally created untracked files, `run_39814536964_jobs.json` and `run_artifacts.json`, are public CI metadata; they are retained and excluded from the proposed commit. Local evidence, coverage, browser output and diagnostics remain ignored. Only example environment files are tracked; no real environment file or private key is proposed.

## Release content review

**PASS for inspected source and local regressions; deployed Atlas/provider configuration is NOT VERIFIED.**

| Required content | Evidence retained in the candidate |
| --- | --- |
| MongoDB TLS | `backend/utils/databaseSecurity.js`, `backend/config/db.js`: production TLS and explicit database, certificate/hostname bypass rejection, matching fallback database names; database-security tests pass |
| Payment idempotency/duplicates | `adminPaymentRoutes.js`, `Payment.js`: recorder-scoped retry key/fingerprint and unique received-payment index; real MongoDB payment/concurrency tests pass |
| Admin payment authorization | Protected admin router; anonymous/other-role tests pass |
| Doctor earnings access | `paymentRoutes.js` scopes the profile to authenticated doctor; cross-doctor/privacy tests pass |
| Leave approval conflicts | `leaveRoutes.js` rechecks eligibility and active/provisional bookings; booking/leave race tests pass |
| Sensitive-field redaction | Explicit admin response selections, safe error responses, hidden passwords/reset fields; security and admin workflow regressions pass |
| Frontend dependencies | Matched Vitest/coverage 4.1.12 and corrected optional bundled metadata retained; hosted install, tests, lint/build and audits pass at 17f69c2 |
| CI vulnerability gates | Both full and production audits retain high-severity enforcement; secret gate and publishing dependencies preserved |
| Coverage | All existing global/module thresholds remain unchanged; local 179-test backend coverage run passes |
| MongoDB integration | Six real-database suites, localhost/test-database guard, disposable fixtures and zero-skip CI guard retained |
| Browser QA | Separate UI artifacts retained; 16 real-API desktop/mobile browser tests pass locally |
| Frontend lockfile | Phase 7.1 correction is already merged; no duplicate lock repair or force/legacy-peer workaround added |
| Docker separation | Separate development database/volume/account/network; production TLS policy unchanged; configuration contract passes |
| Release documentation | Historical reports preserved; this report records current Git/CI state and remaining blockers |

The reconciliation also brought major backend dependency upgrades, including Mongoose 9, Express 5 and Jest 30. These made the earlier integration/browser results insufficient for this revision. No additional removed Express APIs or Mongoose middleware patterns were found in the focused migration review.

## Confirmed failures and minimal repairs

**FAIL at hosted 17f69c2; PASS for local corrective regression checks.**

1. **User persistence:** Mongoose 9 no longer supplies `next()` to pre middleware. The old async password hook called it and a disposable-database reproduction failed with `TypeError: next is not a function`. The hook now completes through its promise, retains bcrypt cost 12 and hashes only changed passwords. Existing integration workflows now also assert that stored passwords are hashed, profile updates preserve the hash and password replacement accepts only the new password. See the [Mongoose migration guide](https://mongoosejs.com/docs/migrating_to_9.html).
2. **Jest database handshake:** the user's hosted log shows 30-second `beforeAll` timeouts. Local stage diagnostics narrowed this to connection establishment; a temporary shorter diagnostic deadline exposed `Missing required sub-document 'driver' in the client metadata document`. The same connection and indexes succeeded in plain Node. MongoDB driver 7.7 dynamically imports `os`; that import fails inside Jest without VM module support and the driver substitutes empty metadata. This matches [MongoDB's tracked defect](https://jira.mongodb.org/browse/NODE-7832). Enabling Jest's documented `--experimental-vm-modules` launch flag made the failing suite pass, followed by all six suites. Package scripts and the disposable-Mongo runner consistently use the flag; CI calls the package test script. Production Node startup is unchanged. See [Jest's launch instructions](https://jestjs.io/docs/ecmascript-modules).
3. **Unsupported container runtime:** both Dockerfiles selected Node 25 after reconciliation. It is end-of-life. Both now select Node 24 LTS, matching CI's major version. This is a source correction pending actual Linux builds/start/smoke tests. [Node's release status](https://nodejs.org/en/about/previous-releases) lists Node 25 as EOL and Node 24 as LTS.

The password-hook defect explains a failure while the browser QA server creates its users; that link is an inference from the startup code and local persistence reproduction. The hosted browser startup traceback has not been supplied/downloaded, so it is not presented as a directly observed hosted error. All 16 real-API browser cases pass after the hook fix.

No dependency downgrade, timeout increase, skipped test, lowered threshold, disabled audit, driver mock or production database write was used. Temporary diagnostic logging and connection options were removed. Existing Mongoose deprecation notices (`new`, `validateSync`) are follow-up maintenance, not failed assertions. The VM module API remains experimental and is confined to test processes.

## Actual hosted CI

Run [39814536964](https://github.com/msajath/MedNexus/actions/runs/39814536964), workflow `MedNexus CI and images`, push on main, created **22 October 2026 16:29:47 UTC**, completed **failure**. Every row below is for exact SHA **17f69c2d671117a6edee4d1a2e00b4199812e9a6**. These are actual public job/step conclusions; they do not describe the uncommitted fixes.

| Required job | Status | Relevant step/result | Uploaded artifact |
| --- | --- | --- | --- |
| `secrets` | **PASS** | Complete-history secret scan succeeded | None |
| `checks (backend)` | **PASS** | Install and full coverage command succeeded | `coverage-backend` |
| `checks (frontend)` | **PASS** | Install, coverage, lint and build succeeded | `coverage-frontend`, `frontend-dist` |
| `dependency-audit (backend)` | **PASS** | Full and production audit steps succeeded | `npm-audit-backend` |
| `dependency-audit (frontend)` | **PASS** | Full and production audit steps succeeded | `npm-audit-frontend` |
| `backend-integration` | **FAIL** | `Run integration tests against disposable MongoDB`; supplied log shows beforeAll timeouts | `backend-integration-results` |
| `browser-qa` | **FAIL** | UI step succeeded; `Run npm run test:e2e` failed | `browser-qa-report` |
| `containers` | **NOT VERIFIED** | Skipped because upstream integration failed; no build/start/smoke execution | None |
| `publish` (push-only) | **NOT VERIFIED** | Skipped because upstream gates failed | None |

Detailed log/artifact downloads require GitHub authentication unavailable to this session. The backend failure excerpt came from the owner. Exact hosted test counts, zero unexpected skips and artifact contents are **NOT VERIFIED**; artifact existence is not a successful-test result. The earlier run 39736955644 is historical and is not evidence for this candidate.

Artifact inventory was verified through the run API: audit backend `12442235389` (622 bytes), frontend distribution `12442060799` (4,270,556), audit frontend `12441911031` (624), frontend coverage `12441107873` (2,258,865), backend coverage `12440998757` (228,356), integration results `12440919182` (12,529), browser report `12440759581` (404,884). None was expired at inspection.

## Local validation of the corrective working tree

Node v24.11.1 on Windows; MongoMemoryServer 7.0.14 with generated localhost QA databases. Real Atlas/medibook data was not contacted.

| Check | Status | Result |
| --- | --- | --- |
| Backend full coverage command | **PASS** | 179 tests, 20 suites; all existing thresholds passed. The 67 integration cases are expected skips in this unit-only run and execute separately below |
| Backend coverage, all-files S/B/F/L | **PASS** | 64.04% / 56.23% / 52.34% / 66.39%; global threshold calculations exclude individually gated modules |
| Real database integration | **PASS** | 67 tests, six suites, **zero skipped tests/suites**, 84.3 seconds |
| Real-API browser QA | **PASS** | 16 desktop/mobile tests, 1.3 minutes |
| UI contract browser QA | **PASS** | 14 desktop/mobile tests, 2.1 minutes; combined with real-API QA, 30 browser tests passed |
| Backend lock consistency | **PASS** | `npm ci --dry-run --ignore-scripts --no-audit --no-fund`; dependency metadata matches lock. Script-only edits do not require a new lock |
| Workflow syntax | **PASS** | Actionlint 1.7.12; this is static validation, not hosted execution |
| Compose contract | **PASS** | `node scripts/checkComposeConfig.js`: development isolation and production separation; configuration only |
| Container runtime | **BLOCKED** | Docker CLI cannot connect to Docker Desktop Linux engine pipe; hosted container job skipped |
| Current frontend unit/lint/build/audits | **PASS at hosted baseline** | Their application/dependency sources are unchanged by this patch; no claim of a fresh local rerun |
| Patch whitespace / independent source review | **PASS** | `git diff --check`; security/coverage/skip gates unchanged |
| Reviewed-file secret scan | **PASS** | Gitleaks 8.30.1, zero leaks in the eight proposed files and two retained external CI JSON files; hosted baseline also passed history scanning |

Ignored evidence includes `backend/coverage/phase72-unit-results.json`, `backend/coverage/phase72-integration-results.json`, browser reports, and `.phase72-evidence.local` metadata. Preserve these locally; do not stage them.

## Branch protection and deployment safety

**FAIL:** fresh public main metadata has `protected: false`; the active branch-rules endpoint and repository rulesets both return empty lists. No settings were changed.

Owner action: GitHub repository **Settings → Rules → Rulesets → New branch ruleset**. Activate it, target `main`, require a pull request and the exact required contexts below, block force pushes and deletion, and keep bypass access empty or limited to explicitly accountable emergency owners. Enable requiring the branch to be up to date with main. For a solo repository, use zero mandatory approving reviews unless another eligible reviewer is available; do not require impossible self-approval.

Required contexts: `secrets`, `checks (backend)`, `checks (frontend)`, `dependency-audit (backend)`, `dependency-audit (frontend)`, `backend-integration`, `browser-qa`, `containers`. Select the GitHub Actions source if offered. CodeQL's observed context is `analyze` if that workflow is intended to be mandatory. Do not require push-only `publish` on a PR, and do not invent a staging check. Repository-plan enforcement support and the final configured ruleset remain **NOT VERIFIED** until the owner applies and checks it.

The owner reports **Vercel previews disabled; Render deploys main only**. This is owner-confirmed, not independently dashboard-verified. Historical public deployment records include Preview and Production entries for 17f69c2; the Production entry was created at 16:29:58 UTC, before CI completed. Current production deployment is therefore not proven CI-gated. No preview was opened or used for synthetic writes.

`frontend/vercel.json` rewrites `/api/*` to the production Render API for every Vercel build. Keep previews disabled. Before enabling any preview/staging site, give it an isolated API/database and verify its API origin; never run these write tests against a Vercel preview pointing at production. The local/CI suites use guarded disposable MongoDB and localhost browser URLs. Main merges may deploy automatically; merge/deploy approval is separate and is not included in this Phase 7.2 work.

## Exact reviewed file set and manual release commands

Eight proposed files: `.github/workflows/ci.yml`, `backend/Dockerfile`, `backend/models/User.js`, `backend/package.json`, `backend/scripts/testWithMongo.js`, `backend/tests/integration/workflows.test.js`, `frontend/Dockerfile`, and this report. The two external JSON files, all ignored evidence, real environment files and generated output are excluded.

These commands are prepared only. **Do not execute commit, push or PR creation without explicit owner approval.** The Phase 7.2 request explicitly requires that approval. Review the index before committing and stop if anything outside this list appears; preserve unrelated staged work.

```powershell
git switch release/phase-7-2-ci-fixes
git status --short
git diff --check
git add -- .github/workflows/ci.yml backend/Dockerfile backend/models/User.js backend/package.json backend/scripts/testWithMongo.js backend/tests/integration/workflows.test.js frontend/Dockerfile docs/phase72-release-verification.md
git diff --cached --name-status
git diff --cached
git commit -m "fix: restore database QA and use supported Node runtime"
git rev-parse HEAD
git push --set-upstream origin release/phase-7-2-ci-fixes
```

Prepare a **new Draft PR** from `release/phase-7-2-ci-fixes` to `main`; #26 is already merged. Title: **Fix Mongoose 9 persistence and MongoDB CI handshake; restore Node 24 LTS**. The complete prepared body is in `.phase72-evidence.local/phase72-pr-body.md`. If an authenticated GitHub CLI becomes available, after explicit approval:

```powershell
gh pr create --repo msajath/MedNexus --draft --base main --head release/phase-7-2-ci-fixes --title "Fix Mongoose 9 persistence and MongoDB CI handshake; restore Node 24 LTS" --body-file .phase72-evidence.local/phase72-pr-body.md
```

The CLI is not installed/connected here. The equivalent GitHub UI flow is Compare branches → select these exact branches → Create draft pull request, using the prepared body. A draft PR still triggers CI. Feature-branch pushes alone are not covered by this workflow's push branch filters.

After an authorized push/PR, verify all eight required jobs on the **new exact head SHA**, including uploaded integration JSON with zero skipped cases and executed Linux Compose build/start/smoke steps. If any job fails, read its first meaningful error and repair only the necessary cause without weakening gates. Do not reuse 17f69c2's green unit jobs as proof of the new commit.

## Remaining actions / Phase 7.3 decision

**BLOCKED:** owner approval for the reviewed commit/push/new draft PR; an all-green hosted run on its exact SHA; executed Linux container smoke tests; effective main protection and deployment-gate verification. Hosted browser startup details remain **NOT VERIFIED**, although the local reproduction and all 16 real-API cases validate the targeted fix. Atlas roles/network/backups and always-on production availability remain operator verification items from Phase 7, not newly certified here.

Phase 7.3 is **not ready** until these release gates are satisfied. Stop at Phase 7.2; no production data changes, automatic deployment, main push, settings mutation or merge is authorized by this report.

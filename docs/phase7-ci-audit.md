# Phase 7: CI, deployment, environment and database security evidence

Audit date: 22 October 2026, Asia/Colombo. This is a read-only audit of the
workspace based on commit `a92e897390e60bc3ea29271d50db1ff54defd61b`, public GitHub
run metadata, and local validation. Existing uncommitted work was preserved.
No push, deployment, provider setting, production database connection, or
production data change was performed by this CI audit. Other Phase 7 agents
made separate local code and test changes, which are outside this agent's
read-only review scope.

## Release blockers and unverified claims

1. **The latest hosted CI run for the inspected commit failed.** Local passing
   commands do not establish hosted success. Frontend dependency installation
   failed before its tests, lint, build and browser jobs could run. Backend unit
   coverage and integration commands also failed. Container verification and
   image publication were consequently skipped. Public job annotations expose
   exit code 1 but not the detailed cause; the job-log download API returned
   HTTP 403 without authenticated access.
2. **Default Compose cannot satisfy the production MongoDB TLS policy.**
   `docker-compose.yml` sets `NODE_ENV=production` and connects to the service
   hostname `mongodb` using an unencrypted standard MongoDB URI. A synthetic,
   parser-only call to `validateMongoUriSecurity` rejected that configuration
   with `Production remote MongoDB connections require explicit TLS`.
   No database was contacted for this proof. Do not weaken TLS validation or
   switch the production backend to development mode. Self-managed MongoDB needs
   TLS server certificates, a matching hostname, and trusted CA configuration
   on both server and client. The documented Atlas Compose alternative uses
   provider TLS, but does not repair the default Compose CI test.
3. **Main is not protected by a visible GitHub branch gate.** The public
   `branches/main` response reported `protected: false`; active branch rules and
   repository rulesets returned no entries. Image publication is gated by CI,
   but the observed branch can receive commits with failing checks. An owner
   should configure required checks and review rules through repository settings.
4. **Production readiness remains unverified.** The repository does not contain
   a Render/Vercel deploy job. Provider Git integration, deployment approval,
   current release SHA, instance type, SMTP delivery, Atlas roles/network access,
   backups, and restore evidence cannot be certified from these files. The
   parent audit observed intermittent availability: at 07:11 UTC frontend
   readiness returned HTTP 502 with `X-Render-Routing: no-deploy` and the direct
   API timed out; at 07:12:20 direct health returned 200; at 07:12:38 both direct
   and frontend readiness returned 200. Intended-origin CORS preflight returned
   204 and a malicious-origin request returned 403. This is recovery evidence,
   not proof of sustained production availability.

## Hosted evidence

[MedNexus CI run 39736955644](https://github.com/msajath/MedNexus/actions/runs/39736955644)
ran for `a92e897390e60bc3ea29271d50db1ff54defd61b` on 22 October 2026,
06:54:56–06:56:52 UTC, equivalent to 12:24:56–12:26:52 in Asia/Colombo.

| Job | Result | Failed step | UTC start–finish | Evidence |
| --- | --- | --- | --- | --- |
| Secrets | Passed | — | 06:54:58–06:55:06 | [Job](https://github.com/msajath/MedNexus/actions/runs/39736955644/job/119684784168) |
| Backend dependency audit | Passed | — | 06:54:58–06:55:45 | [Job](https://github.com/msajath/MedNexus/actions/runs/39736955644/job/119684784257) |
| Backend checks | Failed | `npm run test:coverage` | 06:54:59–06:55:22 | [Job](https://github.com/msajath/MedNexus/actions/runs/39736955644/job/119684784263) |
| Backend integration | Failed | Integration Jest command | 06:54:58–06:56:51 | [Job](https://github.com/msajath/MedNexus/actions/runs/39736955644/job/119684783973) |
| Frontend checks | Failed | `npm ci` | 06:54:58–06:55:07 | [Job](https://github.com/msajath/MedNexus/actions/runs/39736955644/job/119684784313) |
| Frontend dependency audit | Failed | `npm ci` | 06:54:59–06:55:07 | [Job](https://github.com/msajath/MedNexus/actions/runs/39736955644/job/119684784390) |
| Browser QA | Failed | Frontend `npm ci` | 06:54:58–06:55:53 | [Job](https://github.com/msajath/MedNexus/actions/runs/39736955644/job/119684784225) |
| Containers | Skipped | Upstream failures | — | [Job](https://github.com/msajath/MedNexus/actions/runs/39736955644/job/119685440396) |
| Publish | Skipped | Upstream failures | — | [Job](https://github.com/msajath/MedNexus/actions/runs/39736955644/job/119685441042) |

The separate [CodeQL run 39736955668](https://github.com/msajath/MedNexus/actions/runs/39736955668)
passed for the same SHA, 06:54:56–06:56:08 UTC. A successful analysis run does
not by itself prove that the repository enforces a blocking policy on findings.

Hosted annotations also warn that the pinned v4 GitHub actions target deprecated
Node 20 and are forced to run on Node 24, and that `ubuntu-latest` is migrating to
Ubuntu 26. These are environment maintenance warnings; they do not identify the
cause of the observed command failures.

## Workflow configuration that is present

The inspected `.github/workflows/ci.yml` defines push triggers for `main`,
`master`, `dev` and `v*` tags; pull requests; and manual dispatch. Default token
permissions are `contents: read`; only the publish job adds `packages: write`.
There is no `pull_request_target` execution path. Actions are pinned to commit
SHAs, jobs have timeouts, and concurrency cancels superseded runs.

The workflow includes full-history redacted Gitleaks scanning, backend/frontend
coverage checks, frontend ESLint and build, all-dependency and production-only
`npm audit` checks that fail on high/critical findings, disposable MongoDB
integration tests, desktop/mobile Playwright runs, Compose smoke checks, and
report artifacts. Image publication requires secrets, checks, dependency audit,
integration, browser QA, and container jobs to pass. It runs only on qualifying
pushes and generates SHA/tag image references with SBOM and provenance options.
CodeQL is a separate workflow and is not in that publish job's dependency list.

Coverage thresholds exist in `backend/jest.config.js` and
`frontend/vite.config.js`. The workspace CI edit removes `--coverage` only from
the integration-only command. The general checks job still runs
`npm run test:coverage`. This avoids demanding coverage of unrelated modules
from an integration subset; the revised workflow has not yet passed a hosted
run. That edit alone does not explain or fix the other hosted failures.

Reproducibility remains partial: CI and Docker select Node major 24 without an
exact npm version, manifests lack `engines`/`packageManager` pins, and Docker base
images are mutable tags rather than digests. No container vulnerability scan
is configured. Dependabot covers npm, Docker and GitHub Actions weekly.

## Local checks and count reconciliation

| Check | Observation |
| --- | --- |
| Actionlint | Official v1.7.12 Windows binary; release SHA256 verified; exit 0 for the current workflows. ShellCheck was not separately installed or run. |
| Full-history secret scan | Official Gitleaks v8.30.1 Windows binary; release SHA256 verified; `git --log-opts=--all --redact=100`; 160 commits / approximately 6.81 MB; no findings; exit 0. This scans reachable Git history, not ignored local secret files. |
| Lock manifests | Both lockfiles are v3; root dependency specifications match their package manifests. Frontend Vitest and V8 coverage are both 4.1.12. |
| Linux-target installation dry run | Both components passed `npm ci --dry-run --ignore-scripts --no-audit --no-fund --os=linux --cpu=x64 --libc=glibc` using local Node 24.11.1 / npm 11.6.2. This is not an actual clean Linux install or a reproduction of the hosted npm failure. |
| Latest backend unit/coverage result | Parent audit's final workspace validation: **169 tests passed in 20 unit suites**, with 67 integration tests skipped when no test URI was supplied. Coverage: statements 63.90%, branches 55.30%, functions 52.34%, lines 66.34%; thresholds passed. This agent's earlier run had 167 passes / 65 skipped before the final two payment tests. The original 164-test claim predates all five new tests. |
| Latest frontend unit/coverage result | Parent audit's final workspace validation: **115 tests passed in 14 files**. Coverage: statements 79.04%, branches 67.40%, functions 73.63%, lines 81.80%; thresholds passed. The original 114-test claim predates the new receipt-form test. |
| Integration discovery and final execution | The final workspace contains **67 tests across six files**. The parent audit confirmed **67 passed, six suites passed, zero skipped** against disposable MongoDB. Their skips in the separate unit-only invocation are not counted as passes. |
| Docker | CLI exists, but the Docker Linux daemon pipe is unavailable. No local container runtime test was completed. |
| GitHub CLI | `gh` was not installed; public REST metadata was available without credentials. Log download required additional authorization and was not bypassed. |

The earlier claim of 16 real-API browser tests is a separate QA result, not
evidence that the corresponding hosted job passed.
Mocked UI-contract Playwright runs and real-API browser runs are distinct
commands in CI; a single browser count should identify which command produced it.

The six integration files discovered by Jest, including the final two payment
tests added by the parent audit, are:

| File | Tests discovered |
| --- | ---: |
| `workflows.test.js` | 19 |
| `leaveBooking.test.js` | 20 |
| `adminPayments.test.js` | 14 |
| `adminOperations.test.js` | 6 |
| `doctorPayments.test.js` | 4 |
| `security.test.js` | 4 |

The existing skipped-test gate was exercised in a safe child process using the
expression extracted directly from CI, with synthetic result files: zero pending
tests/suites with 67 passed tests exited 0; one pending test exited 1; one pending suite
exited 1. The workflow passes the localhost disposable database URI explicitly,
and test helpers reject remote hosts and database names outside the test/CI/QA
suffix convention. The gate will not run after a failed Jest step, but that
job has already failed; publication remains blocked.

## Environment and Atlas limits

`backend/.env` is ignored and untracked. No tracked `.env`, private key,
certificate-key, or PKCS archive file was found. Both Docker ignore files exclude
environment files, local artifacts and dependency directories. The backend image
uses the unprivileged `node` user. Compose uses a dedicated application database
user, separate from its root bootstrap user, with `readWrite` only on `medibook`.
MongoDB is not published as a host port in the default Compose file.

`npm run audit:db -- --config-only` passed explicit database, configured
authentication, TLS and certificate-verification checks for the current local
configuration. It did not connect to a database. This does not reveal or verify
the deployed configuration or effective Atlas roles. `DATABASE_SECURITY.md`'s
20 October `atlasAdmin` result is historical and must not be treated as current
least-privilege proof; its old missing-database-path finding no longer matches
the current local configuration. Database users, network allowlists, MFA,
backups, retention and restore drills require provider evidence.

Server configuration enforces a production JWT secret length and rejects unsafe
production MongoDB TLS options. The current workspace also adds explicit-database
startup validation. Production SMTP is required by `mailer.js`; its development
fallback only reports that mail was not sent. The example environment's former
comment claiming that email bodies were logged has been corrected during the
parent audit.

References: [MongoDB TLS setup](https://www.mongodb.com/docs/manual/tutorial/configure-ssl/),
[MongoDB database roles](https://www.mongodb.com/docs/manual/reference/built-in-roles/),
[Atlas database users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/),
[GitHub workflow triggers](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

## Handoff commands and release evidence needed

Run against an isolated checkout and disposable test databases. These commands
do not require production credentials:

```powershell
# Backend and frontend, from their respective directories:
npm ci
npm run test:coverage

# Frontend:
npm run lint
npm run build
npx playwright install chromium
npm run test:ui
npm run test:e2e

# Backend disposable MongoDB fallback:
npm run test:qa -- --testPathPatterns=tests/integration --coverage=false

# Authenticated read-only inspection, if gh is available:
gh run view 39736955644 --repo msajath/MedNexus --log-failed
```

Before release, obtain a successful hosted run for the final SHA, inspect the
exact frontend install and backend failure logs, repair and execute the TLS
Compose path, require branch checks, verify actual Render/Vercel deployment
SHAs and readiness, and obtain current Atlas least-privilege/network/backup
evidence. This audit does not authorize pushing, redeploying, rotating secrets,
changing database users, changing production IP lists, or repairing data.

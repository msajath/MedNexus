# MedNexus security and QA review

Reviewed: 2026-10-11. Scope: repository code, assets, dependency locks, deployment configuration, and GitHub Actions. This report distinguishes executed checks from checks that still require an environment. Healthcare data should not be treated as production-ready on the basis of source review alone.

## Changes made

| Area | Result |
| --- | --- |
| Authentication | Removed browser token storage, added Secure/HttpOnly/SameSite cookie sessions, session invalidation on logout and credential changes, stronger new-password rules, and atomic single-use reset codes. Email changes require the current password. Reset codes are no longer logged. |
| API | Added bounded JSON input, typed field validation, operator/prototype-key rejection, generic error responses, a strict origin allowlist, request protection for cookie mutations, Helmet headers, and rate limits. |
| Authorization | Checked roles and ownership for appointments, clinical records, messages, and administrator operations. Doctor access to patient records requires an existing confirmed/completed treatment relationship. |
| Scheduling | Normalized dates and times, enforced half-hour slots and weekly availability, retained the unique active-slot database index, added one schedule per doctor, restricted status transitions, and made cancellation and rescheduling conditional atomic updates. Rescheduling now updates the original appointment. |
| Frontend | Repaired doctor-profile rendering when experience is absent, message read actions, real dashboard data/report actions, password-change forms, and appointment controls. Removed misleading demo statistics and encryption claims. |
| Hosting/CI | Added CSP and other browser headers to Nginx and Vercel, pinned GitHub Actions, audited all npm dependencies, added MongoDB integration and browser jobs, secret scanning, a CodeQL workflow, Compose smoke checks, coverage artifacts, SBOMs, and build provenance. CI disables the MongoDB memory-server postinstall download because its database jobs provide MongoDB services. Publication depends on the required CI gates. |

## Checks completed locally

| Check | Result |
| --- | --- |
| Repository inventory | 132 tracked files inventoried; 111 UTF-8 text files and 28 image/SVG assets validated. No active SVG content found. Static checks do not establish that every function works. |
| Backend unit/HTTP tests | 61 passed, including mocked HTTP tests for schedule updates, slot rejection, doctor discovery, and location filtering. Twenty-three database-dependent tests were skipped because MongoDB is unavailable. Coverage: 61.65% statements, 50.4% branches, 44.8% functions, with the skipped suites. |
| Frontend unit tests | 7 passed. Coverage of imported modules: 55.7% statements, 44.78% branches, 55.76% functions. It is not whole-app coverage. |
| Browser UI tests | 10 passed on Edge desktop and emulated mobile with a mocked API. They cover public pages, patient/doctor/admin routes, records, messages, profiles, booking/rescheduling/cancellation, admin actions, and recovery/contact forms. |
| Static and build checks | Fresh `npm ci` installs passed for both projects. Frontend ESLint and production build passed; 43 backend JavaScript files passed syntax checks; GitHub workflow and Compose YAML parsed; both Compose files passed `docker compose config --quiet` before Docker was removed from this machine. The revised workflows have not yet run on GitHub. |
| Dependency audit | `npm audit --audit-level=moderate` returned zero known vulnerabilities for backend and frontend dependencies. |
| Secret pattern scan | 459 selected text/source blobs across all Git references scanned for high-confidence private keys and major provider token formats; zero matches. The CI Gitleaks job will perform a broader scan. |

## Pending gates and remaining risks

1. **Database and deployment verification:** The 23 MongoDB tests, 16 real-API Playwright scenarios, and container smoke test need a working Docker engine or isolated localhost MongoDB. Docker Desktop and its CLI are installed, but `docker desktop status` reports `stopped`, the engine is unreachable, and Windows says WSL is not installed. Install WSL from an elevated PowerShell window and restart Windows as described in [Microsoft's WSL installation instructions](https://learn.microsoft.com/en-us/windows/wsl/install); then start Docker Desktop and verify `docker info`. No application or existing database was used for test data; test helpers reject remote/non-QA database URIs.
2. **GitHub CI:** The [latest published run checked on 2026-10-11](https://github.com/msajath/MedNexus/actions/runs/38083808018) failed at `npm ci` in backend integration and both frontend/backend checks, before tests or container verification. GitHub required sign-in to view step logs, so the exact failure cause is unknown. Both dependency locks install successfully with local `npm ci` after these changes. No pipeline run exists for these local changes; verify the `secrets`, `checks`, `backend-integration`, `browser-qa`, `containers`, and publish gate on a branch/PR. CodeQL runs for public repositories; a private repository requires GitHub Code Security and `ENABLE_CODEQL=true`.
3. **Production operations:** Confirm same-origin HTTPS routing, SMTP delivery, backup and restore, secret rotation, log retention, clinical access policy, and any required healthcare compliance controls in staging. The repo cannot establish these external controls. Vercel needs a backend `/api` proxy. Per-process API rate limits need a shared store or gateway limits for multiple replicas.
4. **Uncovered behavior:** Unit coverage is limited, and mocked browser tests do not prove server/database behavior. Treat the database-backed suites and staging checks as release gates. The footer's privacy, terms, and help links are placeholders and need actual approved content before launch.

## Commands to rerun

```powershell
cd backend
npm ci
npm run test:coverage
npm audit --audit-level=moderate

cd ../frontend
npm ci
npm run lint
npm run build
npm run test:coverage
$env:QA_BROWSER_CHANNEL='msedge'
npm run test:ui
```

With an **isolated** localhost MongoDB containing a disposable `mednexus_qa` database, run backend `npm run test:coverage` with `MONGO_TEST_URI=mongodb://127.0.0.1:27017/mednexus_qa` and a test-only `JWT_SECRET`. For real browser/API tests, set `QA_MONGO_URI=mongodb://127.0.0.1:27017/mednexus_browser_qa` and run frontend `npm run test:e2e`. The browser QA server drops only that explicitly named QA database. The GitHub workflow provisions its own MongoDB services; local test runs must never use the application database.

Security changes follow [Express production guidance](https://expressjs.com/en/advanced/best-practice-security/), the [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), and the [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

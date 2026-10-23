# MedNexus workflow and release verification

This report records the pre-publication QA state. The owner subsequently authorized publishing all changes to `main`; see [main-publish-verification.md](main-publish-verification.md) for the publication method and retained operational limitations.

23 October 2026. Scope: the existing patient, doctor and admin application, tested with synthetic users, disposable localhost MongoDB and a local SMTP inbox. Production checks were read-only. This report distinguishes the current local changes from earlier hosted results. No production database writes, real financial transactions, provider configuration changes, commits, pushes, merges or deployments were performed by this QA run.

## 1. Application workflow matrix

The complete page/action/handler inventory is [workflow-inventory.md](workflow-inventory.md). Actual role names are `patient`, `doctor`, `admin`; handlers are in `backend/routes`, with shared logic in middleware and utilities. All API paths below begin with `/api`.

**Final browser rerun: PASS.** The strengthened revision passed **46 real-API tests and 14 UI-contract tests**, with no failures or skips. Real-API diagnostics cover all 46 cases, including secondary role contexts with complete mobile emulation: zero unhandled browser exceptions and zero HTTP 5xx responses. These are local results, not hosted or production certification.

| Role | Workflow | Frontend | API | Database | E2E result | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Public | Discover/filter doctors and weekday slots | `/doctors`, `/doctors/:id` | Doctor and availability GETs | Active verified doctors; schedule/bookings/leave reads | PASS | Integration PASS |
| Public | Contact submission | `/contact` | POST `/contact` | ContactMessage insert | PASS | Integration PASS |
| Patient/doctor | Register; reject duplicate/invalid input | `/register` | POST `/auth/register` | Hashed User; pending Doctor profile | PASS | Integration PASS |
| All | Role login, refresh, logout, invalid session | Login and protected routes | Login/me/logout and protected reads | Activation and token-version checks | PASS | Integration PASS |
| All | Five-minute, single-use password reset | `/forgot-password` | Forgot/reset-password POSTs | Hashed code; atomic password/session change | PASS; loopback SMTP | Integration PASS; provider NOT VERIFIED |
| Patient | Edit profile and reload | `/patient/profile` | PUT `/auth/profile` | Own User update | PASS | Component/integration PASS |
| Patient | Book, race, reschedule, cancel | Booking and appointments | Appointment POST/PUT/GET | One persisted slot; history and status updates | PASS | Integration PASS |
| Doctor | Availability and appointment status | Availability/appointments | Availability PUT; status PUT | Schedule saved; booking retained; status CAS | PASS | Integration PASS |
| Patient/doctor | Upload/download/private clinical records | Patient records; doctor API | Record GET/POST/DELETE | Ownership, treatment relationship, soft deletion | PASS; downloaded bytes checked | Integration PASS; doctor editor absent |
| Patient/doctor | Inbox and mark read | Messages pages | Messages GET/read PUT | Recipient-scoped read/update | PASS | Integration PASS; compose absent |
| Doctor/admin | Leave application, preview, review | Doctor leave/admin leaves | Leaves and conflict/review endpoints | Fenced final conflict recheck; status/history | PASS | Integration PASS |
| Doctor | Personal earnings and refunds | Doctor dashboard | GET `/payments/my` | Own recorded receipt/refund totals | PASS | Integration PASS |
| Admin | Statistics, users, doctor approval/deactivation | Admin dashboard/users/doctors | Admin operational endpoints | Allowlisted reads; verified/active/token updates | PASS | Component/integration PASS |
| Admin | Received receipt, ambiguous retry, full refund | Admin appointments | Payment/refund POSTs | Unique receipt/key; immutable attribution; CAS refund | PASS | Integration PASS |
| Admin | Download operational JSON | Admin dashboard | Stats/earnings reads; no report endpoint | Read-only snapshot | PASS; actual contents compared | Component/integration PASS |
| Admin | Contact triage; clinical-access prohibition | Admin messages; records redirect | Contact status PUT; records rejected | Contact update; no admin clinical reads | PASS | Integration PASS |

## 2. Discovered bugs

Paths in the table are relative to the repository root; page paths start with `frontend/src/pages/`.

| Workflow | Failure | Root cause | Modified files | Fix | Test result |
| --- | --- | --- | --- | --- | --- |
| Admin users | Failed reads/actions appeared empty or silent | Missing load/action error state | `frontend/src/pages/AdminUsers.jsx` | Visible errors and retry | Component PASS |
| Admin doctor history | Historical and pending fees were wrong/missing | Current doctor fee used instead of booking snapshot | `frontend/src/pages/AdminUsers.jsx` | Use `feeAtBooking`; explicit unavailable legacy value | Failing-to-passing component regression |
| Patient records | Failed GET looked like a healthy empty list | Fetch errors collapsed into empty records | `frontend/src/pages/MedicalRecords.jsx` | Error/retry state and envelope validation | Component PASS |
| Report upload | Unsupported files selectable | Permissive MIME fallback | `frontend/src/pages/MedicalRecords.jsx` | MIME/extension allowlist; server validation retained | Component PASS |
| Clinical records | Forbidden delete/remove controls shown | UI did not match clinical immutability | `frontend/src/pages/MedicalRecords.jsx` | Hide forbidden mutations | Component + real API privacy PASS |
| Patient profile | Unknown blood type appeared as O+ | Missing Unknown select option | `frontend/src/pages/PatientProfile.jsx` | Preserve Unknown | Component + browser PASS |
| Doctor profile | Saved zero fee reopened as 100 | Truthy fallback discarded zero | `frontend/src/pages/DoctorProfileSettings.jsx` | Nullish fallback | Component + reload/later-edit browser PASS |
| Expired session | Open SPA retained authenticated state | No invalid-session notification on protected reads | `backend/middleware/auth.js`, `frontend/src/config.js`, `frontend/src/context/AuthContext.jsx` | Dedicated auth-invalid code clears cached user; wrong-password errors retain session | Unit + real browser PASS |
| Login | Remember-me checkbox had no effect | Persistence option not implemented | `frontend/src/pages/LoginPage.jsx` | Remove inert control; retain cookie policy | Existing auth regressions PASS |
| Attachment removal | Malformed path removed wrong file | `parseInt` accepted partial numeric input | `backend/routes/medicalRecordRoutes.js` | Exact nonnegative safe-integer validation | Four before-fix failures; unit + Mongo persistence PASS |
| Doctor navigation | Unhandled null-element exception | Tilt leave transition accessed unmounted card | `frontend/src/components/DoctorCard.jsx` | Native keyboard-compatible Link; retain motion hover | Before-fix desktop/mobile FAIL; final browser PASS |
| Dependencies | Moderate vulnerable dependency installed | Advisory-affected `ip-address` lock entry | `backend/package-lock.json` | Minimal update to10.7.4 | Clean install + four audits PASS |

Test authoring failures were classified separately: stale icon-bearing selectors, a valid logout destination race, an integration fixture missing its required date, and booking-conflict expectations that assumed only HTTP409 although the existing preflight returns400. These were corrected to assert the actual persisted outcome and exact conflict message; application validation was not relaxed.

## 3. Implemented fixes

Production changes already captured by an external actor in `dd4bffb` include `backend/middleware/auth.js`, `backend/package-lock.json`, `frontend/src/config.js`, `frontend/src/context/AuthContext.jsx`, and the pages `AdminUsers.jsx`, `MedicalRecords.jsx`, `PatientProfile.jsx`, `DoctorProfileSettings.jsx`, `LoginPage.jsx` under `frontend/src/pages`. The current remaining production changes are exact attachment-index validation in `backend/routes/medicalRecordRoutes.js` and accessible, keyboard-compatible doctor links in `frontend/src/components/DoctorCard.jsx`.

Regressions are in `backend/tests/authMiddleware.test.js`, `backend/tests/integration/authLifecycle.test.js`, `backend/tests/integration/security.test.js`, `backend/tests/routes/medicalRecordRoutes.test.js`, and `frontend/src/tests/{AdminUsers,AuthContext,MedicalRecords,ProfileSettings}.test.jsx` plus `ApiClient.test.js`. Profile tests exercise successful persistence, invalid responses, missing profiles, zero fees and failed saves without lowering coverage thresholds.

`backend/scripts/qaServer.js` seeds guarded disposable data; `backend/tests/helpers/smtpInbox.js` receives actual Nodemailer traffic on loopback. Its test-only mailbox endpoint is not mounted by the production entry point. `frontend/e2e/{auth-workflows,patient-doctor-workflows,admin-operations-workflows,workflows}.spec.js` use real APIs. `frontend/e2e/fixtures.js` collects exceptions, console errors, failed requests and response status metadata across primary/secondary pages and popups. Its context factory preserves mobile emulation while isolating role cookies. No request credentials or production records are logged.

`frontend/scripts/runWorkflowQa.mjs` starts a fresh disposable environment per spec, preserving genuine production rate limits. It rejects failed, missing, skipped or flaky results and merges JSON/HTML reports without suppressing child exits. `frontend/playwright.config.js`, `frontend/playwright.ui.config.js`, `frontend/scripts/strictQaReporter.mjs`, `frontend/package.json`, `frontend/eslint.config.js` and `frontend/e2e-ui/flows.spec.js` enforce diagnostics, lint and browser gates. A synthetic password-like literal flagged by Gitleaks was replaced with a runtime-generated value in the current auth spec; the history finding remains unresolved.

## 4. API and database verification

Tests assert stored values and reads after mutations, not only visible success labels:

- Registration creates hashed users, enforces unique normalized email and keeps new doctors unverified. Login/refresh read actual cookie sessions; logout, deactivation and reset invalidate previous sessions. Reset delivery uses real local SMTP, with expired/replayed codes rejected and the new password usable.
- Patient profile and doctor zero-fee changes survive refresh and later edits. Invalid saves preserve the previous data. Ownership and role restrictions are exercised through direct unauthorized API requests.
- Booking creates one pending appointment; the other role reads that same appointment. Two competing browsers yield one success, one explicit conflict and one stored booking. Rescheduling retains identity/history; cancellation persists and releases availability. Invalid/past/weekend/out-of-schedule requests are rejected by integration tests.
- Availability updates persist, affect patient slots and retain existing appointments. Doctor confirmation/completion appears on the patient's refreshed list. Leave approval rechecks a preview made stale by a new booking, fails without approving, then succeeds after cancellation. Approval blocks slots; rejection/cancellation release dates. Integration tests cover coordination races.
- Uploaded synthetic PDF bytes are compared with the actual downloaded stream. Private reports are absent from another patient's and treating doctor's authorized results. Clinical records are immutable to patients. Malformed attachment removal leaves both files intact; exact index deletion persists only the selected removal. Whole-record deletion is soft deletion.
- A real payment is persisted before deliberately dropping its response. UI retry reuses the same key and receipt ID, leaving one payment. Full refund persists once, duplicate/concurrent attempts fail, and the doctor's own net earnings change correctly. No external funds move.
- Report downloads are parsed and compared with actual stats/earnings API values, including privacy assertions. Contact triage and inbox-read updates persist. Admin deactivation removes the operational account from active lists and revokes its session without deleting history.

## 5. Automated test results

Local environment: Windows/PowerShell, Node24.11.1/npm11.6.2; disposable MongoDB7.0.14. Linux evidence is reported separately. Exit codes below come from executed checks, not predictions.

| Check | Passed / failed / skipped | Exit | Result |
| --- | --- | --- | --- |
| Backend unit/coverage | 183 / 0 / 73 integration cases; 20 passed suites | 0 | PASS; the skipped cases execute separately below |
| Real MongoDB integration | 73 / 0 / 0; 7 suites | 0 | PASS |
| Frontend Vitest/coverage | 151 / 0 / 0; 16 files | 0 | PASS |
| Final real-API browser rerun | 46 / 0 / 0; zero flaky cases; 4 specs | 0 | PASS; desktop/mobile, 282.2 seconds of reported test duration |
| Final UI-contract rerun | 14 / 0 / 0 | 0 | PASS; desktop/mobile, 1.6 minutes |
| ESLint and production Vite build | Successful | 0 | PASS |
| Backend actual clean `npm ci` | 434 packages installed | 0 | PASS |
| Frontend clean copied-manifest `npm ci` | 256 packages installed | 0 | PASS |
| Full and production npm audits, both components | 0 vulnerabilities in all four audits | 0 | PASS |
| Actionlint1.7.12 | No findings | 0 | PASS |
| Compose configuration/isolation check | Development isolation and production separation true | 0 | PASS; configuration only |
| Current source snapshot Gitleaks8.30.1 | 209 tracked/unignored files including this report, 0 findings | 0 | PASS |
| Complete history Gitleaks8.30.1 | 172 commits, 1 finding | 1 | FAIL |
| Current local container build/start | Engine unavailable | Not executed | BLOCKED |

Coverage statements/branches/functions/lines: backend **64.21/56.52/52.34/66.58%**; frontend **81.12/70.37/74.81/84.15%**. All established global and targeted thresholds passed unchanged. Coverage does not mean every function or failure mode was exercised.

Evidence includes `backend/coverage/workflow-unit-results-final.json`, `backend/coverage/workflow-integration-results-final.json`, coverage output, and ignored `.workflow-qa-evidence.local` diagnostics. Browser traces/screenshots are retained on failure. Console/network events were reviewed: expected anonymous/expired-session HTTP401, intentionally invalid requests/conflicts, and the injected lost payment response are recorded. One in-flight appointments read returned401 after logout; logout and subsequent navigation still passed, with no server error or unhandled exception. These logs are not represented as error-free consoles. Final merged results are `frontend/test-results/real-api-results.json` and `frontend/playwright-report`; per-spec reports and attachments are in `frontend/test-results/workflow-b9883ef7-7308-40ff-9fe8-fb8897a8a613`; UI output is separate.

## 6. CI/CD results

Authentically retrieved [run39838016974](https://github.com/msajath/MedNexus/actions/runs/39838016974), **MedNexus CI and images**, is successful for PR27 head `994e2d00463a687f219a105e48b7c17512f9767c`, branch `release/phase-7-2-ci-fixes`, event `pull_request`, created22October19:12UTC. Checkout tested synthetic merge `aef4e090d60a5819ec8ea2726f40a23dc45902b0`. It does not validate the newer local commits/diff.

| Hosted job | Actual conclusion and evidence at994e2d0 |
| --- | --- |
| secrets | PASS; older history scan clean |
| checks (backend) | PASS;179 unit cases and coverage |
| backend-integration | PASS;67 cases, no skipped integration tests |
| checks (frontend) | PASS;115 cases, coverage, lint, production build |
| dependency-audit (backend) | PASS high/critical gate; one moderate advisory existed then and is fixed locally |
| dependency-audit (frontend) | PASS; zero vulnerabilities |
| browser-qa | PASS;14 UI-contract plus16 real-API tests at that older revision |
| containers | PASS; actual Linux image build/start, healthy services, SPA/API/CSP/missing-asset smoke checks |
| publish | SKIPPED as intended for a pull-request event |

CodeQL run39838016998 also succeeded at994e2d0. Downloaded authenticated logs and metadata are in ignored `.phase72-evidence.local/run-39838016974`.

Earlier [failed main run39814536964](https://github.com/msajath/MedNexus/actions/runs/39814536964) tested `17f69c2d671117a6edee4d1a2e00b4199812e9a6`, event `push`. In job `browser-qa`, step `npm run test:e2e`, startup failed with `TypeError: next is not a function` at `backend/models/User.js:89`. In job `backend-integration`, step `npx jest --runInBand --testPathPatterns=tests/integration --json --outputFile=integration-results.json`, hooks timed out with `Exceeded timeout of 30000 ms for a hook` during connection/index setup. The release branch's async-only Mongoose hook and Jest VM-module startup correction address those reproduced causes; increasing timeouts alone is not the repair.

Current workflow inspection confirms pinned actions, Node24, clean installs, unchanged coverage gates, disposable Mongo service, explicit integration-skip rejection, dependency audits and complete-history secret scanning. Publishing requires secrets, checks, audits, integration, browser and container jobs; container validation requires checks and integration. Publish is limited to appropriate push branches/tags. No failure suppression was added. **Current candidate hosted CI is NOT VERIFIED** until an approved branch push executes these gates, including the currently failing history scan.

## 7. Deployment risks

Read-only probes reproduced the reported availability problem: direct Render health/readiness returned200 after about22.7-22.8seconds while concurrent Vercel API probes returned502 with `X-Render-Routing: no-deploy`. `/contact` returned200 with the SPA root and CSP. Immediately warmed, Render readiness returned200 in1846ms and Vercel readiness returned200 in1003ms, then579ms; these were uncached/no-store responses. This supports a cold-start/transient availability issue, not a permanently incorrect rewrite. The cause cannot be reduced to the screenshot alone.

The owner identifies the service as Render Free. [Render's Free documentation](https://render.com/docs/free) documents idle spin-down, startup delay, and blocked outbound SMTP ports25/465/587. The mailer defaults to587, so successful loopback reset delivery does **not** certify production email. An approved always-on hosting arrangement and a supported mail transport/provider must be verified before claiming reliable live booking and password reset.

Repository routing uses Vercel `/api` rewrites to the Render backend, QA-only Vite loopback proxying, explicit origins, controlled proxy trust, production TLS/database validation, bounded readiness and PORT binding on all interfaces. Deployed backend/frontend SHAs and provider environment values are not proven to match this candidate. Atlas least-privilege grants, network allowlists, backups/restore and retention remain operator checks; no production settings were changed.

GitHub metadata reports main unprotected with no rules/rulesets. Although previews were described as disabled earlier, successful Vercel Preview deployments exist, including994e2d0, while the checked-in rewrite targets production. Provider isolation and merge requirements need owner verification. Local Docker engine is stopped/unavailable; only older hosted994 container runtime is certified.

## 8. Remaining broken or unverified workflows

The complete-history secret gate **fails** on a synthetic password-like literal committed at `dd4bffb`, `frontend/e2e/auth-workflows.spec.js:142`. Current source uses a runtime-generated value, but editing the latest file does not remove a historical finding. No secret value is reproduced here. No allowlist, ignored result or history rewrite was introduced. The finding needs review and an explicitly approved history/remediation decision; it must not be declared harmless or resolved merely because it was test data.

Exact-candidate hosted checks remain pending. Live cold availability and production email delivery remain release blockers. There is no refresh-token flow, message compose/send/reply, booking/leave-generated notification, doctor record editor/viewer, doctor rescheduling, partial refund, payment gateway, printable receipt export, or CSV/PDF operations report. Existing messages are an inbox; refunds record already-issued full refunds; operations reports are browser-generated JSON. These unsupported features are not reported as passing workflows.

## 9. Git changes

Current branch: `release/phase-7-2-ci-fixes`. Local HEAD `dd4bffb` is ahead of remote994e2d0 by three commits. External commits `5e7ac63` (timeouts), `373a510` (artifact removal despite its broad title), and `dd4bffb` (QA/application work) were preserved. Initial user changes were snapshotted locally; no reset, amend or history rewrite occurred. The root agent did not create these external commits.

Remaining modified paths are `backend/routes/medicalRecordRoutes.js`, its route/integration tests; `frontend/e2e-ui/flows.spec.js`; all four `frontend/e2e/*.spec.js`; frontend ESLint/package/Playwright configs; `frontend/src/components/DoctorCard.jsx`; and `frontend/src/tests/ProfileSettings.test.jsx`. New files include both workflow documents, `frontend/e2e/fixtures.js`, and `frontend/scripts/{runWorkflowQa,strictQaReporter}.mjs`. Another actor staged these changes during the final review; that index was preserved. This report has additional final-result edits beyond its staged snapshot. Use current status and both staged/unstaged diffs for the authoritative final list.

Suggested commit: `fix: repair real user workflows and expand end-to-end QA`.

Safe review commands, run from the repository root:

```powershell
git status --short
git log --oneline origin/release/phase-7-2-ci-fixes..HEAD
git diff --check
git diff --stat
git diff -- backend frontend docs
git diff --cached --stat
git diff --cached -- backend frontend docs
git ls-files --others --exclude-standard
```

The user's workflow request explicitly says, "Do not push, merge, or deploy without my explicit approval." No automatic release action follows this report. Review the exact files and unresolved history finding before authorizing any new commit/push or PR change.

## 10. Release readiness

**PASS:** local unit/integration/coverage, all 60 browser scenarios, clean installs, audits, lint/build, actionlint, Compose configuration and the current-source secret scan. **FAIL:** complete Git-history secret scan. **BLOCKED:** current local container runtime, because its engine is unavailable. **NOT VERIFIED:** exact-candidate hosted gates, deployed version parity, production email, provider isolation/branch protections and sustained live availability.

Decision: **READY FOR REVIEW; NOT READY FOR STAGING OR PRODUCTION.** Resolve and verify the history gate, obtain approval for a concrete branch update, require successful hosted checks on that exact revision, verify isolated provider configuration, and validate operational availability/email before advancing release readiness. Passing an older hosted run or a warm health check does not satisfy those remaining requirements.

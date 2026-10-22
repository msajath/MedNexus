# Runtime Validation Report

**Generated:** 2026-10-22  
**Target:** `D:\4th sem\MedNexus`

## Summary

| Step | Status | Exit code | Details |
| --- | --- | ---: | --- |
| Infrastructure capability | PASS with fallback | 0 | Node.js v24.11.1 available; Docker CLI installed but Docker Linux daemon unavailable. |
| Backend unit tests | PASS | 0 | 19 suites passed; 164 tests passed; 6 integration suites and 65 tests skipped when no database URI was configured. |
| Backend coverage | PASS | 0 | 62.21% statements, 53.18% branches, 50.50% functions, 64.60% lines. |
| MongoDB integration tests | PASS | 0 | `npm run test:qa -- --testPathPatterns=tests/integration --coverage=false`; 6 suites and 65 tests passed against disposable `mongodb-memory-server`. |
| Frontend unit tests and coverage | PASS | 0 | 14 files and 114 tests passed; 78.91% statements, 67.32% branches, 73.63% functions, 81.67% lines. |
| Frontend lint and build | PASS | 0 | ESLint and Vite production build passed. |
| Browser E2E | PASS | 0 | 16 tests passed across Chromium desktop and mobile projects. |

## Test infrastructure

The backend integration runner uses `mongodb-memory-server` with a temporary
`mednexus_qa` database and injects `MONGO_TEST_URI` only into the Jest child
process. Test database validation rejects remote hosts and non-test database
names. Docker remains the CI integration path; the local in-memory runner is
the documented fallback for a stopped Docker daemon.

## Browser QA repair

The admin dashboard rendered **Download Operations Report**, while the
Playwright selector searched for `/Download Report/`, which does not match the
intervening word. The selector was corrected to the exact rendered label. No
application button or authorization behavior was changed.

## Coverage and CI notes

The integration-only CI command no longer enables coverage, because the
integration subset cannot satisfy module-specific thresholds for unrelated
unit-tested modules. The separate `checks` job continues to enforce the full
backend and frontend coverage thresholds. The workflow still rejects skipped
integration suites and tests.

GitHub Actions itself was not executed locally; workflow behavior is
configuration-validated only.

## Known gaps

- Docker daemon availability was not restored locally, so the Docker service
  container path was not executed on this Windows machine.
- No production MongoDB, credentials, Render settings, Vercel settings, or
  deployment targets were accessed or modified.

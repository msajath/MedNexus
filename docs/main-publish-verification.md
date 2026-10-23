# Main branch publication

For the subsequent successful main CI run and the separately canceled manual rerun, see [browser-ci-timeout-verification.md](browser-ci-timeout-verification.md).

The owner explicitly requested publishing all current changes to `main` after the workflow QA report. This publication includes the complete tracked and unignored source snapshot, including the final report edits that were not in the original staged snapshot. Local evidence directories, environment secrets, dependency directories and generated test/build files remain excluded by Git ignore rules.

The source was tested with 183 backend unit tests, 73 real MongoDB integration tests, 151 frontend tests and 60 desktop/mobile browser tests. Coverage, lint, production build, dependency audits, actionlint and Compose configuration checks passed. Detailed evidence and limitations are in [workflow-qa-verification.md](workflow-qa-verification.md).

Publication uses a single commit based on the latest remote `main`. The existing release branch and its local commits are preserved. This brings every current file change across without introducing an obsolete synthetic test-password literal from a superseded local commit. The auth regression now generates its changed password at runtime. Secret scanning remains enabled without an allowlist or ignored failure.

Before the push, both the source snapshot and the candidate's complete history together with existing remote history are scanned with Gitleaks. Hosted checks must execute on the new main commit; prior hosted success is not treated as proof of this revision. The CI workflow continues to require secret scanning, coverage, audits, database integration, browser QA and container checks before publishing images.

The push can trigger configured provider deployments. It does not change Atlas settings, environment secrets, hosting plans or mail-provider configuration. Render cold-start availability, production SMTP delivery, provider isolation and deployed-version parity remain operational verification items. The earlier QA report describes these limits; publication does not certify production readiness.

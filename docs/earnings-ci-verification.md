# Earnings workflow and CI repair

The failing [run 40068444008](https://github.com/msajath/MedNexus/actions/runs/40068444008) tested commit `6aca1f6`. It is a different failure from the older browser-install timeout. Its backend test assertions passed, but coverage fell below the existing global branch and line thresholds. Frontend tests and database integration still expected doctor-editable fees and the former photo controls. Browser QA attempted to use the removed manual receipt form. Both dependency audit jobs also found newly reported vulnerabilities.

The repaired tests exercise the requested behavior: administrators set consultation charges, doctors cannot overwrite those charges, and public doctor cards show the saved fee, including zero. Completion uses the immutable booked fee to create an earnings credit once. Missing historical prices do not fall back to a doctor's current price. A failed credit write returns an error and completion can be retried to recover it. Refunded credits cannot be resurrected by completion retries. These service credits represent earned revenue, not a card charge or confirmed bank deposit; historical API amount fields retain their existing names for compatibility.

Browser testing found an additional application bug: the admin appointment page updated status but discarded the payment state returned with completion. It now immediately displays the generated credit while retaining populated doctor and patient identity. A separate regression reproduced a delayed signed-out response clearing a newer login. Session revisions now prevent older responses from invalidating a newly established session, while current invalid sessions still trigger sign-out.

Patient and administrator profiles start without a photo. Upload, removal and account switching are covered, including a regression against displaying a previous account's avatar.

## Salary requests and bank transfer boundary

The original payout endpoint only inserted a database document while claiming money had been sent. No bank or payment provider was called. It now saves **pending salary requests**, with explicit wording that no money has been transferred. Doctor and hospital balances count only provider-confirmed transfers as paid. An administrator can cancel a pending request to release its reservation. A unique database index prevents competing pending requests for the same doctor, and the API rejects requests exceeding unreserved earnings. Bank-account numbers are masked in payout responses and earnings exports.

Older `completed` payout documents without provider confirmation are shown as **unverified** and reserved for review, rather than being accepted as evidence of money sent. They are not deleted or automatically retransferred. The owner must reconcile any such existing records before a future provider integration is enabled.

Real bank transfers remain unimplemented pending the owner's country, currency and payout-provider details. `transfersEnabled` is false. The current application retains its existing USD currency. A provider integration must verify transfer confirmation and reconcile existing requests; connecting credentials must never automatically send old requests.

The owner has since confirmed Sri Lanka, LKR and Bank of Ceylon, without bank API or bulk salary-payment access. [The BOC connection handoff](boc-payout-onboarding.md) records the bank setup still needed and the currency migration boundary. Existing USD entries have not been relabelled or converted.

The final booking review covers reservation cleanup before an error response, including occupied slots, concurrent changes and storage failures. A real MongoDB regression verifies that a patient can immediately retry another slot without creating another appointment. The salary dashboard now counts only confirmed completed transfers in its paid-transfer counter; pending and other payout records remain visible in history without being counted as sent money.

## Dependency and verification evidence

Lockfile repairs update body-parser to 2.4.0, Nodemailer to 10.2.1, Undici to 7.30.1 and Zod to 4.6.7. Both actual clean installs passed. Both full dependency audits and both production-only audits reported zero vulnerabilities.

The latest local backend unit/coverage verification passed **229 tests**. Its 81 database tests are intentionally run in a separate job; the separate real MongoDB run passed **all 81 with none skipped**. Frontend unit/coverage verification passed **168 tests**. Existing coverage thresholds are unchanged. Lint and production build passed again; the workflow and Compose configuration have not changed since their earlier successful validation.

Browser QA retains all four real-API spec files, both desktop/mobile projects, the separate UI checks and the existing rejection of skipped or flaky results. Assertions referring to removed controls have been replaced with real completion, credit, reversal and administrator fee workflows. The final browser and hosted CI results must be checked on the published revision; earlier successful commits are not proof of this patch. Test databases and mail capture are isolated on localhost; no real bank transfers or production database writes were performed during verification.

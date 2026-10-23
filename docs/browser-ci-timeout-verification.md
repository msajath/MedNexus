# Browser CI cancellation investigation

Verified on October 24, 2026, using authenticated GitHub run metadata, check annotations and downloaded job logs.

The uploaded log belongs to [manual run 40001673867](https://github.com/msajath/MedNexus/actions/runs/40001673867), on main commit `1dc733d780c2c3860ce330fd82f4966433ce49b7`. GitHub's browser-job annotation states: **The job has exceeded the maximum execution time of 15m0s**. The cancellation did not report a failed test assertion.

| Browser job phase | UTC timestamps on October 23 | Result |
| --- | --- | --- |
| Install Chromium and OS dependencies | 18:15:02 to 18:26:27 | Passed, 11 minutes 25 seconds |
| UI contract checks | 18:26:27 to 18:27:32 | All 14 passed |
| Real API browser workflows | Started 18:27:32; canceled around 18:29:46 | First three spec files passed (6 + 12 + 12 checks); final 16-check spec was interrupted |

The install log identifies the delay: Ubuntu downloaded 25.9 MB of OS packages in **11 minutes 3 seconds, at 39.1 kB/s**, from `azure.archive.ubuntu.com`. Browser binary downloads then completed in seconds. The Mongoose `new`/`returnDocument` messages are deprecation warnings and do not explain GitHub's timeout.

The earlier [push run 39996890103](https://github.com/msajath/MedNexus/actions/runs/39996890103) tested the **same commit** successfully. Its browser job passed all 14 UI checks and all 46 real API checks (6 + 12 + 12 + 16). Both unit/coverage jobs, both dependency audits, secret scanning, real MongoDB integration, container smoke checks and both image publications also passed. [CodeQL run 39996889996](https://github.com/msajath/MedNexus/actions/runs/39996889996) passed on that commit. This is evidence for that revision, rather than evidence that the canceled run completed.

The CI adjustment pins the browser runner to Ubuntu 24.04 and raises its total budget to 30 minutes. Explicit step limits allow 15 minutes for browser/OS installation, four for UI checks, eight for the complete API workflows and two for report upload. Normal browser test execution in the successful run took about four minutes combined. Installation stalls and test hangs still fail; all existing tests, failure gates, per-test timeouts, retry rules and image-publication dependencies remain in place.

Pinning the OS avoids an unrelated environment change during [GitHub's Ubuntu 26.04 rollout](https://github.com/actions/runner-images/issues/14748); the canceled job itself used Ubuntu 24.04. Browser caching would not address the observed delay: [Playwright documents that Linux OS dependencies still require installation and cannot be cached](https://playwright.dev/docs/ci#caching-browsers). The standard dependency installation is retained.

The revised workflow must run on GitHub to verify its Linux installation and end-to-end behavior. The same-commit successful run above establishes the application baseline; it does not certify the modified CI configuration. This change does not certify production hosting availability or production email delivery.

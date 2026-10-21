# Production availability

The frontend is hosted at `https://med-nexus-pi.vercel.app`. Its `/api/*`
requests are forwarded by `frontend/vercel.json` to the Render backend at
`https://mednexus-hngd.onrender.com/api/*`.

## Render settings

1. Open the existing backend service. For production, use a **paid service
   instance** that stays running. Render Free instances sleep after 15 minutes
   without traffic and take about a minute to wake. Upgrading a workspace plan
   alone does not change the service's instance type. This is a billing change;
   the account owner must choose and apply it.
2. In the service's **Settings → Health Checks**, set **Health Check Path** to
   `/api/ready`. A Dockerfile `HEALTHCHECK` does not configure this dashboard
   setting. Readiness checks MongoDB with a two-second deadline; `/api/health`
   only confirms the HTTP process is running.
3. Retain the existing Docker build context (`backend`) and its `Dockerfile`.
   The application listens on `0.0.0.0` using Render's `PORT` environment value.
   Keep production environment values configured on Render, including
   `NODE_ENV=production`, a strong `JWT_SECRET`, the existing `MONGO_URI`, and
   `ALLOWED_ORIGINS=https://med-nexus-pi.vercel.app` (plus any other actual
   frontend domains, separated by commas). Do not copy secrets into Git.
   Leave `TRUST_PROXY` unset to use the app's Render default of **one trusted hop**, or
   explicitly set `TRUST_PROXY=1`. An existing `0` or `false` value disables that
   default and must be corrected for this proxied service. Direct local servers
   default to no proxy trust. Other values are rejected at startup.
4. In Atlas, keep the application cluster running and allow the Render service's
   current outbound CIDRs. Keep the existing database name unless migrating its
   data deliberately. See [DATABASE_SECURITY.md](DATABASE_SECURITY.md) for the
   database account and network checks.

The application still waits for its database connection and required safety
indexes before listening. Startup errors must be fixed in Render/Atlas; the
frontend cannot make an unavailable database operational.

Rate limiting uses Express's trusted `X-Forwarded-For` address and the library's
default IPv6 subnet protection. It does not take an identity from a raw
`Forwarded` header. With the proxy configured, the supplied `Forwarded` and
`X-Forwarded-For` validation warnings are resolved without disabling validation
or rate limiting. These warnings are logged configuration checks; they do not,
by themselves, prove a crash or explain an HTTP 502.

The Vercel rewrite adds another proxy path. The one-hop policy intentionally
selects the nearest untrusted address and may group visitors behind an upstream
gateway. Verify the provider's address chain before changing this policy; do not
increase the hop count or trust every forwarded address to recover a visitor IP.
The direct Render URL also remains reachable, so paths can have different lengths.

## Application recovery

Read requests retry network failures and temporary gateway/service errors.
Each attempt has a 15-second deadline inside a 90-second total budget, so a
stalled connection can recover without a manual refresh. Writes, including
bookings and password changes, are never automatically replayed.

The homepage and doctor listing share the same recovery behavior. After an
exhausted transient failure, they make one additional recovery check after
15 seconds and offer manual retry. Recovery stops when the page is left.
Previously fetched doctors are kept only in that mounted page's memory;
appointment availability is always fetched separately. A persistent outage is
reported clearly rather than shown as an empty list or a successful booking.

## Deploy and verify

Deploy the tested frontend and backend revisions. Confirm the expected commit
in each provider's deployment history, then verify through the public frontend:

```sh
curl --fail https://med-nexus-pi.vercel.app/api/health
curl --fail https://med-nexus-pi.vercel.app/api/ready
```

Open `/doctors`, confirm actual doctors load, and exercise search and filters.
Check login and use a staging account/database for booking write tests. Repeat
the readiness and doctor-page checks after more than 15 minutes without traffic
to confirm the chosen service instance stays available when idle.

Configure an external uptime monitor for the public `/api/ready` URL and enable
provider failure notifications. Monitoring detects failures; it is not a
replacement for an always-on service or a healthy database. No hosting setup or
retry policy guarantees zero outages.

References: [Render Free limitations](https://render.com/docs/free),
[Render health checks](https://render.com/docs/health-checks),
[Render environment variables](https://render.com/docs/environment-variables),
[Express proxy trust](https://expressjs.com/en/guide/behind-proxies/),
[Rate-limit validation errors](https://express-rate-limit.mintlify.app/reference/error-codes).

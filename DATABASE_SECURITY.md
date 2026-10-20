# Checking MongoDB security

The application uses MongoDB Atlas in the local backend configuration. The audit
below reads configuration, permissions, indexes, and credential-format counts.
It does not create indexes, change accounts, read patient documents, or write data.

From `backend`:

```powershell
npm run audit:db -- --config-only
npm run audit:db
```

The command loads `backend/.env`, with existing environment variables taking
precedence. Run it inside the deployed backend shell to check that deployment's
configuration. It never prints the URI, database username/password, host, password
hashes, or patient records. Exit codes are 0 (automated checks pass), 1 (failure),
and 2 (manual review or connection unavailable). A passing command is not a full
security certification: Atlas dashboard checks below are still required.

## Findings verified on 20 October 2026

- TLS is enabled by the configured Atlas SRV connection; certificate verification
  has no bypass option.
- The configured database account has **atlasAdmin**. Replace the runtime account
  with a dedicated user granted **readWrite on the application database only**.
  Keep administrative credentials out of Render's runtime environment.
- The URI has no database path, so the current connection selects **test**. Do not
  append a different database name without a planned migration: the site would
  connect to a different dataset. Confirm the deployed URI separately.
- Unique email, active appointment slot, and doctor availability indexes exist.
- No account has an unexpected password format or bcrypt cost below 12.
- No doctor document contains the old plaintext `tempPassword` field.
- A patient deletion permission bypass was fixed: doctor-created or appointment-
  linked clinical records and attachments cannot be removed through patient APIs.

These results describe the locally configured connection at audit time. Production
environment values, Atlas management settings, and future changes need separate
verification. Medical reports/diagnoses are not encrypted individually by this
application; database readers can read them. Atlas storage encryption is a
separate protection.

## Atlas checks you perform

1. **Database & Network Access → Database Users**: create a dedicated application
   user with `readWrite` only on the database currently used by the site. Update
   Render's `MONGO_URI`, redeploy, and verify `/api/ready`, login, booking, and a
   record read. Once verified, remove the old administrative credential from the
   application environment.
2. **Database & Network Access → IP Access List**: allow the actual outbound CIDRs
   shown by Render for each API service. Remove `0.0.0.0/0` only after the intended
   CIDRs are active and tested. Use expiring entries for a developer's IP.
3. **Atlas account security**: enable MFA for every person with project access and
   review project membership. Database users and Atlas dashboard users are separate.
4. **Backups**: verify your cluster tier's backup capability, retention, and latest
   successful backup. Perform a restore into a separate test cluster/database and
   verify data before depending on it. Never restore over the live database as a test.
5. **Activity Feed / alerts**: review access-list and user changes, connection
   failures, storage/capacity alerts, and available audit logging for your tier.

Atlas always encrypts data at rest and requires TLS. Those provider defaults do
not prove that your account permissions, IP list, backups, or application access
rules are correct.

Official references:

- [Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/ip-access-list/)
- [Atlas network security](https://www.mongodb.com/docs/atlas/architecture/current/network-security/)
- [Atlas encryption at rest](https://www.mongodb.com/docs/atlas/security-encryption-at-rest-overview/)
- [Atlas database users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/)

## Safe automated verification

```powershell
cd backend
npm test
```

Real database and browser integration suites use disposable test databases and
delete their fixtures. Never point `MONGO_TEST_URI` or `QA_MONGO_URI` at a live database.
`npm run seed` is also destructive, requires an explicit localhost database, and is for local development only.

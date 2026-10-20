# Separate showcase environment

The showcase uses a separate database named **mednexus_showcase**, three normal login accounts, and clearly fictitious appointments, a medical record, and inbox messages. Its doctor has weekday availability; Saturday and Sunday are disabled.

For this workspace, the database was provisioned in the existing Atlas cluster on
20 October 2026. All three accounts passed normal cookie login and role checks;
the database contains three users, one doctor, two sample appointments, and one
synthetic record. The generated passwords are in the private
`showcase-credentials.local` file at the repository root. Its Windows ACL grants
access only to your Windows account, SYSTEM, and local administrators. The original application
database was not seeded or reset. A dedicated runtime database user and the
separate online deployments are still required; these accounts do not log in to
the live production site's database.

Use a separate backend deployment and frontend deployment for the showcase. Keep the live site's backend, database, JWT secret, and frontend API address separate. A showcase administrator has full access to its own demo database, so never connect a public showcase to real patient data.

## Provision the sample accounts

1. For the already provisioned workspace, use the existing cluster's `mednexus_showcase` database. Create a database user with `readWrite` access only to that database. For a fresh environment, use a new empty database, preferably in a separate Atlas project or cluster. Add only the required Render outbound ranges or your provisioning computer's IP to Atlas Network Access.
2. In your local `backend/.env`, set `DEMO_MONGO_URI` to that new database's connection string. Include `/mednexus_showcase` explicitly. Use the provider's TLS-enabled URI; invalid certificates and disabled hostname validation are rejected for remote databases. Keep existing `MONGO_URI` and `MONGO_STANDARD_URI` pointing at the live database so the script can reject accidental reuse. Never paste any URI into chat or source control.
3. From `backend`, run `npm run provision-showcase`. The script requires an empty database on its first run. It does not run the destructive development seeder.
4. Open `showcase-credentials.local` in the repository root privately. It contains independent generated passwords for `showcase.patient@example.invalid`, `showcase.doctor@example.invalid`, and `showcase.admin@example.invalid`. The `*.local` ignore rule prevents this file from being committed. Passwords are hashed in MongoDB and never printed to the terminal. Keep a private backup; these fictitious email addresses cannot receive password-reset messages.

The file is created exclusively with mode `0600`, and permissions are tightened where supported. On Windows, inspect it with `icacls .\showcase-credentials.local` and use Properties → Security to allow only your Windows account (plus required system administrators). POSIX mode bits alone do not guarantee Windows ACL restrictions. Do not put the credential file in a synced or public folder. `SHOWCASE_CREDENTIALS_FILE` can select another private path ending in `.local`.

The database stores a provisioning manifest without passwords. A normal rerun leaves all data and passwords unchanged and directs you to the original credential file. If a run stops halfway, keep that file and rerun with the same URI and file: missing planned documents are inserted, while changed or unexpected existing data causes a safe stop. If the credential file is lost or modified, the script refuses to regenerate passwords or overwrite accounts. Restore the original private backup or build a new isolated showcase environment.

## Create the separate online API

After provisioning, push the reviewed source changes to the repository. In Render, create a **new Blueprint** from that repository and choose `render.showcase.yaml` as the Blueprint path. Review the plan: it must create only `mednexus-showcase-api`, using the free Docker web-service plan and `backend/Dockerfile`, without changing the existing live service.

Supply the new database URI when Render prompts for `MONGO_URI`. For `ALLOWED_ORIGINS`, initially use `https://showcase-pending.invalid`; replace it with the exact new Vercel origin after the next step. The Blueprint generates a separate JWT secret, uses one-hour sessions, trusts one proxy, and checks `/api/ready`. Leave `MONGO_STANDARD_URI` unset. Do not import the production service's environment group or credentials.

Add only this new Render service's outbound ranges to the demo Atlas project's Network Access. If its first deployment starts before these ranges are allowed, redeploy the new showcase service afterward. Copy its assigned HTTPS origin, such as `https://YOUR-NEW-SHOWCASE-API.onrender.com`, and confirm its `/api/ready` returns HTTP 200. Keep the live Render service unchanged.

## Build and deploy the separate online frontend

From the repository root, using Node 24:

```powershell
npm --prefix frontend ci
npm --prefix frontend run build
node frontend/scripts/packageShowcase.js --api-origin https://YOUR-NEW-SHOWCASE-API.onrender.com
```

Replace the example origin with the new API's actual HTTPS origin. Packaging requires an existing `frontend/dist/index.html` and creates a **new** ignored `showcase-frontend.local` folder. It copies the built public files, security headers, and SPA rewrite, and creates its own `vercel.json` pointing `/api` only at the explicit showcase API. It rejects the production API/site and excludes existing `.vercel` project links and `.local` files. It never changes `frontend/vercel.json` or deletes or overwrites an existing package. If the default output already exists, choose a fresh folder with `--output showcase-frontend-v2.local`.

Use a terminal without `VERCEL_PROJECT_ID` or `VERCEL_ORG_ID` environment variables. Sign in to Vercel if needed, then deploy the packaged folder:

```powershell
npx vercel --prod --cwd ./showcase-frontend.local
```

When prompted, create a **new project**, for example `mednexus-showcase`. Answer **No** to linking an existing project; never select the live MedNexus project. Use the current package directory (`.`), framework **Other**, no install/build command, and output directory `.` if prompted. The directory already contains the completed static build. The new project must not import production environment variables or use the repository's `frontend` root directory.

Copy the new stable Vercel production origin, update only the showcase Render service's `ALLOWED_ORIGINS` to that exact origin, and redeploy that service. The frontend calls same-origin `/api`; a `VITE_API_URL` environment variable alone does not change its production proxy. Confirm `https://YOUR-NEW-SHOWCASE.vercel.app/api/ready` returns HTTP 200 before logging in.

## Verify the presentation

Use `/login` for the patient and doctor and `/admin/login` for the administrator, with the credentials from the private `.local` file. The usual role checks still apply. Keep the live site and its original credentials separate.

Verify that the patient can see its synthetic appointment and record, the doctor can see that appointment and weekday availability, and the administrator can see only the three demo users. Make a test booking on a weekday and confirm that weekend slots remain unavailable. Never enter real patient information into the showcase.

The preloaded future appointment is one week after provisioning; dates are not silently refreshed on reruns. Create later demo appointments through the normal patient flow when needed. Real outbound email should be disabled or routed to a test mail service for the showcase.

For a private presentation, share credentials only with the presenter. If you publish demo credentials, publish them only alongside the isolated showcase URL, and expect visitors to change its sample data. The script deliberately adds no login bypass or public production administrator button.

After the presentation, suspend the showcase deployments or deactivate its accounts. Deactivation through the normal admin controls also invalidates their sessions. Revoke the demo Atlas database user's access when retiring the environment. Do not delete or reseed the live database.

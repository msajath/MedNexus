# MedNexus Production Deployment Audit Report

**Date:** 8 October 2026  
**Auditor Roles:** Senior Software Engineer, Lead QA / Automation Tester, Senior DevOps Engineer  
**Status:** Pre-Deployment Verified & Hardened  

---

## 1. Executive Summary

MedNexus was evaluated across three core engineering disciplines: **Quality Assurance (Testing)**, **Software Engineering (Code & Security Architecture)**, and **DevOps (CI/CD, Containers, and Deployment)**.

### Current Health Scorecard
| Pillar | Status | Summary |
|---|---|---|
| **QA / Unit & Integration Testing** | ✅ **PASSED** | 8/8 backend test suites (41 tests) passed; 2/2 frontend test suites (4 tests) passed; real MongoDB Atlas integration suite verified. |
| **Frontend Quality & Build** | ✅ **PASSED** | ESLint: 0 errors, 0 warnings; Vite production build: 100% clean. Doctor action controls and dynamic metrics restored. |
| **Database & API Operations** | ✅ **VERIFIED** | Live connection to MongoDB Atlas verified (`ac-g5kpgtu-shard-00-02`). Automatic DNS fallback added for Atlas SRV resolution. |
| **CI/CD Pipelines** | ✅ **VERIFIED** | GitHub Actions (`ci.yml`) enforces lint, tests, mongo integration, compose smoke tests, and GHCR container publishing. |
| **Production Readiness** | ⚠️ **ACTION REQUIRED** | Final environment configuration needed (Database name, SMTP, HTTPS origin, and Admin Bootstrap). |

---

## 2. Issues Discovered and Solutions Applied

### Issue 1: Windows / ISP DNS Resolution Failure for MongoDB Atlas (`querySrv ENOTFOUND`)
- **Category:** Senior Software Engineer / Infrastructure
- **Problem:** When connecting to Atlas using `mongodb+srv://`, Node's default resolver failed with `querySrv ENOTFOUND _mongodb._tcp.cluster0.dzhrkdl.mongodb.net` due to ISP/local router DNS restrictions.
- **Solution Applied:** Added automatic DNS fallback (`8.8.8.8`, `1.1.1.1`) inside `backend/config/db.js` and `backend/tests/integration/security.test.js`. If the initial SRV lookup fails, it automatically recovers and connects immediately.

### Issue 2: MongoDB Integration Test Fixture Omission
- **Category:** Lead QA / Automation Tester
- **Problem:** In `tests/integration/security.test.js`, test patient records were created without `addedBy: 'patient'`, which defaulted to `addedBy: 'doctor'` without a doctor ID. This caused the record-access privacy filter to return empty results.
- **Solution Applied:** Explicitly marked patient-created records with `addedBy: 'patient'`. All 4 MongoDB integration tests now pass against a live database.

### Issue 3: Inactive Appointment Action Buttons on Doctor Management Page
- **Category:** Lead QA / Software Engineer
- **Problem:** On `ManageAppointments.jsx`, the "Complete" and "Cancel" buttons lacked event handlers and API connections. Doctors could not change appointment status from the UI.
- **Solution Applied:** Wired up `handleStatusUpdate(id, status)` connected to `PUT /api/appointments/:id/status`. Added intuitive status-specific buttons:
  - Pending appointments: **Confirm** and **Cancel**
  - Confirmed appointments: **Complete** and **Cancel**

### Issue 4: Hardcoded Doctor Dashboard Metrics
- **Category:** Lead QA / UI Engineering
- **Problem:** `DoctorDashboard.jsx` displayed mock figures (`12` appointments, `1,284` patients, `$14,250` revenue) regardless of logged-in doctor, and the action button triggered a generic alert.
- **Solution Applied:** Updated `DoctorDashboard.jsx` to dynamically compute real-time statistics from `/api/appointments/my` (Today's count, Unique patient count, Pending count, and Actual earnings based on fee). Connected calendar navigation.

---

## 3. Step-by-Step Pre-Deployment Action Plan (Solve One by One)

Before pointing real-world users to your deployed instance, follow these steps in order:

### Step 1: Specify Database Name in MongoDB Connection String
* **File:** `backend/.env` (for local) or `.env.atlas` (for Docker/Production)
* **Problem:** `MONGO_URI=mongodb+srv://...cluster0.dzhrkdl.mongodb.net/?appName=Cluster0` lacks a database name in the path. Mongoose will default to saving data in a database named `test`.
* **Fix:** Change to:
  ```env
  MONGO_URI=mongodb+srv://<username>:<password>@cluster0.dzhrkdl.mongodb.net/medibook?appName=Cluster0
  ```
  *(Notice `/medibook` added before `?appName=Cluster0`)*

### Step 2: Configure Production Secret Keys
* **File:** Root `.env` or `.env.atlas`
* **Requirements:**
  1. `JWT_SECRET`: Must be a cryptographically random string with at least 32 characters (e.g., generated with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
  2. `ALLOWED_ORIGINS`: Set to your exact production domain (e.g., `https://mednexus.yourdomain.com`).
  3. `NODE_ENV`: Set to `production`.

### Step 3: Configure SMTP Email Service
* **File:** `.env` / `.env.atlas`
* **Requirement:** Required for password resets and initial admin creation.
  ```env
  SMTP_HOST=smtp.sendgrid.net  # or smtp.mailgun.org, smtp.gmail.com, etc.
  SMTP_PORT=587
  SMTP_SECURE=false
  SMTP_USER=apikey
  SMTP_PASS=<your_smtp_password>
  SMTP_FROM="MedNexus Support <no-reply@yourdomain.com>"
  ```

### Step 4: Bootstrap the Initial Admin Account
* **How to run:**
  - On native Node:
    ```bash
    ADMIN_EMAIL=admin@yourdomain.com npm run bootstrap-admin
    ```
  - In Docker Compose:
    ```bash
    docker compose exec -e ADMIN_EMAIL=admin@yourdomain.com backend npm run bootstrap-admin
    ```
  - Then visit `/forgot-password` in the frontend to receive an OTP code and set the administrator password securely.

### Step 5: Production Reverse Proxy and SSL/TLS
* The frontend Nginx container listens on port `8080` (or `HTTP_PORT`).
* Use a host-level reverse proxy (such as Nginx, Caddy, or AWS ALB / Cloudflare) with an SSL certificate:
  ```
  Client (HTTPS: 443) ---> Host Nginx (SSL termination) ---> MedNexus Frontend (127.0.0.1:8080)
  ```

---

## 4. Verification Check Details

```
Test Suites: 8 passed, 8 total
Tests:       41 passed, 41 total
Snapshots:   0 total
Time:        ~36 s (including cloud Atlas roundtrips)

✓ tests/integration/security.test.js
  ✓ only a treating doctor reads records and private records remain hidden
  ✓ simultaneous booking requests reserve a slot only once
  ✓ deactivating a doctor preserves patient records and invalidates their token
  ✓ email uniqueness is enforced by MongoDB
✓ tests/routes/adminRoutes.test.js
✓ tests/routes/appointmentRoutes.test.js
✓ tests/routes/authRoutes.test.js
✓ tests/routes/medicalRecordRoutes.test.js
✓ tests/routes/healthRoutes.test.js
✓ tests/routes/contactRoutes.test.js
✓ tests/routes/messageRoutes.test.js

Frontend Vitest:
✓ src/tests/AdminDashboard.test.jsx
✓ src/tests/AdminLogin.test.jsx

Frontend Linting:
ESLint: 0 errors, 0 warnings

Frontend Build:
Vite: 472 modules transformed, dist generated in 456ms
```

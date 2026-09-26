# West Bengal Forum for Mental Health – Online Appointments

Full stack appointment, video consultation and prescription system.

| Part        | Stack                                                                              | Hosting |
| ----------- | ---------------------------------------------------------------------------------- | ------- |
| `frontend/` | React 19 + Vite 8, React Router 8, axios                                           | Vercel  |
| `backend/`  | Node 24 + Express 5, pg, bcryptjs, JWT, pdfkit, AWS SDK v3                         | Render  |
| Database    | PostgreSQL (hierarchical `users` parent table + `admins` / `doctors` / `patients`) | Neon    |
| Files       | Prescription PDFs → Neon object storage (S3), meeting recordings → Cloudflare R2   |         |
| Email       | Resend (OTP, booking confirmation, family invitations)                             |         |
| Video       | 8x8 JaaS (Jitsi) embedded in the app, doctor side auto recording                   |         |

Everything runs in the **Asia/Kolkata** time zone. Browsers in other zones see the IST time plus their local equivalent.

## Project layout

```
backend/
  server.js                  entry point (bootstraps DB, schedules the midnight job, starts Express)
  src/config                 env loader, db pool, CORS, constants
  src/scripts/*.sql.js       every SQL statement, as named constants per user type (admin / patient / doctor / common / system / transaction)
  src/scripts/schema.sql     full schema - the first run drops ALL existing tables, indices, types and extensions
  src/routes | controllers | services | models | middleware | utils | jobs | db
  tests/api                  API + unit tests (node:test, supertest)   tests/performance  load tests
frontend/
  src/components/<Name>/<Name>.jsx + <Name>.css   (Dropdown, DatePicker, Pagination, Password, Captcha, Loader, MessageBox, ErrorHandler, NavDrawer, Header, ...)
  src/views/{auth,admin,patient,doctor,meeting,common}
  src/api  src/context  src/routes  src/utils  src/styles
  tests/{unit,components,views,performance}      (Vitest + Testing Library)
e2e/                          Playwright browser journey test
scripts/                      db.sh, backend.sh, frontend.sh, setup.sh, run.sh, run-all-tests.sh, generate.sh
```

## Environment files

| File                        | Used for                                                          |
| --------------------------- | ----------------------------------------------------------------- |
| `backend/.env.production`   | Render + Neon + Vercel URL + Resend + S3 + R2 + JaaS              |
| `backend/.env.development`  | local PostgreSQL, `FRONTEND_URL=http://localhost:5173`            |
| `backend/.env.test`         | automated tests (`appointment_test`, in-memory email and storage) |
| `frontend/.env.production`  | `VITE_API_BASE_URL=https://<render-service>.onrender.com/api`     |
| `frontend/.env.development` | `VITE_API_BASE_URL=http://localhost:5000/api`                     |

`backend/.env.example` documents every variable.

## Local development

Requirements: Node 24+, PostgreSQL 15+ (user `postgres` / `postgres` on localhost, or edit the `.env.development` / `.env.test` URLs).

```bash
./scripts/setup.sh              # npm install both apps, create appointment_dev + appointment_test, init schema
./scripts/run.sh console        # backend :5000 + frontend :5173, emails printed in the backend console
./scripts/run.sh                # same, but sends real emails through Resend
```

On the first start the backend:

1. drops every existing table, index, type and extension, and then creates the schema (only when the `app_meta` marker is missing, so this happens once);
2. creates the admin `wbffmh@gmail.com` (password from `ADMIN_PASSWORD`, default `Admin@12345`); and
3. loads ~249k medicine names from the Indian Medicine Dataset if the `medicines` table is empty.

`./scripts/db.sh reset development` forces a full clean rebuild.

## Tests

```bash
./scripts/run-all-tests.sh      # everything
./scripts/backend.sh test       # 114 API/unit tests (auth, captcha, OTP, admin, patient, family, doctor, prescription PDF, meeting, webhook, midnight job)
./scripts/backend.sh perf       # load tests (health, captcha, doctors, slots, medicine search, concurrent booking storm)
./scripts/frontend.sh test      # 57 unit / component / view / performance tests
python e2e/e2e.py               # full browser journey (Playwright): deep link, admin, register with OTP, booking, prescription PDF
```

Tests create their own users in `@autotest.wbfmh.local` and delete them afterwards (`./scripts/db.sh cleanup-test` removes leftovers and their PDFs).

## Deployment

### 1. Backend on Render

1. Push the repository to GitHub. Create a **Web Service** (or use `backend/render.yaml` as a Blueprint) with root directory `backend`, build command `npm ci --omit=dev`, start command `npm start`, and health check `/api/health`.
2. In **Environment → Secret Files**, add a file named `.env.production` with the content of `backend/.env.production`. It is read from `/etc/secrets/.env.production`.
3. Deploy. The first boot initialises the Neon database, which wipes everything already in it.

### 2. Frontend on Vercel

1. Set `frontend/.env.production` → `VITE_API_BASE_URL=https://<your-render-service>.onrender.com/api`.
2. Import the repo in Vercel: root directory `frontend`, framework **Vite**, build `npm run build`, output `dist`. `vercel.json` already contains the SPA rewrite and the camera/microphone permission policy for 8x8.vc.
3. Copy the Vercel URL into `FRONTEND_URL` and `CORS_ORIGINS` in the Render secret file, then redeploy the backend.

### 3. Email (Resend)

`onboarding@resend.dev` can only deliver to the Resend account owner's address. Verify your own domain in Resend and set `EMAIL_FROM=WBFMH <noreply@your-domain>` so patients receive OTPs and confirmations.

### 4. Video recording (8x8 JaaS → Cloudflare R2)

- When the doctor joins the in-app meeting, recording starts automatically (JaaS JWT with the recording feature, moderator = doctor).
- In the JaaS console, open **Webhooks** and add `https://<render-service>.onrender.com/api/webhooks/jaas` with the event **RECORDING_UPLOADED**. Put the signing secret in `JAAS_WEBHOOK_SECRET`.
- Fill `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (and optionally `R2_PUBLIC_BASE_URL`). When the webhook arrives, the backend streams the recording into R2 and stores its URL on the appointment.
- JaaS recording requires a JaaS plan that includes recording.

### 5. Scheduled job

Every day at 00:00 IST, scheduled or rescheduled appointments that are already in the past are marked **cancelled**. It runs inside the backend process. On the Render free plan the service sleeps, so the job also runs on every start-up as a catch-up.

## Security notes

- Passwords are hashed with bcryptjs (salted, cost 12). Emails are unique across admin, doctor and patient.
- The captcha is a distorted server-rendered image. The answer is only kept as an HMAC and is never sent to the browser.
- OTPs are valid for 10 minutes, stored hashed, and rate limited. Login sessions last 30 days (JWT plus localStorage).
- Every SQL statement is a named constant using `$n` parameters, and no string literals are embedded in the SQL.
- Rotate any secret that has been shared in chat or email (Neon password, Resend key, S3 keys, JaaS private key) before going live.

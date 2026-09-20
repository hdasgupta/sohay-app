# WBFFMH Appointment Portal

Appointment booking portal for **West Bengal Forum for Mental Health** with three
kinds of users (administrator, doctor, patient), a single login page, video
consultations over Jitsi (8x8.vc) and PDF prescriptions stored in a Neon S3
bucket.

```
appointment-app/
  backend/            node + express api (Render)
    src/
      config/         env + postgres pool
      controllers/    request handling per user type
      db/             schema creation, admin seed, bootstrap
      jobs/           midnight cancellation job
      middleware/     auth, validation, error handler, request logger
      models/         data access, one per entity
      routes/         auth / admin / patient / doctor / shared routes
      scripts/        EVERY sql statement, as named constants, per user type
      services/       business rules
      utils/          password, jwt, captcha, slots, mail, otp, s3, pdf, jitsi, drive
    server.js
  frontend/           react 19 + vite 8 single page app (Vercel)
    src/
      api/            axios client and one module per user type
      components/     Dropdown, DatePicker, Pagination, PasswordInput, Captcha,
                      OtpField, Loader, MessageBox, ErrorBoundary, NavPanel,
                      Header, Card, PageTransition, ThemeToggle, OrgLogo
      context/        theme, messages, loader, auth
      layouts/        application shell
      pages/          common / admin / patient / doctor views
      styles/         theme (dark blue default + light), global, animations
      utils/          slots, dates, dose guessing, constants
  db.sh               database commands
  backend.sh          backend install / build / run
  frontend.sh         frontend install / build / run
  generate-project.sh one shot bootstrap of the whole project
```

Every component and every page has its own CSS file.

## 1. Requirements

* Node.js 20 or newer (tested on 20.20)
* A Neon Postgres database
* A Gmail account with an app password (outgoing mail)
* A Neon object storage bucket (prescription PDFs)
* Optional: JaaS (8x8.vc) credentials for video, Google OAuth credentials for
  uploading the recorded consultation to Google Drive

## 2. First run

```bash
cd appointment-app
./generate-project.sh          # installs both sides, creates the schema, builds the ui
./backend.sh run               # http://localhost:5000
./frontend.sh run              # http://localhost:5173
```

The administrator is created automatically on the first backend run:

```
wbffmh@gmail.com / Admin@12345
```

`./db.sh init` drops and recreates every table, index, type and extension, seeds
the administrator and imports the medicine master data (~39k names) from the
[Indian Medicine Dataset](https://raw.githubusercontent.com/junioralive/Indian-Medicine-Dataset/refs/heads/main/DATA/indian_medicine_data.csv)
when the `medicines` table is empty.

Useful commands:

| Command | What it does |
| --- | --- |
| `./db.sh init` | recreate the schema, seed admin, import medicines |
| `./db.sh check` | connectivity report |
| `./db.sh job` | run the midnight cancellation job once |
| `./backend.sh dev` | express with file watching |
| `./backend.sh smoke` | end to end API test (creates throwaway users) |
| `./frontend.sh build` | static bundle in `frontend/dist` |
| `./frontend.sh preview` | serve the built bundle |

## 3. Environment files

`backend/.env` (an `.env.example` without secrets is included):

| Group | Keys |
| --- | --- |
| Server | `NODE_ENV`, `PORT`, `BACKEND_URL` |
| Frontend link | `FRONTEND_URL`, `CORS_ORIGINS` |
| Database | `DATABASE_URL`, `PGSSL` |
| Auth | `JWT_SECRET`, `JWT_EXPIRES_IN`, `CAPTCHA_SECRET`, `CAPTCHA_TTL_SECONDS`, `BCRYPT_SALT_ROUNDS` |
| Seed admin | `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` |
| OTP | `OTP_TTL_MINUTES`, `OTP_LENGTH` |
| Mail | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `MAIL_FROM_NAME` |
| Storage | `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE`, `PRESCRIPTION_URL_TTL_SECONDS` |
| Branding | `ORG_NAME`, `ORG_LOGO_PATH`, `DOCTOR_SIGNATURE_PATH` |
| Video | `JITSI_DOMAIN`, `JAAS_APP_ID`, `JAAS_API_KEY`, `JAAS_PRIVATE_KEY` / `JAAS_PRIVATE_KEY_PATH`, `JAAS_TOKEN_TTL_SECONDS`, `JAAS_WEBHOOK_SECRET` |
| Drive | `GOOGLE_DRIVE_ENABLED`, `GOOGLE_DRIVE_OWNER_EMAIL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID` |
| Medicines | `MEDICINE_CSV_URL`, `MEDICINE_IMPORT_LIMIT` |
| Jobs | `CANCEL_JOB_CRON`, `CANCEL_JOB_TIMEZONE` |

`frontend/.env`:

```
VITE_API_BASE_URL=http://localhost:5000/api
VITE_ORG_NAME=West Bengal Forum for Mental Health
VITE_ORG_SHORT_NAME=WBFFMH
VITE_JITSI_DOMAIN=8x8.vc
```

`frontend/.env.production` holds the Render URL used by the Vercel build.

## 4. Deployment

### Neon (database)

1. Create the project and copy the pooled connection string into
   `DATABASE_URL`.
2. Run `./db.sh init` once from a machine that can reach Neon.
3. The object storage bucket named in `S3_BUCKET` is created automatically by
   `db:init` when it does not exist.

### Render (backend)

* Root directory `backend`
* Build command `npm ci`
* Start command `npm start`
* Health check path `/api/health`
* Add every key of `backend/.env` as an environment variable, with
  `FRONTEND_URL` pointing at the Vercel URL and `BACKEND_URL` at the Render URL.

### Vercel (frontend)

* Root directory `frontend`
* Framework preset Vite, build command `npm run build`, output `dist`
* Environment variable `VITE_API_BASE_URL=https://<render-app>.onrender.com/api`
* `vercel.json` already rewrites every path to `index.html` so the client side
  routes work on a hard refresh.

## 5. Functional notes

* **Hierarchical data model** - `users` is the parent table (name, email,
  password hash, `is_disabled`); `admins`, `patients` and `doctors` extend it, so
  an email address is unique across all three kinds of users and the role is
  detected at login without a role chooser.
* **Passwords** - bcryptjs with a per password salt, rules enforced in the UI and
  again on the server.
* **Captcha** - generated as an SVG of vector paths plus noise, so it is never
  sent as text; the answer lives in a short lived signed token.
* **OTP** - 6 digits, valid for 10 minutes, sent as an HTML email, with an
  on-screen countdown after sending.
* **Slots** - the day is divided into 48 half hour slots. A slot is offered only
  when it is inside the doctor's availability for that weekday, is not taken for
  that doctor, and is not taken for that patient with any doctor.
* **Appointments** - booking sends an email with the Jitsi 8x8.vc room link and
  the in-app consultation link; a cron job at midnight
  (`CANCEL_JOB_CRON`, Asia/Kolkata) cancels past appointments that were never
  completed.
* **Recording** - the doctor's consultation page starts a JaaS file recording;
  the JaaS webhook (`POST /api/webhooks/jaas-recording`, header
  `x-webhook-secret`) uploads the finished file to the configured Google Drive
  account.
* **Prescriptions** - the doctor picks today's patient, searches the medicine
  table, the dose is guessed from the medicine name (tablet/capsule → `1 pcs`,
  syrup → `10 ml`) and stays editable; the generated PDF carries the
  organisation logo and name, the doctor's name and speciality, a horizontal
  rule, the patient name, age and date, the medicine list and the doctor's
  signature, and it is stored in the Neon S3 bucket with its URL kept in the
  database.
* **SQL** - every statement lives in `backend/src/scripts` as a named constant,
  split per user type, with no literal values inside the statements: even
  constants used in `WHERE` clauses are passed as parameters.

## 6. Video consultation setup

8x8.vc (JaaS) **always** requires a signed JWT. Joining it without one - which is
what happens while `JAAS_APP_ID`, `JAAS_API_KEY` and the private key are still
the placeholders - makes the iframe answer
*"Sorry, you are not allowed to join this call"*.

The backend therefore checks the credentials before it builds the room:

* **Configured** - domain `8x8.vc`, room `<AppID>/<roomId>`, RS256 token signed
  with the JaaS private key (`kid` header = API key, `aud: jitsi`, `iss: chat`,
  `sub` = AppID, plus `context.user` / `context.features`), the doctor joins as
  moderator and recording is allowed.
* **Not configured** - it falls back to `JITSI_FALLBACK_DOMAIN`
  (`meet.jit.si` by default) with a plain room name and no token, logs a warning,
  and the consultation page shows a "Public Jitsi room" badge. Recording to
  Google Drive stays off in this mode.

This deployment is already wired to a live JaaS app: `JAAS_APP_ID` and
`JAAS_API_KEY` are set in `backend/.env` and the matching private key lives at
`backend/assets/jaas.pem`. A signed token was verified against 8x8.vc, which
accepts it and shows the doctor's name from the token.

To move it to another JaaS app:

1. Copy the AppID from [jaas.8x8.vc](https://jaas.8x8.vc/) into `JAAS_APP_ID`.
2. Add an API key, download the private key, and either point
   `JAAS_PRIVATE_KEY_PATH` at the `.pem` file or paste it into
   `JAAS_PRIVATE_KEY`. `JAAS_API_KEY` must be the full `kid`
   (`<AppID>/<key-id>`).
3. Restart the backend - `[jitsi] issued JaaS token for room ...` confirms it,
   and `[jitsi] JaaS is not configured (missing: ...)` names what is absent.
4. For recording uploads, add a JaaS webhook of type `RECORDING_UPLOADED`
   pointing at `POST <BACKEND_URL>/api/webhooks/jaas-recording` with the header
   `x-webhook-secret: <JAAS_WEBHOOK_SECRET>`, and fill in the Google OAuth keys.

**On Render** the `.pem` file is usually not in the repository, so put the key in
the `JAAS_PRIVATE_KEY` environment variable instead. Turn the file into the
single line it expects with:

```bash
awk '{ printf "%s\\n", $0 }' backend/assets/jaas.pem
```

## 7. Google Drive recording uploads

`backend/drive-auth.mjs` turns a Google OAuth client into the refresh token the
backend needs:

```bash
cd backend
node drive-auth.mjs ./client_secret_xxx.json   # or: node drive-auth.mjs (reads .env)
```

It starts a local server on `http://localhost:53682/oauth2callback`, prints the
consent url, captures the code from the redirect and writes
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` and
`GOOGLE_DRIVE_ENABLED=true` into `backend/.env`. Use `PORT_OAUTH=<port>` to move
the listener.

Checklist in Google Cloud, because each of these produces
*"Access blocked: This app's request is invalid"*:

1. **Drive API enabled** for the project (APIs & Services → Library → Google
   Drive API).
2. **OAuth consent screen configured** - user type External, an app name and a
   support email, scope `.../auth/drive.file`, and the Drive owner added under
   Test users while the app is still in Testing.
3. **Client type** - a *Desktop app* client accepts any loopback port with no
   extra setup. A *Web application* client needs
   `http://localhost:53682/oauth2callback` added verbatim to its Authorized
   redirect URIs. The old copy-the-code (`oob`) flow no longer works at all.

If Google returns no refresh token, revoke the app at
[myaccount.google.com/permissions](https://myaccount.google.com/permissions) and
run the helper again.

## 8. Development helpers

* `backend/smoke-test.mjs` (`./backend.sh smoke`) walks the whole API: login,
  add doctor, register patient, book, reschedule, prescription, cancel. It
  creates throwaway `@example.com` users, so run it against a test database.

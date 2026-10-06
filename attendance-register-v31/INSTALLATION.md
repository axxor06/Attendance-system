# Installation Guide

Quick copy-paste reference. For explanations of *why*, see `README.md`.

## Prerequisites

- [ ] Node.js v20+ installed (`node --version`)
- [ ] MongoDB Community Server installed and running (`mongod` running as a service, or started manually)
- [ ] Redis is optional for one local backend and required for shared rate limits across multiple production instances
- [ ] A Gmail account with 2-Step Verification + an App Password generated (for OTP emails)

## Backend

```powershell
cd server
copy .env.example .env
```

Edit `server\.env`:
```
MONGO_URI=mongodb://127.0.0.1:27017/attendance_register
JWT_ACCESS_SECRET=<paste a long random string here>
JWT_REFRESH_SECRET=<paste a different long random string here>
EMAIL_USER=youremail@gmail.com
EMAIL_PASS=<your 16-character Gmail App Password>
SEED_ADMIN_EMAIL=admin@college.edu
SEED_ADMIN_NAME=Head Admin
SEED_ADMIN_PASSWORD=<local HOD password of at least 12 characters>
SEED_FACULTY_PASSWORD=<local faculty password of at least 12 characters>
SEED_STUDENT_PASSWORD=<local student password of at least 12 characters>
```

Generate a random secret quickly with:
```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Run it twice — once for each JWT secret.

Run these commands in this order. `npm install` must come before `npm run seed`, because the seed script imports packages such as `dotenv` from `node_modules`.

```powershell
npm install
npm run seed
npm run dev
```

Expect to see: `[DB] MongoDB connected` and `[Server] Running in development mode on 0.0.0.0:5000`. The seed creates 1 HOD, 100 Faculty, 120 students, 8 departments, 8 semesters, 6 classes, 12 subjects, class-specific timetables, attendance history, and notifications.

## Frontend

Open a **second** terminal:

```powershell
cd client
copy .env.example .env
npm install
npm run dev
```

Expect to see a `Local: http://localhost:5173/` link printed. Open it in your browser.

## First login

Go to `http://localhost:5173`, log in with the `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` you set above. You're now logged in as HOD.

## Optional Docker development

For a complete local Compose stack, create `server/.env` from `server/.env.example`, set the JWT/email/seed values, and run from the project root:

```powershell
docker compose up --build
```

The backend connects to the Compose service `mongo`, the client is built with `VITE_API_BASE_URL=/api`, and client Nginx proxies `/api/` to the `server` service. Open `http://localhost:5173`. Stop with `docker compose down`; use `docker compose down -v` only when you intentionally want to delete the MongoDB development volume.

Docker is optional and is not required for normal development. If Docker is unavailable, use the local MongoDB, optional Redis, and separate `server`/`client` terminals described above.

## Production build (optional)

Frontend:
```powershell
cd client
npm run build
```
Outputs static files to `client/dist`, which can be served by any static host (or by the Express server itself if you add `express.static`).

Backend:
```powershell
cd server
set NODE_ENV=production
npm start
```

## Troubleshooting

**`[DB] Initial connection failed: connect ECONNREFUSED`** — MongoDB isn't running. Open MongoDB Compass and check you can connect to `mongodb://127.0.0.1:27017`, or start the MongoDB service from Windows Services.

**`[Email] SMTP verification failed`** at startup — your `EMAIL_USER`/`EMAIL_PASS` are wrong, or you used your normal Gmail password instead of an App Password. The server still starts; only OTP/notification emails will fail until this is fixed.

**Frontend shows a blank page / network errors in the browser console** — check `client/.env`'s `VITE_API_BASE_URL` matches where your backend is actually running (default `http://localhost:5000/api`), and that the backend terminal is still running.

**`Refresh session is no longer valid` or `No refresh token provided` after reseeding or reopening the app** — this usually means the browser still has an old rotated refresh cookie, or another old tab is open. Close other Attendance Register tabs, open the browser site settings for `localhost:5173`, clear cookies/site data for the app, then open the app again and sign in. Do not disable refresh-token rotation or reuse detection; those 401 responses are security protections doing their job.

**`EADDRINUSE` on port 5000 or 5173** — something else is already using that port. Either stop it, or change `PORT` in `server/.env` (and `VITE_API_BASE_URL` in `client/.env` to match) / change the Vite port in `client/vite.config.js`.

## Optional ImageKit profile photos

Profile photos are optional. If ImageKit is configured, set `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`, and optionally `IMAGEKIT_PROFILE_FOLDER` in `server/.env`. Keep the private key only in the backend environment; never put it in a `VITE_*` variable. The API accepts only JPG, PNG, and WebP images up to 3 MB and validates file content server-side. Without ImageKit configuration, photo upload fails safely with a clear setup message and no account is created from a failed passwordless setup flow.

## Legacy age migration

The application stores `dateOfBirth` and calculates age dynamically. If an old database contains `age` without a verified DOB, do not invent a date. Back up the database, review the records with the migration utility, collect verified DOB values through an approved data process, and only then set `ALLOW_LEGACY_AGE_CLEANUP=true` for the explicit cleanup step:

```powershell
cd server
npm run migrate:user-dob
```

## Registration status

After public registration, save the short status reference shown once, for example `AR-7K4P-92XM`. Enter it manually or use the copy/open-status action to check the request while it is pending and after the HOD approves or rejects it, until the bounded expiry. Older private links remain accepted during migration. The status page pauses polling when the browser tab is hidden and stops after approval, rejection, or expiry. Never paste the status reference or legacy token into public support channels.

## Custom error recovery

The application uses a branded error experience for missing routes, expired sessions, permission failures, validation errors, network outages, server errors, and unexpected render crashes. Use the available **Try again**, **Reload page**, **Go back**, **Go to start**, or **Sign in** actions. The application intentionally does not show stack traces, MongoDB messages, filesystem paths, JWT internals, passwords, OTPs, or private upload configuration in the browser.

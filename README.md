# Attendance Register

<p align="center">
  <strong>A secure, role-aware college attendance platform for HODs, faculty, and students.</strong>
</p>

<p align="center">
  <a href="#quick-start"><img src="https://img.shields.io/badge/Setup-Quick%20Start-162B49?style=for-the-badge" alt="Quick start" /></a>
  <a href="#security-model"><img src="https://img.shields.io/badge/Security-JWT%20%2B%20HTTP--only%20cookies-3F766D?style=for-the-badge" alt="Security" /></a>
  <a href="#verification"><img src="https://img.shields.io/badge/Tests-17%20backend%20checks-B27A35?style=for-the-badge" alt="Tests" /></a>
  <a href="#developer"><img src="https://img.shields.io/badge/Developer-Arjun%20Krishnan%20P.S.-5E6E95?style=for-the-badge" alt="Developer" /></a>
</p>

> **Attendance Register** is a MERN-stack college attendance management system with scoped authorization, QR attendance, academic management, reports, notifications, secure account recovery, and separate experiences for HODs, faculty, and students.

The application is designed around a simple principle: **the frontend improves usability, while the backend remains the source of truth for identity, permissions, relationships, attendance rules, and data access**. The interface uses a restrained professional glassmorphism system with responsive navigation, accessible forms, skeleton loading states, recoverable errors, and data-driven dashboards.

## Contents

| Section | What it covers |
|---|---|
| [Product overview](#product-overview) | Main capabilities and design goals |
| [Role capabilities](#role-capabilities) | HOD, faculty, and student access |
| [Technology](#technology) | Runtime, frontend, backend, database, and test stack |
| [Project structure](#project-structure) | Important folders and files |
| [Quick start](#quick-start) | Windows and macOS/Linux startup instructions |
| [Seed data](#seed-data) | Default HOD, 20 faculty, 120 students, and development data |
| [Security model](#security-model) | Sessions, authorization, OTPs, QR, and rate limits |
| [Profile and password flows](#profile-and-password-flows) | Editable fields and reset behavior |
| [LAN development](#lan-development) | Accessing the app from another device |
| [Verification](#verification) | Tests, lint, and production build |
| [Troubleshooting](#troubleshooting) | Common setup and runtime issues |
| [Developer](#developer) | Project credit |

## Product overview

Attendance Register supports the daily operational workflow of a college department. HODs manage people, academic structures, registration requests, periods, reports, and department-scoped attendance data. Faculty members work with assigned subjects and classes, mark attendance manually or through QR sessions, and review reports. Students view their own attendance, timetable, notifications, attendance trends, and QR scanning workflow.

### Core capabilities

| Capability | Included behavior |
|---|---|
| Identity and access | Login, registration verification, access-token sessions, refresh-token rotation, logout invalidation, and role-aware route protection |
| Academic management | Departments, semesters, classes, subjects, faculty assignments, and period templates |
| Attendance | Manual roster marking, attendance history, status handling, reports, and student attendance analytics |
| QR attendance | Faculty-created sessions, expiry checks, class/subject validation, duplicate prevention, and student scanning |
| Account management | HOD/admin account creation, authorized edits, deactivation, password reset requests, and protected profile editing |
| Communication | Notifications, OTP email flows, account-created messages, password-change notifications, and registration updates |
| User experience | Glassmorphism surfaces, professional visual hierarchy, responsive navigation, skeleton loading, empty states, retry states, and accessible dialogs |
| Data integrity | MongoDB constraints, scoped queries, atomic attendance claims, duplicate-key handling, and audit activity logging |

## Role capabilities

The following table describes the intended application boundary. Every sensitive action is checked again by the backend API; hiding a button in React is not treated as authorization.

| Role | Main workspace | Can manage | Protected boundaries |
|---|---|---|---|
| **HOD** | Department dashboard, people, registrations, academics, periods, reports | Faculty and students within the authorized department scope | Cannot manage another department or global administrator accounts |
| **Faculty** | Faculty dashboard, subjects, manual attendance, QR sessions, reports | Attendance for assigned subjects/classes and authorized student records | Cannot access HOD administration or unrelated classes |
| **Student** | Student dashboard, QR scan, timetable, attendance, notifications, profile | Own attendance view, own notifications, and own contact details | Cannot read or modify another student’s records or protected academic identifiers |
| **ADMIN** | Institution-wide administration | HOD, faculty, student, academic, registration, and report operations | Cannot manage `SUPER_ADMIN` accounts |
| **SUPER_ADMIN** | Global administration and security-sensitive settings | Global configuration and privileged account management | Reserved for explicitly authorized operational use |

## Technology

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, React Router, Axios, Tailwind CSS v4, Framer Motion, Recharts, Lucide |
| Backend | Node.js, Express, Mongoose, JWT, bcryptjs, Nodemailer, PDFKit, ExcelJS |
| Database | MongoDB with Mongoose schemas, indexes, scoped queries, and transactional/fallback controller logic |
| Session security | Short-lived in-memory access tokens plus HTTP-only refresh cookies and MongoDB-backed refresh sessions |
| Abuse protection | Helmet, explicit CORS allowlist, request IDs, validation middleware, endpoint-specific limits, and optional Redis-backed rate limits |
| Testing | Node built-in test runner, backend syntax checks, frontend tests, Oxlint, and Vite production build |
| Development | Node.js 20+, npm, MongoDB Community Server, optional SMTP provider, optional Redis |

## Project structure

```text
attendance-register-v9.0/
├── client/
│   ├── src/
│   │   ├── api/                 # Axios services and auth/session client
│   │   ├── components/          # Layout, common controls, charts, dashboards
│   │   ├── context/             # Auth context and session bootstrap
│   │   ├── hooks/               # Reusable React hooks
│   │   ├── pages/               # Auth, HOD, faculty, student, and shared pages
│   │   ├── utils/               # Motion, validation, formatting, and helpers
│   │   ├── App.jsx              # Router and application shell
│   │   └── index.css            # Theme tokens, glass surfaces, focus, skeletons
│   ├── .env.example
│   └── package.json
├── server/
│   ├── src/
│   │   ├── config/              # Environment and application constants
│   │   ├── controllers/         # Request handlers and authorization-aware logic
│   │   ├── middleware/           # Auth, validation, security, errors, rate limits
│   │   ├── models/               # MongoDB/Mongoose schemas and indexes
│   │   ├── routes/               # REST route definitions
│   │   ├── services/             # Notifications, logs, reports, and domain services
│   │   ├── utils/                # JWT, OTP, authorization, seed, and helpers
│   │   └── server.js             # HTTP server entry point
│   ├── .env.example
│   └── package.json
├── API.md
├── ARCHITECTURE.md
├── CHANGELOG.md
├── DEPLOYMENT.md
├── INSTALLATION.md
├── PRODUCTION_CHECKLIST.md
└── SECURITY_AUDIT.md
```

## Quick start

### Prerequisites

Install the following before starting:

| Requirement | Recommended setup |
|---|---|
| Node.js | Node.js 20 or newer |
| MongoDB | MongoDB Community Server running locally or a private development deployment |
| Email | Gmail App Password or another SMTP provider for OTP and notification emails |
| Redis | Optional for shared rate limits when running multiple backend instances |

### Windows Command Prompt

Open **Command Prompt 1** in the project root:

```bat
cd server
copy .env.example .env
notepad .env
```

Set the important backend values in `server\.env`:

```env
MONGO_URI=mongodb://127.0.0.1:27017/attendance_system
JWT_ACCESS_SECRET=replace-with-a-long-random-secret
JWT_REFRESH_SECRET=replace-with-a-different-long-random-secret
CLIENT_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173
SEED_ADMIN_EMAIL=admin@college.edu
SEED_ADMIN_PASSWORD=HodPassword123!
SEED_FACULTY_PASSWORD=FacultyPassword123!
SEED_STUDENT_PASSWORD=StudentPassword123!
```

The three seed passwords must each contain at least 12 characters. Install dependencies **before** running the seed:

```bat
npm install
npm run seed
npm run dev
```

Open **Command Prompt 2**:

```bat
cd client
copy .env.example .env
notepad .env
```

For a normal local setup, use:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Then install and start the frontend:

```bat
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### macOS/Linux

Open Terminal 1:

```bash
cd server
cp .env.example .env
nano .env
npm install
npm run seed
npm run dev
```

Open Terminal 2:

```bash
cd client
cp .env.example .env
nano .env
npm install
npm run dev
```

Use the same `MONGO_URI`, JWT secrets, seed passwords, and `VITE_API_BASE_URL` values described above.

> **Important:** `npm install` must be completed in `server` before `npm run seed`. Otherwise packages such as `dotenv` will not yet exist in `node_modules`.

### Development URLs

| Service | URL |
|---|---|
| Frontend | [http://localhost:5173](http://localhost:5173) |
| Backend API | [http://localhost:5000](http://localhost:5000) |
| Liveness endpoint | [http://localhost:5000/api/health](http://localhost:5000/api/health) |
| Readiness endpoint | [http://localhost:5000/api/ready](http://localhost:5000/api/ready) |

## Seed data

The development seed creates a connected demonstration dataset. It refuses to run when `NODE_ENV=production` and skips when the configured HOD email already exists.

| Dataset | Count | Notes |
|---|---:|---|
| HOD | 1 | Uses `SEED_ADMIN_EMAIL`, defaulting to `admin@college.edu` |
| Departments | 3 | CSE, ECE, and MECH |
| Semesters | 8 | Semesters 1 through 8 |
| Classes | 6 | Six department/class combinations |
| Faculty | 20 | Unique `FAC001`–`FAC020` employee IDs |
| Students | 120 | Twenty students assigned to each seeded class |
| Subjects | 12 | Two subjects per seeded class |
| Period templates | Monday–Saturday | Weekday and Saturday schedules |
| Attendance history | 60 school days | Generated from the seeded class/subject/student relationships |
| Notifications | All seeded users | Welcome and system-ready notifications |

All faculty accounts use `SEED_FACULTY_PASSWORD`, and all student accounts use `SEED_STUDENT_PASSWORD`. The seed prints sample emails after completion. Keep these credentials only in local development and change them before any shared deployment.

## Profile and password flows

### Profile editing

Students and faculty can update their own **email address** and **phone number** from the profile page. Their name, register number, employee ID, department, class, role, and authorization scope remain protected.

Privileged HOD/admin users can update their own display name and contact details. Authorized HOD/admin account management in People supports editing managed accounts within the backend scope. Administrator-only identity-field changes remain restricted to global administrators.

### Self-service password reset

The public reset flow is intentionally two-step:

| Step | User action |
|---|---|
| 1. Request | Submit the account email on Forgot Password |
| 2. Verify | Enter the emailed OTP and verify it |
| 3. Set password | Enter a strong new password and confirm it |
| 4. Sign in | Return to Login with the new password |

Reset codes are hashed, rate-limited, time-limited, and consumed only once during the final reset operation.

### Administrator reset

An HOD/admin reset sends a secure, expiring reset code to the affected user. The system deliberately does **not** return a plaintext temporary password to the administrator browser. This prevents credentials from being exposed in API responses, browser history, screenshots, logs, or copied support messages.

## Security model

> **Security boundary:** React controls presentation. Express and MongoDB enforce identity, authorization, relationships, ownership, and data integrity.

| Area | Protection |
|---|---|
| Access tokens | Short-lived JWTs held in frontend memory with role and token-version claims |
| Refresh tokens | HTTP-only cookies, persistent server-side sessions, family rotation, reuse detection, and revocation |
| Logout races | Auth epoch invalidation, single-flight refresh coordination, stale-bootstrap protection, and logout retry bypass |
| Passwords | bcrypt hashing, shared strong-password policy, no plaintext storage, and session revocation after changes |
| OTPs | Cryptographic generation, bcrypt hashing, expiry, attempt limits, rate limits, and single-use consumption |
| Authorization | Role checks plus object-level department, class, subject, faculty, and student ownership checks |
| Attendance | Compound uniqueness, atomic QR claims, duplicate prevention, active-session checks, and relationship validation |
| Browser boundary | Helmet, explicit CORS, cookie-origin guard, SameSite cookies, and secure production cookie settings |
| Input handling | express-validator, Mongo identifier validation, bounded pagination, report row caps, and sanitized search values |
| Auditability | Activity logging for important account, academic, attendance, QR, and password actions |

Production deployments must use HTTPS, exact allowed origins, Secure cookies, private MongoDB, authenticated Redis, managed secrets, backups, and a trusted reverse proxy configuration.

## LAN development

To use the application from another device on the same private Wi-Fi network:

1. Find the development computer’s private IPv4 address, such as `192.168.1.28`.
2. Set the client API URL to `http://192.168.1.28:5000/api`.
3. Add `http://192.168.1.28:5173` to the server `ALLOWED_ORIGINS` value.
4. Keep `NODE_ENV=development`, `ALLOW_LAN_ORIGINS=true`, `REFRESH_COOKIE_SECURE=false`, and `REFRESH_COOKIE_SAMESITE=lax` for local HTTP testing.
5. Allow TCP ports `5173` and `5000` only on the Windows Private network profile.
6. Open `http://192.168.1.28:5173` on the phone or second computer.

Do not use `localhost` in the client API URL from a second device. On that device, `localhost` refers to the device itself rather than the development computer. Do not expose the development server to the public internet.

## Verification

### Backend

```bash
cd server
while IFS= read -r file; do node --check "$file"; done < <(find src -type f -name '*.js' -print | sort)
npm test
```

### Frontend

```bash
cd client
npm test
npm run lint
npm run build
```

The current release verification includes backend syntax checks, 17 backend tests, frontend tests, lint, and a Vite production build. The backend suite covers token claims, refresh-session families, secure reset wiring, OTP generation, uniqueness constraints, cookie-origin behavior, rate-limit fallback, readiness/liveness, CORS, malformed identifiers, lockout calculations, and production-seed refusal.

Database-backed integration and browser E2E scenarios should run against a disposable staging MongoDB environment. They should cover login, refresh rotation, reuse revocation, role boundaries, registration approval, QR attendance, concurrent attendance claims, profile ownership, and report authorization.

## Production build

Build the frontend:

```bash
cd client
npm run build
```

Start the backend in production only after configuring HTTPS, exact origins, secure cookies, private MongoDB, secrets, logging, backups, and any required Redis instance:

```bash
cd server
npm start
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) and [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) before deploying.

## Troubleshooting

| Symptom | Resolution |
|---|---|
| `dotenv` cannot be found | Run `npm install` inside `server` before `npm run seed`. |
| Seed asks for passwords | Add `SEED_ADMIN_PASSWORD`, `SEED_FACULTY_PASSWORD`, and `SEED_STUDENT_PASSWORD` to `server/.env`; each must be at least 12 characters. |
| Seed says HOD already exists | The seed intentionally skips existing databases. Use a fresh development database only when you intentionally want a complete reset. |
| MongoDB connection refused | Start MongoDB and verify `MONGO_URI`, normally `mongodb://127.0.0.1:27017/attendance_system`. |
| Frontend API errors | Verify the backend is running and `VITE_API_BASE_URL` ends with `/api`. Restart Vite after changing `.env`. |
| Refresh session is invalid | Close old app tabs, clear site data for `localhost:5173`, reopen the app, and sign in again. Do not disable refresh rotation or reuse detection. |
| OTP email does not arrive | Check SMTP credentials and use a Gmail App Password rather than a normal Gmail password. |
| Port already in use | Stop the process using port 5000 or 5173, or update the matching server/client configuration. |
| LAN device cannot connect | Use the development computer’s private IP, confirm both devices share the same private network, and allow only the required private-profile firewall ports. |

## Supporting documentation

| Document | Purpose |
|---|---|
| [INSTALLATION.md](./INSTALLATION.md) | Copy-paste local installation guide |
| [API.md](./API.md) | REST endpoint and role-scope reference |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Frontend, backend, database, auth, QR, and deployment architecture |
| [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) | Security findings, remediation, and remaining limitations |
| [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) | Deployment, secrets, observability, backup, and release checklist |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Local, LAN, reverse-proxy, MongoDB, Redis, and rollout guidance |
| [CHANGELOG.md](./CHANGELOG.md) | Release history, including v9.0 interface and profile/reset updates |

## Developer

| Project detail | Value |
|---|---|
| **Developer** | Arjun Krishnan P. S. |
| **Project** | Attendance Register |
| **Release** | v9.0 |
| **Purpose** | College attendance management with secure role-based workflows |

## References

[1]: ./ARCHITECTURE.md "Attendance Register architecture"
[2]: ./SECURITY_AUDIT.md "Attendance Register security audit"
[3]: ./INSTALLATION.md "Attendance Register installation guide"
[4]: ./API.md "Attendance Register API reference"

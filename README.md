# ◈ Attendance Register

> **A secure, relationship-aware college attendance platform for HODs, Faculty, and Students.**
>
> **Made by Arjun Krishnan P. S.**

[![Release](https://img.shields.io/badge/release-v28.1.0-183B56?style=flat-square)](./CHANGELOG.md)
[![Frontend](https://img.shields.io/badge/frontend-React%2019-2F855A?style=flat-square&logo=react&logoColor=white)](./client)
[![Backend](https://img.shields.io/badge/backend-Express%204-CB8A2E?style=flat-square&logo=express&logoColor=white)](./server)
[![Database](https://img.shields.io/badge/database-MongoDB-2F855A?style=flat-square&logo=mongodb&logoColor=white)](./server)
[![Security](https://img.shields.io/badge/security-server--enforced-183B56?style=flat-square)](./SECURITY_FINAL_AUDIT.md)

Attendance Register is a MERN-based college operations system designed around real academic relationships rather than generic role labels. It provides separate workflows for **HODs**, **Faculty**, and **Students**, while keeping authorization, attendance integrity, timetable ownership, QR validation, and messaging permissions enforced by the server.

The current release is **v28.1.0**. It includes the v28 professional workspace redesign and a targeted production-hardening pass for authentication, temporary administrator resets, operational logging, error handling, request lifetimes, response compression, and background polling.

---

## ◇ Contents

- [Core capabilities](#-core-capabilities)
- [Role responsibilities](#-role-responsibilities)
- [Technology](#-technology)
- [Security model](#-security-model)
- [Messaging](#-messaging)
- [Attendance and QR integrity](#-attendance-and-qr-integrity)
- [Project structure](#-project-structure)
- [Local development](#-local-development)
- [Database seeding](#-database-seeding)
- [Docker development](#-docker-development)
- [LAN/Wi-Fi development](#-lanwi-fi-development)
- [Production deployment](#-production-deployment)
- [Verification](#-verification)
- [Operational boundaries](#-operational-boundaries)
- [Supporting documentation](#-supporting-documentation)
- [Author](#-author)

---

## ◆ Core capabilities

| Icon | Capability | Description |
|---|---|---|
| ◈ | Role-aware workspaces | Dedicated HOD, Faculty, and Student dashboards with different priorities and controlled route namespaces. |
| ▦ | Academic management | Departments, semesters, classes, subjects, Faculty assignments, tutors, and class-specific timetables. |
| ◷ | Attendance operations | Exact student, subject, date, and period records with correction, reporting, and duplicate-write protection. |
| ⌁ | QR attendance | Short-lived opaque tokens, hashed server storage, session expiry, class/subject checks, and duplicate-scan protection. |
| ◎ | Direct Messages | Text-only one-to-one conversations with relationship-derived recipient discovery, read state, notifications, and message actions. |
| ⌕ | Search and directories | Bounded server-side search for Students, Faculty, classes, academic records, and authorized chat recipients. |
| ◫ | Leave workflow | Students submit leave requests; tutors and HODs review requests through Pending, Approved, and Rejected sections. |
| ↻ | Resilient sessions | Short-lived in-memory access tokens with HTTP-only rotating refresh sessions and StrictMode-safe single-flight refresh. |
| ▣ | Reports and audit | Authorized attendance reports, notifications, activity records, and operational verification tools. |
| ◇ | Responsive interface | Professional navy, sage, warm-accent, and paper surfaces with desktop navigation, mobile drawer behavior, focus states, and reduced-motion support. |

---

## ◇ Role responsibilities

| Role | Primary responsibilities | Security boundary |
|---|---|---|
| **HOD** | Institution-wide academic management, account and registration review, tutor assignment, timetable control, reports, attendance administration, and authorized communication. | Stored internally as `super_admin`. Every mutation still requires validation, rate limiting, object checks, and audit logging. |
| **Faculty** | Assigned-class teaching workflows, attendance marking, authorized QR sessions, scoped reports, Faculty inability requests, and assigned-student viewing. | Stored internally as `admin`. Access is derived from actual subject, class, timetable, and tutor relationships. |
| **Student** | Own attendance, timetable, profile fields allowed by policy, QR scanning, leave requests, notifications, and authorized Messages. | Stored internally as `user`. Student access is limited to the student’s own record, class, teaching Faculty, tutor, and deterministic HOD relationship. |

> **Important:** the client controls presentation only. The Express API recomputes role, resource, academic relationship, attendance, timetable, and messaging permissions before returning data or accepting a mutation.

---

## ⚙ Technology

| Layer | Implementation |
|---|---|
| Frontend | React 19, Vite, React Router, Axios, Tailwind CSS v4, Recharts, Lucide, Framer Motion |
| Backend | Node.js, Express 4, Mongoose, MongoDB, JWT, bcryptjs, Nodemailer, PDFKit, ExcelJS |
| Security | Helmet, explicit CORS allowlist, cookie Origin/Fetch Metadata guards, request IDs, Mongo sanitization, strict body contracts, express-validator, endpoint-specific rate limits, bounded HTTP lifetimes |
| Distributed state | MongoDB-backed refresh sessions and QR sessions; optional Redis-backed shared rate limiting |
| Media storage | Server-only ImageKit credentials for validated profile photos; message storage remains permanently text-only |
| Validation | Node built-in test runner, server syntax checks, client tests, ESLint, Vite production build, npm audit, OpenAPI validation |

---

## 🛡 Security model

### Authentication and sessions

Access tokens are short-lived JWTs held in frontend memory. They contain the user ID, canonical role, and per-user `tokenVersion`. Protected requests load the current user, verify the token version, check active status, and enforce the Student device binding when applicable.

Refresh tokens are stored in HTTP-only cookies and represented server-side only by SHA-256 digests. Refresh sessions use unique `jti` values, persistent families, atomic rotation, bounded same-token grace handling, reuse detection, and family revocation. A page reload can therefore preserve a legitimate session without storing an access token in local storage.

The client uses a single-flight refresh coordinator. Concurrent expired requests share one refresh operation, and the authentication bootstrap is protected against duplicate React StrictMode initialization. Terminal failures are auth-epoch-aware so stale failures cannot invalidate a newer session.

### Password lifecycle

Passwords are hashed through the User model hook and must satisfy the shared strength policy. HOD-managed resets generate a cryptographically random temporary password that is shown once to the authorized HOD, hashed before storage, expires within a bounded TTL, invalidates existing sessions, and requires a password change.

The temporary-password restriction is enforced by server middleware, not only by frontend routing. Until the user completes Change Password, normal protected resources are blocked and only the authenticated password-change endpoint remains available. OTP reset flows use hashed, expiring, one-time codes with bounded verification attempts.

### Request and data protections

The API uses strict mutation bodies, validated identifiers, object-level authorization, relationship checks, bounded pagination, endpoint-specific rate limits, secure projections, safe error codes, metadata-only operational error logging, compressed responses, bounded HTTP request lifetimes, and a restrictive Permissions-Policy header.

Profile photo uploads are restricted to the dedicated upload routes, limited in size, checked by detected file content, and stored through server-only ImageKit credentials. Messages never accept attachments, external URLs, HTML, or executable content.

---

## ◎ Messaging

Messages are secure, direct, one-to-one, and permanently **text-only**. Existing conversations are shown in the inbox; there is no permanently rendered contact directory. An **Add chat** action opens recipient search only when requested, and selecting an authorized result creates or opens the conversation.

| Sender | Authorized recipients |
|---|---|
| HOD | Active Faculty and Students permitted by the institution’s relationship policy. |
| Faculty | Students taught by that Faculty, tutors, HODs, and authorized Faculty peers. |
| Student | Same-class classmates, teaching Faculty, the current class tutor, and one deterministic HOD. Students from other departments or semesters are excluded. |

The server rechecks relationship authorization for recipient discovery, profile viewing, conversation creation, conversation access, sending, editing, and deletion. Enter sends a message; Shift+Enter inserts a new line. Read state is represented with message ticks and synchronized notifications. **Delete from me** uses per-user visibility state; **Delete from everyone** is durable and sender-owned only.

---

## ⌁ Attendance and QR integrity

Attendance records are uniquely identified by `(student, subject, date, periodOrder)`. Bulk writes use indexed operations, while QR claims use atomic updates alongside the unique attendance index so concurrent duplicate scans cannot create duplicate attendance.

QR sessions are short-lived, tied to the subject, class, date, and period, and store only a SHA-256 token digest. Scans validate session state, expiry, active Student status, class membership, subject enrollment, exact timetable consistency, and duplicate state. Older active sessions are deactivated when a new session is created.

Timetable availability is server-derived. Busy Faculty are omitted from selectable options when the server can verify availability; failed availability checks fail closed. Save-time conflicts return structured details including Faculty, day, period, and time rather than a misleading generic error.

---

## ▦ Project structure

```text
attendance-register-v28.1/
├── client/
│   ├── public/
│   ├── src/
│   │   ├── api/              # Axios wrappers and auth refresh coordination
│   │   ├── components/       # Layout, navigation, common controls, modals
│   │   ├── context/          # Auth and theme state
│   │   ├── pages/            # HOD, Faculty, Student, and shared workflows
│   │   └── utils/            # Client validation and error mapping
│   ├── .env.example
│   └── package.json
├── server/
│   ├── src/
│   │   ├── config/           # Environment, security, and database setup
│   │   ├── controllers/      # Business workflows and safe projections
│   │   ├── middleware/       # Auth, validation, rate limits, errors, request IDs
│   │   ├── models/           # Mongoose persistence contracts and indexes
│   │   ├── routes/            # Protected REST route boundaries
│   │   ├── services/          # Redis, email, storage, activity, and notifications
│   │   └── utils/             # Seed, migration, authorization, QR, and diagnostics
│   ├── .env.example
│   └── package.json
├── tests/server/             # Backend security and domain regression contracts
├── docs/openapi.yaml         # OpenAPI 3.1 API contract
├── verification/             # Release verification reports
├── API.md
├── CHANGELOG.md
├── PRODUCTION_CHECKLIST.md
└── SECURITY_FINAL_AUDIT.md
```

---

## ◇ Local development

### Requirements

Use **Node.js 20 or newer**, npm, MongoDB 7 or a compatible deployment, and an SMTP provider for OTP and notification flows. Redis is optional for one local backend and required for coordinated rate limiting across multiple API instances.

### Backend

```bash
unzip attendance-register-v28.1.zip
cd attendance-register-v28.1/server
cp .env.example .env
```

Edit `server/.env` with a valid MongoDB URI, distinct strong JWT secrets, email settings, and development origins. Never commit `.env` files or real credentials.

```bash
npm install
npm run seed
npm run dev
```

### Frontend

In a second terminal:

```bash
cd attendance-register-v28.1/client
cp .env.example .env
npm install
npm run dev
```

The development API runs at `http://localhost:5000`, and the Vite client runs at `http://localhost:5173`. Health endpoints are `/api/health` and `/api/ready`.

### Required seed variables

The seed script requires explicit passwords of at least 12 characters and refuses to run in production:

```dotenv
SEED_ADMIN_PASSWORD=use-a-strong-development-password
SEED_FACULTY_PASSWORD=use-a-strong-development-password
SEED_STUDENT_PASSWORD=use-a-strong-development-password
```

The seed is designed to be idempotent. It preserves existing records and adds missing development data. Do not use it against a production database.

---

## ◫ Database migrations

Run migrations only during a controlled maintenance window after verifying a backup.

### Canonical roles

```bash
cd server
ROLE_MIGRATION_DRY_RUN=true ALLOW_ROLE_MODEL_MIGRATION=true npm run migrate:canonical-roles
ALLOW_ROLE_MODEL_MIGRATION=true npm run migrate:canonical-roles
```

Ambiguous legacy `admin` records are never silently remapped. Review and provide an explicit ID map when necessary.

### Legacy registration credentials

```bash
cd server
ALLOW_CREDENTIAL_MIGRATION=true NODE_ENV=staging npm run migrate:registration-passwords
```

Confirm the legacy credential field is absent after verification, then unset the migration flag.

---

## ◫ Docker development

Docker is optional. The local Compose stack runs the backend, frontend, and MongoDB on a private Compose network:

```bash
docker compose up --build
```

Open `http://localhost:5173`. Stop the stack with:

```bash
docker compose down
```

Use `docker compose down -v` only when you intentionally want to remove the development MongoDB volume. The production Compose example is in `deploy/docker-compose.production.yml`.

---

## ⌕ LAN/Wi-Fi development

For another device on the same private network:

1. Find the development PC’s private IPv4 address, such as `192.168.1.28`.
2. Set `VITE_API_BASE_URL=http://192.168.1.28:5000/api` in `client/.env`.
3. Replace `YOUR_PC_LAN_IP` in `server/.env` with the same address in `ALLOWED_ORIGINS`.
4. Keep development mode enabled with `ALLOW_LAN_ORIGINS=true`, `REFRESH_COOKIE_SECURE=false`, and `REFRESH_COOKIE_SAMESITE=lax`.
5. Visit `http://192.168.1.28:5173` from the phone, tablet, or second computer.

Do not use `localhost` in the second device’s API URL. Keep the network private, do not expose the development server to the public internet, and do not disable the firewall globally. The application’s Student device binding uses an opaque browser-local identifier sent through `X-Device-Id`.

---

## ▲ Production deployment

For production, terminate HTTPS at a managed load balancer or reverse proxy and configure:

| Requirement | Production expectation |
|---|---|
| Origins | Exact HTTPS values in `CLIENT_URL` and `ALLOWED_ORIGINS`; no LAN wildcard behavior. |
| Cookies | `REFRESH_COOKIE_SECURE=true` with deliberate SameSite policy. |
| Rate limits | Shared Redis through `REDIS_URL`; no development bypass flags. |
| Proxy | `TRUST_PROXY_HOPS` set to the exact trusted proxy count. |
| Database | Private, authenticated, TLS-protected MongoDB with tested backups and monitoring. |
| Instances | Stateless API instances behind the proxy; critical state remains in MongoDB. |
| Secrets | Strong, distinct JWT secrets and server-only provider credentials. |

Startup fails closed for unsafe production configuration. The demonstration Compose database is not an internet-facing production database.

---

## ✓ Verification

The current v28.1 source passed the following local gates:

| Gate | Result |
|---|---:|
| Server regression suite | **78 passed, 0 failed** |
| Client regression suite | **32 passed, 0 failed** |
| Server syntax checks | **Passed for all `server/src/**/*.js` files** |
| Client lint | **0 warnings, 0 errors** |
| Client production build | **Passed** |
| Server dependency audit | **0 vulnerabilities at high threshold** |
| Client dependency audit | **0 vulnerabilities at high threshold** |
| OpenAPI validation | **54 documented paths parsed successfully** |
| Source safety scan | No unsafe dynamic HTML/code markers; no non-CLI runtime `console.log` or raw error-message logs |
| Archive validation | Root, metadata, safe environment templates, exclusions, and extraction checks passed |

Useful commands:

```bash
cd server
npm test

cd ../client
npm test
npm run lint
npm run build
```

The backend suite covers authentication claims, refresh sessions, strict bodies, role migration, rate limits, QR token handling, attendance scope, timetable occupancy, Faculty availability, tutor scope, leave decisions, registration assignment, Messages authorization, BOLA boundaries, safe errors, uploads, and seed safeguards. The client suite covers single-flight refresh, responsive navigation, error pages, cancellable search, visibility-aware polling, timetable state, leave states, QR behavior, and Messages interactions.

---

## ! Operational boundaries

The local gates do not replace staging verification. The following require a disposable environment with real services and are intentionally not claimed as complete here:

- Live MongoDB, Redis, SMTP, and ImageKit integration.
- Authenticated browser checks across desktop, tablet, phone, and multiple devices.
- Refresh-token theft, reuse, race, and family-revocation scenarios.
- QR expiry, wrong-class, duplicate, and concurrent-scan scenarios against live persistence.
- Timetable seed persistence, unchanged saves, intentional conflicts, and exact availability requests against MongoDB.
- Backup restoration, deployed HTTPS, reverse-proxy behavior, production monitoring, and alerting.

These boundaries are documented so a staging operator can complete them without confusing static or sandbox validation with production certification.

---

## ◈ Supporting documentation

| Document | Purpose |
|---|---|
| [API.md](./API.md) | REST endpoint, request, response, and role-scope reference. |
| [SECURITY_FINAL_AUDIT.md](./SECURITY_FINAL_AUDIT.md) | Security controls, evidence, migrations, and honest limitations. |
| [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) | Deployment, secrets, observability, backup, and staging checklist. |
| [CHANGELOG.md](./CHANGELOG.md) | Release history and v28.1 production-polish notes. |
| [docs/openapi.yaml](./docs/openapi.yaml) | OpenAPI 3.1 contract for the implemented REST API. |
| [verification/V28_1_VERIFICATION_REPORT.md](./verification/V28_1_VERIFICATION_REPORT.md) | Current v28.1 verification evidence and validation boundary. |

---

## ◇ Author

**Arjun Krishnan P. S.**  
Developer of Attendance Register

This README describes the v28.1 source release and its verified boundaries.

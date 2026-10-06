# Attendance Register Deployment Guide

## Deployment principles

Run the client as a static build, run at least two API instances behind an HTTPS-capable reverse proxy, keep MongoDB private and authenticated, and configure Redis for shared production rate limits. The API’s request processing is stateless; refresh sessions, refresh families, QR state, attendance, and academic data are persisted in MongoDB, so sticky sessions are not required.

```text
Browser
  ↓ HTTPS
Load balancer / Nginx
  ↓ /api
API instance 1 ─┐
API instance 2 ─┼─ MongoDB TLS/private network
API instance N ─┘
       └────── Redis TLS/private network for shared rate limits
```

## Development

Install Node.js 20 or newer, npm, MongoDB, and an SMTP provider if OTP/password email flows are needed. Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env`. Set different high-entropy JWT access and refresh secrets, exact local origins, and explicit seed passwords.

```bash
cd server
cp .env.example .env
npm install
npm run seed
npm run dev
```

In a second terminal:

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

The API listens on port 5000 and Vite on port 5173 by default. The seed uses canonical HOD/Faculty/Student roles and a deterministic demo generator and fails fast with the configured MongoDB connection timeout when the database is unavailable. Confirm `GET /api/health` returns liveness and `GET /api/ready` returns readiness after MongoDB is connected. Redis is optional for a single local development instance; `/api/health` reports `connected`, `disconnected`, or `not_configured`, and development readiness is not blocked by an unavailable optional Redis service.

## Production environment

Set `NODE_ENV=production`, exact HTTPS `CLIENT_URL`/`ALLOWED_ORIGINS`, `REFRESH_COOKIE_SECURE=true`, high-entropy separate JWT secrets, TLS-capable `MONGO_URI`, SMTP credentials, and the exact `TRUST_PROXY_HOPS` count. Do not use wildcard CORS, blanket proxy trust, shared credentials between environments, or `DISABLE_RATE_LIMITS=true`.

Set `REDIS_URL` for every production API instance. Production retains reconnect support, connects Redis before listening, and closes Redis during graceful shutdown. If Redis is not configured or unavailable in production, readiness remains false when shared limits are required. In development, a bounded connection attempt falls back to the process-local limiter without repeated connection-error spam; that fallback cannot coordinate limits across instances.

Protect `.env` values through the deployment secret manager. Never place secrets in Dockerfiles, Compose source, the client bundle, logs, or Git. The browser must never receive JWT signing secrets, SMTP credentials, MongoDB credentials, Redis credentials, or refresh-token values.

## Existing-database migration sequence

Before deploying the current registration approval and credential-hardening changes to a database that may have been created by an older build:

1. Take and verify a database backup or snapshot.
2. Deploy the current code to a staging clone and inspect `registrationrequests` for plaintext `password` fields and `users.role` values.
3. Run `ALLOW_CREDENTIAL_MIGRATION=true NODE_ENV=staging npm run migrate:registration-passwords`.
4. Inventory canonical roles with `ROLE_MIGRATION_DRY_RUN=true ALLOW_ROLE_MODEL_MIGRATION=true npm run migrate:canonical-roles`.
5. Review any ambiguous legacy `role=admin` IDs and supply an explicit `ROLE_MIGRATION_ADMIN_MAP` mapping before running the canonical migration from `server`.
6. Confirm both migrations report the expected counts, verify old `password` fields are absent, and verify roles are only `super_admin`, `admin`, or `user`; do not print secret values.
7. Rotate credentials that may have been exposed during the plaintext-storage window.
8. Clean any duplicate active QR records before MongoDB builds the new partial unique index.
9. Deploy production with both migration flags unset and confirm the seed script remains disabled in production.

Each migration refuses unsafe execution without its explicit maintenance flag. Keep `ALLOW_CREDENTIAL_MIGRATION`, `ALLOW_ROLE_MODEL_MIGRATION`, and any role map unset after the controlled maintenance window.

## Docker Compose reference

`deploy/docker-compose.production.yml` is a reference for a private MongoDB, two API instances, and an edge client/proxy container. It is not a substitute for managed MongoDB backups, TLS certificate automation, secret management, or infrastructure monitoring.

```bash
docker compose -f deploy/docker-compose.production.yml build
docker compose -f deploy/docker-compose.production.yml up -d
docker compose -f deploy/docker-compose.production.yml ps
```

The example should be adapted before use: provide a secure MongoDB credential, mount or inject server environment values, add Redis if multi-instance limits are required, and terminate TLS at the edge or upstream managed load balancer. Do not publish MongoDB port 27017 to the public internet.

## Reverse proxy requirements

`deploy/nginx.conf` proxies `/api` to the backend pool, preserves request IDs and safe client context, and serves the Vite SPA fallback. Replace example `server_name` and certificate directives with the infrastructure owner’s domain and managed certificate configuration. Set `TRUST_PROXY_HOPS` to the exact number of trusted proxy hops between the client and Node; the value controls IP-based rate limits and audit logging.

The reverse proxy should enforce HTTPS, limit request body sizes consistently with the application, support WebSocket upgrades only if a future feature needs them, expose `/api/health` for liveness, expose `/api/ready` for readiness, and remove unhealthy API instances from rotation before termination.

## MongoDB requirements

Use a managed replica set or private controlled deployment with TLS, authentication, least-privilege application credentials, network allowlisting, encrypted backups, tested restores, query monitoring, and separate staging/production databases. Maintain indexes for attendance uniqueness, active QR uniqueness, refresh sessions, OTP expiry, registration status, and the common subject/class/student query patterns. Confirm index build status before accepting writes after a migration.

## Redis requirements

Use a private Redis deployment with authentication and TLS where supported. Restrict network access to API instances, monitor memory/eviction/error rates, and define an appropriate persistence/availability policy. Redis is not the source of truth for authentication, attendance, QR records, or academic data; it stores shared rate-limit counters. If Redis is unavailable and the limiter cannot contact it, requests fail closed according to the limiter configuration rather than silently bypassing protection.

## Health, rollout, and rollback

A release should pass backend syntax checks, the Node security suite, frontend lint/build, secret scanning, and staged database-backed authorization/concurrency tests. In staging, verify login, refresh rotation, refresh reuse response, password change invalidation, password reset, registration approval, OTP expiry/attempt limits, wrong-class QR scans, duplicate/concurrent scans, report scoping, and mobile/desktop navigation.

During a rollout, deploy the new image to one drained canary instance, verify health/readiness and logs, then roll through the remaining instances. Keep the prior application image available. Do not roll back a database migration by simply downgrading application code; use a tested database restoration or forward-fix plan.

## References

[1]: ./README.md "Project README"
[2]: ./SECURITY_AUDIT.md "Security audit"
[3]: ./ARCHITECTURE.md "Architecture overview"
[4]: ./PRODUCTION_CHECKLIST.md "Production checklist"

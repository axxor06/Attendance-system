# Attendance Register v5 Deployment Guide

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

The API listens on port 5000 and Vite on port 5173 by default. Confirm `GET /api/health` returns liveness and `GET /api/ready` returns readiness only after MongoDB is connected.

## Production environment

Set `NODE_ENV=production`, exact HTTPS `CLIENT_URL`/`ALLOWED_ORIGINS`, `REFRESH_COOKIE_SECURE=true`, high-entropy separate JWT secrets, TLS-capable `MONGO_URI`, SMTP credentials, and the exact `TRUST_PROXY_HOPS` count. Do not use wildcard CORS, blanket proxy trust, shared credentials between environments, or `DISABLE_RATE_LIMITS=true`.

Set `REDIS_URL` for every API instance. The application connects Redis before listening and closes Redis during graceful shutdown. If Redis is not configured, the memory limiter is only a development fallback and cannot coordinate limits across instances.

Protect `.env` values through the deployment secret manager. Never place secrets in Dockerfiles, Compose source, the client bundle, logs, or Git. The browser must never receive JWT signing secrets, SMTP credentials, MongoDB credentials, Redis credentials, or refresh-token values.

## Existing-database migration sequence

Before deploying the v5 registration approval change to a database that may have been created by an older build:

1. Take and verify a database backup or snapshot.
2. Deploy the v5 code to a staging clone and inspect `registrationrequests` for plaintext `password` fields.
3. Run `ALLOW_CREDENTIAL_MIGRATION=true NODE_ENV=staging npm run migrate:registration-passwords` from `server`.
4. Confirm the migration reports the expected count and verify old `password` fields are absent; do not print their values.
5. Rotate credentials that may have been exposed during the plaintext-storage window.
6. Clean any duplicate active QR records before MongoDB builds the new partial unique index.
7. Deploy production with `ALLOW_CREDENTIAL_MIGRATION` unset and confirm the seed script remains disabled in production.

The migration refuses `NODE_ENV=production` unless the explicit maintenance flag is present. Keep the flag unset after the controlled maintenance window.

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

[1]: ./README.md "v5 project README"
[2]: ./SECURITY_AUDIT.md "v5 security audit"
[3]: ./ARCHITECTURE.md "v5 architecture"
[4]: ./PRODUCTION_CHECKLIST.md "v5 production checklist"

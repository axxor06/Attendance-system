import './config/env.js';

import http from 'http';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import { verifyEmailConnection } from './utils/email.js';
import { connectRedis, disconnectRedis } from './services/redisService.js';
import { assertSecurityConfiguration } from './config/security.js';

const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS || 10000);
const HTTP_REQUEST_TIMEOUT_MS = Number(process.env.HTTP_REQUEST_TIMEOUT_MS || 30000);
const HTTP_HEADERS_TIMEOUT_MS = Number(process.env.HTTP_HEADERS_TIMEOUT_MS || 15000);
const HTTP_KEEP_ALIVE_TIMEOUT_MS = Number(process.env.HTTP_KEEP_ALIVE_TIMEOUT_MS || 5000);

function positiveDuration(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function start() {
  assertSecurityConfiguration();
  await connectDB();
  await connectRedis();
  const { default: app } = await import('./app.js');
  await verifyEmailConnection();

  const server = http.createServer(app);
  // Bound incomplete requests and idle connections so a slow client cannot
  // retain a socket forever. The values are configurable but sanitized here;
  // production startup validation also rejects invalid overrides.
  server.requestTimeout = positiveDuration(HTTP_REQUEST_TIMEOUT_MS, 30000);
  server.headersTimeout = positiveDuration(HTTP_HEADERS_TIMEOUT_MS, 15000);
  server.keepAliveTimeout = positiveDuration(HTTP_KEEP_ALIVE_TIMEOUT_MS, 5000);
  server.listen(PORT, HOST, () => {
    console.log(`[Server] Running in ${process.env.NODE_ENV || 'development'} mode on ${HOST}:${PORT}`);
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Server] ${signal} received; draining connections.`);

    const forceExit = setTimeout(() => {
      console.error('[Server] Graceful shutdown timed out.');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    server.close(async () => {
      try {
        await mongoose.connection.close(false);
        await disconnectRedis();
        clearTimeout(forceExit);
        process.exit(0);
      } catch (error) {
        console.error('[Server] Shutdown failed:', error.message);
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => {
    console.error('[Server] Unhandled rejection:', err);
    shutdown('unhandledRejection');
  });
  process.on('uncaughtException', (err) => {
    console.error('[Server] Uncaught exception:', err);
    shutdown('uncaughtException');
  });
}

start().catch((err) => {
  console.error('[Server] Startup failed:', err?.code || 'STARTUP_ERROR', err?.message || 'Initialization failed.');
  process.exit(1);
});

import { createClient } from 'redis';

let client = null;
let connecting = null;

export function isRedisConfigured() {
  return Boolean(process.env.REDIS_URL);
}

export function getRedisClient() {
  return client;
}

export async function connectRedis() {
  if (!isRedisConfigured()) {
    if (process.env.NODE_ENV === 'production') throw new Error('REDIS_URL is required in production for shared rate limiting.');
    return null;
  }
  if (client?.isReady) return client;
  if (connecting) return connecting;

  const isDevelopment = process.env.NODE_ENV !== 'production';
  let errorReported = false;
  const connectTimeout = Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 3000);
  client = createClient({
    url: process.env.REDIS_URL,
    socket: {
      connectTimeout: Number.isFinite(connectTimeout) && connectTimeout >= 1000 && connectTimeout <= 30000 ? connectTimeout : 3000,
      reconnectStrategy: isDevelopment ? false : (retries) => Math.min(5000, Math.max(250, retries * 250)),
    },
  });
  client.on('error', (error) => {
    if (errorReported) return;
    errorReported = true;
    const logger = isDevelopment ? console.warn : console.error;
    logger(`[Redis] ${isDevelopment ? 'Optional development connection unavailable' : 'Client error'} (${error?.code || 'REDIS_ERROR'}).`);
  });

  connecting = client.connect()
    .then(() => {
      errorReported = false;
      console.log('[Redis] Shared rate-limit store connected.');
      return client;
    })
    .catch(async (error) => {
      client = null;
      if (isDevelopment) return null;
      const connectionError = new Error('Redis could not be reached during startup.');
      connectionError.code = 'REDIS_CONNECTION_ERROR';
      connectionError.cause = error;
      throw connectionError;
    })
    .finally(() => {
      connecting = null;
    });

  return connecting;
}

export async function disconnectRedis() {
  if (!client) return;
  const current = client;
  client = null;
  if (current.isOpen) await current.quit();
}

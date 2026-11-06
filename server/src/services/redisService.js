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
  client = createClient({
    url: process.env.REDIS_URL,
    socket: {
      connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 3000),
      reconnectStrategy: isDevelopment ? false : (retries) => Math.min(5000, Math.max(250, retries * 250)),
    },
  });
  client.on('error', (error) => {
    if (errorReported) return;
    errorReported = true;
    const logger = isDevelopment ? console.warn : console.error;
    logger(`[Redis] ${isDevelopment ? 'Optional development connection unavailable' : 'Client error'}:`, error.message);
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
      throw new Error(`Redis connection failed: ${error.message}`);
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

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
  if (!isRedisConfigured()) return null;
  if (client?.isReady) return client;
  if (connecting) return connecting;

  client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (error) => {
    console.error('[Redis] Client error:', error.message);
  });

  connecting = client.connect()
    .then(() => {
      console.log('[Redis] Shared rate-limit store connected.');
      return client;
    })
    .catch(async (error) => {
      client = null;
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

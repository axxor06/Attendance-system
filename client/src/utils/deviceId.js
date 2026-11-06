const STORAGE_KEY = 'attendance-register.device-id.v1';
let memoryDeviceId = null;

function createDeviceId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(24);
  globalThis.crypto?.getRandomValues?.(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('') || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getDeviceId() {
  if (memoryDeviceId) return memoryDeviceId;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && stored.length >= 20) {
      memoryDeviceId = stored;
      return memoryDeviceId;
    }
    memoryDeviceId = createDeviceId();
    window.localStorage.setItem(STORAGE_KEY, memoryDeviceId);
    return memoryDeviceId;
  } catch {
    memoryDeviceId = createDeviceId();
    return memoryDeviceId;
  }
}

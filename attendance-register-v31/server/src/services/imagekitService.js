import crypto from 'node:crypto';
import ImageKit from 'imagekit';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ['image/jpeg', (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff],
  ['image/png', (buffer) => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))],
  ['image/webp', (buffer) => buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP'],
]);

let client;

function getClient() {
  if (client) return client;
  const { IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT } = process.env;
  if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_PRIVATE_KEY || !IMAGEKIT_URL_ENDPOINT) return null;
  client = new ImageKit({ publicKey: IMAGEKIT_PUBLIC_KEY, privateKey: IMAGEKIT_PRIVATE_KEY, urlEndpoint: IMAGEKIT_URL_ENDPOINT });
  return client;
}

export function validateProfileImage(file) {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) return { ok: false, message: 'Please select an image file.' };
  const reportedSize = Number(file.size);
  if (file.buffer.length > MAX_IMAGE_BYTES || (Number.isFinite(reportedSize) && reportedSize > MAX_IMAGE_BYTES)) return { ok: false, message: 'Image must be 3 MB or smaller.' };
  const detectedType = [...ALLOWED_TYPES.entries()].find(([, detector]) => detector(file.buffer))?.[0];
  if (!detectedType || !ALLOWED_TYPES.has(file.mimetype) || detectedType !== file.mimetype) return { ok: false, message: 'Only JPG, PNG and WebP images are allowed.' };
  return { ok: true, mimeType: detectedType };
}

export function isImageKitConfigured() {
  return Boolean(process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT);
}

/**
 * Avatar URLs are accepted only when they point at the configured ImageKit
 * origin. Upload bytes are validated separately in uploadProfileImage(); this
 * check prevents a caller from bypassing that pipeline with an arbitrary URL.
 */
export function isAllowedProfileImageUrl(value) {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string' || !isImageKitConfigured()) return false;
  try {
    const candidate = new URL(value);
    const endpoint = new URL(process.env.IMAGEKIT_URL_ENDPOINT);
    return candidate.protocol === 'https:' && candidate.origin === endpoint.origin;
  } catch {
    return false;
  }
}

export async function uploadProfileImage(file, { userId, purpose = 'profile-photo' } = {}) {
  const validation = validateProfileImage(file);
  if (!validation.ok) {
    const error = new Error(validation.message);
    error.statusCode = 422;
    error.code = 'INVALID_PROFILE_IMAGE';
    throw error;
  }
  const imageKit = getClient();
  if (!imageKit) {
    const error = new Error('Profile photo uploads are not configured yet.');
    error.statusCode = 503;
    error.code = 'IMAGE_UPLOAD_NOT_CONFIGURED';
    throw error;
  }
  const extension = validation.mimeType === 'image/png' ? 'png' : validation.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `${purpose}-${userId || 'registration'}-${crypto.randomUUID()}.${extension}`;
  const uploaded = await imageKit.upload({ file: file.buffer, fileName, folder: process.env.IMAGEKIT_PROFILE_FOLDER || '/attendance-register/profiles', useUniqueFileName: false, tags: ['attendance-register', purpose] });
  return { url: uploaded.url };
}

export const PROFILE_IMAGE_MAX_BYTES = MAX_IMAGE_BYTES;

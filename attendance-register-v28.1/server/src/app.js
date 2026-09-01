import './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import routes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimiters.js';
import { requestId } from './middleware/requestId.js';
import { objectIdInputGuard } from './middleware/inputGuard.js';

const app = express();

function accessLogFormat(tokens, req, res) {
  return JSON.stringify({
    requestId: req.id || null,
    method: tokens.method(req, res),
    path: req.path,
    status: Number(tokens.status(req, res)) || 0,
    durationMs: Number(tokens['response-time'](req, res)) || 0,
    responseBytes: Number(tokens.res(req, res, 'content-length')) || 0,
  });
}

const imageKitOrigin = (() => {
  try { return process.env.IMAGEKIT_URL_ENDPOINT ? new URL(process.env.IMAGEKIT_URL_ENDPOINT).origin : null; } catch { return null; }
})();

function isAllowedDevelopmentLanOrigin(origin) {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_LAN_ORIGINS !== 'true') return false;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:') return false;
    if (!['5173', '3000'].includes(url.port)) return false;
    const host = url.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    const ipv4 = host.split('.').map(Number);
    if (ipv4.length !== 4 || ipv4.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    return ipv4[0] === 10 || (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31) || (ipv4[0] === 192 && ipv4[1] === 168);
  } catch {
    return false;
  }
}

const configuredOrigins = [
  process.env.CLIENT_URL,
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean),
  ...(process.env.NODE_ENV === 'production' ? [] : [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
  ]),
].filter(Boolean);
const allowedOrigins = new Set(configuredOrigins);

const corsOptions = {
  origin(origin, callback) {
    // Requests without an Origin are not browser cross-origin requests.
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin) || isAllowedDevelopmentLanOrigin(origin)) return callback(null, true);
    const error = new Error('CORS origin is not allowed');
    error.statusCode = 403;
    error.code = 'CORS_ORIGIN_DENIED';
    return callback(error);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID', 'X-Device-Id'],
  exposedHeaders: ['X-Request-ID', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],
};

const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
app.set('trust proxy', Number.isInteger(trustProxyHops) && trustProxyHops > 0 ? trustProxyHops : false);

app.use(requestId);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', ...(imageKitOrigin ? [imageKitOrigin] : [])],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
}));
app.use((_req, res, next) => {
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  next();
});
app.use(compression({ threshold: 1024 }));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: false, limit: process.env.URLENCODED_BODY_LIMIT || '100kb' }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(objectIdInputGuard);

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(accessLogFormat, {
    skip: (req) => req.path === '/api/health' || req.path === '/api/ready',
  }));
}

app.use('/api', (req, res, next) => {
  // API responses contain authenticated and rapidly-changing application data.
  // Do not let Express turn them into empty 304 responses that clients cannot
  // hydrate after navigation or a page refresh.
  res.set('Cache-Control', 'no-store, private');
  next();
});
app.use('/api', generalLimiter);
app.use('/api', routes);

app.get('/', (_req, res) => {
  res.json({ success: true, message: 'Attendance Register API' });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

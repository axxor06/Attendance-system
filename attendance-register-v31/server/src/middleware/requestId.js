import crypto from 'crypto';

export function requestId(req, res, next) {
  const incoming = req.get('X-Request-ID');
  const id = incoming && /^[A-Za-z0-9._:-]{8,128}$/.test(incoming)
    ? incoming
    : crypto.randomUUID();

  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
}

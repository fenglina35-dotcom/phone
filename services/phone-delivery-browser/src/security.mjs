import crypto from 'node:crypto';

export function sign(secret, timestamp, rawBody) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

export function verifySignedRequest({ secret, timestamp, signature, rawBody, now = Date.now() }) {
  const time = Number(timestamp);
  if (!secret || secret.length < 24 || !Number.isFinite(time) || Math.abs(now - time) > 5 * 60_000) return false;
  const expected = Buffer.from(sign(secret, String(timestamp), rawBody), 'hex');
  let received;
  try { received = Buffer.from(String(signature || ''), 'hex'); } catch { return false; }
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export function opaqueFingerprint(secret, value) {
  return crypto.createHmac('sha256', secret).update(String(value || '')).digest('hex');
}

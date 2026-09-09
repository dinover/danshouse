import crypto from 'node:crypto';

const PASSWORD = process.env.ADMIN_PASSWORD || '';

/** Sin ADMIN_PASSWORD no hay panel remoto: el admin cae a modo local. */
export const authConfigured = Boolean(PASSWORD);

const SECRET = process.env.ADMIN_SECRET
  || (PASSWORD ? crypto.createHash('sha256').update(`danshouse:${PASSWORD}`).digest('hex') : '');

export const COOKIE = 'dh_admin';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días

const b64u = buf => Buffer.from(buf).toString('base64url');

function sign(value) {
  return crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
}

/** Compara sin filtrar la longitud ni el contenido por timing. */
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function checkPassword(input) {
  return authConfigured && typeof input === 'string' && input.length > 0 && safeEqual(input, PASSWORD);
}

export function makeToken() {
  const payload = b64u(JSON.stringify({ exp: Date.now() + MAX_AGE * 1000 }));
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token) {
  if (!authConfigured || typeof token !== 'string') return false;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  if (!safeEqual(token.slice(dot + 1), sign(payload))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof exp === 'number' && exp > Date.now();
  } catch { return false; }
}

function readCookie(req, name) {
  const header = req.headers?.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

export function isAdmin(req) {
  return verifyToken(readCookie(req, COOKIE));
}

export function sessionCookie(token) {
  const base = `${COOKIE}=${token ? encodeURIComponent(token) : ''}; Path=/; HttpOnly; SameSite=Lax; Secure`;
  return token ? `${base}; Max-Age=${MAX_AGE}` : `${base}; Max-Age=0`;
}

/** Huella del visitante, sólo para limitar intentos de login. */
export function clientKey(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'desconocido';
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 24);
}

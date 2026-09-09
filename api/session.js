import { checkPassword, makeToken, sessionCookie, isAdmin, authConfigured, clientKey } from './_lib/auth.js';
import { dbBump, dbEnabled } from './_lib/store.js';

const MAX_INTENTOS = 8;
const VENTANA = 60 * 15; // 15 minutos

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return res.status(200).json({ admin: isAdmin(req), authConfigured, shared: dbEnabled });
  }

  if (req.method === 'POST') {
    if (!authConfigured) {
      return res.status(503).json({ error: 'Falta configurar ADMIN_PASSWORD en Vercel.' });
    }

    const intentos = await dbBump(`danshouse:login:${clientKey(req)}`, VENTANA);
    if (intentos > MAX_INTENTOS) {
      return res.status(429).json({ error: 'Demasiados intentos. Probá de nuevo en un rato.' });
    }

    const { password } = await readBody(req);
    // Freno parejo para que un fallo no se distinga por el tiempo de respuesta.
    await new Promise(r => setTimeout(r, 350));

    if (!checkPassword(password)) {
      return res.status(401).json({ error: 'Contraseña incorrecta.' });
    }

    res.setHeader('Set-Cookie', sessionCookie(makeToken()));
    return res.status(200).json({ admin: true, authConfigured, shared: dbEnabled });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', sessionCookie(null));
    return res.status(200).json({ admin: false, authConfigured, shared: dbEnabled });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Método no permitido.' });
}

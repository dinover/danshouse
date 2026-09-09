import { loadState, saveState, compose, applyPatch } from './_lib/state.js';
import { dbEnabled } from './_lib/store.js';
import { isAdmin, authConfigured } from './_lib/auth.js';

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return null; }
}

export default async function handler(req, res) {
  const admin = isAdmin(req);

  if (req.method === 'GET') {
    const state = await loadState();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      ...compose(state),
      meta: { shared: dbEnabled, authConfigured, admin, hidden: state.hidden || [], updatedAt: state.updatedAt },
    });
  }

  if (req.method === 'PUT') {
    if (!authConfigured) {
      return res.status(503).json({ error: 'El panel remoto no está configurado. Falta la variable ADMIN_PASSWORD.' });
    }
    if (!admin) return res.status(401).json({ error: 'Necesitás iniciar sesión.' });
    if (!dbEnabled) {
      return res.status(503).json({ error: 'No hay base de datos conectada. Activá Upstash Redis en Vercel (ver README).' });
    }

    const patch = await readBody(req);
    if (!patch) return res.status(400).json({ error: 'Cuerpo inválido.' });

    const guardado = await saveState(applyPatch(await loadState(), patch));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      ...compose(guardado),
      meta: { shared: true, authConfigured, admin: true, hidden: guardado.hidden || [], updatedAt: guardado.updatedAt },
    });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Método no permitido.' });
}

// Almacenamiento compartido sobre Redis REST (Upstash / Vercel KV).
// Si no hay credenciales, el sitio sigue funcionando en modo local:
// la carta muestra el estado semilla y el admin guarda en el navegador.

const URL_ =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_REST_URL || '';

const TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REDIS_REST_TOKEN || '';

export const kvEnabled = Boolean(URL_ && TOKEN);

async function command(...args) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`KV ${args[0]} falló: ${res.status} ${await res.text()}`);
  return (await res.json()).result;
}

export async function kvGetJSON(key) {
  if (!kvEnabled) return null;
  const raw = await command('GET', key);
  if (raw == null) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { return null; }
}

export async function kvSetJSON(key, value) {
  if (!kvEnabled) return false;
  await command('SET', key, JSON.stringify(value));
  return true;
}

/** Contador con expiración, para limitar intentos de login. */
export async function kvBump(key, ttlSeconds) {
  if (!kvEnabled) return 0;
  const n = Number(await command('INCR', key)) || 0;
  if (n === 1) await command('EXPIRE', key, String(ttlSeconds));
  return n;
}

export async function kvDel(key) {
  if (!kvEnabled) return false;
  await command('DEL', key);
  return true;
}

// Almacenamiento compartido sobre Redis REST (Upstash, el que Vercel ofrece
// en la pestaña Storage). Guarda el estado de la casa y los contadores del
// freno de login.
//
// Sin credenciales el sitio no se rompe: sigue en modo local, mostrando el
// estado semilla, y el panel guarda en el navegador avisando con un cartel.

const URL_ =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_REST_URL || '';

const TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REDIS_REST_TOKEN || '';

export const dbEnabled = Boolean(URL_ && TOKEN);

async function comando(...args) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });

  if (!res.ok) {
    const cuerpo = (await res.text()).slice(0, 200);
    if (res.status === 401 || res.status === 403) {
      throw new Error('La base rechazó el token. Revisá KV_REST_API_TOKEN en Vercel.');
    }
    if (res.status === 404) {
      throw new Error('No encontré la base en esa dirección. Revisá KV_REST_API_URL en Vercel.');
    }
    throw new Error(`La base respondió ${res.status} a ${args[0]}: ${cuerpo}`);
  }

  return (await res.json()).result;
}

export async function dbGetJSON(key) {
  if (!dbEnabled) return null;
  const crudo = await comando('GET', key);
  if (crudo == null) return null;
  try { return typeof crudo === 'string' ? JSON.parse(crudo) : crudo; }
  catch { return null; }
}

export async function dbSetJSON(key, value) {
  if (!dbEnabled) return false;
  await comando('SET', key, JSON.stringify(value));
  return true;
}

/** Contador que se borra solo, para frenar intentos de login. */
export async function dbBump(key, segundosVentana) {
  if (!dbEnabled) return 0;
  const n = Number(await comando('INCR', key)) || 0;
  if (n === 1) await comando('EXPIRE', key, String(segundosVentana));
  return n;
}

export async function dbDel(key) {
  if (!dbEnabled) return false;
  await comando('DEL', key);
  return true;
}

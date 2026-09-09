// Almacenamiento compartido sobre Supabase (API REST de PostgREST).
// Una sola tabla clave-valor guarda tanto el estado de la casa como los
// contadores de intentos de login.
//
// Si no hay credenciales, el sitio sigue funcionando en modo local:
// la carta muestra el estado semilla y el panel guarda en el navegador.

const URL_ = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');

// La clave de servicio se usa sólo acá, en el servidor: nunca llega al navegador.
const KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY || '';

const TABLA = process.env.SUPABASE_TABLE || 'danshouse_state';

export const dbEnabled = Boolean(URL_ && KEY);

const cabeceras = extra => ({
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  ...extra,
});

function explicar(status, cuerpo) {
  if (status === 404 || /relation .* does not exist|PGRST205/i.test(cuerpo)) {
    return new Error(`Falta la tabla "${TABLA}" en Supabase. Creala con el SQL del README.`);
  }
  if (status === 401 || status === 403) {
    return new Error('Supabase rechazó la clave. Revisá SUPABASE_SERVICE_ROLE_KEY.');
  }
  return new Error(`Supabase respondió ${status}: ${cuerpo.slice(0, 200)}`);
}

export async function dbGetJSON(key) {
  if (!dbEnabled) return null;
  const url = `${URL_}/rest/v1/${TABLA}?id=eq.${encodeURIComponent(key)}&select=data`;
  const res = await fetch(url, { headers: cabeceras() });
  if (!res.ok) throw explicar(res.status, await res.text());
  const filas = await res.json();
  return filas?.[0]?.data ?? null;
}

export async function dbSetJSON(key, value) {
  if (!dbEnabled) return false;
  const res = await fetch(`${URL_}/rest/v1/${TABLA}`, {
    method: 'POST',
    headers: cabeceras({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ id: key, data: value, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw explicar(res.status, await res.text());
  return true;
}

/**
 * Contador con ventana de tiempo, para frenar intentos de login.
 * Lee y reescribe en dos pasos: dos intentos simultáneos podrían contar como
 * uno, y para un freno de fuerza bruta eso alcanza de sobra.
 */
export async function dbBump(key, segundosVentana) {
  if (!dbEnabled) return 0;
  const ahora = Date.now();
  let previo = null;
  try { previo = await dbGetJSON(key); } catch { return 0; }

  const vigente = previo && typeof previo.hasta === 'number' && previo.hasta > ahora;
  const cuenta = vigente ? (Number(previo.cuenta) || 0) + 1 : 1;
  const hasta = vigente ? previo.hasta : ahora + segundosVentana * 1000;

  try { await dbSetJSON(key, { cuenta, hasta }); } catch { /* contar es best-effort */ }
  return cuenta;
}

export async function dbDel(key) {
  if (!dbEnabled) return false;
  const url = `${URL_}/rest/v1/${TABLA}?id=eq.${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: 'DELETE', headers: cabeceras() });
  if (!res.ok) throw explicar(res.status, await res.text());
  return true;
}

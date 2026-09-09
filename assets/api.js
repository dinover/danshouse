// Acceso al estado de la casa.
// Con almacenamiento compartido conectado, manda el servidor y todos ven lo mismo.
// Sin él, el sitio sigue andando y los cambios quedan guardados en este navegador.

const LOCAL_KEY = 'danshouse:local:v1';

export function readLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); }
  catch { return null; }
}

function writeLocal(patch) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(patch)); return true; }
  catch { return false; }
}

/** Rehace del lado del cliente lo que el servidor haría con el estado guardado. */
function overlay(data, patch) {
  if (!patch) return data;
  const out = { ...data };

  if (Array.isArray(patch.customIngredients)) {
    const seed = new Set(data.ingredients.map(i => i.id));
    out.ingredients = [...data.ingredients, ...patch.customIngredients.filter(i => i && !seed.has(i.id))];
  }

  const hidden = new Set(patch.hidden || []);
  const overrides = new Map((patch.customRecipes || []).map(r => [r.id, r]));
  if (hidden.size || overrides.size) {
    const base = data.recipes.filter(r => !hidden.has(r.id)).map(r => overrides.get(r.id) || r);
    const nuevas = [...overrides.values()].filter(r => !data.recipes.some(s => s.id === r.id));
    out.recipes = [...base, ...nuevas];
    out.hiddenRecipes = [...(data.hiddenRecipes || []), ...data.recipes.filter(r => hidden.has(r.id))];
  }

  if (Array.isArray(patch.pantry)) {
    const known = new Set(out.ingredients.map(i => i.id));
    out.pantry = patch.pantry.filter(id => known.has(id));
  }

  return out;
}

/** Estado actual de la casa, listo para renderizar. */
export async function fetchState() {
  const res = await fetch('/api/state', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`No pude leer la carta (${res.status})`);
  const data = await res.json();
  return data.meta?.shared ? data : overlay(data, readLocal());
}

/** Guarda cambios: al servidor si hay almacenamiento, si no acá mismo. */
export async function pushState(patch, { shared }) {
  if (!shared) {
    const merged = { ...(readLocal() || {}), ...patch };
    if (!writeLocal(merged)) throw new Error('Este navegador no me deja guardar nada.');
    return { local: true };
  }
  const res = await fetch('/api/state', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `No pude guardar (${res.status})`);
  return body;
}

export async function session(method = 'GET', body) {
  const res = await fetch('/api/session', {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Algo falló.');
  return data;
}

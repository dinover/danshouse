// Motor de disponibilidad: decide qué se puede cocinar con lo que hay en casa.
// Un requisito es un id suelto, o una lista que significa "cualquiera de estos".

export const isGroup = entry => Array.isArray(entry);

export function satisfies(entry, pantry) {
  return isGroup(entry) ? entry.some(id => pantry.has(id)) : pantry.has(entry);
}

/** Nombre legible de un requisito: "manteca o aceite". */
export function entryName(entry, names) {
  return isGroup(entry)
    ? entry.map(id => names.get(id) || id).join(' o ')
    : (names.get(entry) || entry);
}

export function evaluate(recipe, pantry) {
  const missing = (recipe.need || []).filter(entry => !satisfies(entry, pantry));
  const extras = (recipe.opt || [])
    .flatMap(entry => (isGroup(entry) ? entry : [entry]))
    .filter(id => pantry.has(id));
  return { missing, extras, ready: missing.length === 0 };
}

/**
 * Divide el recetario en lo que sale ya y lo que está a uno o dos ingredientes.
 * `near` se ordena por cercanía para que lo más alcanzable quede arriba.
 */
export function buildMenu(data, { nearLimit = 2 } = {}) {
  const pantry = new Set(data.pantry || []);
  const ready = [];
  const near = [];

  for (const recipe of data.recipes || []) {
    const result = evaluate(recipe, pantry);
    const entry = { recipe, ...result };
    if (result.ready) ready.push(entry);
    else if (result.missing.length <= nearLimit) near.push(entry);
  }

  near.sort((a, b) => a.missing.length - b.missing.length || a.recipe.name.localeCompare(b.recipe.name, 'es'));
  return { ready, near, pantry };
}

/**
 * Qué conviene comprar: cada ingrediente ausente, con las recetas
 * que se destrabarían si entrara a la casa. Pensado para el surtido.
 */
export function shoppingSuggestions(data, { limit = 20 } = {}) {
  const pantry = new Set(data.pantry || []);
  const names = new Map((data.ingredients || []).map(i => [i.id, i.name]));
  const unlocks = new Map();

  for (const recipe of data.recipes || []) {
    const { missing } = evaluate(recipe, pantry);
    if (missing.length !== 1) continue;
    // Un único requisito pendiente: cualquiera de sus opciones alcanza.
    const candidates = isGroup(missing[0]) ? missing[0] : [missing[0]];
    for (const id of candidates) {
      if (pantry.has(id)) continue;
      if (!unlocks.has(id)) unlocks.set(id, []);
      unlocks.get(id).push(recipe.name);
    }
  }

  return [...unlocks.entries()]
    .map(([id, recipes]) => ({ id, name: names.get(id) || id, recipes }))
    .sort((a, b) => b.recipes.length - a.recipes.length || a.name.localeCompare(b.name, 'es'))
    .slice(0, limit);
}

/** Índice id → nombre, para pintar requisitos faltantes. */
export function nameIndex(data) {
  return new Map((data.ingredients || []).map(i => [i.id, i.name]));
}

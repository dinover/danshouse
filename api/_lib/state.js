import { INGREDIENTS, CATEGORIES } from './ingredients.js';
import { RECIPES, SECTIONS } from './recipes.js';
import { kvGetJSON, kvSetJSON } from './store.js';

const KEY = 'danshouse:state:v1';
const TAGS = ['picante', 'clasico', 'veggie', 'estrella', 'rapido', 'casa', 'suave'];

export const EMPTY_STATE = {
  pantry: null,          // null = nunca configurada, arranca con los básicos
  customIngredients: [],
  customRecipes: [],
  hidden: [],            // recetas base ocultadas
  updatedAt: null,
};

export async function loadState() {
  const stored = await kvGetJSON(KEY);
  return { ...EMPTY_STATE, ...(stored || {}) };
}

export async function saveState(state) {
  return kvSetJSON(KEY, { ...state, updatedAt: new Date().toISOString() });
}

const slug = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);

const clean = (text, max) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Une la base del repo con lo que agregó Dan desde el panel. */
export function compose(state) {
  const seedIds = new Set(INGREDIENTS.map(i => i.id));
  const custom = (state.customIngredients || []).filter(i => i && i.id && !seedIds.has(i.id));
  const ingredients = [...INGREDIENTS, ...custom];

  const hidden = new Set(state.hidden || []);
  const overrides = new Map((state.customRecipes || []).filter(r => r && r.id).map(r => [r.id, r]));
  const recipes = [
    ...RECIPES.filter(r => !hidden.has(r.id)).map(r => overrides.get(r.id) || r),
    ...[...overrides.values()].filter(r => !RECIPES.some(s => s.id === r.id)),
  ];
  // Las quitadas viajan aparte: la carta las ignora, el panel las ofrece para restaurar.
  const hiddenRecipes = RECIPES.filter(r => hidden.has(r.id));

  const known = new Set(ingredients.map(i => i.id));
  const pantry = state.pantry === null
    ? ingredients.filter(i => i.staple).map(i => i.id)
    : (state.pantry || []).filter(id => known.has(id));

  return { categories: CATEGORIES, sections: SECTIONS, tags: TAGS, ingredients, recipes, hiddenRecipes, pantry };
}

/** Valida todo lo que llega del panel antes de tocar el almacenamiento. */
export function applyPatch(state, patch) {
  const next = { ...state };
  const catIds = new Set(CATEGORIES.map(c => c.id));
  const secIds = new Set(SECTIONS.map(s => s.id));

  if (Array.isArray(patch.customIngredients)) {
    const seedIds = new Set(INGREDIENTS.map(i => i.id));
    const seen = new Set();
    next.customIngredients = patch.customIngredients
      .map(raw => {
        const name = clean(raw?.name, 40);
        if (!name) return null;
        const id = slug(raw?.id || name);
        if (!id || seedIds.has(id) || seen.has(id)) return null;
        seen.add(id);
        return { id, name, cat: catIds.has(raw?.cat) ? raw.cat : 'almacen', custom: true };
      })
      .filter(Boolean)
      .slice(0, 300);
  }

  const known = new Set(compose(next).ingredients.map(i => i.id));

  if (Array.isArray(patch.customRecipes)) {
    const seen = new Set();
    next.customRecipes = patch.customRecipes
      .map(raw => {
        const name = clean(raw?.name, 60);
        if (!name) return null;
        const id = slug(raw?.id || name);
        if (!id || seen.has(id)) return null;
        seen.add(id);
        const pick = list => (Array.isArray(list) ? list : [])
          .map(entry => Array.isArray(entry)
            ? entry.filter(x => known.has(x))
            : (known.has(entry) ? entry : null))
          .filter(entry => Array.isArray(entry) ? entry.length : entry)
          .slice(0, 30);
        const need = pick(raw?.need);
        if (!need.length) return null;
        return {
          id, name, need,
          section: secIds.has(raw?.section) ? raw.section : 'platos',
          tags: (Array.isArray(raw?.tags) ? raw.tags : []).filter(t => TAGS.includes(t)).slice(0, 3),
          desc: clean(raw?.desc, 180),
          opt: pick(raw?.opt),
          custom: true,
        };
      })
      .filter(Boolean)
      .slice(0, 300);
  }

  if (Array.isArray(patch.hidden)) {
    const seedIds = new Set(RECIPES.map(r => r.id));
    next.hidden = [...new Set(patch.hidden.filter(id => seedIds.has(id)))];
  }

  if (Array.isArray(patch.pantry)) {
    const valid = new Set(compose(next).ingredients.map(i => i.id));
    next.pantry = [...new Set(patch.pantry.filter(id => valid.has(id)))];
  }

  return next;
}

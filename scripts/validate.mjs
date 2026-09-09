import { INGREDIENTS, CATEGORIES } from '../api/_lib/ingredients.js';
import { RECIPES, SECTIONS } from '../api/_lib/recipes.js';

const ids = new Set(INGREDIENTS.map(i => i.id));
const secs = new Set(SECTIONS.map(s => s.id));
const problems = [];
const seen = new Set();
const used = new Set();

for (const r of RECIPES) {
  if (seen.has(r.id)) problems.push(`receta duplicada: ${r.id}`);
  seen.add(r.id);
  if (!secs.has(r.section)) problems.push(`${r.id}: sección inválida "${r.section}"`);
  if (!Array.isArray(r.need) || !r.need.length) problems.push(`${r.id}: sin "need"`);
  const flat = [...(r.need || []), ...(r.opt || [])].flat();
  for (const ing of flat) {
    used.add(ing);
    if (!ids.has(ing)) problems.push(`${r.id}: ingrediente inexistente "${ing}"`);
  }
}

const huerfanos = [...ids].filter(i => !used.has(i));
console.log(`recetas: ${RECIPES.length} · ingredientes: ${ids.size}`);
if (huerfanos.length) console.log(`\nsin usar en ninguna receta (${huerfanos.length}):\n  ${huerfanos.join(', ')}`);
if (problems.length) { console.log('\nPROBLEMAS:'); problems.forEach(p => console.log('  ✗ ' + p)); process.exit(1); }
console.log('\n✓ todo consistente');

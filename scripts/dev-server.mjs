// Servidor de prueba: imita el ruteo de Vercel (estáticos + /api/*) sin depender de la nube.
// Para el camino compartido, levantar antes scripts/fake-redis.mjs.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };

const PUERTO = Number(process.env.PORT) || 3000;

const rutas = {
  '/api/state': (await import('../api/state.js')).default,
  '/api/session': (await import('../api/session.js')).default,
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const handler = rutas[url.pathname];
  if (handler) {
    res.status = c => (res.statusCode = c, res);
    res.json = body => (res.setHeader('Content-Type', 'application/json'), res.end(JSON.stringify(body)));
    try { await handler(req, res); }
    catch (err) { res.statusCode = 500; res.end(JSON.stringify({ error: err.message })); }
    return;
  }

  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!path.extname(file)) file += '.html';           // cleanUrls
  const full = path.join(ROOT, file);
  if (!full.startsWith(ROOT) || !fs.existsSync(full)) { res.statusCode = 404; return res.end('404'); }
  res.setHeader('Content-Type', TIPOS[path.extname(full)] || 'application/octet-stream');
  res.end(fs.readFileSync(full));
}).listen(PUERTO, () => console.log(`http://localhost:${PUERTO}`));

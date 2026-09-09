// Redis REST de mentira para desarrollo: entiende los cuatro comandos que usa
// el sitio, incluido el vencimiento de claves. Guarda en memoria.
import http from 'node:http';

const db = new Map();        // clave → valor
const vence = new Map();     // clave → timestamp

/** Una clave vencida es una clave que no está. */
function leer(key) {
  const hasta = vence.get(key);
  if (hasta !== undefined && hasta <= Date.now()) {
    db.delete(key);
    vence.delete(key);
  }
  return db.get(key) ?? null;
}

http.createServer((req, res) => {
  let raw = '';
  req.on('data', c => raw += c).on('end', () => {
    const [cmd, key, val] = JSON.parse(raw || '[]');
    let result = null;

    if (cmd === 'GET') result = leer(key);
    else if (cmd === 'SET') { db.set(key, val); vence.delete(key); result = 'OK'; }
    else if (cmd === 'INCR') { result = (Number(leer(key)) || 0) + 1; db.set(key, String(result)); }
    else if (cmd === 'EXPIRE') { vence.set(key, Date.now() + Number(val) * 1000); result = 1; }
    else if (cmd === 'DEL') { db.delete(key); vence.delete(key); result = 1; }

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ result }));
  });
}).listen(3001, () => console.log('redis de mentira en :3001'));

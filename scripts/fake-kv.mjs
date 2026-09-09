// Redis REST de mentira, sólo para probar el camino compartido sin nube.
import http from 'node:http';
const db = new Map();
http.createServer((req, res) => {
  let raw = '';
  req.on('data', c => raw += c).on('end', () => {
    const [cmd, key, val] = JSON.parse(raw || '[]');
    let result = null;
    if (cmd === 'GET') result = db.get(key) ?? null;
    else if (cmd === 'SET') { db.set(key, val); result = 'OK'; }
    else if (cmd === 'INCR') { result = (Number(db.get(key)) || 0) + 1; db.set(key, String(result)); }
    else if (cmd === 'EXPIRE') result = 1;
    else if (cmd === 'DEL') { db.delete(key); result = 1; }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ result }));
  });
}).listen(3001);

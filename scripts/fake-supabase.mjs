// Supabase de mentira para desarrollo: imita los dos gestos de PostgREST que
// usa el sitio (leer por id, y upsert). Guarda en memoria, se borra al cerrar.
import http from 'node:http';

const filas = new Map();

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const id = decodeURIComponent((url.searchParams.get('id') || '').replace(/^eq\./, ''));
  const responder = (code, body) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  };

  if (req.method === 'GET') {
    const fila = filas.get(id);
    return responder(200, fila ? [{ data: fila }] : []);
  }

  if (req.method === 'POST') {
    let raw = '';
    return req.on('data', c => raw += c).on('end', () => {
      const fila = JSON.parse(raw || '{}');
      filas.set(fila.id, fila.data);
      responder(201, []);
    });
  }

  if (req.method === 'DELETE') { filas.delete(id); return responder(204, []); }
  responder(405, { message: 'no implementado' });
}).listen(3001, () => console.log('supabase de mentira en :3001'));

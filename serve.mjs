import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const types = { 'index.html':'text/html', 'styles.css':'text/css', 'app.mjs':'text/javascript',
  'ui.mjs':'text/javascript', 'model.mjs':'text/javascript' };
createServer(async (req,res) => {
  const name = new URL(req.url,'http://localhost').pathname.slice(1) || 'index.html';
  if (!Object.hasOwn(types,name)) { res.writeHead(404).end(); return; }
  try {
    const body = await readFile(new URL(name,import.meta.url));
    res.writeHead(200,{'Content-Type':types[name]+'; charset=utf-8'}).end(body);
  } catch {
    res.writeHead(500).end();
  }
}).listen(Number(process.env.PORT || 8080),'127.0.0.1');

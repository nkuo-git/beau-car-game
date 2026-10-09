// 輕量車（LOD）的小工具：本機靜態伺服器（/three/ 對到 node_modules/three）＋開 Chromium（SwiftShader）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
export const DIR = path.dirname(new URL(import.meta.url).pathname);
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.glb': 'model/gltf-binary', '.json': 'application/json', '.jpg': 'image/jpeg', '.txt': 'text/plain' };
export function serve(dir = DIR) {
  const three = path.join(dir, '../node_modules/three');
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    let f = u.startsWith('/three/') ? path.join(three, u.slice(7)) : path.join(dir, u);
    if (!fs.existsSync(f) && /^\/car-[a-z0-9]+-lod\.txt$/.test(u)) f = path.join(dir, 'art', u); // carlod.js 的 LOD_CARS[k].load() 抓頁面旁邊的 car-<key>-lod.txt（跟 art/garage.html 一樣）
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    const b = fs.readFileSync(f);
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'content-length': b.length });
    res.end(b);
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() })));
}
export async function browser() {
  return pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}

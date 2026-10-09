// 試做頁用：art/garage.html → art/garage-free.html（TRIAL_FREE 換成 true：錢用不完）；App（build-app.mjs）不用這個
import fs from 'node:fs';
import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname), a = 'const TRIAL_FREE = false;';
const html = fs.readFileSync(path.join(dir, 'art/garage.html'), 'utf8');
if (html.split(a).length !== 2) throw new Error('TRIAL_FREE anchor missing or not unique');
fs.writeFileSync(path.join(dir, 'art/garage-free.html'), html.replace(a, 'const TRIAL_FREE = true;'));
console.log('art/garage-free.html written');

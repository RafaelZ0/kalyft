import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const source = fs.readFileSync(path.join(import.meta.dirname, 'hoje.html'), 'utf8');
let scripts = 0;
for (const match of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  if (match[1].trim()) { new vm.Script(match[1]); scripts++; }
}
for (const match of source.matchAll(/src="(\.\.\/[^\"]+)"/g)) {
  if (!fs.existsSync(path.resolve(import.meta.dirname, match[1]))) throw Error('Arquivo ausente: ' + match[1]);
}
for (const id of ['theme', 'water', 'water-fill', 'water-progress', 'undo', 'toast']) {
  if (!source.includes('id="' + id + '"')) throw Error('Controle ausente: ' + id);
}
console.log(`${scripts} scripts válidos; arquivos de marca e controles encontrados.`);

// Soma o tamanho gzip de dist/assets/*.js e falha se passar do orçamento (CLAUDE.md § Stack).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const LIMITE_KB = 200;
const pasta = join(process.cwd(), 'dist', 'assets');

if (!existsSync(pasta)) {
  console.error('dist/assets não existe. Rode `npm run build` antes.');
  process.exit(1);
}

const arquivos = readdirSync(pasta).filter((f) => f.endsWith('.js'));
if (arquivos.length === 0) {
  console.error('Nenhum .js em dist/assets.');
  process.exit(1);
}

let total = 0;
for (const f of arquivos) {
  const kb = gzipSync(readFileSync(join(pasta, f)), { level: 9 }).length / 1024;
  total += kb;
  console.log(`${f.padEnd(40)} ${kb.toFixed(2)} KB gzip`);
}
console.log(`TOTAL JS gzip: ${total.toFixed(2)} KB (limite ${LIMITE_KB} KB)`);
if (total >= LIMITE_KB) {
  console.error('FALHOU: orçamento de bundle estourado.');
  process.exit(1);
}
console.log('OK: dentro do orçamento.');

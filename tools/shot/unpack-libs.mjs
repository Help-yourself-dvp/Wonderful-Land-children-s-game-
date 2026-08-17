// Распаковывает системные библиотеки AL2023 и шрифты из @sparticuz/chromium,
// которых нет в песочнице (libnspr4.so и др.). Бинарник chromium ищет их через
// LD_LIBRARY_PATH, который мы выставляем вручную — без этого запуск падает с
// "error while loading shared libraries: libnspr4.so".
//
// В пакете нет утилиты brotli, поэтому распаковываем .br через Node zlib.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.join(__dirname, 'node_modules', '@sparticuz', 'chromium', 'bin');

function brotliExtract(brFile, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const tarPath = path.join(outDir, '_data.tar');
  const buf = zlib.brotliDecompressSync(fs.readFileSync(brFile));
  fs.writeFileSync(tarPath, buf);
  execSync(`tar -xf ${tarPath} -C ${outDir}`, { stdio: 'inherit' });
  fs.rmSync(tarPath);
}

brotliExtract(path.join(pkg, 'al2023.tar.br'), path.join(__dirname, 'al2023'));
brotliExtract(path.join(pkg, 'fonts.tar.br'), path.join(__dirname, 'fonts'));

const nspr = path.join(__dirname, 'al2023', 'lib', 'libnspr4.so');
if (!fs.existsSync(nspr)) {
  console.error('FAILED: libnspr4.so не найдена после распаковки');
  process.exit(1);
}
console.log('OK: библиотеки и шрифты распакованы в tools/shot/al2023 и tools/shot/fonts');

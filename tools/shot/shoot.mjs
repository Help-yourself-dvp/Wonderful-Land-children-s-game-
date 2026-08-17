// Скрипт автономной скриншот-проверки превью через @sparticuz/chromium.
//
// Почему именно так (урок v0.19.0): в песочнице Arena нет системного Chromium,
// а `npx playwright install chromium` и `playwright install-deps` НЕ работают:
// бинарник не качается, а apt-пакеты не ставятся без root. Рабочий обходной путь —
// npm-пакет @sparticuz/chromium (бинарник и библиотеки AL2023 идут внутри пакета),
// плюс ручная распаковка al2023.tar.br и указание LD_LIBRARY_PATH.
//
// Запуск (один раз на свежую песочницу — см. tools/shot/README.md):
//   cd tools/shot && npm i && node unpack-libs.mjs
// Затем из корня репо после `npm run build && python3 tools/build_preview.py`:
//   cd tools/shot && node shoot.mjs hedge world
//
// Аргументы — имена хеш-сценариев без префикса #shot- (hedge, world, owl, ...).
// Каждый снимается в двух размерах: планшет 1280x800 и телефон 812x375.
// Картинки пишутся в tools/shot/<сценарий>-<размер>.png.

import chromium from '@sparticuz/chromium';
import { chromium as pw } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');
const PREVIEW = 'file://' + path.join(REPO, 'wonder-meadow-preview.html');

chromium.setGraphicsMode = false;
const exe = await chromium.executablePath();

// У @sparticuz/chromium в args зашиты --disable-webgl/--single-process/--disable-gpu.
// Убираем их и включаем программный swiftshader, иначе Three.js не создаст WebGL.
const bad = ['--disable-webgl', '--single-process', '--disable-gpu'];
const args = chromium.args.filter(a => !bad.some(b => a === b));
args.push(
  '--no-sandbox',
  '--enable-webgl',
  '--use-angle=swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-unsafe-swiftshader',
  '--disable-dev-shm-usage',
  '--font-render-hinting=none'
);

const VIEWS = [
  { name: 'tablet', w: 1280, h: 800, mobile: false },
  { name: 'phone', w: 812, h: 375, mobile: true },
];

const SHOTS = process.argv.slice(2);
if (SHOTS.length === 0) {
  console.error('Usage: node shoot.mjs <shot> [shot ...]  (имена без #shot-)');
  process.exit(1);
}

const browser = await pw.launch({
  executablePath: exe,
  args,
  headless: true,
  ignoreDefaultArgs: ['--disable-webgl', '--disable-gpu'],
});

const results = [];
for (const shot of SHOTS) {
  for (const v of VIEWS) {
    const ctx = await browser.newContext({
      viewport: { width: v.w, height: v.h },
      deviceScaleFactor: 1,
      isMobile: v.mobile,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    const consoleErrs = [];
    const pageErrs = [];
    const failed = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 180)); });
    page.on('pageerror', e => pageErrs.push(e.message.slice(0, 180)));
    page.on('requestfailed', r => failed.push(r.url().slice(0, 80)));

    await page.goto(`${PREVIEW}#shot-${shot}`, { waitUntil: 'load', timeout: 60000 });
    // swiftshader ~4-10 fps: ждём дольше, никогда не судим по одному кадру.
    await page.waitForTimeout(7000);

    const out = path.join(__dirname, `${shot}-${v.name}.png`);
    await page.screenshot({ path: out });

    const sig = await page.evaluate(() => {
      const get = id => document.getElementById(id);
      const r = {};
      r.canvas = !!document.querySelector('canvas');
      r.ver = get('verTag')?.textContent;
      r.overflowX = document.documentElement.scrollWidth > window.innerWidth;
      // сигналы мини-игры Ёжика (для других сценариев остаются 0 — не ошибка)
      r.mgApples = document.querySelectorAll('#minigame .mg-apple').length;
      r.mgBaskets = document.querySelectorAll('#minigame .mg-basket').length;
      r.mgVisible = (() => { const el = get('minigame'); return el ? getComputedStyle(el).display : null; })();
      return r;
    });

    results.push({ shot: `${shot}-${v.name}`, ...sig, consoleErrs, pageErrs, failedReqs: failed });
    await ctx.close();
  }
}
await browser.close();
console.log(JSON.stringify(results, null, 2));

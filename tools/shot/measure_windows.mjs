// =====================================================================
// MEASURE_WINDOWS — замеры единого стандарта окон всех 16 мини-игр.
// Проверяет на 6 размерах экрана (телефоны и планшеты):
//   - карточка игры целиком помещается в экран (по вертикали и горизонтали);
//   - шапка (cg-title) маленькая: <= max(22px, 5.5vh) высоты;
//   - поле ЗАМЕТНО выше: его высота >= 62% высоты экрана на телефоне;
//   - все интерактивные элементы каждой игры внутри своего поля;
//   - 0 ошибок console/page, нет горизонтального overflow.
// Запуск: cd tools/shot && export LD_LIBRARY_PATH=$PWD/al2023/lib FONTCONFIG_PATH=$PWD/fonts
//         node measure_windows.mjs
// =====================================================================
import chromium from '@sparticuz/chromium';
import { chromium as pw } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');
const PREVIEW = 'file://' + path.join(REPO, 'wonder-meadow-preview.html');

chromium.setGraphicsMode = false;
const exe = await chromium.executablePath();
const bad = ['--disable-webgl', '--single-process', '--disable-gpu'];
const args = chromium.args.filter(a => !bad.some(b => a === b));
args.push('--no-sandbox', '--enable-webgl', '--use-angle=swiftshader', '--ignore-gpu-blocklist',
  '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--font-render-hinting=none',
  '--autoplay-policy=no-user-gesture-required');

const VIEWS = [
  { name: 'phone812', w: 812, h: 375, mobile: true },
  { name: 'phone926', w: 926, h: 428, mobile: true },
  { name: 'tablet',   w: 1280, h: 800, mobile: false },
  { name: 'laptop',   w: 1366, h: 768, mobile: false },
];

// Игра → {поле, элементы внутри поля}
const GAMES = {
  hedge:   { field: '#mgField', inner: ['#mgField .mg-apple', '#mgField .mg-baskets'] },
  owl:     { field: '#countgame .cg-field', inner: ['#countgame .cg-item', '#countgame .cg-answers'] },
  frog:    { field: '#bridgegame .bg-field', inner: ['#bridgegame .bg-item', '#bridgegame button:not(.mg-exit):not(.mg-hint)'] },
  mole:    { field: '#mlField', inner: ['#mlField .ml-hole', '#mlField .ml-mole.up'] },
  mole2:   { field: '#mlField', inner: ['#mlField .ml-hole', '#mlField .ml-mole.up', '#mlField .ml-deco'] },
  sq:      { field: '#sqgame .sq-field', inner: ['#sqgame .sq-field button'] },
  fire:    { field: '#stonegame .st-field', inner: ['#stonegame .st-stone'] },
  beaver:  { field: '#beavergame .bv-field', inner: ['#beavergame .bv-field button', '#beavergame .bv-slot'] },
  heron:   { field: '#herongame .hg-field', inner: ['#herongame .hg-fish', '#herongame .hg-pool', '#herongame .hg-line'] },
  duck:    { field: '#duckgame .dk-panel', inner: ['#duckgame .dk-el'] },
  otter:   { field: '#ottergame .ot-field', inner: ['#ottergame .ot-btn'] },
  moose:   { field: '#moosegame .ms-field', inner: ['#moosegame .ms-cell'] },
  raccoon: { field: '#raccoongame .rc-field', inner: ['#raccoongame .rc-q', '#raccoongame .rc-answers'] },
  magpie:  { field: '#magpiegame .mp-field', inner: ['#magpiegame .mp-card'] },
  mouse:   { field: '#mousegame .mw-field', inner: ['#mousegame .mw-pan', '#mousegame .mw-field button'] },
  badger:  { field: '#badgergame .bd-field', inner: ['#badgergame .bd-piece', '#badgergame .bd-slot'] },
  frog2g:  { field: '#bridgegame .bg-field', inner: ['#bridgegame .bg-item', '#bridgegame button:not(.mg-exit):not(.mg-hint)'] },
};

const results = [];
function report(name, ok, details = '') {
  results.push({ name, ok, details });
  console.log(`${ok ? 'OK ' : 'FAIL'} ${name}${details ? ' — ' + details : ''}`);
}

const browser = await pw.launch({ executablePath: exe, args, headless: true, ignoreDefaultArgs: ['--disable-webgl', '--disable-gpu'] });

async function newPage(w, h, mobile) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 140)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
  return { ctx, page, errs };
}

for (const view of VIEWS) {
  for (const [game, cfg] of Object.entries(GAMES)) {
    const { ctx, page, errs } = await newPage(view.w, view.h, view.mobile);
    const label = `${game}@${view.name}`;
    try {
      await page.goto(PREVIEW + '#shot-' + game, { waitUntil: 'load', timeout: 60000 });
      await page.evaluate(() => {
        setInterval(() => {
          ['splash', 'select', 'startGate'].forEach(id => {
            const el = document.getElementById(id);
            if (el && el.style.display !== 'none') el.style.display = 'none';
          });
        }, 250);
      });
      try {
        await page.waitForSelector(cfg.field, { state: 'visible', timeout: 12000 });
      } catch {}
      await page.waitForTimeout(game === 'mole2' ? 2200 : 3500);
      const m = await page.evaluate(({ game, fieldSel, inner }) => {
        const out = { vh: innerHeight, vw: innerWidth };
        const card = document.querySelector('#minigame .mg-card, #countgame .mg-card, #bridgegame .mg-card, #molegame .mg-card, #sqgame .mg-card, #stonegame .mg-card, #beavergame .mg-card, #herongame .mg-card, #duckgame .mg-card, #ottergame .mg-card, #moosegame .mg-card, #raccoongame .mg-card, #magpiegame .mg-card, #mousegame .mg-card, #badgergame .mg-card');
        if (card) {
          const r = card.getBoundingClientRect();
          out.card = { t: r.top, b: r.bottom, w: r.width };
        }
        const title = [...document.querySelectorAll('.cg-title')].find(el => {
          const g = el.closest('[id$="game"], #minigame');
          return g && getComputedStyle(g).display !== 'none';
        });
        if (title) out.titleH = title.getBoundingClientRect().height;
        const fields = [...document.querySelectorAll(fieldSel)].filter(el => {
          const s = getComputedStyle(el);
          return s.display !== 'none' && el.getBoundingClientRect().width > 10;
        });
        out.fieldCount = fields.length;
        if (fields.length) {
          const rs = fields.map(f => f.getBoundingClientRect());
          out.field = {
            t: Math.min(...rs.map(r => r.top)), b: Math.max(...rs.map(r => r.bottom)),
            l: Math.min(...rs.map(r => r.left)), r: Math.max(...rs.map(r => r.right)),
          };
          const oob = [];
          inner.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
              const s = getComputedStyle(el);
              if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return;
              const r = el.getBoundingClientRect();
              if (r.width < 2) return;
              const f = fields.find(fr => {
                const fbb = fr.getBoundingClientRect();
                return r.left >= fbb.left - 3 && r.right <= fbb.right + 3 && r.top >= fbb.top - 3 && r.bottom <= fbb.bottom + 3;
              });
              if (!f) oob.push(`${sel} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
            });
          });
          out.oob = oob.slice(0, 4);
        }
        return out;
      }, { game, fieldSel: cfg.field, inner: cfg.inner });

      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      let fails = [];
      if (errs.length) fails.push(`errs=${errs.length} ${errs[0]}`);
      if (overflowX) fails.push('overflowX');
      if (!m.card) fails.push('нет карточки');
      else {
        if (m.card.t < -2) fails.push(`карточка сверху за экраном (t=${Math.round(m.card.t)})`);
        if (m.card.b > view.h + 2) fails.push(`карточка снизу за экраном (b=${Math.round(m.card.b)})`);
      }
      if (m.titleH != null && m.titleH > Math.max(22, view.h * 0.055)) fails.push(`шапка высокая ${Math.round(m.titleH)}px`);
      if (m.field) {
        const fh = m.field.b - m.field.t;
        const ratio = fh / view.h;
        const minRatio = view.h <= 480 ? 0.62 : 0.60;
        if (ratio < minRatio) fails.push(`поле низкое ${Math.round(fh)}px (${Math.round(ratio * 100)}% от экрана)`);
        if (m.field.b > view.h + 2) fails.push('поле ниже экрана');
        if (m.oob && m.oob.length) fails.push('элементы вне поля: ' + m.oob.join(' | '));
      } else fails.push('поле не найдено');
      report(label, fails.length === 0, fails.length ? fails.join('; ') : `поле ${Math.round((m.field.b - m.field.t) * 100 / view.h)}% в.э., шапка ${Math.round(m.titleH || 0)}px`);
    } catch (e) {
      report(label, false, 'исключение: ' + String(e).slice(0, 120));
    }
    await ctx.close();
  }
}

const badCount = results.filter(r => !r.ok).length;
console.log(`\n=== ИТОГО: ${results.length - badCount}/${results.length} замеров чисты ===`);
process.exit(badCount ? 1 : 0);

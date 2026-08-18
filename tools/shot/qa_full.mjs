// =====================================================================
// QA_FULL — полный автоматический прогон игры как «пользователя».
// Входит в tools/shot и используется перед каждым релизом.
//
// Что проверяет:
//   1. screens  — обход всех #shot-хуков: 0 console/page-ошибок, нет overflow;
//   2. games    — ПРОХОЖДЕНИЕ всех мини-игр до победы (Zero Fail, награды);
//   3. routes   — маршруты игрока через порталы Л1→Л2→Л3 и обратно (DBG-позиции);
//   4. chaos    — «хаотичный пользователь»: случайные тапы по миру и мини-игре;
//   5. slow     — эмуляция медленного устройства (CPU throttle 6x);
//   6. ui       — пауза, выход с подтверждением, родительский уголок, сброс, альбом.
//
// ВАЖНО: почти все игровые кнопки слушают pointerdown — кликать ТОЛЬКО мышью
// по координатам (page.mouse.click), а не element.click() внутри evaluate.
//
// Запуск (после npm run build && python3 tools/build_preview.py):
//   cd tools/shot
//   export LD_LIBRARY_PATH="$PWD/al2023/lib:$LD_LIBRARY_PATH" FONTCONFIG_PATH="$PWD/fonts"
//   node qa_full.mjs games ui        # быстрый прогон
//   node qa_full.mjs                 # полный прогон (включая routes/chaos/slow)
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

const PARTS = process.argv.slice(2);
const ALL = PARTS.length === 0;
const want = (name) => ALL || PARTS.includes(name);

const results = [];
function report(category, name, ok, details = '') {
  results.push({ category, name, ok, details });
  console.log(`${ok ? 'OK ' : 'FAIL'} [${category}] ${name}${details ? ' — ' + details : ''}`);
}

const browser = await pw.launch({ executablePath: exe, args, headless: true, ignoreDefaultArgs: ['--disable-webgl', '--disable-gpu'] });

async function newPage(w, h, throttle = 0) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 1000, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 140)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
  if (throttle > 0) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  }
  return { ctx, page, errs };
}
async function openShot(page, shot, waitMs = 6500) {
  await page.goto(PREVIEW + '#shot-' + shot, { waitUntil: 'load', timeout: 60000 });
  // Хук #shot прячет заставку/выбор героя только первые 8 с; на свежем профиле они
  // возвращаются и перекрывают клики долгих прохождений. Держим их скрытыми весь тест.
  await page.evaluate(() => {
    setInterval(() => {
      ['splash', 'select', 'startGate'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.style.display !== 'none') el.style.display = 'none';
      });
    }, 250);
  });
  await page.waitForTimeout(waitMs);
}
// центр элемента по селектору (для честного mouse-клика)
async function centerOf(page, selector, idx = 0) {
  const bb = await page.locator(selector).nth(idx).boundingBox();
  return bb ? { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 } : null;
}
// клик по элементу, найденному функцией внутри страницы (возвращает coords)
async function clickFn(page, fn) {
  const c = await page.evaluate(fn);
  if (!c) return false;
  await page.mouse.click(c.x, c.y);
  return true;
}
async function waitWin(page, gameId, winsKey, maxSec = 120) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxSec * 1000) {
    const st = await page.evaluate(({ id, k }) => ({
      gone: getComputedStyle(document.getElementById(id)).display === 'none',
      win: localStorage.getItem(k) === '1',
    }), { id: gameId, k: winsKey });
    if (st.gone && st.win) return true;
    await page.waitForTimeout(800);
  }
  return false;
}

// ============ 1. SCREENS: обход всех хуков ============
if (want('screens')) {
  const shots = ['world', 'hedge', 'owl', 'frog', 'mole', 'mole2', 'sq', 'fire', 'beaver',
    'heron', 'duck', 'otter', 'moose', 'raccoon', 'magpie', 'mouse', 'badger',
    'l2', 'l3', 'l3night', 'pause', 'gate', 'parent', 'break', 'choir', 'portal'];
  let badCount = 0;
  for (const shot of shots) {
    for (const [name, w, h] of [['tablet', 1280, 800], ['phone', 812, 375]]) {
      const { ctx, page, errs } = await newPage(w, h);
      await openShot(page, shot);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      const ok = errs.length === 0 && !ov;
      if (!ok) badCount++;
      report('screens', `${shot}-${name}`, ok, ok ? '' : `errs=${errs.length} ov=${ov} ${errs[0] || ''}`);
      await ctx.close();
    }
  }
  report('screens', 'ИТОГО', badCount === 0, badCount === 0 ? 'все экраны чисты' : `проблемных: ${badCount}`);
}

// ============ 2. GAMES: прохождение всех мини-игр ============
if (want('games')) {
  // Ёжик: перетаскивание плодов в корзины своего цвета, 3 раунда
  {
    const { ctx, page, errs } = await newPage(1280, 800);
    await openShot(page, 'hedge');
    await page.waitForFunction(() => document.querySelectorAll('#mgField .mg-apple').length >= 6, null, { timeout: 30000 });
    for (let i = 0; i < 80; i++) {
      const task = await page.evaluate(() => {
        const a = [...document.querySelectorAll('#mgField .mg-apple')].find(x => x.style.opacity !== '0.5' && !x.classList.contains('dragging'));
        if (!a) return null;
        const ar = a.getBoundingClientRect();
        const b = a.dataset.color === 'red' ? document.getElementById('basketRed') : document.getElementById('basketGreen');
        const br = b.getBoundingClientRect();
        return { ax: ar.left + ar.width / 2, ay: ar.top + ar.height / 2, bx: br.left + br.width / 2, by: br.top + br.height / 2 };
      });
      if (!task) { await page.waitForTimeout(800); continue; }
      await page.mouse.move(task.ax, task.ay);
      await page.mouse.down();
      await page.mouse.move(task.bx, task.by, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      if (await page.evaluate(() => localStorage.getItem('wm_wins_hedge') === '1')) break;
    }
    const win = await waitWin(page, 'minigame', 'wm_wins_hedge', 20);
    report('games', 'hedge (перетаскивание, 3 раунда)', win && errs.length === 0, win ? '' : 'не достигнута победа');
    await ctx.close();
  }
  // Сова: счёт предметов → правильная цифра
  {
    const { ctx, page, errs } = await newPage(1280, 800);
    await openShot(page, 'owl');
    await page.waitForFunction(() => document.querySelectorAll('#cgItems .cg-item').length >= 3, null, { timeout: 30000 });
    for (let i = 0; i < 12; i++) {
      const n = await page.evaluate(() => document.querySelectorAll('#cgItems .cg-item').length);
      const ok = await clickFn(page, () => {
        const b = [...document.querySelectorAll('#cgAnswers .cg-answer')].find(x => x.textContent === String(document.querySelectorAll('#cgItems .cg-item').length));
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      if (!ok) break;
      await page.waitForTimeout(1200);
      if (await page.evaluate(() => localStorage.getItem('wm_wins_owl') === '1')) break;
    }
    const win = await waitWin(page, 'countgame', 'wm_wins_owl', 20);
    report('games', 'owl (счёт до 5)', win && errs.length === 0, win ? '' : 'не достигнута победа');
    await ctx.close();
  }
  // Лягушка: узор — перебор ответов ПО КРУГУ до верного
  {
    const { ctx, page, errs } = await newPage(1280, 800);
    await openShot(page, 'frog');
    await page.waitForFunction(() => document.querySelectorAll('#bgAnswers .bg-answer').length >= 2, null, { timeout: 30000 });
    const N = await page.evaluate(() => document.querySelectorAll('#bgAnswers .bg-answer').length);
    for (let i = 0; i < 24; i++) {
      const c = await centerOf(page, '#bgAnswers .bg-answer', i % N);
      if (c) await page.mouse.click(c.x, c.y);
      await page.waitForTimeout(1200);
      if (await page.evaluate(() => localStorage.getItem('wm_wins_frog') === '1')) break;
    }
    const win = await waitWin(page, 'bridgegame', 'wm_wins_frog', 20);
    report('games', 'frog (узоры-мостик)', win && errs.length === 0, win ? '' : 'не достигнута победа');
    await ctx.close();
  }
  // Крот этап 1: ловим морковки (время в песочнице в 6–15 раз медленнее — терпеливо ждём)
  {
    const { ctx, page, errs } = await newPage(1280, 800);
    await openShot(page, 'mole');
    await page.waitForFunction(() => document.querySelectorAll('#mlField .ml-mole').length >= 5, null, { timeout: 30000 });
    for (let i = 0; i < 60; i++) {
      const ok = await clickFn(page, () => {
        const m = [...document.querySelectorAll('#mlField .ml-mole.up')].find(b => {
          const c = b.querySelector('.ml-carrot');
          return c && getComputedStyle(c).display !== 'none';
        });
        if (!m) return null;
        const r = m.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      if (!ok) { await page.waitForTimeout(2500); continue; }
      await page.waitForTimeout(500);
      if (await page.evaluate(() => localStorage.getItem('wm_wins_mole') === '1')) break;
    }
    const win = await waitWin(page, 'molegame', 'wm_wins_mole', 90);
    report('games', 'mole этап 1 (6 морковок)', win && errs.length === 0, win ? '' : 'не достигнута победа');
    await ctx.close();
  }
  // Белка: прячем орех — перебор грибочков ПО КРУГУ
  {
    const { ctx, page, errs } = await newPage(1280, 800);
    await openShot(page, 'sq');
    await page.waitForFunction(() => document.querySelectorAll('#sqField .sq-shroom').length >= 3, null, { timeout: 30000 });
    const N = await page.evaluate(() => document.querySelectorAll('#sqField .sq-shroom').length);
    for (let i = 0; i < 20; i++) {
      const c = await centerOf(page, '#sqField .sq-shroom', i % N);
      if (c) await page.mouse.click(c.x, c.y);
      await page.waitForTimeout(1400);
      if (await page.evaluate(() => localStorage.getItem('wm_wins_sq') === '1')) break;
    }
    const win = await waitWin(page, 'sqgame', 'wm_wins_sq', 20);
    report('games', 'sq (прятки-норки)', win && errs.length === 0, win ? '' : 'не достигнута победа');
    await ctx.close();
  }
  // Светлячок: записываем подсветку камешков, повторяем мелодию
  {
    const { ctx, page, errs } = await newPage(1280, 800);
    await openShot(page, 'fire');
    await page.waitForFunction(() => document.querySelectorAll('#stField .st-stone').length >= 5, null, { timeout: 30000 });
    for (let round = 0; round < 3; round++) {
      let seq = [];
      let prev = -1;
      for (let t = 0; t < 200; t++) {
        const cur = await page.evaluate(() => {
          const s = [...document.querySelectorAll('#stField .st-stone')].findIndex(x => x.classList.contains('lit'));
          const msg = document.getElementById('stMsg').textContent;
          return { s, tap: msg.includes('Твоя очередь') || msg.includes('твоя очередь') };
        });
        if (cur.s >= 0 && cur.s !== prev) { seq.push(cur.s); prev = cur.s; }
        if (cur.tap && seq.length > 0) break;
        await page.waitForTimeout(120);
      }
      if (seq.length === 0) break;
      for (const s of seq) {
        const c = await centerOf(page, '#stField .st-stone', s);
        if (c) await page.mouse.click(c.x, c.y);
        await page.waitForTimeout(220);
      }
      await page.waitForTimeout(900);
      if (await page.evaluate(() => getComputedStyle(document.getElementById('stonegame')).display === 'none')) break;
    }
    const win = await waitWin(page, 'stonegame', 'wm_wins_fire', 20);
    report('games', 'fire (звонкие камни)', win && errs.length === 0, win ? '' : 'не достигнута победа (или не записана мелодия)');
    await ctx.close();
  }
  // Бобр: дощечки — перебор форм ПО КРУГУ
  {
    const { ctx, page, errs } = await newPage(1280, 800);
    await openShot(page, 'beaver');
    await page.waitForFunction(() => document.querySelectorAll('#bvAnswers .bv-answer').length >= 2, null, { timeout: 30000 });
    const N = await page.evaluate(() => document.querySelectorAll('#bvAnswers .bv-answer').length);
    for (let i = 0; i < 24; i++) {
      const c = await centerOf(page, '#bvAnswers .bv-answer', i % N);
      if (c) await page.mouse.click(c.x, c.y);
      await page.waitForTimeout(1200);
      if (await page.evaluate(() => localStorage.getItem('wm_wins_beaver') === '1')) break;
    }
    const win = await waitWin(page, 'beavergame', 'wm_wins_beaver', 20);
    report('games', 'beaver (дощечки)', win && errs.length === 0, win ? '' : 'не достигнута победа');
    await ctx.close();
  }
  // Цапля: рыбки по росту (от меньшей к большей; между раундами — пауза)
  {
    const { ctx, page, errs } = await newPage(1280, 800);
    await openShot(page, 'heron');
    await page.waitForFunction(() => document.querySelectorAll('#hgPool .hg-fish').length >= 3, null, { timeout: 30000 });
    for (let i = 0; i < 20; i++) {
      const ok = await clickFn(page, () => {
        const fish = [...document.querySelectorAll('#hgPool .hg-fish:not(.done)')];
        if (!fish.length) return null;
        const sz = (f) => parseInt((f.className.match(/s(\d)/) || [])[1], 10);
        const min = fish.reduce((a, b) => sz(a) < sz(b) ? a : b);
        const r = min.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      if (!ok) { await page.waitForTimeout(1800); continue; }
      await page.waitForTimeout(350);
      if (await page.evaluate(() => localStorage.getItem('wm_wins_heron') === '1')) break;
    }
    const win = await waitWin(page, 'herongame', 'wm_wins_heron', 30);
    report('games', 'heron (рыбки по росту)', win && errs.length === 0, win ? '' : 'не достигнута победа');
    await ctx.close();
  }
  // Утка: отличия — клики по координатам, пропуская уже найденные (по меткам)
  {
    const { ctx, page, errs } = await newPage(1280, 800);
    await openShot(page, 'duck');
    await page.waitForFunction(() => document.querySelectorAll('#dkRight .dk-el').length > 0, null, { timeout: 30000 });
    for (let i = 0; i < 8; i++) {
      const spot = await page.evaluate(() => {
        // ключ с учётом ФОНА: отличие может быть «тот же кружок, другой цвет»
        const key = e => e.style.left + '|' + e.style.top + '|' + e.textContent + '|' + e.style.background;
        const L = [...document.querySelectorAll('#dkLeft .dk-el')].map(key);
        const R = [...document.querySelectorAll('#dkRight .dk-el')].map(key);
        const marks = [...document.querySelectorAll('#dkRight .dk-mark')].map(m => m.style.left + '|' + m.style.top);
        const diff = L.find(s => {
          if (R.includes(s)) return false;
          const [x, y] = s.split('|');
          return !marks.includes(x + '|' + y);
        });
        if (!diff) return null;
        const [x, y] = diff.split('|').map(parseFloat);
        const rect = document.getElementById('dkRight').getBoundingClientRect();
        return { x: rect.left + rect.width * x / 100, y: rect.top + rect.height * y / 100 };
      });
      if (!spot) break;
      await page.mouse.click(spot.x, spot.y);
      await page.waitForTimeout(700);
      if (await page.evaluate(() => localStorage.getItem('wm_wins_duck') === '1')) break;
    }
    const win = await waitWin(page, 'duckgame', 'wm_wins_duck', 20);
    report('games', 'duck (найди отличия)', win && errs.length === 0, win ? '' : 'не достигнута победа');
    await ctx.close();
  }
  // Выдра: следы — перебор ПО КРУГУ
  {
    const { ctx, page, errs } = await newPage(1280, 800);
    await openShot(page, 'otter');
    await page.waitForFunction(() => document.querySelectorAll('#otAnswers .ot-btn').length >= 3, null, { timeout: 30000 });
    const N = await page.evaluate(() => document.querySelectorAll('#otAnswers .ot-btn').length);
    for (let i = 0; i < 24; i++) {
      const c = await centerOf(page, '#otAnswers .ot-btn', i % N);
      if (c) await page.mouse.click(c.x, c.y);
      await page.waitForTimeout(1000);
      if (await page.evaluate(() => localStorage.getItem('wm_wins_otter') === '1')) break;
    }
    const win = await waitWin(page, 'ottergame', 'wm_wins_otter', 20);
    report('games', 'otter (чьи следы)', win && errs.length === 0, win ? '' : 'не достигнута победа');
    await ctx.close();
  }
  // Лось: тропинка по data-seq
  {
    const { ctx, page, errs } = await newPage(1280, 800);
    await openShot(page, 'moose');
    await page.waitForFunction(() => document.querySelectorAll('#msGrid .ms-cell').length === 15, null, { timeout: 30000 });
    for (let i = 0; i < 18; i++) {
      const ok = await clickFn(page, () => {
        const m = document.querySelector('#msGrid .ms-marker');
        if (!m) return null;
        const cur = +m.parentElement.dataset.seq;
        const el = document.querySelector(`#msGrid .ms-cell[data-seq="${cur + 1}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      if (!ok) { await page.waitForTimeout(1000); continue; }
      await page.waitForTimeout(250);
      if (await page.evaluate(() => localStorage.getItem('wm_wins_moose') === '1')) break;
      await page.waitForTimeout(1100);
    }
    const win = await waitWin(page, 'moosegame', 'wm_wins_moose', 20);
    report('games', 'moose (лесная тропинка)', win && errs.length === 0, win ? '' : 'не достигнута победа');
    await ctx.close();
  }
  // Енот: тени — перебор ПО КРУГУ
  {
    const { ctx, page, errs } = await newPage(1280, 800);
    await openShot(page, 'raccoon');
    await page.waitForFunction(() => document.querySelectorAll('#rcAnswers .rc-shade').length === 3, null, { timeout: 30000 });
    const N = await page.evaluate(() => document.querySelectorAll('#rcAnswers .rc-shade').length);
    for (let i = 0; i < 24; i++) {
      const c = await centerOf(page, '#rcAnswers .rc-shade', i % N);
      if (c) await page.mouse.click(c.x, c.y);
      await page.waitForTimeout(1000);
      if (await page.evaluate(() => localStorage.getItem('wm_wins_raccoon') === '1')) break;
    }
    const win = await waitWin(page, 'raccoongame', 'wm_wins_raccoon', 20);
    report('games', 'raccoon (чья тень)', win && errs.length === 0, win ? '' : 'не достигнута победа');
    await ctx.close();
  }
  // Сорока: лишний предмет
  {
    const { ctx, page, errs } = await newPage(1280, 800);
    await openShot(page, 'magpie');
    await page.waitForFunction(() => document.querySelectorAll('#mpCards .mp-card').length === 4, null, { timeout: 30000 });
    for (let i = 0; i < 6; i++) {
      const ok = await clickFn(page, () => {
        const b = document.querySelector('#mpCards .mp-card[data-odd="1"]');
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      if (!ok) break;
      await page.waitForTimeout(1200);
      if (await page.evaluate(() => localStorage.getItem('wm_wins_magpie') === '1')) break;
    }
    const win = await waitWin(page, 'magpiegame', 'wm_wins_magpie', 20);
    report('games', 'magpie (что лишнее)', win && errs.length === 0, win ? '' : 'не достигнута победа');
    await ctx.close();
  }
  // Мышка: тяжёлый предмет
  {
    const { ctx, page, errs } = await newPage(1280, 800);
    await openShot(page, 'mouse');
    await page.waitForFunction(() => document.querySelectorAll('#mwBoard [data-heavy]').length >= 2, null, { timeout: 30000 });
    for (let i = 0; i < 6; i++) {
      const ok = await clickFn(page, () => {
        const b = document.querySelector('#mwBoard [data-heavy="1"]');
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      if (!ok) break;
      await page.waitForTimeout(1200);
      if (await page.evaluate(() => localStorage.getItem('wm_wins_mouse') === '1')) break;
    }
    const win = await waitWin(page, 'mousegame', 'wm_wins_mouse', 20);
    report('games', 'mouse (весёлые весы)', win && errs.length === 0, win ? '' : 'не достигнута победа');
    await ctx.close();
  }
  // Барсук: пазл (4 кусочка → 6 кусочков)
  {
    const { ctx, page, errs } = await newPage(1280, 800);
    await openShot(page, 'badger');
    await page.waitForFunction(() => document.querySelectorAll('#bdTray .bd-piece').length === 4, null, { timeout: 30000 });
    for (let i = 0; i < 40; i++) {
      const task = await page.evaluate(() => {
        const p = document.querySelector('#bdTray .bd-piece:not(.gone)');
        if (!p) return null;
        const idx = p.dataset.idx;
        const s = document.querySelector(`#bdBoard .bd-slot[data-idx="${idx}"]`);
        const pr = p.getBoundingClientRect();
        const sr = s.getBoundingClientRect();
        return { px: pr.left + pr.width / 2, py: pr.top + pr.height / 2, sx: sr.left + sr.width / 2, sy: sr.top + sr.height / 2 };
      });
      if (!task) break;
      await page.mouse.click(task.px, task.py);
      await page.waitForTimeout(150);
      await page.mouse.click(task.sx, task.sy);
      await page.waitForTimeout(300);
      if (await page.evaluate(() => localStorage.getItem('wm_wins_badger') === '1')) break;
      await page.waitForTimeout(1100);
    }
    const win = await waitWin(page, 'badgergame', 'wm_wins_badger', 20);
    report('games', 'badger (пазл 4→6)', win && errs.length === 0, win ? '' : 'не достигнута победа');
    await ctx.close();
  }
  // Крот этап 2: геометрия большого поля
  {
    const { ctx, page, errs } = await newPage(1280, 800);
    await openShot(page, 'mole2');
    await page.waitForFunction(() => document.querySelectorAll('#mlField.big .ml-hole').length === 6, null, { timeout: 30000 });
    await page.waitForTimeout(2000);
    const geo = await page.evaluate(() => {
      const f = document.getElementById('mlField').getBoundingClientRect();
      const mounds = [...document.querySelectorAll('#mlField .ml-mound')].map(m => m.getBoundingClientRect());
      return { holes: document.querySelectorAll('#mlField .ml-hole').length, inField: mounds.every(m => m.left >= f.left - 1 && m.right <= f.right + 1 && m.top >= f.top - 1 && m.bottom <= f.bottom + 1) };
    });
    report('games', 'mole этап 2 (норы сверху)', geo.holes === 6 && geo.inField && errs.length === 0, JSON.stringify(geo));
    await ctx.close();
  }
}

// ============ 3. ROUTES: порталы Л1→Л2→Л3 ============
if (want('routes')) {
  const routes = [['walk', 1], ['walk2', 0], ['walk4', 2], ['walk5', 1]];
  for (const [hook, dest] of routes) {
    const { ctx, page, errs } = await newPage(1280, 800);
    const logs = [];
    page.on('console', m => { if (m.text().startsWith('DBG')) logs.push(m.text()); });
    await openShot(page, hook, 3000);
    const t0 = Date.now();
    let arrived = false;
    while (Date.now() - t0 < 240000) {
      if (logs.some(l => l.includes(`cl=${dest}`))) { arrived = true; break; }
      await page.waitForTimeout(3000);
    }
    report('routes', `${hook} → cl=${dest}`, arrived && errs.length === 0, logs.slice(-2).join(' | ') || 'нет DBG-логов');
    await ctx.close();
  }
}

// ============ 4. CHAOS: хаотичный пользователь ============
if (want('chaos')) {
  {
    const { ctx, page, errs } = await newPage(1280, 800);
    await openShot(page, 'world');
    for (let i = 0; i < 60; i++) {
      const x = Math.floor(Math.random() * 1280);
      const y = Math.floor(Math.random() * 800);
      await page.mouse.click(x, y);
      await page.waitForTimeout(650);
    }
    let pauseOk = false;
    try {
      await page.click('#pauseBtn', { force: true });
      await page.waitForTimeout(500);
      pauseOk = await page.evaluate(() => getComputedStyle(document.getElementById('pauseOv')).display === 'flex');
      await page.click('#pauseResume', { force: true });
    } catch (e) {}
    report('chaos', 'мир: 60 случайных тапов', errs.length === 0 && pauseOk, `errs=${errs.length} pause=${pauseOk}`);
    await ctx.close();
  }
  {
    const { ctx, page, errs } = await newPage(1280, 800);
    await openShot(page, 'hedge');
    await page.waitForFunction(() => document.querySelectorAll('#mgField .mg-apple').length >= 6, null, { timeout: 30000 });
    for (let i = 0; i < 35; i++) {
      const x = Math.floor(Math.random() * 1280);
      const y = Math.floor(Math.random() * 800);
      await page.mouse.click(x, y);
      await page.waitForTimeout(650);
    }
    let exitOk = false;
    try {
      await page.click('.mg-exit', { force: true });
      await page.waitForTimeout(700);
      exitOk = await page.evaluate(() => getComputedStyle(document.getElementById('minigame')).display === 'none'
        && getComputedStyle(document.getElementById('pauseOv')).display === 'none');
    } catch (e) {}
    report('chaos', 'hedge: 35 случайных тапов + ✕', errs.length === 0 && exitOk, `errs=${errs.length} exit=${exitOk}`);
    await ctx.close();
  }
}

// ============ 5. SLOW: медленное устройство (CPU 6x) ============
if (want('slow')) {
  {
    const { ctx, page, errs } = await newPage(1280, 800, 6);
    await openShot(page, 'world', 9000);
    const canvasAlive = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return !!c && c.width > 0;
    });
    let pauseOk = false;
    try {
      await page.click('#pauseBtn', { force: true });
      await page.waitForTimeout(800);
      pauseOk = await page.evaluate(() => getComputedStyle(document.getElementById('pauseOv')).display === 'flex');
    } catch (e) {}
    report('slow', 'world при CPU 6x', errs.length === 0 && canvasAlive && pauseOk, `errs=${errs.length} canvas=${canvasAlive} pause=${pauseOk}`);
    await ctx.close();
  }
  {
    const { ctx, page, errs } = await newPage(1280, 800, 4);
    await openShot(page, 'badger', 9000);
    await page.waitForFunction(() => document.querySelectorAll('#bdTray .bd-piece').length === 4, null, { timeout: 40000 });
    const task = await page.evaluate(() => {
      const p = document.querySelector('#bdTray .bd-piece');
      const idx = p.dataset.idx;
      const s = document.querySelector(`#bdBoard .bd-slot[data-idx="${idx}"]`);
      const pr = p.getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      return { px: pr.left + pr.width / 2, py: pr.top + pr.height / 2, sx: sr.left + sr.width / 2, sy: sr.top + sr.height / 2 };
    });
    await page.mouse.click(task.px, task.py);
    await page.waitForTimeout(300);
    await page.mouse.click(task.sx, task.sy);
    await page.waitForTimeout(1200);
    const placed = await page.evaluate(() => !!document.querySelector('#bdBoard .bd-slot.filled'));
    report('slow', 'пазл при CPU 4x', errs.length === 0 && placed, `errs=${errs.length} placed=${placed}`);
    await ctx.close();
  }
}

// ============ 6. UI: пауза/выход/уголок/сброс/альбом ============
if (want('ui')) {
  {
    const { ctx, page, errs } = await newPage(1280, 800);
    await openShot(page, 'world');
    // детерминированно открываем паузу сами
    await page.click('#pauseBtn', { force: true });
    await page.waitForTimeout(600);
    const p = await page.evaluate(() => getComputedStyle(document.getElementById('pauseOv')).display);
    await page.click('#pauseExit', { force: true });
    await page.waitForTimeout(400);
    const e1 = await page.evaluate(() => getComputedStyle(document.getElementById('exitOv')).display);
    await page.click('#exitNo', { force: true });
    await page.waitForTimeout(300);
    const e2 = await page.evaluate(() => getComputedStyle(document.getElementById('exitOv')).display);
    await page.click('#pauseExit', { force: true });
    await page.waitForTimeout(300);
    await page.click('#exitYes', { force: true });
    await page.waitForTimeout(400);
    const yesText = await page.evaluate(() => document.getElementById('exitYes').textContent);
    report('ui', 'пауза → выход → подтверждение', p === 'flex' && e1 === 'flex' && e2 === 'none' && yesText.includes('Можно закрыть') && errs.length === 0,
      `pause=${p} exit=${e1}/${e2} yesText=${yesText}`);
    await ctx.close();
  }
  {
    const { ctx, page, errs } = await newPage(1280, 800);
    await openShot(page, 'parent');
    await page.waitForSelector('#parentReset', { timeout: 30000 });
    await page.waitForTimeout(800);
    const stats = await page.evaluate(() => document.getElementById('parentStats').textContent);
    const residents = ['Лось', 'Енот', 'Сорока', 'Мышка', 'Барсук'].map(n => stats.includes(n));
    await page.locator('#parentReset').scrollIntoViewIfNeeded();
    const bb = await page.locator('#parentReset').boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1600);
    const mid = await page.evaluate(() => document.getElementById('resetBar').style.width);
    await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({ w: document.getElementById('resetBar').style.width, ov: getComputedStyle(document.getElementById('resetOv')).display }));
    report('ui', 'родительский уголок (статистика + сброс-удержание)', residents.every(Boolean) && mid === '100%' && after.w === '0px' && after.ov === 'none' && errs.length === 0,
      `rows=${residents.every(Boolean)} mid=${mid} after=${after.w}/${after.ov}`);
    await ctx.close();
  }
  {
    const { ctx, page, errs } = await newPage(1280, 800);
    await openShot(page, 'album');
    // альбом открывается не мгновенно — ждём явного показа
    await page.waitForFunction(() => getComputedStyle(document.getElementById('album')).display === 'block', null, { timeout: 20000 }).catch(() => {});
    const a = await page.evaluate(() => {
      const ov = document.getElementById('album');
      return ov ? getComputedStyle(ov).display : 'нет';
    });
    let closed = true;
    try {
      await page.click('#albumClose', { force: true });
      await page.waitForTimeout(400);
      closed = await page.evaluate(() => getComputedStyle(document.getElementById('album')).display === 'none');
    } catch (e) { closed = false; }
    report('ui', 'альбом открывается и закрывается', a === 'block' && closed && errs.length === 0, `album=${a} closed=${closed}`);
    await ctx.close();
  }
}

await browser.close();
const fails = results.filter(r => !r.ok).length;
console.log('\n===== QA ИТОГ: ' + results.length + ' проверок, проблем: ' + fails + ' =====');
if (fails > 0) results.filter(r => !r.ok).forEach(r => console.log('FAIL: [' + r.category + '] ' + r.name + ' — ' + r.details));
process.exit(fails > 0 ? 1 : 0);

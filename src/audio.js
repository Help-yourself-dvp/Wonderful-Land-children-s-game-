// Аудиосистема «Волшебной полянки»: всё синтезируется Web Audio API,
// без аудиофайлов, лицензий и сети. Голос NPC (позже) — отдельные файлы.

let ctx = null;
let master = null;
let windGain = null;
let nightLevel = 0;
let muted = localStorage.getItem('wm_muted') === '1';
let gamePaused = false; // v0.27.1: альбом/пауза глушат ВСЕ звуки мира (но не звуки самого альбома)

function ensureCtx() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    startWind();
    startAmbientScheduler();
    return true;
  } catch (e) { return false; }
}

// Вызывать из обработчика жеста пользователя (pointerdown)
export function initAudio() {
  if (!ensureCtx()) return;
  // v0.26.3: Android WebView уводит контекст в 'interrupted' (не только 'suspended') —
  // без resume() эффекты/синтез молчат до перезапуска.
  // v0.27.1 (живой тест): НЕ будить звук, пока игра на паузе/в альбоме — раньше каждый
  // тап по альбому «просыпал» ветер и окружение.
  if ((ctx.state === 'suspended' || ctx.state === 'interrupted') && !gamePaused) ctx.resume();
}

export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  localStorage.setItem('wm_muted', muted ? '1' : '0');
  if (master) master.gain.value = muted ? 0 : 0.5;
  // голосовые mp3 играют через HTMLAudio — им нужен СВОЙ выключатель (не master gain)!
  Object.values(voiceCache).forEach(a => { a.muted = muted; });
  if (muted) stopVoice(); // и текущую реплику тоже гасим сразу
  return muted;
}
export function setNight(n) { nightLevel = n; }

// ---- примитивы синтеза ----
function tone(freq, dur, { type = 'sine', vol = 0.25, slideTo = null, delay = 0 } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

let noiseBuf = null;
function noise(dur, { vol = 0.2, from = 800, to = 300, delay = 0 } = {}) {
  if (!ctx) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0); src.stop(t0 + dur + 0.05);
}

// Ветер: постоянный тихий фон
function startWind() {
  const src = ctx.createBufferSource();
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 320;
  windGain = ctx.createGain();
  windGain.gain.value = 0.016;
  src.connect(f).connect(windGain).connect(master);
  src.start();
}

// Днём — птичьи трели, ночью — сверчки
function startAmbientScheduler() {
  setInterval(() => {
    if (!ctx || muted || ctx.state !== 'running') return;
    if (Math.random() < 0.55) {
      if (nightLevel < 0.5) {
        // трель: 3-4 быстрых нотки вниз-вверх
        const base = 2200 + Math.random() * 1400;
        const n = 3 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) {
          tone(base * (1 + Math.random() * 0.2), 0.07, { vol: 0.05, slideTo: base * 0.8, delay: i * 0.09 });
        }
      } else {
        // сверчок: серия коротких писков
        for (let i = 0; i < 5; i++) tone(4200, 0.03, { vol: 0.02, delay: i * 0.06 });
      }
    }
  }, 3500);
}

// ---- именованные эффекты ----
const SFX = {
  tap:      () => tone(700, 0.09, { vol: 0.18, slideTo: 950, type: 'sine' }),
  pop:      () => { tone(440, 0.08, { vol: 0.2 }); tone(660, 0.1, { vol: 0.2, delay: 0.07 }); },
  pickup:   () => tone(500, 0.07, { vol: 0.2, slideTo: 760, type: 'triangle' }),
  good:     () => { tone(660, 0.09, { vol: 0.22 }); tone(880, 0.12, { vol: 0.22, delay: 0.08 }); },
  bad:      () => tone(300, 0.25, { vol: 0.16, slideTo: 170, type: 'triangle' }), // мягкий «плинг», без страха
  fanfare:  () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.14, { vol: 0.22, delay: i * 0.1 })),
  drop:     () => { tone(880, 0.1, { vol: 0.2, slideTo: 1320 }); noise(0.15, { vol: 0.05, from: 3000, to: 1500, delay: 0.05 }); },
  tickle:   () => { for (let i = 0; i < 6; i++) tone(900 + (i % 2) * 200, 0.06, { vol: 0.14, delay: i * 0.07, type: 'square' }); },
  whoosh:   () => noise(0.5, { vol: 0.1, from: 500, to: 120 }),
  hintGlow: () => tone(1180, 0.12, { vol: 0.08, type: 'sine' }),
  // v0.25.2: мягкий «топ-топ» шагов героя — лёгкий синтез без файлов
  step: () => {
    // v0.27.0 (живой тест): шаги «пропали» — были слишком тихими; теперь
    // мягкий «топ-топ» слышен отчётливо, но не резко
    tone(175, 0.06, { vol: 0.09, slideTo: 130, type: 'sine' });
    tone(390, 0.03, { vol: 0.055, delay: 0.015, type: 'triangle' });
  },
};

export function play(name) {
  // v0.27.0: эффекты тоже не должны молчать при 'interrupted' (телефон)
  // v0.27.1: на паузе/в альбоме мир молчит; звуки САМОГО альбома идут через playUI
  if (!ctx || muted || gamePaused) return;
  const fn = SFX[name];
  if (fn) fn();
}
// Звуки интерфейса альбома/меню — работают и на паузе (мир при этом молчит)
export function playUI(name) {
  if (!ctx || muted) return;
  const fn = SFX[name];
  if (fn) fn();
}

// Звонкий «камешек-колокольчик»: чистый тон + мягкая октава сверху.
// Используется в мини-игре Светлячка «Звонкие камни».
export function playNote(freq, { delay = 0, dur = 0.5, vol = 0.26 } = {}) {
  // v0.27.0: не требовать state==='running' (Android WebView даёт 'interrupted' —
  // из-за этого хор/мелодии молчали); resume уже зовётся из initAudio/каждого жеста
  // v0.27.1: на паузе/в альбоме мелодии мира тоже молчат
  if (!ctx || muted || gamePaused) return;
  tone(freq, dur, { vol, delay, type: 'sine' });
  tone(freq * 2, dur * 0.55, { vol: vol * 0.3, delay, type: 'sine' });
}

// Голосовые реплики NPC (заранее сгенерированные файлы, локальные, офлайн)
// Правило: голос следует за ДЕЙСТВИЕМ ребёнка. Новая реплика сразу гасит старую
// (stopVoice внутри speak). Исключение — speak(file, {after:true}): реплика
// дождётся конца текущей, но отменяется, если контекст сменился (voiceGen).
const voiceCache = {};
let lastVoice = null;
let voiceGen = 0;
// v0.27.2 (живой тест: Крот/Мышь «не разговаривали», Утка обрывалась на полуслове):
// voicePlaying() смотрит на флаг проигрывания, но HTMLAudio при старте декодирует
// файл — в этот момент paused===true, и таймер «открыть игру» срабатывал ДО начала
// звука. Теперь голос резервирует время по ДЛИТЕЛЬНОСТИ файла (voiceBusyUntil),
// и игра ждёт ровно столько, сколько длится реплика (+ цепочки after).
let voiceBusyUntil = 0;
function markVoice(a) {
  if (!a._metaHooked) {
    a._metaHooked = true;
    a.addEventListener('loadedmetadata', () => {
      a._dur = (Number.isFinite(a.duration) && a.duration > 0.3) ? a.duration * 1000 : 0;
      if (a._startAt) voiceBusyUntil = Math.max(voiceBusyUntil, a._startAt + (a._dur || 3200));
    });
  }
  a._startAt = performance.now();
  const d = a._dur || 3200;
  voiceBusyUntil = Math.max(performance.now(), voiceBusyUntil) + d;
}
export function voiceBusy() { return performance.now() < voiceBusyUntil; }
export function speak(file, opts = {}) {
  if (muted || gamePaused) return; // v0.27.1: в альбоме/паузе отложенные реплики не звучат
  // v0.26.3: реплики — это HTMLAudio, им НЕ нужен работающий Web Audio-контекст.
  // Раньше при ctx.state !== 'running' (телефон, 'interrupted'/'suspended')
  // реплики молча выбрасывались — Крот/Белка «не разговаривали».
  if (!ctx) ensureCtx();
  else if (ctx.state === 'suspended' || ctx.state === 'interrupted') ctx.resume();
  try {
    let a = voiceCache[file];
    if (!a) { a = new Audio(file); voiceCache[file] = a; }
    a.muted = muted;
    a.volume = opts.vol != null ? opts.vol : 0.95;
    let gen = voiceGen;
    // opts.then: следующая реплика цепочкой после ЭТОЙ (иначе два {after:true}
    // привязались бы к одному и тому же текущему звуку и заговорили одновременно).
    const chainNext = (src) => {
      const b = voiceCache[opts.then] || (voiceCache[opts.then] = new Audio(opts.then));
      b.muted = muted; b.volume = 0.95;
      voiceBusyUntil += 3200; // v0.27.2: заранее резервируем время на следующую реплику
      const onEnd2 = () => {
        src.removeEventListener('ended', onEnd2);
        if (gen === voiceGen) {
          try { b.currentTime = 0; b.play().catch(() => {}); lastVoice = b; markVoice(b); } catch (e) {}
        }
      };
      src.addEventListener('ended', onEnd2);
    };
    if (opts.after && lastVoice && !lastVoice.paused && !lastVoice.ended) {
      const cur = lastVoice;
      voiceBusyUntil += 3200; // v0.27.2: резерв на эту реплику (точная длительность добавится при старте)
      const onEnd = () => {
        cur.removeEventListener('ended', onEnd);
        if (gen === voiceGen) {
          try { a.currentTime = 0; a.play().catch(() => {}); lastVoice = a; markVoice(a); } catch (e) {}
          if (opts.then) chainNext(a);
        }
      };
      cur.addEventListener('ended', onEnd);
      return;
    }
    stopVoice();
    gen = voiceGen; // поколение после гашения: цепочка then должна выжить
    a.currentTime = 0;
    a.play().catch(() => {});
    lastVoice = a;
    markVoice(a);
    if (opts.then) chainNext(a);
  } catch (e) {}
}
// Реплика интерфейса (например, карточка отдыха): звучит и на паузе мира
export function speakUI(file) {
  if (muted) return;
  try {
    let a = voiceCache[file];
    if (!a) { a = new Audio(file); voiceCache[file] = a; }
    a.muted = muted; a.volume = 0.95;
    stopVoice();
    a.currentTime = 0;
    a.play().catch(() => {});
    lastVoice = a;
    markVoice(a);
  } catch (e) {}
}
export function stopVoice() {
  voiceGen++;
  lastVoice = null;
  voiceBusyUntil = 0;
  for (const k in voiceCache) { try { voiceCache[k].pause(); voiceCache[k].currentTime = 0; } catch (e) {} }
}
// Уже слышно ли что-то
export function voicePlaying() { return !!(lastVoice && !lastVoice.paused && !lastVoice.ended); }
// Пауза всей игры: глушим Web Audio и ставим реплики на паузу
export function setGamePaused(p) {
  gamePaused = p;
  try { Object.values(voiceCache).forEach(a => { if (p) a.pause(); else if (a.duration && a.currentTime > 0 && a.currentTime < a.duration) a.play().catch(() => {}); }); } catch (e) {}
  try { if (ctx) { if (p) ctx.suspend(); else ctx.resume(); } } catch (e) {}
}

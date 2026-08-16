// Аудиосистема «Волшебной полянки»: всё синтезируется Web Audio API,
// без аудиофайлов, лицензий и сети. Голос NPC (позже) — отдельные файлы.

let ctx = null;
let master = null;
let windGain = null;
let nightLevel = 0;
let muted = localStorage.getItem('wm_muted') === '1';

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
  if (ctx.state === 'suspended') ctx.resume();
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
};

export function play(name) {
  if (!ctx || muted || ctx.state !== 'running') return;
  const fn = SFX[name];
  if (fn) fn();
}

// Звонкий «камешек-колокольчик»: чистый тон + мягкая октава сверху.
// Используется в мини-игре Светлячка «Звонкие камни».
export function playNote(freq, { delay = 0, dur = 0.5, vol = 0.26 } = {}) {
  if (!ctx || muted || ctx.state !== 'running') return;
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
export function speak(file, opts = {}) {
  if (!ctx || muted || ctx.state !== 'running') return;
  try {
    let a = voiceCache[file];
    if (!a) { a = new Audio(file); voiceCache[file] = a; }
    a.muted = muted;
    a.volume = opts.vol != null ? opts.vol : 0.95;
    const gen = voiceGen;
    if (opts.after && lastVoice && !lastVoice.paused && !lastVoice.ended) {
      const cur = lastVoice;
      const onEnd = () => {
        cur.removeEventListener('ended', onEnd);
        if (gen === voiceGen) {
          try { a.currentTime = 0; a.play().catch(() => {}); lastVoice = a; } catch (e) {}
        }
      };
      cur.addEventListener('ended', onEnd);
      return;
    }
    stopVoice();
    a.currentTime = 0;
    a.play().catch(() => {});
    lastVoice = a;
  } catch (e) {}
}
export function stopVoice() {
  voiceGen++;
  lastVoice = null;
  for (const k in voiceCache) { try { voiceCache[k].pause(); voiceCache[k].currentTime = 0; } catch (e) {} }
}
// Уже слышно ли что-то
export function voicePlaying() { return !!(lastVoice && !lastVoice.paused && !lastVoice.ended); }
// Пауза всей игры: глушим Web Audio и ставим реплики на паузу
export function setGamePaused(p) {
  try { Object.values(voiceCache).forEach(a => { if (p) a.pause(); else if (a.duration && a.currentTime > 0 && a.currentTime < a.duration) a.play().catch(() => {}); }); } catch (e) {}
  try { if (ctx) { if (p) ctx.suspend(); else ctx.resume(); } } catch (e) {}
}

import * as THREE from 'three';
import { initAudio, play, setNight, toggleMute, isMuted, speak, stopVoice, setGamePaused } from './audio.js';

// ============ БАЗА ============
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaee3f5);
scene.fog = new THREE.Fog(0xaee3f5, 36, 75);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (e) {
  const el = document.getElementById('hint');
  if (el) { el.style.opacity = '1'; el.textContent = '⚠️ Нужен браузер с WebGL'; }
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 250);
const hemi = new THREE.HemisphereLight(0xffffff, 0x9ccc8f, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d0, 1.35);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 2, far: 70 });
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);

const L = (c) => new THREE.MeshLambertMaterial({ color: c });
const swayList = [];
const obstacles = [];

// ============ ОСТРОВ ============
const ISLAND_R = 15;
const ground = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R, ISLAND_R * 0.88, 1.8, 48), L(0x8ed081));
ground.position.y = -0.9;
ground.receiveShadow = true;
scene.add(ground);
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

let seed = 42;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// Разнотравье: мягкие пятна на лугу
for (let i = 0; i < 14; i++) {
  const a = rand() * Math.PI * 2, r = 2 + Math.sqrt(rand()) * 11.5;
  const patch = new THREE.Mesh(
    new THREE.CircleGeometry(1.1 + rand() * 1.4, 20),
    new THREE.MeshLambertMaterial({ color: rand() > 0.5 ? 0x84cc78 : 0x9adb8a, transparent: true, opacity: 0.5 })
  );
  patch.rotation.x = -Math.PI / 2;
  patch.position.set(Math.cos(a) * r, 0.015 + i * 0.001, Math.sin(a) * r);
  scene.add(patch);
}

for (const [x, z, r, c] of [[-7, -7, 3.4, 0x7ecb74], [9, 6, 2.6, 0x86cf78], [-11, 4, 2.2, 0x94d687]]) {
  const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), L(c));
  hill.scale.y = 0.38; hill.position.set(x, 0, z); hill.receiveShadow = true;
  scene.add(hill);
}

const pond = new THREE.Mesh(new THREE.CircleGeometry(3.4, 40), L(0x7ecbe8));
pond.rotation.x = -Math.PI / 2; pond.position.set(5, 0.04, 4);
scene.add(pond);
obstacles.push({ x: 5, z: 4, r: 3.9 });
for (const [dx, dz, s] of [[-1, 0.6, 0.5], [0.9, -1, 0.4], [0.3, 1.4, 0.35]]) {
  const pad = new THREE.Mesh(new THREE.CircleGeometry(s, 14), L(0x5fbf7a));
  pad.rotation.x = -Math.PI / 2; pad.position.set(5 + dx, 0.07, 4 + dz);
  scene.add(pad);
}
for (const [dx, dz] of [[3.6, 0.5], [3.3, -1.8]]) {
  const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.4, 8), L(0x5aa860));
  reed.position.set(5 + dx, 0.7, 4 + dz);
  const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.3, 4, 8), L(0x8a5a3b));
  tip.position.set(5 + dx, 1.55, 4 + dz);
  scene.add(reed, tip);
}
for (let i = 0; i < 6; i++) {
  const t = i / 5;
  const st = new THREE.Mesh(new THREE.CircleGeometry(0.55 - t * 0.1, 16), L(0xf0e3c0));
  st.rotation.x = -Math.PI / 2; st.position.set(-1.5 - t * 4.5, 0.05, -1 - t * 4.2);
  st.receiveShadow = true;
  scene.add(st);
}

// Камни, бревнышко, грибы, подсолнух
for (const [x, z, r] of [[7.8, 6.8, 0.5], [-4.5, -4, 0.42], [11, 6.5, 0.38]]) {
  const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), L(0xb9c1c9));
  stone.position.set(x, r * 0.55, z); stone.castShadow = true;
  scene.add(stone);
  obstacles.push({ x, z, r: r + 0.08 });
}
{
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.7, 14), L(0x9a6b4f));
  log.rotation.z = Math.PI / 2; log.position.set(8.9, 0.32, 1.2); log.rotation.y = 0.4;
  log.castShadow = true;
  scene.add(log);
  obstacles.push({ x: 8.9, z: 1.2, r: 1.0 });
}
for (const [x, z] of [[-9, 1.5], [8.4, -4.6], [-5.8, 8.6]]) {
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.42, 10), L(0xf7e7c3));
  stem.position.set(x, 0.21, z);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), L(0xe26d5c));
  cap.position.set(x, 0.42, z); cap.castShadow = true;
  scene.add(stem, cap);
}
{
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.7, 8), L(0x5aa860));
  stem.position.y = 0.85;
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 14), L(0x8a5a3b));
  center.position.y = 1.75; center.scale.z = 0.45; center.castShadow = true;
  g.add(stem, center);
  for (let p = 0; p < 9; p++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), L(0xffd166));
    const a = (p / 9) * Math.PI * 2;
    petal.position.set(Math.cos(a) * 0.34, 1.75 + Math.sin(a) * 0.34, 0.05);
    petal.scale.set(1.5, 0.7, 0.4);
    petal.rotation.z = a;
    g.add(petal);
  }
  g.position.set(-9.5, 0, 8.2);
  g.rotation.y = 0.6;
  scene.add(g);
  swayList.push({ obj: g, amp: 0.08, speed: 1.2 });
  obstacles.push({ x: -9.5, z: 8.2, r: 0.4 });
}

// ============ ДЕРЕВЬЯ / КУСТЫ / ЦВЕТЫ / ТРАВА ============
function makeTree(x, z, s, crownColor) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.34 * s, 1.5 * s, 12), L(0x9a6b4f));
  trunk.position.y = 0.75 * s; trunk.castShadow = true;
  const crown = new THREE.Group();
  const crownMat = L(crownColor);
  const c1 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25 * s, 2), crownMat);
  c1.castShadow = true;
  const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 * s, 2), crownMat);
  c2.position.set(0.6 * s, 0.5 * s, 0.2 * s); c2.castShadow = true;
  const c3 = c2.clone(); c3.position.set(-0.55 * s, 0.4 * s, -0.25 * s);
  crown.add(c1, c2, c3); crown.position.y = 1.9 * s;
  g.add(trunk, crown);
  g.position.set(x, 0, z); g.rotation.y = Math.random() * Math.PI;
  scene.add(g);
  swayList.push({ obj: crown, amp: 0.04, speed: 1.1 + Math.random() * 0.4 });
  obstacles.push({ x, z, r: 0.55 * s });
}
const treeSpots = [
  [-6, -9, 1.1, 0x6cbf6f], [8.5, -7, 0.9, 0x5cb85c], [-10.5, -3.5, 1.25, 0x8fd07a],
  [-8.5, 6.5, 1.0, 0x6cbf6f], [1.5, 10.5, 1.0, 0x8fd07a],
  [-12.5, 0.5, 0.9, 0x8fd07a], [7.5, 9.5, 1.15, 0x6cbf6f],
];
treeSpots.forEach(([x, z, s, c]) => makeTree(x, z, s, c));

for (const [x, z, r] of [[-3.5, 6, 0.8], [-9, -2, 0.9], [5.5, 7, 0.6], [2, -6, 0.75], [-5, 1.5, 0.65]]) {
  const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), L(0x74c476));
  bush.position.set(x, r * 0.55, z); bush.castShadow = true;
  scene.add(bush);
  obstacles.push({ x, z, r: r * 0.9 });
}

const flowerColors = [0xf2a0b5, 0xffd166, 0xc3aed6, 0xff8fa3, 0xffffff];
const flowerSpots = [[-2, 3], [0.5, 6], [-6, 2], [3.5, -2.5], [7, 2.5], [-4.5, -5.5], [9.5, 5.5], [1, 8.5], [-7.5, 7.5], [4, -7.5], [-1, -9], [11, -0.5], [-10, 2.5], [6.5, 10]];
flowerSpots.forEach(([x, z], i) => {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.5, 6), L(0x5aa860));
  stem.position.y = 0.25;
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), L(0xfff3d6));
  center.position.y = 0.55;
  g.add(stem, center);
  for (let p = 0; p < 5; p++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), L(flowerColors[i % flowerColors.length]));
    const a = (p / 5) * Math.PI * 2;
    petal.position.set(Math.cos(a) * 0.17, 0.55, Math.sin(a) * 0.17);
    petal.scale.set(1, 0.5, 1);
    g.add(petal);
  }
  g.position.set(x, 0, z);
  scene.add(g);
  swayList.push({ obj: g, amp: 0.11, speed: 1.6 + Math.random() });
});

const tuftGeo = new THREE.ConeGeometry(0.09, 0.35, 6);
const tuftMat = L(0x6fbf62);
for (let i = 0; i < 70; i++) {
  const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * (ISLAND_R - 1.5);
  const tuft = new THREE.Mesh(tuftGeo, tuftMat);
  tuft.position.set(Math.cos(a) * r, 0.17, Math.sin(a) * r);
  tuft.rotation.y = rand() * Math.PI;
  scene.add(tuft);
}

// ============ ДОМИК / ОГОРОД / ДЫМОК ============
const house = new THREE.Group();
const walls = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 2.2), L(0xf7e7c3));
walls.position.y = 0.9; walls.castShadow = true;
const roof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 1.5, 4), L(0xe08e79));
roof.position.y = 2.55; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
const door = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.0, 0.1), L(0x9a6b4f));
door.position.set(0, 0.5, 1.15);
const winMat = new THREE.MeshLambertMaterial({ color: 0xfff7cc });
const win = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 24), winMat);
win.rotation.x = Math.PI / 2; win.position.set(-0.8, 1.15, 1.12);
const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.35), L(0xc98a6d));
chimney.position.set(0.8, 2.9, -0.4);
house.add(walls, roof, door, win, chimney);
house.position.set(-7, 0.7, -6.5); house.rotation.y = 0.5;
scene.add(house);
obstacles.push({ x: -7, z: -6.5, r: 2.5 });

const garden = new THREE.Group();
for (let i = 0; i < 3; i++) {
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 0.55), L(0x8a5a3b));
  bed.position.set(i * 2 - 2, 0.11, 0); bed.castShadow = true;
  garden.add(bed);
  for (let j = 0; j < 3; j++) {
    const sprout = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), L(0x7ddb7d));
    sprout.position.set(i * 2 - 2 - 0.5 + j * 0.5, 0.3, 0); sprout.scale.y = 0.7;
    garden.add(sprout);
  }
}
garden.position.set(2.5, 0, -6); garden.rotation.y = -0.3;
scene.add(garden);
obstacles.push({ x: 2.5, z: -6, r: 2.4 });

const smokes = [];
for (let i = 0; i < 4; i++) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10),
    new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
  s.userData.t = i / 4;
  scene.add(s); smokes.push(s);
}

// ============ НЕБО / ЖИВОСТЬ ============
const clouds = [];
function makeCloud(x, y, z, s) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
  for (const [dx, dy, dz, r] of [[0, 0, 0, 1.1], [1, 0.15, 0.2, 0.8], [-0.9, 0.1, 0.1, 0.7], [0.3, 0.35, -0.3, 0.6]]) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
    puff.position.set(dx, dy, dz); g.add(puff);
  }
  g.scale.setScalar(s); g.position.set(x, y, z);
  scene.add(g);
  clouds.push({ g, mat, speed: 0.25 + Math.random() * 0.2, radius: 1.6 * s });
}
makeCloud(-8, 11, -10, 1.4); makeCloud(6, 13, -14, 1.8); makeCloud(0, 12, 12, 1.2);

const birds = [];
for (let i = 0; i < 3; i++) {
  const g = new THREE.Group();
  const wingGeo = new THREE.PlaneGeometry(0.5, 0.12);
  const wMat = new THREE.MeshBasicMaterial({ color: 0x5a6b7a, side: THREE.DoubleSide });
  const wL = new THREE.Mesh(wingGeo, wMat); wL.position.x = -0.28; wL.rotation.z = 0.4;
  const wR = new THREE.Mesh(wingGeo, wMat); wR.position.x = 0.28; wR.rotation.z = -0.4;
  g.add(wL, wR); scene.add(g);
  birds.push({ g, off: i * 2.5, y: 14 + i });
}

const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(120 * 3);
for (let i = 0; i < 120; i++) {
  const a = rand() * Math.PI * 2, r = 25 + rand() * 35, y = 12 + rand() * 30;
  starPos[i * 3] = Math.cos(a) * r; starPos[i * 3 + 1] = y; starPos[i * 3 + 2] = Math.sin(a) * r;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, transparent: true, opacity: 0, sizeAttenuation: true });
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

const moon = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 24),
  new THREE.MeshLambertMaterial({ color: 0xf4f1de, transparent: true, opacity: 0 }));
moon.position.set(-16, 20, -14);
scene.add(moon);

const FF = 26;
const ffGeo = new THREE.BufferGeometry();
const ffPos = new Float32Array(FF * 3);
const ffBase = [];
for (let i = 0; i < FF; i++) {
  const a = rand() * Math.PI * 2, r = 2 + rand() * 11;
  const x = Math.cos(a) * r, y = 0.5 + rand() * 1.6, z = Math.sin(a) * r;
  ffPos.set([x, y, z], i * 3);
  ffBase.push({ x, y, z, ph: rand() * 10 });
}
ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
const ffMat = new THREE.PointsMaterial({ color: 0xffe08a, size: 0.16, transparent: true, opacity: 0, sizeAttenuation: true });
const fireflies = new THREE.Points(ffGeo, ffMat);
scene.add(fireflies);

const pollenGeo = new THREE.BufferGeometry();
const POLLEN = 50;
const pPos = new Float32Array(POLLEN * 3);
for (let i = 0; i < POLLEN; i++) {
  const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 13;
  pPos.set([Math.cos(a) * r, 0.4 + rand() * 2.5, Math.sin(a) * r], i * 3);
}
pollenGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pollenMat = new THREE.PointsMaterial({ color: 0xfff8c9, size: 0.08, transparent: true, opacity: 0.7 });
const pollen = new THREE.Points(pollenGeo, pollenMat);
scene.add(pollen);

const butterflies = [];
function makeButterfly(cx, cz, color) {
  const g = new THREE.Group();
  const wingGeo = new THREE.CircleGeometry(0.16, 12);
  const wL = new THREE.Mesh(wingGeo, L(color));
  const wR = new THREE.Mesh(wingGeo, L(color));
  wL.position.x = -0.14; wR.position.x = 0.14;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.16, 4, 8), L(0x4a3b32));
  body.rotation.x = Math.PI / 2;
  g.add(wL, wR, body);
  scene.add(g);
  butterflies.push({ g, wL, wR, cx, cz, t: Math.random() * 10 });
}
makeButterfly(0.5, 6, 0xffb703); makeButterfly(-6, 2, 0xff8fa3);

// ============ ОБЛАЧКА-ЭМОДЗИ ============
function makeBubbleSprite(emoji, scale = 1.15) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.arc(128, 108, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(108, 190); ctx.lineTo(92, 236); ctx.lineTo(140, 196);
  ctx.fill();
  ctx.font = '96px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 128, 112);
  const tex = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(scale, scale, 1);
  return sp;
}

// ============ ЁЖИК ============
const hedgehog = new THREE.Group();
{
  const spikes = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 2), L(0x8a6b9e));
  spikes.position.y = 0.45; spikes.scale.set(1.15, 0.9, 1.15); spikes.castShadow = true;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 18), L(0xf2d7b6));
  face.position.set(0, 0.42, 0.34);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), L(0x4a3b32));
  nose.position.set(0, 0.45, 0.62);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2b2b2b });
  const eL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat);
  eL.position.set(-0.11, 0.53, 0.56);
  const eR = eL.clone(); eR.position.x = 0.11;
  const earGeo = new THREE.SphereGeometry(0.08, 10, 10);
  const earL = new THREE.Mesh(earGeo, L(0xf2d7b6)); earL.position.set(-0.22, 0.62, 0.3);
  const earR = earL.clone(); earR.position.x = 0.22;
  hedgehog.add(spikes, face, nose, eL, eR, earL, earR);
}
const HEDGE_POS = { x: -2.2, z: 7.2 };
hedgehog.position.set(HEDGE_POS.x, 0, HEDGE_POS.z);
hedgehog.rotation.y = 0.4;
scene.add(hedgehog);
obstacles.push({ x: HEDGE_POS.x, z: HEDGE_POS.z, r: 0.45 });

const hedgeBubble = makeBubbleSprite('🍎', 1.05);
hedgeBubble.position.set(HEDGE_POS.x, 2.1, HEDGE_POS.z);
scene.add(hedgeBubble);
const bubTex = {
  apple: hedgeBubble.material.map,
  work: makeBubbleSprite('🍎→🧺', 1).material.map,
  star: makeBubbleSprite('⭐', 1).material.map,
};
function setBubble(t) { hedgeBubble.material.map = t; hedgeBubble.material.needsUpdate = true; }

// ============ СОВА ============
const owl = new THREE.Group();
{
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.5, 14), L(0x9a6b4f));
  stump.position.y = 0.25; stump.castShadow = true;
  const stumpTop = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.06, 14), L(0xc9a46e));
  stumpTop.position.y = 0.53;
  owl.add(stump, stumpTop);
  const bird = new THREE.Group();
  const owlBody = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 18), L(0xb08a5f));
  owlBody.position.y = 0.42; owlBody.scale.set(1, 1.15, 0.9); owlBody.castShadow = true;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 14), L(0xf2e3c9));
  belly.position.set(0, 0.36, 0.16); belly.scale.set(0.85, 1, 0.55);
  const wingGeo = new THREE.SphereGeometry(0.24, 12, 12);
  const wingMat = L(0x8a6a44);
  const wingL = new THREE.Mesh(wingGeo, wingMat);
  wingL.position.set(-0.36, 0.45, 0); wingL.scale.set(0.5, 0.9, 0.75); wingL.rotation.z = 0.3;
  const wingR = wingL.clone(); wingR.position.x = 0.36; wingR.rotation.z = -0.3;
  const eyeWGeo = new THREE.SphereGeometry(0.14, 12, 12);
  const eyeWM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyeWL = new THREE.Mesh(eyeWGeo, eyeWM);
  eyeWL.position.set(-0.15, 0.72, 0.3); eyeWL.scale.z = 0.5;
  const eyeWR = eyeWL.clone(); eyeWR.position.x = 0.15;
  const pupilGeo = new THREE.SphereGeometry(0.07, 10, 10);
  const pupilM = new THREE.MeshBasicMaterial({ color: 0x2b2b2b });
  const pupilL = new THREE.Mesh(pupilGeo, pupilM);
  pupilL.position.set(-0.15, 0.72, 0.4);
  const pupilR = pupilL.clone(); pupilR.position.x = 0.15;
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.15, 8), L(0xf2994c));
  beak.position.set(0, 0.6, 0.36); beak.rotation.x = Math.PI * 0.6;
  const tuftGeoO = new THREE.ConeGeometry(0.08, 0.2, 6);
  const tuftL = new THREE.Mesh(tuftGeoO, wingMat);
  tuftL.position.set(-0.22, 0.95, 0.02); tuftL.rotation.z = 0.35;
  const tuftR = tuftL.clone(); tuftR.position.x = 0.22; tuftR.rotation.z = -0.35;
  bird.add(owlBody, belly, wingL, wingR, eyeWL, eyeWR, pupilL, pupilR, beak, tuftL, tuftR);
  bird.position.y = 0.55;
  owl.add(bird);
  owl.userData.bird = bird;
}
const OWL_POS = { x: -6.5, z: 10.5 };
owl.position.set(OWL_POS.x, 0, OWL_POS.z);
owl.rotation.y = Math.atan2(0 - OWL_POS.x, 0 - OWL_POS.z);
scene.add(owl);
obstacles.push({ x: OWL_POS.x, z: OWL_POS.z, r: 0.55 });

const owlBubble = makeBubbleSprite('🔢', 1.05);
owlBubble.position.set(OWL_POS.x, 2.5, OWL_POS.z);
scene.add(owlBubble);
const owlBubTex = {
  count: owlBubble.material.map,
  star: makeBubbleSprite('⭐', 1).material.map,
};
function setOwlBubble(t) { owlBubble.material.map = t; owlBubble.material.needsUpdate = true; }

// ============ ЛЯГУШКА ============
const frog = new THREE.Group();
{
  const pad = new THREE.Mesh(new THREE.CircleGeometry(0.62, 20), L(0x4faf6a));
  pad.rotation.x = -Math.PI / 2; pad.position.y = 0.06;
  frog.add(pad);
  const fBody = new THREE.Group();
  const fbodyM = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 18), L(0x69c34d));
  fbodyM.position.y = 0.42; fbodyM.scale.set(1, 0.85, 0.9); fbodyM.castShadow = true;
  const fbelly = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 14), L(0xd9f2b8));
  fbelly.position.set(0, 0.36, 0.18); fbelly.scale.set(0.85, 0.8, 0.5);
  const fsocketGeo = new THREE.SphereGeometry(0.13, 12, 12);
  const fsockL = new THREE.Mesh(fsocketGeo, L(0x69c34d));
  fsockL.position.set(-0.16, 0.72, 0.08);
  const fsockR = fsockL.clone(); fsockR.position.x = 0.16;
  const feyeGeo = new THREE.SphereGeometry(0.09, 10, 10);
  const feyeM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const feyeL = new THREE.Mesh(feyeGeo, feyeM);
  feyeL.position.set(-0.16, 0.75, 0.14);
  const feyeR = feyeL.clone(); feyeR.position.x = 0.16;
  const fpupGeo = new THREE.SphereGeometry(0.045, 8, 8);
  const fpupM = new THREE.MeshBasicMaterial({ color: 0x2b2b2b });
  const fpupL = new THREE.Mesh(fpupGeo, fpupM);
  fpupL.position.set(-0.16, 0.75, 0.22);
  const fpupR = fpupL.clone(); fpupR.position.x = 0.16;
  const fmouth = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.028, 8, 16, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x3f7a2e }));
  fmouth.position.set(0, 0.42, 0.31); fmouth.rotation.z = Math.PI;
  const flegGeo = new THREE.SphereGeometry(0.14, 10, 10);
  const flegL = new THREE.Mesh(flegGeo, L(0x57a83f));
  flegL.position.set(-0.32, 0.2, -0.05); flegL.scale.set(1.2, 0.6, 1.1);
  const flegR = flegL.clone(); flegR.position.x = 0.32;
  fBody.add(fbodyM, fbelly, fsockL, fsockR, feyeL, feyeR, fpupL, fpupR, fmouth, flegL, flegR);
  frog.add(fBody);
  frog.userData.body = fBody;
}
const FROG_POS = { x: 10.8, z: 2.6 };
frog.position.set(FROG_POS.x, 0.02, FROG_POS.z);
frog.rotation.y = Math.atan2(0 - FROG_POS.x, 0 - FROG_POS.z);
scene.add(frog);
obstacles.push({ x: FROG_POS.x, z: FROG_POS.z, r: 0.5 });

const frogBubble = makeBubbleSprite('🧩', 1.05);
frogBubble.position.set(FROG_POS.x, 2.2, FROG_POS.z);
scene.add(frogBubble);
const frogBubTex = {
  puzzle: frogBubble.material.map,
  star: makeBubbleSprite('⭐', 1).material.map,
};
function setFrogBubble(t) { frogBubble.material.map = t; frogBubble.material.needsUpdate = true; }

// ============ ДРЕВО ЖЕЛАНИЙ ============
const TREE_POS = { x: -0.5, z: -2.8 };
let treeStage = parseInt(localStorage.getItem('wm_tree_stage') || '1', 10);
let treeWaters = parseInt(localStorage.getItem('wm_tree_waters') || '0', 10);
const TREE_STAGE_AT = { 2: 2, 3: 5 };

const treeStages = [null, null, null, null];
function buildTreeStage(s) {
  const g = new THREE.Group();
  if (s === 1) {
    // Саженец, но уже заметный: ребёнок считает его «настоящим деревцем»
    const trunk1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.95, 10), L(0x9a6b4f));
    trunk1.position.y = 0.48; trunk1.castShadow = true;
    const crown1 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 2), L(0x8fd07a));
    crown1.position.y = 1.25; crown1.castShadow = true;
    const crown2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 2), L(0x7ecb7f));
    crown2.position.set(0.32, 1.05, 0.12);
    g.add(trunk1, crown1, crown2);
  } else if (s === 2) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.2, 10), L(0x9a6b4f));
    trunk.position.y = 0.6; trunk.castShadow = true;
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 2), L(0x7ecb7f));
    crown.position.y = 1.6; crown.castShadow = true;
    const crown2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 2), L(0x8fd07a));
    crown2.position.set(0.4, 1.35, 0.15);
    g.add(trunk, crown, crown2);
    for (const [dx, dy, dz] of [[0.3, 1.75, 0.2], [-0.35, 1.5, -0.1]]) {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
      fruit.position.set(dx, dy, dz);
      g.add(fruit);
    }
  } else {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.9, 12), L(0x9a6b4f));
    trunk.position.y = 0.95; trunk.castShadow = true;
    g.add(trunk);
    const crownMat = L(0x74c98f);
    for (const [dx, dy, dz, r] of [[0, 2.5, 0, 1.05], [0.7, 2.1, 0.3, 0.65], [-0.65, 2.15, -0.25, 0.6], [0.15, 1.9, -0.5, 0.5]]) {
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), crownMat);
      c.position.set(dx, dy, dz); c.castShadow = true;
      g.add(c);
    }
    for (const [dx, dy, dz] of [[0.5, 2.6, 0.4], [-0.5, 2.3, 0.3], [0.1, 2.9, -0.3], [0.85, 2.0, -0.1], [-0.3, 1.8, 0.55]]) {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
      fruit.position.set(dx, dy, dz);
      g.add(fruit);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe9a3, transparent: true, opacity: 0.8 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.06;
    g.add(ring);
  }
  return g;
}
const treeRoot = new THREE.Group();
for (let s = 1; s <= 3; s++) {
  treeStages[s] = buildTreeStage(s);
  treeStages[s].visible = (s === treeStage);
  treeRoot.add(treeStages[s]);
}
treeRoot.position.set(TREE_POS.x, 0, TREE_POS.z);
scene.add(treeRoot);
obstacles.push({ x: TREE_POS.x, z: TREE_POS.z, r: 0.5 });

const treeBubble = makeBubbleSprite('💧', 0.95);
treeBubble.position.set(TREE_POS.x, 2.6, TREE_POS.z);
scene.add(treeBubble);
function updateTreeBubble() {
  treeBubble.visible = dropsCount > 0 && (gameState === 'explore' || gameState === 'intro');
  if (treeBubble.visible) treeBubble.scale.setScalar(0.95 + Math.sin(elapsed * 2.2) * 0.05);
}

const waterDrops = [];
function pourRain() {
  for (let i = 0; i < 12; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x7ecbe8, transparent: true, opacity: 0.95 }));
    d.position.set(TREE_POS.x + (rand() - 0.5) * 1.6, 3.2 + rand() * 1.5, TREE_POS.z + (rand() - 0.5) * 1.6);
    d.userData.v = 3 + rand() * 1.5;
    scene.add(d);
    waterDrops.push(d);
  }
}

// ============ ПЕРСОНАЖИ ============
function makeChar(type) {
  const g = new THREE.Group();
  const bodyG = new THREE.Group();
  const dark = new THREE.MeshBasicMaterial({ color: 0x2b2b2b });
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  let ears = [], inners = [];

  if (type === 'bunny') {
    const fur = L(0xffffff), pink = L(0xf7c8d3);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 24), fur);
    body.position.y = 0.55; body.scale.set(1, 1.05, 0.95); body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 24), fur);
    head.position.set(0, 1.2, 0.12); head.castShadow = true;
    const earGeo = new THREE.CapsuleGeometry(0.11, 0.5, 6, 12);
    const eL = new THREE.Mesh(earGeo, fur); eL.position.set(-0.17, 1.8, 0.05); eL.rotation.z = 0.12;
    const eR = new THREE.Mesh(earGeo, fur); eR.position.set(0.17, 1.8, 0.05); eR.rotation.z = -0.12;
    const innerGeo = new THREE.CapsuleGeometry(0.055, 0.32, 6, 12);
    const iL = new THREE.Mesh(innerGeo, pink); iL.position.set(-0.17, 1.8, 0.14); iL.rotation.z = 0.12;
    const iR = new THREE.Mesh(innerGeo, pink); iR.position.set(0.17, 1.8, 0.14); iR.rotation.z = -0.12;
    ears = [eL, eR]; inners = [iL, iR];
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), L(0xf2a0b5));
    nose.position.set(0, 1.16, 0.5);
    const cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), pink);
    cheekL.position.set(-0.24, 1.12, 0.36); cheekL.scale.z = 0.5;
    const cheekR = cheekL.clone(); cheekR.position.x = 0.24;
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), fur);
    tail.position.set(0, 0.5, -0.55);
    const pawGeo = new THREE.SphereGeometry(0.16, 12, 12);
    const pawL = new THREE.Mesh(pawGeo, fur); pawL.position.set(-0.3, 0.14, 0.3); pawL.scale.set(1, 0.55, 1.5);
    const pawR = pawL.clone(); pawR.position.x = 0.3;
    const eyeGeo = new THREE.SphereGeometry(0.07, 14, 14);
    const eyeL = new THREE.Mesh(eyeGeo, dark); eyeL.position.set(-0.16, 1.28, 0.46);
    const eyeR = new THREE.Mesh(eyeGeo, dark); eyeR.position.set(0.16, 1.28, 0.46);
    const glintGeo = new THREE.SphereGeometry(0.022, 8, 8);
    const gLm = new THREE.Mesh(glintGeo, glintMat); gLm.position.set(-0.145, 1.305, 0.52);
    const gRm = new THREE.Mesh(glintGeo, glintMat); gRm.position.set(0.175, 1.305, 0.52);
    bodyG.add(body, head, eL, eR, iL, iR, eyeL, eyeR, gLm, gRm, nose, cheekL, cheekR, pawL, pawR, tail);
    g.userData = { eyes: [eyeL, eyeR], glints: [gLm, gRm], ears, inners };
  } else if (type === 'fox') {
    const fur = L(0xf29e4c), cream = L(0xfff3e0), tipDark = L(0x8a5a3b);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 24), fur);
    body.position.y = 0.55; body.scale.set(1, 1.05, 0.95); body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), fur);
    head.position.set(0, 1.18, 0.12); head.castShadow = true;
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 14), cream);
    muzzle.position.set(0, 1.08, 0.44); muzzle.scale.set(1, 0.8, 1.1);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), L(0x4a3b32));
    nose.position.set(0, 1.13, 0.6);
    const earGeo = new THREE.ConeGeometry(0.16, 0.45, 10);
    const eL = new THREE.Mesh(earGeo, fur); eL.position.set(-0.22, 1.62, 0.08); eL.rotation.z = 0.25;
    const eR = new THREE.Mesh(earGeo, fur); eR.position.set(0.22, 1.62, 0.08); eR.rotation.z = -0.25;
    const tipGeo = new THREE.ConeGeometry(0.09, 0.18, 8);
    const tL = new THREE.Mesh(tipGeo, tipDark); tL.position.set(-0.27, 1.82, 0.08); tL.rotation.z = 0.25;
    const tR = new THREE.Mesh(tipGeo, tipDark); tR.position.set(0.27, 1.82, 0.08); tR.rotation.z = -0.25;
    ears = [eL, eR];
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 6, 12), fur);
    tail.position.set(0, 0.45, -0.6); tail.rotation.x = -1.0;
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), cream);
    tailTip.position.set(0, 0.78, -0.86);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 14), cream);
    chest.position.set(0, 0.6, 0.38); chest.scale.set(0.8, 1, 0.6);
    const pawGeo = new THREE.SphereGeometry(0.15, 12, 12);
    const pawL = new THREE.Mesh(pawGeo, tipDark); pawL.position.set(-0.28, 0.13, 0.28); pawL.scale.set(1, 0.55, 1.5);
    const pawR = pawL.clone(); pawR.position.x = 0.28;
    const eyeGeo = new THREE.SphereGeometry(0.07, 14, 14);
    const eyeL = new THREE.Mesh(eyeGeo, dark); eyeL.position.set(-0.17, 1.28, 0.44);
    const eyeR = new THREE.Mesh(eyeGeo, dark); eyeR.position.set(0.17, 1.28, 0.44);
    const glintGeo = new THREE.SphereGeometry(0.022, 8, 8);
    const gLm = new THREE.Mesh(glintGeo, glintMat); gLm.position.set(-0.155, 1.305, 0.5);
    const gRm = new THREE.Mesh(glintGeo, glintMat); gRm.position.set(0.185, 1.305, 0.5);
    bodyG.add(body, head, muzzle, nose, eL, eR, tL, tR, eyeL, eyeR, gLm, gRm, chest, tail, tailTip, pawL, pawR);
    g.userData = { eyes: [eyeL, eyeR], glints: [gLm, gRm], ears, inners: [], tail };
  } else {
    const fur = L(0xa9746e), muzzleC = L(0xe8c9a8);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 24), fur);
    body.position.y = 0.58; body.scale.set(1, 1.0, 0.95); body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 24, 24), fur);
    head.position.set(0, 1.25, 0.08); head.castShadow = true;
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 14), muzzleC);
    muzzle.position.set(0, 1.15, 0.4); muzzle.scale.set(1, 0.75, 0.9);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), L(0x4a3b32));
    nose.position.set(0, 1.22, 0.55);
    const earGeo = new THREE.SphereGeometry(0.15, 14, 14);
    const eL = new THREE.Mesh(earGeo, fur); eL.position.set(-0.32, 1.6, 0.05);
    const eR = new THREE.Mesh(earGeo, fur); eR.position.set(0.32, 1.6, 0.05);
    const innerGeo = new THREE.SphereGeometry(0.08, 10, 10);
    const iL = new THREE.Mesh(innerGeo, muzzleC); iL.position.set(-0.32, 1.6, 0.14);
    const iR = new THREE.Mesh(innerGeo, muzzleC); iR.position.set(0.32, 1.6, 0.14);
    ears = [eL, eR]; inners = [iL, iR];
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), fur);
    tail.position.set(0, 0.5, -0.6);
    const pawGeo = new THREE.SphereGeometry(0.19, 12, 12);
    const pawL = new THREE.Mesh(pawGeo, fur); pawL.position.set(-0.32, 0.15, 0.3); pawL.scale.set(1, 0.55, 1.4);
    const pawR = pawL.clone(); pawR.position.x = 0.32;
    const eyeGeo = new THREE.SphereGeometry(0.065, 14, 14);
    const eyeL = new THREE.Mesh(eyeGeo, dark); eyeL.position.set(-0.17, 1.35, 0.42);
    const eyeR = new THREE.Mesh(eyeGeo, dark); eyeR.position.set(0.17, 1.35, 0.42);
    const glintGeo = new THREE.SphereGeometry(0.022, 8, 8);
    const gLm = new THREE.Mesh(glintGeo, glintMat); gLm.position.set(-0.155, 1.375, 0.47);
    const gRm = new THREE.Mesh(glintGeo, glintMat); gRm.position.set(0.185, 1.375, 0.47);
    bodyG.add(body, head, muzzle, nose, eL, eR, iL, iR, eyeL, eyeR, gLm, gRm, tail, pawL, pawR);
    g.userData = { eyes: [eyeL, eyeR], glints: [gLm, gRm], ears, inners };
  }
  g.add(bodyG);
  g.userData.bodyG = bodyG;
  return g;
}

let hero = null;
let charData = null;
let spawnPop = 0;
const blob = new THREE.Mesh(
  new THREE.CircleGeometry(0.55, 24),
  new THREE.MeshBasicMaterial({ color: 0x3f6b46, transparent: true, opacity: 0.16 })
);
blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02;
const laughBubble = makeBubbleSprite('😂', 0.95);
laughBubble.visible = false;
scene.add(laughBubble);

// ============ ДОМИК-УКРЫТИЕ (переждать ночь, спрятаться от волков) ============
const sleepBubble = makeBubbleSprite('💤', 0.9);
sleepBubble.visible = false;
sleepBubble.position.set(-6.4, 4.1, -5.6);
scene.add(sleepBubble);
const HOUSE_DOOR = { x: -6.45, z: -5.49 };
let hiding = false;
let sleptNight = false;
function enterHouse() {
  if (hiding || !hero) return;
  hiding = true;
  sleptNight = nightness > 0.4;
  path = null; finalTarget = null;
  hero.visible = false;
  sleepBubble.visible = true;
  play('pop');
  for (const w of wolves) { w.mode = 'flee'; w.cooldown = 30; }
}
function exitHouse() {
  if (!hiding) return;
  hiding = false;
  hero.visible = true;
  hero.position.set(HOUSE_DOOR.x, 0, HOUSE_DOOR.z);
  sleepBubble.visible = false;
  spawnPop = 1;
  play('pop');
}

// ============ ВОЛКИ / СЕРДЕЧКИ ============
const wolves = [];
let wolfWarned = false;
function makeWolf() {
  const g = new THREE.Group();
  const fur = L(0x7a7f8a);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 18), fur);
  body.position.y = 0.5; body.scale.set(1.3, 0.9, 0.9); body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 18), fur);
  head.position.set(0.55, 0.78, 0);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), L(0x9aa0ab));
  muzzle.position.set(0.82, 0.7, 0);
  const earGeo = new THREE.ConeGeometry(0.1, 0.28, 8);
  const eL = new THREE.Mesh(earGeo, fur); eL.position.set(0.45, 1.08, 0.14);
  const eR = new THREE.Mesh(earGeo, fur); eR.position.set(0.45, 1.08, -0.14);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffc94d });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat);
  eyeL.position.set(0.78, 0.85, 0.12);
  const eyeR = eyeL.clone(); eyeR.position.z = -0.12;
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.4, 4, 8), fur);
  tail.position.set(-0.65, 0.55, 0); tail.rotation.z = 0.8;
  g.add(body, head, muzzle, eL, eR, eyeL, eyeR, tail);
  return g;
}
function spawnWolf() {
  play('whoosh');
  if (!wolfWarned) { wolfWarned = true; speak('voice/wolf_warn.mp3'); }
  const a = rand() * Math.PI * 2;
  const g = makeWolf();
  g.position.set(Math.cos(a) * (ISLAND_R - 1), 0, Math.sin(a) * (ISLAND_R - 1));
  scene.add(g);
  wolves.push({ g, mode: 'hunt', cooldown: 0 });
}

const bursts = [];
function spawnBurst(pos, n = 10) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.1),
      new THREE.MeshBasicMaterial({ color: [0xff8fa3, 0xffd166, 0xc3aed6][i % 3], transparent: true }));
    m.position.copy(pos).add(new THREE.Vector3((rand() - 0.5) * 0.6, 0.8 + rand() * 0.5, (rand() - 0.5) * 0.6));
    m.userData.v = new THREE.Vector3((rand() - 0.5) * 2, 2 + rand() * 1.5, (rand() - 0.5) * 2);
    scene.add(m);
    bursts.push(m);
  }
}

// ============ СОСТОЯНИЕ ============
let gameState = 'loading'; // loading | intro | explore | dialog | minigame | celebrate

// Капельки
let dropsCount = parseInt(localStorage.getItem('wm_drops') || '0', 10);
const dropsEl = document.getElementById('drops');
const dropsNum = document.getElementById('dropsNum');
function refreshDrops(pop = false) {
  if (dropsCount > 0) dropsEl.style.display = 'flex';
  dropsNum.textContent = dropsCount;
  localStorage.setItem('wm_drops', String(dropsCount));
  if (pop) { dropsEl.classList.remove('pop'); void dropsEl.offsetWidth; dropsEl.classList.add('pop'); }
}
refreshDrops();

// ============ ПОЛИВ ДРЕВА ============
let watering = 0;
function waterTree() {
  if (dropsCount <= 0 || watering > 0) {
    if (dropsCount <= 0) play('hintGlow');
    return;
  }
  dropsCount--;
  refreshDrops(true);
  treeWaters++;
  localStorage.setItem('wm_tree_waters', String(treeWaters));
  watering = 1.4;
  pourRain();
  play('drop');
  speak('voice/tree_water.mp3');
  setTimeout(() => {
    const need = TREE_STAGE_AT[treeStage + 1];
    if (need && treeWaters >= need) {
      treeStage++;
      localStorage.setItem('wm_tree_stage', String(treeStage));
      treeStages[treeStage - 1].visible = false;
      treeStages[treeStage].visible = true;
      spawnBurst(new THREE.Vector3(TREE_POS.x, 1.5, TREE_POS.z), 22);
      play('fanfare');
      speak('voice/tree_grow.mp3');
      treeRoot.scale.setScalar(1.25);
    } else {
      treeRoot.scale.setScalar(1.12);
    }
  }, 1100);
}

// ============ АЛЬБОМ ============
let tasksDone = parseInt(localStorage.getItem('wm_tasks') || '0', 10);
const STICKERS = ['🍎', '🦔', '⭐', '🌸', '🦋', '🍏', '🌈', '🍄', '🌰', '🐞', '🌻', '🐝'];
function unlockedCount() { return Math.min(STICKERS.length, Math.floor(tasksDone / 3)); }

const albumEl = document.getElementById('album');
const albumField = document.getElementById('albumField');
const albumBtn = document.getElementById('albumBtn');
let albumPos = {};
try { albumPos = JSON.parse(localStorage.getItem('wm_album') || '{}'); } catch (e) {}

function buildAlbum() {
  albumField.innerHTML = '';
  const unlocked = unlockedCount();
  STICKERS.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'sticker' + (i < unlocked ? '' : ' locked');
    el.textContent = s;
    const col = i % 4, row = Math.floor(i / 4);
    const p = albumPos[i] || { x: 6 + col * 24, y: 6 + row * 30 };
    el.style.left = p.x + '%';
    el.style.top = p.y + '%';
    if (i < unlocked) enableStickerDrag(el, i);
    albumField.appendChild(el);
  });
}
function enableStickerDrag(el, idx) {
  let sx = 0, sy = 0, startL = 0, startT = 0, drag = false;
  el.addEventListener('pointerdown', (e) => {
    drag = true; sx = e.clientX; sy = e.clientY;
    startL = parseFloat(el.style.left); startT = parseFloat(el.style.top);
    el.setPointerCapture(e.pointerId);
    e.stopPropagation();
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const rect = albumField.getBoundingClientRect();
    let l = startL + ((e.clientX - sx) / rect.width) * 100;
    let t = startT + ((e.clientY - sy) / rect.height) * 100;
    const maxL = ((rect.width - el.offsetWidth) / rect.width) * 100;
    const maxT = ((rect.height - el.offsetHeight) / rect.height) * 100;
    l = Math.max(0, Math.min(maxL, l)); t = Math.max(0, Math.min(maxT, t));
    el.style.left = l + '%'; el.style.top = t + '%';
  });
  el.addEventListener('pointerup', () => {
    if (!drag) return;
    drag = false;
    albumPos[idx] = { x: parseFloat(el.style.left), y: parseFloat(el.style.top) };
    localStorage.setItem('wm_album', JSON.stringify(albumPos));
    play('tap');
  });
}
if (albumBtn) {
  albumBtn.addEventListener('click', () => {
    buildAlbum();
    albumEl.style.display = 'block';
    play('pop');
  });
}
document.getElementById('albumClose').addEventListener('click', () => {
  albumEl.style.display = 'none';
});
function onTaskDone() {
  tasksDone++;
  localStorage.setItem('wm_tasks', String(tasksDone));
  const before = Math.floor((tasksDone - 1) / 3), after = Math.floor(tasksDone / 3);
  if (after > before) {
    albumBtn.classList.remove('pop'); void albumBtn.offsetWidth; albumBtn.classList.add('pop');
  }
}

// ============ МИНИ-ИГРА «УРОЖАЙНЫЙ ДЕНЬ» (отдельный экран) ============
const mgEl = document.getElementById('minigame');
const mgField = document.getElementById('mgField');
const mgFinger = document.getElementById('mgFinger');
const basketEls = { red: document.getElementById('basketRed'), green: document.getElementById('basketGreen') };
const mgDom = { apples: [], done: 0, total: 6, lastAction: 0, fingerFlip: 0 };

function openMinigame() {
  gameState = 'minigame';
  mgDom.done = 0;
  mgDom.lastAction = elapsed;
  mgEl.style.display = 'flex';
  mgFinger.style.display = 'none';
  Object.values(basketEls).forEach(b => b.classList.remove('glow'));
  // ждём кадр для раскладки
  requestAnimationFrame(() => {
    const rect = mgField.getBoundingClientRect();
    // убрать старые яблоки
    for (const a of mgDom.apples) a.el.remove();
    mgDom.apples = [];
    const kinds = ['red', 'red', 'red', 'green', 'green', 'green'].sort(() => rand() - 0.5);
    kinds.forEach((color, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const el = document.createElement('div');
      el.className = 'mg-apple';
      el.textContent = color === 'red' ? '🍎' : '🍏';
      el.dataset.color = color;
      const x = Math.min(rect.width * (0.12 + col * 0.26) + rand() * 8, rect.width - 78);
      const y = Math.min(rect.height * (0.05 + row * 0.2) + rand() * 6, rect.height - 200);
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      const a = { el, color, done: false, home: { x, y } };
      el.addEventListener('pointerdown', (e) => appleDown(e, a));
      mgField.appendChild(el);
      mgDom.apples.push(a);
    });
  });
}
function closeMinigame() {
  mgEl.style.display = 'none';
  mgFinger.style.display = 'none';
}

let appleDrag = null;
function appleDown(e, a) {
  if (a.done) return;
  appleDrag = a;
  a.el.classList.add('dragging');
  a.el.setPointerCapture(e.pointerId);
  a.sx = e.clientX; a.sy = e.clientY;
  const r = mgField.getBoundingClientRect();
  a.startL = parseFloat(a.el.style.left);
  a.startT = parseFloat(a.el.style.top);
  a.fieldRect = r;
  play('pickup');
  mgDom.lastAction = elapsed;
  e.stopPropagation();

  a.move = (ev) => {
    let l = a.startL + (ev.clientX - a.sx);
    let t = a.startT + (ev.clientY - a.sy);
    l = Math.max(-10, Math.min(a.fieldRect.width - 40, l));
    t = Math.max(-10, Math.min(a.fieldRect.height - 40, t));
    a.el.style.left = l + 'px';
    a.el.style.top = t + 'px';
  };
  a.up = (ev) => {
    a.el.removeEventListener('pointermove', a.move);
    a.el.removeEventListener('pointerup', a.up);
    a.el.classList.remove('dragging');
    appleDrag = null;
    appleDrop(a);
  };
  a.el.addEventListener('pointermove', a.move);
  a.el.addEventListener('pointerup', a.up);
}
function appleDrop(a) {
  const fieldR = mgField.getBoundingClientRect();
  const ax = parseFloat(a.el.style.left) + 28, ay = parseFloat(a.el.style.top) + 28;
  let best = null, bestD = Infinity;
  for (const color of ['red', 'green']) {
    const b = basketEls[color];
    const br = { left: b.offsetLeft, top: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight };
    // корзина лежит внутри .mg-baskets (flex) внутри field → координаты offsetLeft/Top дочерних div'ов относительно .mg-baskets
    const wrap = b.parentElement.getBoundingClientRect();
    const cx = (wrap.left - fieldR.left) + br.left + br.w / 2;
    const cy = (wrap.top - fieldR.top) + br.top + br.h / 2;
    const d = Math.hypot(cx - ax, cy - ay);
    if (d < bestD) { bestD = d; best = { color, cx, cy }; }
  }
  mgDom.lastAction = elapsed;
  Object.values(basketEls).forEach(b => b.classList.remove('glow'));
  mgFinger.style.display = 'none';

  if (best && best.color === a.color && bestD < bestNear()) {
    // ВЕРНО!
    play('good');
    a.done = true;
    a.el.style.left = (best.cx - 28) + 'px';
    a.el.style.top = (best.cy - 28) + 'px';
    a.el.style.transform = 'scale(0.25)';
    a.el.style.opacity = '0.5';
    setTimeout(() => a.el.remove(), 400);
    mgDom.done++;
    if (mgDom.done >= mgDom.total) setTimeout(() => { closeMinigame(); celebrate(); }, 550);
  } else {
    // мягкий возврат «плинг»
    play('bad');
    a.el.classList.add('shake');
    setTimeout(() => {
      a.el.classList.remove('shake');
      a.el.style.left = a.home.x + 'px';
      a.el.style.top = a.home.y + 'px';
    }, 380);
  }
}
function bestNear() { return Math.min(window.innerWidth, window.innerHeight) * 0.18; }

function startDialog() {
  gameState = 'dialog';
  setBubble(bubTex.work);
  play('pop');
  speak('voice/hedge_hello.mp3');
  const dx = HEDGE_POS.x - hero.position.x, dz = HEDGE_POS.z - hero.position.z;
  hero.rotation.y = Math.atan2(dx, dz);
  setTimeout(() => { if (gameState === 'dialog') openMinigame(); }, 2400);
}

function celebrate() {
  gameState = 'celebrate';
  dropsCount++;
  refreshDrops(true);
  onTaskDone();
  play('fanfare');
  setTimeout(() => play('drop'), 450);
  setTimeout(() => speak('voice/hedge_win.mp3'), 600);
  spawnBurst(new THREE.Vector3(HEDGE_POS.x, 1.4, HEDGE_POS.z), 14);
  spawnBurst(hero.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 12);
  setBubble(bubTex.star);
  hedgeBubble.visible = true;
  setTimeout(() => {
    gameState = 'explore';
    setBubble(bubTex.apple);
  }, 2600);
}

// ============ МИНИ-ИГРА «СЧИТАЙ-КА» (Сова, отдельный экран) ============
const cgEl = document.getElementById('countgame');
const cgItems = document.getElementById('cgItems');
const cgAnswers = document.getElementById('cgAnswers');
const cgFinger = document.getElementById('cgFinger');
const cg = { round: 0, total: 2, correct: 0, lastAction: 0, answered: false, fingerShown: false };
const CG_SETS = ['🍓', '🌼', '🍄', '⭐', '🐞', '🍒'];

function startOwlDialog() {
  gameState = 'dialog';
  setOwlBubble(owlBubTex.count);
  play('pop');
  speak('voice/sova_hello.mp3');
  const dx = OWL_POS.x - hero.position.x, dz = OWL_POS.z - hero.position.z;
  hero.rotation.y = Math.atan2(dx, dz);
  setTimeout(() => { if (gameState === 'dialog') openCountGame(); }, 3000);
}

function openCountGame() {
  gameState = 'countgame';
  cg.round = 0;
  cgEl.style.display = 'flex';
  speak('voice/sova_ask.mp3'); // встанет в очередь после приветствия
  buildCountRound();
}

function closeCountGame() {
  cgEl.style.display = 'none';
  cgFinger.style.display = 'none';
}

function buildCountRound() {
  cg.round++;
  cg.answered = false;
  cg.fingerShown = false;
  cg.lastAction = elapsed;
  cgItems.innerHTML = '';
  cgAnswers.innerHTML = '';
  cgFinger.style.display = 'none';

  const n = cg.round === 1 ? 2 + Math.floor(rand() * 3) : 3 + Math.floor(rand() * 3); // 2..4, 3..5
  cg.correct = n;
  const emoji = CG_SETS[Math.floor(rand() * CG_SETS.length)];

  const W = cgItems.clientWidth, H = cgItems.clientHeight;
  const size = Math.max(44, Math.min(64, W * 0.14));
  const cols = Math.max(3, Math.floor(W / (size * 1.6)));
  const rows = 2;
  const slots = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) slots.push({ c, r });
  slots.sort(() => rand() - 0.5);
  for (let i = 0; i < n; i++) {
    const s = slots[i % slots.length];
    const el = document.createElement('div');
    el.className = 'cg-item';
    el.textContent = emoji;
    el.style.left = ((s.c + 0.5) / cols * W + (rand() - 0.5) * size * 0.5 - size / 2) + 'px';
    el.style.top = ((s.r + 0.5) / rows * H + (rand() - 0.5) * size * 0.4 - size / 2) + 'px';
    el.style.animationDelay = (i * 0.09) + 's';
    cgItems.appendChild(el);
  }

  // варианты ответов: правильный + два похожих
  const opts = new Set([n]);
  let guard = 0;
  while (opts.size < 3 && guard++ < 60) {
    opts.add(Math.max(1, Math.min(7, n - 2 + Math.floor(rand() * 5))));
  }
  [...opts].sort(() => rand() - 0.5).forEach(v => {
    const b = document.createElement('button');
    b.className = 'cg-answer';
    b.textContent = v;
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', () => answerCount(v, b));
    cgAnswers.appendChild(b);
  });
}

function answerCount(v, btn) {
  if (gameState !== 'countgame' || cg.answered) return;
  cg.lastAction = elapsed;
  cg.fingerShown = false;
  cgFinger.style.display = 'none';
  Array.from(cgAnswers.children).forEach(b => b.classList.remove('glow'));

  if (v === cg.correct) {
    cg.answered = true;
    play('good');
    btn.classList.add('right');
    Array.from(cgItems.children).forEach(it => { it.classList.remove('jump'); void it.offsetWidth; it.classList.add('jump'); });
    setTimeout(() => {
      if (cg.round >= cg.total) { closeCountGame(); celebrateOwl(); }
      else { buildCountRound(); speak('voice/sova_ask.mp3'); }
    }, 850);
  } else {
    // Zero Fail: мягкий звук и лёгкое покачивание, попыток бесконечно
    play('bad');
    btn.classList.add('shake');
    setTimeout(() => btn.classList.remove('shake'), 420);
  }
}

function celebrateOwl() {
  gameState = 'celebrate';
  dropsCount++;
  refreshDrops(true);
  onTaskDone();
  play('fanfare');
  setTimeout(() => play('drop'), 450);
  setTimeout(() => speak('voice/sova_win.mp3'), 600);
  spawnBurst(new THREE.Vector3(OWL_POS.x, 1.6, OWL_POS.z), 14);
  spawnBurst(hero.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 12);
  setOwlBubble(owlBubTex.star);
  owlBubble.visible = true;
  setTimeout(() => {
    gameState = 'explore';
    setOwlBubble(owlBubTex.count);
  }, 2600);
}

// ============ МИНИ-ИГРА «ВОЛШЕБНЫЙ МОСТИК» (Лягушка, узоры-логика) ============
const bgEl = document.getElementById('bridgegame');
const bgRow = document.getElementById('bgRow');
const bgAnswers = document.getElementById('bgAnswers');
const bgFinger = document.getElementById('bgFinger');
const bg = { round: 0, total: 2, answer: '', lastAction: 0, answered: false, fingerShown: false };
const BG_POOL = ['🍄', '🌼', '⭐', '🐞', '🍀', '🍇'];

function startFrogDialog() {
  gameState = 'dialog';
  setFrogBubble(frogBubTex.puzzle);
  play('pop');
  speak('voice/frog_hello.mp3');
  const dx = FROG_POS.x - hero.position.x, dz = FROG_POS.z - hero.position.z;
  hero.rotation.y = Math.atan2(dx, dz);
  setTimeout(() => { if (gameState === 'dialog') openBridgeGame(); }, 3200);
}

function openBridgeGame() {
  gameState = 'bridgegame';
  bg.round = 0;
  bgEl.style.display = 'flex';
  speak('voice/frog_ask.mp3');
  buildBridgeRound();
}
function closeBridgeGame() {
  bgEl.style.display = 'none';
  bgFinger.style.display = 'none';
}

function buildBridgeRound() {
  bg.round++;
  bg.answered = false;
  bg.fingerShown = false;
  bg.lastAction = elapsed;
  bgRow.innerHTML = '';
  bgAnswers.innerHTML = '';
  bgFinger.style.display = 'none';

  // три разных картинки для узора
  const picks = [];
  const pool = [...BG_POOL];
  while (picks.length < 3) picks.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  const [A, B, C] = picks;

  // шаблоны узоров: [показанные..., правильный следующий]
  let shown, answer;
  if (bg.round === 1) { shown = [A, B, A, B]; answer = A; } // А-Б-А-Б-?
  else {
    const t = Math.floor(rand() * 3);
    if (t === 0) { shown = [A, A, B, A, A]; answer = B; }      // А-А-Б-А-А-?
    else if (t === 1) { shown = [A, B, B, A, B]; answer = B; } // А-Б-Б-А-Б-?
    else { shown = [A, B, C, A, B]; answer = C; }              // А-Б-В-А-Б-?
  }
  bg.answer = answer;

  shown.forEach((e, i) => {
    const cell = document.createElement('div');
    cell.className = 'bg-item';
    cell.textContent = e;
    cell.style.animationDelay = (i * 0.08) + 's';
    bgRow.appendChild(cell);
  });
  const gap = document.createElement('div');
  gap.className = 'bg-item gap';
  gap.textContent = '❓';
  gap.style.animationDelay = (shown.length * 0.08) + 's';
  bgRow.appendChild(gap);

  // варианты: правильный + 2 «похожих»
  const opts = [answer, ...picks.filter(p => p !== answer)].slice(0, 3);
  opts.sort(() => rand() - 0.5).forEach(v => {
    const b = document.createElement('button');
    b.className = 'cg-answer bg-answer';
    b.textContent = v;
    b.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    b.addEventListener('click', () => answerBridge(v, b));
    bgAnswers.appendChild(b);
  });
}

function answerBridge(v, btn) {
  if (gameState !== 'bridgegame' || bg.answered) return;
  bg.lastAction = elapsed;
  bg.fingerShown = false;
  bgFinger.style.display = 'none';
  Array.from(bgAnswers.children).forEach(b => b.classList.remove('glow'));
  if (v === bg.answer) {
    bg.answered = true;
    play('good');
    btn.classList.add('right');
    const gap = bgRow.querySelector('.gap');
    if (gap) { gap.classList.remove('gap'); gap.textContent = v; gap.classList.add('jump'); }
    setTimeout(() => {
      if (bg.round >= bg.total) { closeBridgeGame(); celebrateFrog(); }
      else { buildBridgeRound(); }
    }, 900);
  } else {
    play('bad');
    btn.classList.add('shake');
    setTimeout(() => btn.classList.remove('shake'), 420);
  }
}

function celebrateFrog() {
  gameState = 'celebrate';
  dropsCount++;
  refreshDrops(true);
  onTaskDone();
  play('fanfare');
  setTimeout(() => play('drop'), 450);
  setTimeout(() => speak('voice/frog_win.mp3'), 600);
  spawnBurst(new THREE.Vector3(FROG_POS.x, 1.4, FROG_POS.z), 14);
  spawnBurst(hero.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 12);
  setFrogBubble(frogBubTex.star);
  frogBubble.visible = true;
  setTimeout(() => {
    gameState = 'explore';
    setFrogBubble(frogBubTex.puzzle);
  }, 2600);
}

// ============ НАВИГАЦИЯ A* ============
const NAV_N = 64, NAV_MIN = -16, NAV_CELL = 0.5;
const navBlocked = new Uint8Array(NAV_N * NAV_N);
function cellOf(x, z) {
  return {
    i: Math.max(0, Math.min(NAV_N - 1, Math.round((x - NAV_MIN) / NAV_CELL))),
    j: Math.max(0, Math.min(NAV_N - 1, Math.round((z - NAV_MIN) / NAV_CELL))),
  };
}
function worldOf(i, j) { return { x: NAV_MIN + i * NAV_CELL, z: NAV_MIN + j * NAV_CELL }; }
function buildNavGrid() {
  navBlocked.fill(0);
  for (let i = 0; i < NAV_N; i++) for (let j = 0; j < NAV_N; j++) {
    const { x, z } = worldOf(i, j);
    if (Math.hypot(x, z) > ISLAND_R - 0.7) { navBlocked[j * NAV_N + i] = 1; continue; }
    for (const ob of obstacles) {
      if (Math.hypot(x - ob.x, z - ob.z) < ob.r + 0.75) { navBlocked[j * NAV_N + i] = 1; break; }
    }
  }
}
function nearestFree(i, j) {
  if (!navBlocked[j * NAV_N + i]) return { i, j };
  for (let r = 1; r < 10; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
    const ni = i + di, nj = j + dj;
    if (ni < 0 || nj < 0 || ni >= NAV_N || nj >= NAV_N) continue;
    if (!navBlocked[nj * NAV_N + ni]) return { i: ni, j: nj };
  }
  return { i, j };
}
function findPath(sx, sz, tx, tz) {
  let s = cellOf(sx, sz), t = cellOf(tx, tz);
  s = nearestFree(s.i, s.j); t = nearestFree(t.i, t.j);
  const gScore = new Float32Array(NAV_N * NAV_N).fill(Infinity);
  const came = new Int32Array(NAV_N * NAV_N).fill(-1);
  const closed = new Uint8Array(NAV_N * NAV_N);
  const startI = s.j * NAV_N + s.i, targI = t.j * NAV_N + t.i;
  gScore[startI] = 0;
  const heap = [[0, startI]];
  const pop = () => {
    let bi = 0;
    for (let k = 1; k < heap.length; k++) if (heap[k][0] < heap[bi][0]) bi = k;
    return heap.splice(bi, 1)[0];
  };
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (heap.length) {
    const [, cur] = pop();
    if (cur === targI) {
      const path = [];
      let c = cur;
      while (c >= 0) { path.push({ i: c % NAV_N, j: Math.floor(c / NAV_N) }); c = came[c]; }
      path.reverse();
      return smoothPath(path.map(p => worldOf(p.i, p.j)));
    }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const ci = cur % NAV_N, cj = Math.floor(cur / NAV_N);
    for (const [di, dj, w] of DIRS) {
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= NAV_N || nj >= NAV_N) continue;
      const nidx = nj * NAV_N + ni;
      if (navBlocked[nidx] || closed[nidx]) continue;
      if (di !== 0 && dj !== 0 && (navBlocked[cj * NAV_N + ni] || navBlocked[nj * NAV_N + ci])) continue;
      const ng = gScore[cur] + w;
      if (ng < gScore[nidx]) {
        gScore[nidx] = ng; came[nidx] = cur;
        heap.push([ng + Math.hypot(ni - t.i, nj - t.j), nidx]);
      }
    }
  }
  return null;
}
function lineFree(a, b) {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.ceil(d / 0.2);
  for (let k = 0; k <= steps; k++) {
    const x = a.x + (b.x - a.x) * (k / steps), z = a.z + (b.z - a.z) * (k / steps);
    const c = cellOf(x, z);
    if (navBlocked[c.j * NAV_N + c.i]) return false;
  }
  return true;
}
function smoothPath(pts) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !lineFree(pts[i], pts[j])) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

// ============ УПРАВЛЕНИЕ ============
const marker = new THREE.Mesh(
  new THREE.RingGeometry(0.35, 0.55, 32),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide })
);
marker.rotation.x = -Math.PI / 2;
scene.add(marker);
let markerLife = 0;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let path = null;
let pendingHedge = false;
let pendingTree = false;
let pendingOwl = false;
let pendingFrog = false;
let pendingHouse = false;
let finalTarget = null;
let repathCount = 0;
let noProgT = 0, lastFinalDist = Infinity;
const SPEED = 4;
let elapsed = 0;
let tickling = 0;
let tickleCooldown = 0;

function castAt(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster;
}
function givePath(x, z) {
  let p = findPath(hero.position.x, hero.position.z, x, z);
  if (!p) p = [{ x, z }];
  path = p;
  finalTarget = { x, z };
  repathCount = 0;
  noProgT = 0; lastFinalDist = Infinity;
}
function tapGround(clientX, clientY) {
  if (hiding) return;
  const hit = new THREE.Vector3();
  const rc = castAt(clientX, clientY);
  if (rc.ray.intersectPlane(groundPlane, hit)) {
    if (Math.hypot(hit.x, hit.z) > ISLAND_R - 1) return;
    givePath(hit.x, hit.z);
    const last = path[path.length - 1];
    marker.position.set(last.x, 0.06, last.z);
    markerLife = 1;
    play('tap');
    hideHint();
  }
}

let downX = 0, downY = 0, downT = 0;
window.addEventListener('pointerdown', (e) => {
  initAudio();
  downX = e.clientX; downY = e.clientY; downT = performance.now();
});
window.addEventListener('pointerup', (e) => {
  const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
  const dt = performance.now() - downT;
  if (!hero) return;
  // пропуск вступления
  if (gameState === 'intro') { finishIntro(); return; }
  if (moved >= 24 || dt >= 500 || tickling > 0) return;
  if (gameState !== 'explore') return;
  if (albumEl.style.display === 'block') return;
  const rc = castAt(e.clientX, e.clientY);
  // спрятавшийся герой реагирует только на домик (там спит)
  if (hiding) {
    if (rc.intersectObject(house, true).length) exitHouse();
    return;
  }
  // тап по ёжику
  const hits = rc.intersectObject(hedgehog, true);
  if (hits.length) {
    const dx = HEDGE_POS.x - hero.position.x, dz = HEDGE_POS.z - hero.position.z;
    if (Math.hypot(dx, dz) < 3.0) startDialog();
    else { pendingHedge = true; givePath(HEDGE_POS.x + 1.6, HEDGE_POS.z - 1.2); }
    return;
  }
  // тап по Сове
  const owlHits = rc.intersectObject(owl, true);
  if (owlHits.length) {
    const dx = OWL_POS.x - hero.position.x, dz = OWL_POS.z - hero.position.z;
    if (Math.hypot(dx, dz) < 3.2) startOwlDialog();
    else { pendingOwl = true; givePath(OWL_POS.x + 1.5, OWL_POS.z - 1.4); }
    return;
  }
  // тап по Лягушке
  const frogHits = rc.intersectObject(frog, true);
  if (frogHits.length) {
    const dx = FROG_POS.x - hero.position.x, dz = FROG_POS.z - hero.position.z;
    if (Math.hypot(dx, dz) < 3.2) startFrogDialog();
    else { pendingFrog = true; givePath(FROG_POS.x - 1.6, FROG_POS.z - 1.3); }
    return;
  }
  // тап по Древу Желаний
  const treeHits = rc.intersectObject(treeRoot, true);
  if (treeHits.length) {
    const dx = TREE_POS.x - hero.position.x, dz = TREE_POS.z - hero.position.z;
    if (Math.hypot(dx, dz) < 3.0) waterTree();
    else { pendingTree = true; givePath(TREE_POS.x - 1.4, TREE_POS.z - 1.1); }
    return;
  }
  // тап по домику — войти/переждать ночь
  if (rc.intersectObject(house, true).length) {
    pendingHouse = true;
    givePath(HOUSE_DOOR.x, HOUSE_DOOR.z);
    return;
  }
  tapGround(e.clientX, e.clientY);
});
let hintHidden = false;
function hideHint() {
  if (hintHidden) return;
  hintHidden = true;
  const el = document.getElementById('hint');
  if (el) el.style.opacity = '0';
}

// ============ ДЕНЬ/НОЧЬ ============
const DAY_LEN = 300;
let dayT = 0;
const skyDay = new THREE.Color(0xaee3f5), skyNight = new THREE.Color(0x1c2b4d);
const sunDay = new THREE.Color(0xfff2d0), sunNight = new THREE.Color(0x8fb4ff);
const tmpColor = new THREE.Color();
let nightness = 0;
function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

// ============ ЗАСТАВКА / ВЫБОР / ВСТУПЛЕНИЕ ============
const splashEl = document.getElementById('splash');
const selectEl = document.getElementById('select');
const muteBtn = document.getElementById('muteBtn');
if (muteBtn) {
  muteBtn.textContent = isMuted() ? '🔇' : '🔊';
  muteBtn.addEventListener('click', () => {
    initAudio();
    muteBtn.textContent = toggleMute() ? '🔇' : '🔊';
  });
}
setTimeout(() => {
  splashEl.classList.add('fade-out');
  setTimeout(() => { splashEl.style.display = 'none'; selectEl.style.display = 'flex'; }, 900);
}, 2600);

// Пауза: весь мир замирает (волки не щекочут), звук глушится
const pauseOv = document.getElementById('pauseOv');
let paused = false;
const pauseBtn = document.getElementById('pauseBtn');
if (pauseBtn) {
  pauseBtn.addEventListener('click', () => {
    initAudio();
    paused = true;
    pauseOv.style.display = 'flex';
    setGamePaused(true);
  });
}
document.getElementById('pauseResume').addEventListener('click', () => {
  paused = false;
  pauseOv.style.display = 'none';
  setGamePaused(false);
  play('pop');
});
document.querySelectorAll('.char').forEach(btn => {
  btn.addEventListener('click', () => {
    selectEl.classList.add('fade-out');
    setTimeout(() => selectEl.style.display = 'none', 500);
    spawnHero(btn.dataset.char);
    startIntro();
  });
});

function spawnHero(type) {
  hero = makeChar(type);
  hero.position.set(1, 0, 2);
  hero.add(blob);
  scene.add(hero);
  charData = hero.userData;
  spawnPop = 1;
}

// Вступительный облёт с рассказом
let introIdx = 0, introT = 0;
const introSteps = [];
function startIntro() {
  gameState = 'intro';
  introSteps.length = 0;
  introSteps.push(
    { pos: new THREE.Vector3(1, 17, 16), look: new THREE.Vector3(0, 0, 2), dur: 5 },
    { pos: new THREE.Vector3(HEDGE_POS.x + 1, 4.5, HEDGE_POS.z + 6.5), look: new THREE.Vector3(HEDGE_POS.x, 0.8, HEDGE_POS.z), dur: 6 },
    { pos: new THREE.Vector3(TREE_POS.x + 0.5, 3.6, TREE_POS.z + 5.2), look: new THREE.Vector3(TREE_POS.x, 1, TREE_POS.z), dur: 7 },
    { pos: new THREE.Vector3(OWL_POS.x + 2.2, 4.2, OWL_POS.z + 4.6), look: new THREE.Vector3(OWL_POS.x, 1.3, OWL_POS.z), dur: 4.5 },
    { pos: new THREE.Vector3(10.2, 4.8, 8.4), look: new THREE.Vector3(10.6, 0.5, 2.8), dur: 4.5 },
  );
  introIdx = 0; introT = 0;
  hedgeBubble.visible = true;
  treeBubble.visible = true;
  play('pop');
  speak('voice/intro.mp3');
}
function finishIntro() {
  if (gameState !== 'intro') return;
  gameState = 'explore';
  stopVoice();
  const hint = document.getElementById('hint');
  if (hint) hint.style.opacity = '1';
}

// ============ ЦИКЛ ============
buildNavGrid();
const camOffsetBase = new THREE.Vector3(0, 14, 11.5);
const camOffset = camOffsetBase.clone();
const lookTarget = new THREE.Vector3(1, 0, 2);
camera.position.set(1 + camOffset.x, camOffset.y, 2 + camOffset.z);
camera.lookAt(lookTarget);
let blinkT = 2.5, squashT = 0;

function applyCamFraming() {
  const a = window.innerWidth / window.innerHeight;
  const k = a < 1.6 ? Math.min(1.6 / a, 1.6) : 1;
  camOffset.copy(camOffsetBase).multiplyScalar(k);
  camera.fov = 46 + (k - 1) * 16;
  camera.updateProjectionMatrix();
}
applyCamFraming();

const rotateEl = document.getElementById('rotate');
function checkRotate() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  rotateEl.style.display = (coarse && window.innerHeight > window.innerWidth) ? 'flex' : 'none';
}
checkRotate();

function animate() {
  requestAnimationFrame(animate);
  if (paused) { renderer.render(scene, camera); return; }
  const dt = 1 / 60;
  elapsed += dt;

  // --- ДЕНЬ/НОЧЬ (во сне в домике ночь пролетает быстро) ---
  dayT = (dayT + (dt * (hiding ? 22 : 1)) / DAY_LEN) % 1;
  nightness = smoothstep(0.36, 0.5, dayT) - smoothstep(0.86, 1.0, dayT);
  setNight(nightness);
  tmpColor.copy(skyDay).lerp(skyNight, nightness);
  scene.background.copy(tmpColor);
  scene.fog.color.copy(tmpColor);
  sun.intensity = 1.35 - nightness * 1.1;
  sun.color.copy(sunDay).lerp(sunNight, nightness);
  hemi.intensity = 0.95 - nightness * 0.55;
  starMat.opacity = nightness;
  moon.material.opacity = nightness * 0.9;
  ffMat.opacity = nightness;
  pollenMat.opacity = 0.7 * (1 - nightness);
  winMat.color.setHex(nightness > 0.4 ? 0xffe9a3 : 0xfff7cc);
  // утро — будим героя
  if (hiding && sleptNight && nightness <= 0.03) exitHouse();

  // --- ГЕРОЙ ---
  if (hero) {
    if (spawnPop > 0) {
      spawnPop -= dt * 1.6;
      const k = Math.max(spawnPop, 0);
      charData.bodyG.scale.y = 1 + Math.sin(k * Math.PI) * 0.3;
      charData.bodyG.scale.x = charData.bodyG.scale.z = 1 - Math.sin(k * Math.PI) * 0.15;
    }

    if (tickling > 0) {
      tickling -= dt;
      hero.rotation.z = Math.sin(elapsed * 14) * 0.35;
      hero.position.y = Math.abs(Math.sin(elapsed * 10)) * 0.1;
      laughBubble.visible = true;
      laughBubble.position.set(hero.position.x, 2.1, hero.position.z);
      if (tickling <= 0) { hero.rotation.z = 0; tickleCooldown = 6; laughBubble.visible = false; }
    } else if (gameState !== 'intro' && path && path.length) {
      const LOOKAHEAD = 0.9;
      let steer = path[path.length - 1];
      while (path.length && Math.hypot(path[0].x - hero.position.x, path[0].z - hero.position.z) < 0.25) path.shift();
      for (const p of path) {
        if (Math.hypot(p.x - hero.position.x, p.z - hero.position.z) > LOOKAHEAD) { steer = p; break; }
        steer = p;
      }
      let dx = steer.x - hero.position.x, dz = steer.z - hero.position.z;
      const d = Math.hypot(dx, dz);
      // --- анти-залипание: нет прогресса 0.8 сек → считаем, что дошли ---
      const finalPt = path[path.length - 1];
      const finalDist = Math.hypot(finalPt.x - hero.position.x, finalPt.z - hero.position.z);
      if (lastFinalDist === Infinity || finalDist < lastFinalDist - 0.004) {
        lastFinalDist = finalDist; noProgT = 0;
      } else {
        noProgT += dt;
      }
      const stuckFinish = noProgT > 0.7;
      const arrived = !path.length || (path.length === 1 && finalDist < 0.45);
      if (stuckFinish && !arrived && repathCount < 2 && finalTarget) {
        // застряли у препятствия → не сдаёмся, а строим маршрут заново отсюда
        repathCount++;
        noProgT = 0; lastFinalDist = Infinity;
        const np = findPath(hero.position.x, hero.position.z, finalTarget.x, finalTarget.z);
        if (np) path = np; else { path = null; finalTarget = null; squashT = 1; }
      } else if (stuckFinish || arrived) {
        path = null;
        finalTarget = null;
        squashT = 1;
      } else if (d > 0.001) {
        dx /= d; dz /= d;
        hero.position.x += dx * SPEED * dt;
        hero.position.z += dz * SPEED * dt;
        resolveCollision(hero.position);
        const wantYaw = Math.atan2(dx, dz);
        let dy = wantYaw - hero.rotation.y;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        hero.rotation.y += dy * 0.16;
        const hop = Math.abs(Math.sin(elapsed * 10)) * 0.14;
        hero.position.y = hop;
        charData.bodyG.rotation.x = 0.1 + hop * 0.15;
        charData.ears.forEach(e => e.rotation.x = -hop * 0.9);
        if (charData.inners) charData.inners.forEach(e => e.rotation.x = -hop * 0.9);
      }
    } else {
      hero.position.y += (0 - hero.position.y) * 0.25;
      charData.bodyG.rotation.x += (0 - charData.bodyG.rotation.x) * 0.15;
      charData.ears.forEach(e => e.rotation.x = Math.sin(elapsed * 2) * 0.05);
      if (charData.inners) charData.inners.forEach(e => e.rotation.x = Math.sin(elapsed * 2) * 0.05);
      if (squashT <= 0 && spawnPop <= 0) {
        charData.bodyG.scale.y = 1 + Math.sin(elapsed * 2.6) * 0.012;
        charData.bodyG.scale.x = charData.bodyG.scale.z = 1 - Math.sin(elapsed * 2.6) * 0.006;
      }
    }

    if (!path && (pendingHedge || pendingTree || pendingOwl || pendingFrog || pendingHouse)) {
      if (pendingHedge) {
        pendingHedge = false;
        const d = Math.hypot(HEDGE_POS.x - hero.position.x, HEDGE_POS.z - hero.position.z);
        if (d < 3.4) startDialog();
      }
      if (pendingTree) {
        pendingTree = false;
        const d = Math.hypot(TREE_POS.x - hero.position.x, TREE_POS.z - hero.position.z);
        if (d < 3.2) waterTree();
      }
      if (pendingOwl) {
        pendingOwl = false;
        const d = Math.hypot(OWL_POS.x - hero.position.x, OWL_POS.z - hero.position.z);
        if (d < 3.6) startOwlDialog();
      }
      if (pendingFrog) {
        pendingFrog = false;
        const d = Math.hypot(FROG_POS.x - hero.position.x, FROG_POS.z - hero.position.z);
        if (d < 4.2) startFrogDialog();
      }
      if (pendingHouse) {
        pendingHouse = false;
        const d = Math.hypot(HOUSE_DOOR.x - hero.position.x, HOUSE_DOOR.z - hero.position.z);
        if (d < 2.8) enterHouse();
      }
    }

    if (squashT > 0) {
      squashT -= dt * 3;
      const k = Math.max(squashT, 0);
      charData.bodyG.scale.y = 1 - Math.sin(k * Math.PI) * 0.12;
      charData.bodyG.scale.x = charData.bodyG.scale.z = 1 + Math.sin(k * Math.PI) * 0.08;
    }

    blinkT -= dt;
    if (blinkT < 0) blinkT = 2 + Math.random() * 3;
    const blink = blinkT < 0.12 ? 0.15 : 1;
    charData.eyes[0].scale.y += (blink - charData.eyes[0].scale.y) * 0.6;
    charData.eyes[1].scale.y = charData.eyes[0].scale.y;
    charData.glints.forEach(g => g.visible = blink > 0.5);

    // --- ВОЛКИ ---
    if (nightness > 0.7 && wolves.length < 2 && tickling <= 0 && gameState === 'explore' && !hiding && Math.random() < dt * 0.15) spawnWolf();
    if (tickleCooldown > 0) tickleCooldown -= dt;
    for (let wi = wolves.length - 1; wi >= 0; wi--) {
      const w = wolves[wi];
      if (nightness < 0.5) {
        const d = Math.hypot(w.g.position.x, w.g.position.z);
        const ex = w.g.position.x / d, ez = w.g.position.z / d;
        w.g.position.x += ex * 2.5 * dt; w.g.position.z += ez * 2.5 * dt;
        w.g.rotation.y = Math.atan2(ex, ez) - Math.PI / 2;
        if (d > ISLAND_R + 2) { scene.remove(w.g); wolves.splice(wi, 1); }
        continue;
      }
      if (w.mode === 'hunt' && tickling <= 0 && gameState === 'explore' && !hiding) {
        const dx = hero.position.x - w.g.position.x, dz = hero.position.z - w.g.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.95 && tickleCooldown <= 0) {
          tickling = 2.6;
          w.mode = 'flee'; w.cooldown = 18;
          play('tickle');
          spawnBurst(hero.position);
        } else if (d > 0.9) {
          const sp = 2.6 * dt;
          w.g.position.x += (dx / d) * sp; w.g.position.z += (dz / d) * sp;
          resolveCollision(w.g.position);
          w.g.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;
          w.g.position.y = Math.abs(Math.sin(elapsed * 8)) * 0.08;
        } else {
          w.g.position.y = 0;
        }
      } else {
        w.cooldown -= dt;
        w.g.position.y = 0;
        // убегая, волк действительно уходит к краю острова
        const d = Math.hypot(w.g.position.x, w.g.position.z);
        if (d > 0.001 && d < ISLAND_R + 1.5) {
          const ex = w.g.position.x / d, ez = w.g.position.z / d;
          w.g.position.x += ex * 3 * dt;
          w.g.position.z += ez * 3 * dt;
          w.g.rotation.y = Math.atan2(ex, ez) - Math.PI / 2;
        }
        if (w.cooldown <= 0 && !hiding) w.mode = 'hunt';
      }
    }
  }

  // --- ЁЖИК / СОВА / ЛЯГУШКА ---
  if (hero && (gameState === 'explore' || gameState === 'intro')) {
    hedgehog.position.y = Math.abs(Math.sin(elapsed * 3)) * 0.06;
    hedgeBubble.position.y = 2.1 + Math.sin(elapsed * 2.2) * 0.08;
    owl.userData.bird.rotation.z = Math.sin(elapsed * 1.6) * 0.05;
    owl.userData.bird.position.y = 0.55 + Math.abs(Math.sin(elapsed * 2.4)) * 0.03;
    owlBubble.position.y = 2.5 + Math.sin(elapsed * 2.2) * 0.08;
    const fhop = Math.abs(Math.sin(elapsed * 2.6));
    frog.userData.body.position.y = fhop * 0.1;
    frog.userData.body.scale.y = 0.92 + fhop * 0.08;
    frogBubble.position.y = 2.2 + Math.sin(elapsed * 2.2) * 0.08;
  }

  // --- ДРЕВО ---
  treeRoot.scale.lerp(new THREE.Vector3(1, 1, 1), 0.06);
  treeRoot.rotation.z = Math.sin(elapsed * 1.4) * 0.015;
  if (watering > 0) watering -= dt;
  for (let i = waterDrops.length - 1; i >= 0; i--) {
    const d = waterDrops[i];
    d.position.y -= d.userData.v * dt;
    if (d.position.y < 0.15) { scene.remove(d); waterDrops.splice(i, 1); }
  }
  updateTreeBubble();

  // --- ВСТУПЛЕНИЕ: ключевые кадры камеры ---
  if (gameState === 'intro' && introSteps.length) {
    introT += dt;
    const st = introSteps[Math.min(introIdx, introSteps.length - 1)];
    camera.position.lerp(st.pos, 0.028);
    lookTarget.lerp(st.look, 0.035);
    if (introT > st.dur) {
      introIdx++;
      introT = 0;
      if (introIdx >= introSteps.length) finishIntro();
    }
  }

  // --- ПОДСКАЗКИ В МИНИ-ИГРЕ (DOM) ---
  if (gameState === 'minigame') {
    const idle = elapsed - mgDom.lastAction;
    const remain = mgDom.apples.filter(a => !a.done && a !== appleDrag);
    if (remain.length) {
      const need = basketEls[remain[0].color];
      if (idle > 6) need.classList.add('glow');
      if (idle > 12 && !appleDrag) {
        mgFinger.style.display = 'block';
        mgDom.fingerFlip = Math.sin(elapsed * 1.4) > 0 ? 0 : 1;
        const from = remain[0].el.getBoundingClientRect();
        const to = need.getBoundingClientRect();
        const fx = mgDom.fingerFlip ? to.left + to.width * 0.5 : from.left + from.width * 0.5;
        const fy = mgDom.fingerFlip ? to.top : from.top - 14;
        mgFinger.style.left = fx + 'px';
        mgFinger.style.top = fy + 'px';
      }
    }
  }

  // --- ПОДСКАЗКИ В ИГРЕ «СЧИТАЙ-КА» ---
  if (gameState === 'countgame' && !cg.answered) {
    const idle = elapsed - cg.lastAction;
    const rightBtn = Array.from(cgAnswers.children).find(b => parseInt(b.textContent, 10) === cg.correct);
    if (rightBtn && idle > 6) rightBtn.classList.add('glow');
    if (rightBtn && idle > 12 && !cg.fingerShown) {
      cg.fingerShown = true;
      const r = rightBtn.getBoundingClientRect();
      cgFinger.style.left = (r.left + r.width * 0.18) + 'px';
      cgFinger.style.top = (r.top - r.height * 0.55) + 'px';
      cgFinger.style.display = 'block';
    }
  }

  // --- ПОДСКАЗКИ В ИГРЕ «ВОЛШЕБНЫЙ МОСТИК» ---
  if (gameState === 'bridgegame' && !bg.answered) {
    const idle = elapsed - bg.lastAction;
    const rightBtn = Array.from(bgAnswers.children).find(b => b.dataset.e === bg.answer);
    if (rightBtn && idle > 6) rightBtn.classList.add('glow');
    if (rightBtn && idle > 12 && !bg.fingerShown) {
      bg.fingerShown = true;
      const r = rightBtn.getBoundingClientRect();
      bgFinger.style.left = (r.left + r.width * 0.18) + 'px';
      bgFinger.style.top = (r.top - r.height * 0.55) + 'px';
      bgFinger.style.display = 'block';
    }
  }

  for (const s of swayList) s.obj.rotation.z = Math.sin(elapsed * s.speed + s.obj.position.x) * s.amp;

  const anchor = hero ? hero.position : lookTarget;
  const rayCam = new THREE.Vector3().subVectors(anchor, camera.position);
  const rayLen = rayCam.length(); rayCam.normalize();
  for (const c of clouds) {
    c.g.position.x += c.speed * dt;
    if (c.g.position.x > 26) c.g.position.x = -26;
    const toC = new THREE.Vector3().subVectors(c.g.position, camera.position);
    const proj = toC.dot(rayCam);
    let targetOpacity = 0.55 + 0.45 * (1 - nightness);
    if (proj > 0 && proj < rayLen) {
      const perp = Math.sqrt(Math.max(toC.lengthSq() - proj * proj, 0));
      if (perp < c.radius + 0.8) targetOpacity = 0.3;
    }
    c.mat.opacity += (targetOpacity - c.mat.opacity) * 0.06;
  }

  for (const s of smokes) {
    s.userData.t += dt * 0.22;
    if (s.userData.t > 1) s.userData.t = 0;
    const t = s.userData.t;
    s.position.set(-6.15 + Math.sin(t * 9 + t * 3) * 0.25, 3.6 + t * 2.2, -6.9 + Math.cos(t * 7) * 0.15);
    s.scale.setScalar(0.6 + t * 1.6);
    s.material.opacity = 0.45 * (1 - t) * (1 - nightness * 0.4);
  }

  for (const b of birds) {
    b.off += dt * 0.6 * (1 - nightness);
    b.g.visible = nightness < 0.6;
    const x = ((b.off * 2.2) % 60) - 30;
    b.g.position.set(x, b.y + Math.sin(b.off) * 0.6, -18 + Math.cos(b.off * 0.5) * 4);
    b.g.rotation.y = Math.PI / 2;
    const flap = Math.sin(b.off * 6) * 0.55;
    b.g.children[0].rotation.z = 0.4 + flap;
    b.g.children[1].rotation.z = -0.4 - flap;
  }

  for (const b of butterflies) {
    b.t += dt;
    b.g.visible = nightness < 0.7;
    const wantX = b.cx + Math.cos(b.t * 0.7) * 1.1;
    const wantZ = b.cz + Math.sin(b.t * 0.7) * 1.1;
    let ax = 0, az = 0;
    for (const ob of obstacles) {
      const ox = wantX - ob.x, oz = wantZ - ob.z;
      const d = Math.hypot(ox, oz);
      if (d < ob.r + 0.5 && d > 0.001) {
        ax += (ox / d) * (ob.r + 0.5 - d) * 2;
        az += (oz / d) * (ob.r + 0.5 - d) * 2;
      }
    }
    b.g.position.set(wantX + ax, 1 + Math.sin(b.t * 2.1) * 0.25, wantZ + az);
    const flap = Math.sin(b.t * 18) * 0.9;
    b.wL.rotation.y = flap * 0.7; b.wR.rotation.y = -flap * 0.7;
  }

  if (nightness > 0.05) {
    const pos = ffGeo.attributes.position.array;
    for (let i = 0; i < FF; i++) {
      const b = ffBase[i];
      pos[i * 3] = b.x + Math.sin(elapsed * 0.9 + b.ph) * 0.8;
      pos[i * 3 + 1] = b.y + Math.sin(elapsed * 1.4 + b.ph * 2) * 0.4;
      pos[i * 3 + 2] = b.z + Math.cos(elapsed * 0.8 + b.ph) * 0.8;
    }
    ffGeo.attributes.position.needsUpdate = true;
    ffMat.opacity = nightness * (0.7 + Math.sin(elapsed * 3) * 0.3);
  }

  pollen.rotation.y = elapsed * 0.02;
  pollen.position.y = Math.sin(elapsed * 0.5) * 0.15;
  pond.scale.setScalar(1 + Math.sin(elapsed * 1.6) * 0.012);

  for (let i = bursts.length - 1; i >= 0; i--) {
    const m = bursts[i];
    m.position.addScaledVector(m.userData.v, dt);
    m.userData.v.y -= 4 * dt;
    m.rotation.x += dt * 4; m.rotation.y += dt * 3;
    m.material.opacity -= dt * 0.7;
    if (m.material.opacity <= 0.05 || m.position.y < 0) { scene.remove(m); bursts.splice(i, 1); }
  }

  if (markerLife > 0) {
    markerLife -= 0.025;
    marker.material.opacity = Math.max(markerLife, 0) * 0.9;
    marker.scale.setScalar(1 + (1 - Math.max(markerLife, 0)) * 0.8);
  }

  // --- КАМЕРА (в обычном режиме следует; в интро — по ключевым кадрам выше) ---
  if (hero && gameState !== 'intro') {
    const wanted = new THREE.Vector3().copy(hero.position).add(camOffset);
    camera.position.lerp(wanted, 0.06);
    lookTarget.lerp(hero.position, 0.08);
    sun.position.set(anchor.x + 12, 20, anchor.z + 9);
    sun.target.position.copy(anchor);
  }
  camera.lookAt(lookTarget);

  renderer.render(scene, camera);
}
animate();

function resolveCollision(pos) {
  for (const ob of obstacles) {
    const dx = pos.x - ob.x, dz = pos.z - ob.z;
    const d = Math.hypot(dx, dz);
    const minD = ob.r + 0.5;
    if (d < minD && d > 0.0001) {
      pos.x = ob.x + (dx / d) * minD;
      pos.z = ob.z + (dz / d) * minD;
    }
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  applyCamFraming();
  checkRotate();
});

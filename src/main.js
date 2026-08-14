import * as THREE from 'three';

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
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 250);
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

// ============ РАСТИТЕЛЬНОСТЬ ============
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
  obstacles.push({ x, z, r: 0.55 * s, h: 2.6 * s });
}
const treeSpots = [
  [-6, -9, 1.1, 0x6cbf6f], [8.5, -7, 0.9, 0x5cb85c], [-10.5, -3.5, 1.25, 0x8fd07a],
  [-8.5, 6.5, 1.0, 0x6cbf6f], [11.5, 2.5, 0.85, 0x5cb85c], [1.5, 10.5, 1.0, 0x8fd07a],
  [12, -3, 1.05, 0x6cbf6f], [-3, 11, 0.8, 0x5cb85c], [-12.5, 0.5, 0.9, 0x8fd07a], [7.5, 9.5, 1.15, 0x6cbf6f],
];
treeSpots.forEach(([x, z, s, c]) => makeTree(x, z, s, c));

for (const [x, z, r] of [[-3.5, 6, 0.8], [9.5, 0.5, 0.7], [-9, -2, 0.9], [5.5, 7, 0.6], [2, -6, 0.75], [-5, 1.5, 0.65], [12.5, 5, 0.8]]) {
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
let seed = 42;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
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
const HOUSE_POS = { x: -7, z: -6.5 };

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

// ============ НЕБО: ОБЛАКА / ПТИЦЫ / ЗВЁЗДЫ / ЛУНА ============
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

// Звёзды
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

// Луна
const moon = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 24),
  new THREE.MeshLambertMaterial({ color: 0xf4f1de, transparent: true, opacity: 0 }));
moon.position.set(-16, 20, -14);
scene.add(moon);

// Светлячки (вечер/ночь)
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

// Пыльца (день)
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

// ============ БАБОЧКИ (с обходом объектов) ============
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
  butterflies.push({ g, wL, wR, cx, cz, vx: 0, vz: 0, t: Math.random() * 10 });
}
makeButterfly(0.5, 6, 0xffb703); makeButterfly(-6, 2, 0xff8fa3); makeButterfly(5, 4, 0xc3aed6);

// ============ ПЕРСОНАЖИ (завод по зверятам) ============
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
    // острые ушки
    const earGeo = new THREE.ConeGeometry(0.16, 0.45, 10);
    const eL = new THREE.Mesh(earGeo, fur); eL.position.set(-0.22, 1.62, 0.08); eL.rotation.z = 0.25;
    const eR = new THREE.Mesh(earGeo, fur); eR.position.set(0.22, 1.62, 0.08); eR.rotation.z = -0.25;
    const tipGeo = new THREE.ConeGeometry(0.09, 0.18, 8);
    const tL = new THREE.Mesh(tipGeo, tipDark); tL.position.set(-0.27, 1.82, 0.08); tL.rotation.z = 0.25;
    const tR = new THREE.Mesh(tipGeo, tipDark); tR.position.set(0.27, 1.82, 0.08); tR.rotation.z = -0.25;
    ears = [eL, eR];
    // пушистый хвост
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
  } else { // bear
    const fur = L(0xa9746e), muzzleC = L(0xe8c9a8);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 24), fur);
    body.position.y = 0.58; body.scale.set(1, 1.0, 0.95); body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 24, 24), fur);
    head.position.set(0, 1.25, 0.08); head.castShadow = true;
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 14), muzzleC);
    muzzle.position.set(0, 1.15, 0.4); muzzle.scale.set(1, 0.75, 0.9);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), L(0x4a3b32));
    nose.position.set(0, 1.22, 0.55);
    // круглые ушки
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

// Герой (появляется после выбора)
let hero = null;
let charData = null;
const blob = new THREE.Mesh(
  new THREE.CircleGeometry(0.55, 24),
  new THREE.MeshBasicMaterial({ color: 0x3f6b46, transparent: true, opacity: 0.16 })
);
blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02;

function spawnHero(type) {
  hero = makeChar(type);
  hero.position.set(1, 0, 2);
  hero.add(blob);
  scene.add(hero);
  charData = hero.userData;
  // весёлое появление: прыжок-подскок
  spawnPop = 1;
}
let spawnPop = 0;

// ============ ВОЛКИ-ЩЕКОТУНЫ (ночные гости) ============
const wolves = [];
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
  // хитрые янтарные глаза
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
  const a = rand() * Math.PI * 2;
  const g = makeWolf();
  g.position.set(Math.cos(a) * (ISLAND_R - 1), 0, Math.sin(a) * (ISLAND_R - 1));
  scene.add(g);
  wolves.push({ g, mode: 'hunt', cooldown: 0 });
}

// Сердечки-искры при щекотке
const bursts = [];
function spawnBurst(pos) {
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.1),
      new THREE.MeshBasicMaterial({ color: [0xff8fa3, 0xffd166, 0xc3aed6][i % 3], transparent: true }));
    m.position.copy(pos).add(new THREE.Vector3((rand() - 0.5) * 0.6, 0.8 + rand() * 0.5, (rand() - 0.5) * 0.6));
    m.userData.v = new THREE.Vector3((rand() - 0.5) * 2, 2 + rand() * 1.5, (rand() - 0.5) * 2);
    scene.add(m);
    bursts.push(m);
  }
}

// ============ НАВИГАЦИЯ: A* ПО СЕТКЕ + ПЛАВНОЕ СЛЕДОВАНИЕ ============
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
      if (Math.hypot(x - ob.x, z - ob.z) < ob.r + 0.4) { navBlocked[j * NAV_N + i] = 1; break; }
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
  // простая куча
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
      // не резать углы по диагонали
      if (di !== 0 && dj !== 0 && (navBlocked[cj * NAV_N + ni] || navBlocked[nj * NAV_N + ci])) continue;
      const ng = gScore[cur] + w;
      if (ng < gScore[nidx]) {
        gScore[nidx] = ng; came[nidx] = cur;
        const h = Math.hypot(ni - t.i, nj - t.j);
        heap.push([ng + h, nidx]);
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
let path = null; // очередь маршрутных точек
const SPEED = 4;
let elapsed = 0;
let tickling = 0; // таймер щекотки
let tickleCooldown = 0;

function onTap(clientX, clientY) {
  if (!hero || tickling > 0) return;
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlane, hit)) {
    if (Math.hypot(hit.x, hit.z) > ISLAND_R - 1) return;
    let p = findPath(hero.position.x, hero.position.z, hit.x, hit.z);
    if (!p) p = [{ x: hit.x, z: hit.z }];
    path = p;
    const last = p[p.length - 1];
    marker.position.set(last.x, 0.06, last.z);
    markerLife = 1;
    hideHint();
  }
}
let downX = 0, downY = 0, downT = 0;
window.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; downT = performance.now(); });
window.addEventListener('pointerup', (e) => {
  const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
  const dt = performance.now() - downT;
  if (moved < 24 && dt < 500) onTap(e.clientX, e.clientY);
});
let hintHidden = false;
function hideHint() {
  if (hintHidden) return;
  hintHidden = true;
  const el = document.getElementById('hint');
  if (el) el.style.opacity = '0';
}

// ============ ДЕНЬ/НОЧЬ ============
const DAY_LEN = 150; // секунд полный цикл
let dayT = 0; // 0..1
const skyDay = new THREE.Color(0xaee3f5), skyNight = new THREE.Color(0x1c2b4d);
const sunDay = new THREE.Color(0xfff2d0), sunNight = new THREE.Color(0x8fb4ff);
const tmpColor = new THREE.Color();
let nightness = 0;
function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

// ============ СЦЕНЫ ЗАСТАВКИ ============
const splashEl = document.getElementById('splash');
const selectEl = document.getElementById('select');
setTimeout(() => {
  splashEl.classList.add('fade-out');
  setTimeout(() => { splashEl.style.display = 'none'; selectEl.style.display = 'flex'; }, 900);
}, 2100);
document.querySelectorAll('.char').forEach(btn => {
  btn.addEventListener('click', () => {
    selectEl.classList.add('fade-out');
    setTimeout(() => selectEl.style.display = 'none', 500);
    spawnHero(btn.dataset.char);
    const hint = document.getElementById('hint');
    if (hint) hint.style.opacity = '1';
  });
});

// ============ ЦИКЛ ============
buildNavGrid();
const camOffset = new THREE.Vector3(0, 14, 11.5);
const lookTarget = new THREE.Vector3(1, 0, 2);
camera.position.set(1 + camOffset.x, camOffset.y, 2 + camOffset.z);
camera.lookAt(lookTarget);
let blinkT = 2.5, squashT = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = 1 / 60;
  elapsed += dt;

  // --- ДЕНЬ/НОЧЬ ---
  dayT = (dayT + dt / DAY_LEN) % 1;
  nightness = smoothstep(0.36, 0.5, dayT) - smoothstep(0.86, 1.0, dayT);
  tmpColor.copy(skyDay).lerp(skyNight, nightness);
  scene.background.copy(tmpColor);
  scene.fog.color.copy(tmpColor);
  sun.intensity = 1.35 - nightness * 1.1;
  sun.color.copy(sunDay).lerp(sunNight, nightness);
  hemi.intensity = 0.95 - nightness * 0.55;
  starMat.opacity = nightness;
  moon.material.opacity = nightness * 0.9;
  moon.material.transparent = true;
  ffMat.opacity = nightness;
  pollenMat.opacity = 0.7 * (1 - nightness);
  winMat.color.setHex(nightness > 0.4 ? 0xffe9a3 : 0xfff7cc);

  // --- ГЕРОЙ ---
  if (hero) {
    // появление
    if (spawnPop > 0) {
      spawnPop -= dt * 1.6;
      const k = Math.max(spawnPop, 0);
      charData.bodyG.scale.y = 1 + Math.sin(k * Math.PI) * 0.3;
      charData.bodyG.scale.x = charData.bodyG.scale.z = 1 - Math.sin(k * Math.PI) * 0.15;
    }

    if (tickling > 0) {
      // щекотка: катается и хохочет
      tickling -= dt;
      hero.rotation.z = Math.sin(elapsed * 14) * 0.35;
      hero.position.y = Math.abs(Math.sin(elapsed * 10)) * 0.1;
      if (tickling <= 0) { hero.rotation.z = 0; tickleCooldown = 6; }
    } else if (path && path.length) {
      // pure pursuit: «заглядываем вперёд» по маршруту → плавные дуги
      const LOOKAHEAD = 0.9;
      let steer = path[path.length - 1];
      while (path.length && Math.hypot(path[0].x - hero.position.x, path[0].z - hero.position.z) < 0.25) path.shift();
      for (const p of path) {
        if (Math.hypot(p.x - hero.position.x, p.z - hero.position.z) > LOOKAHEAD) { steer = p; break; }
        steer = p;
      }
      let dx = steer.x - hero.position.x, dz = steer.z - hero.position.z;
      const d = Math.hypot(dx, dz);
      if (!path.length || (path.length === 1 && d < 0.25)) {
        path = null;
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
        // «живая» походка: умеренный прыжок + наклон вперёд, без желе
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
        charData.bodyG.scale.y = 1 + Math.sin(elapsed * 2.6) * 0.012; // дыхание
        charData.bodyG.scale.x = charData.bodyG.scale.z = 1 - Math.sin(elapsed * 2.6) * 0.006;
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

    // --- ВОЛКИ: появляются ночью ---
    if (nightness > 0.7 && wolves.length < 2 && tickling <= 0 && Math.random() < dt * 0.15) spawnWolf();
    if (tickleCooldown > 0) tickleCooldown -= dt;
    for (let wi = wolves.length - 1; wi >= 0; wi--) {
      const w = wolves[wi];
      if (nightness < 0.5) {
        // уходят за край и исчезают
        const d = Math.hypot(w.g.position.x, w.g.position.z);
        const ex = w.g.position.x / d, ez = w.g.position.z / d;
        w.g.position.x += ex * 2.5 * dt; w.g.position.z += ez * 2.5 * dt;
        w.g.rotation.y = Math.atan2(ex, ez) - Math.PI / 2;
        if (d > ISLAND_R + 2) { scene.remove(w.g); wolves.splice(wi, 1); }
        continue;
      }
      if (w.mode === 'hunt' && tickling <= 0) {
        const dx = hero.position.x - w.g.position.x, dz = hero.position.z - w.g.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.75 && tickleCooldown <= 0) {
          // ПОЙМАЛ! Щекотка :)
          tickling = 2.6;
          w.mode = 'flee'; w.cooldown = 18;
          spawnBurst(hero.position);
        } else if (d > 0.001) {
          const sp = 2.6 * dt;
          w.g.position.x += (dx / d) * sp; w.g.position.z += (dz / d) * sp;
          resolveCollision(w.g.position);
          w.g.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;
          w.g.position.y = Math.abs(Math.sin(elapsed * 8)) * 0.08;
        }
      } else {
        // отбежал и побродил в сторонке
        w.cooldown -= dt;
        w.g.position.y = 0;
        if (w.cooldown <= 0) w.mode = 'hunt';
      }
    }
  }

  for (const s of swayList) s.obj.rotation.z = Math.sin(elapsed * s.speed + s.obj.position.x) * s.amp;

  // Облака: прозрачность между камерой и зверьком
  const anchorY = hero ? hero.position : lookTarget;
  const rayCam = new THREE.Vector3().subVectors(anchorY, camera.position);
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
    b.off += dt * 0.6 * (1 - nightness); // ночью спят
    b.g.visible = nightness < 0.6;
    const x = ((b.off * 2.2) % 60) - 30;
    b.g.position.set(x, b.y + Math.sin(b.off) * 0.6, -18 + Math.cos(b.off * 0.5) * 4);
    b.g.rotation.y = Math.PI / 2;
    const flap = Math.sin(b.off * 6) * 0.55;
    b.g.children[0].rotation.z = 0.4 + flap;
    b.g.children[1].rotation.z = -0.4 - flap;
  }

  // Бабочки: уступают дорогу объектам, прячутся ночью
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

  // Светлячки танцуют
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

  // Сердечки-искры вверх и тают
  for (let i = bursts.length - 1; i >= 0; i--) {
    const m = bursts[i];
    m.position.addScaledVector(m.userData.v, dt);
    m.userData.v.y -= 4 * dt;
    m.rotation.x += dt * 4; m.rotation.y += dt * 3;
    m.material.opacity = (m.material.opacity ?? 1) - dt * 0.7;
    if (m.material.opacity <= 0.05 || m.position.y < 0) { scene.remove(m); bursts.splice(i, 1); }
  }

  if (markerLife > 0) {
    markerLife -= 0.025;
    marker.material.opacity = Math.max(markerLife, 0) * 0.9;
    marker.scale.setScalar(1 + (1 - Math.max(markerLife, 0)) * 0.8);
  }

  if (hero) {
    const wanted = new THREE.Vector3().copy(hero.position).add(camOffset);
    camera.position.lerp(wanted, 0.06);
    lookTarget.lerp(hero.position, 0.08);
    sun.position.set(hero.position.x + 12, 20, hero.position.z + 9);
    sun.target.position.copy(hero.position);
  }
  camera.lookAt(lookTarget);

  renderer.render(scene, camera);
}
animate();

function resolveCollision(pos) {
  for (const ob of obstacles) {
    const dx = pos.x - ob.x, dz = pos.z - ob.z;
    const d = Math.hypot(dx, dz);
    const minD = ob.r + 0.42;
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
});

import * as THREE from 'three';
import { initAudio, play, playNote, setNight, toggleMute, isMuted, speak, stopVoice, setGamePaused } from './audio.js';

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
// Кустик-«ширма» в узком проходе между Древом и огородиком: раньше герой там
// поджимался и «подзастревал» с первого раза — теперь маршруты идут красивой дугой.
for (const [bx, bz, br] of [[0.9, -4.3, 0.66], [1.75, -4.7, 0.5]]) {
  const bush = new THREE.Mesh(new THREE.SphereGeometry(br, 16, 12), L(0x6fbf5f));
  bush.position.set(bx, br * 0.72, bz); bush.scale.y = 0.85; bush.castShadow = true;
  scene.add(bush);
  obstacles.push({ x: bx, z: bz, r: br * 0.8 });
}
// Грядки Ёжика — он и правда «ждёт у грядок», как говорит рассказчица (север-запад)
{
  const beds = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.22, 0.42), L(0x8a5f42));
    bed.position.set(-0.62 + i * 0.62, 0.12, 0);
    bed.castShadow = true; bed.receiveShadow = true;
    beds.add(bed);
    for (const side of [-0.22, 0.22]) {
      const sprout = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), L(0x7ed957));
      sprout.scale.set(1, 0.6, 1);
      sprout.position.set(-0.62 + i * 0.62 + side * (i % 2 ? 1 : -1) * 0.5, 0.27, 0.05);
      beds.add(sprout);
    }
  }
  beds.position.set(-4.35, 0, 8.95);
  beds.rotation.y = 0.45;
  scene.add(beds);
  obstacles.push({ x: -4.35, z: 8.95, r: 1.15 });
}
// Мостик Лягушки — маленькая дуга над заводью рядом с её кочкой (она играет
// в «Волшебный мостик» — теперь он есть и в мире)
{
  const pondletM = L(0x7ecbe8);
  for (const [px, pz, pr] of [[10.55, 7.55, 0.85], [11.35, 7.75, 0.75]]) {
    const pl = new THREE.Mesh(new THREE.CircleGeometry(pr, 24), pondletM);
    pl.rotation.x = -Math.PI / 2; pl.position.set(px, 0.045, pz);
    scene.add(pl);
  }
  const lily = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), L(0x5fbf7a));
  lily.rotation.x = -Math.PI / 2; lily.position.set(10.4, 0.07, 7.4);
  scene.add(lily);
  const fbr = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const y = 0.1 + Math.sin((i / 2) * Math.PI) * 0.1;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 1.15), L(i % 2 ? 0xbd8760 : 0xb07b4f));
    plank.position.set(-0.4 + i * 0.4, y, 0);
    plank.rotation.z = (i - 1) * -0.14;
    plank.castShadow = true;
    fbr.add(plank);
  }
  for (const sz of [-0.55, 0.55]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.06, 0.08), L(0x9a6b4f));
    rail.position.set(0, 0.42, sz);
    fbr.add(rail);
    for (const px of [-0.42, 0.42]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.34, 6), L(0x8a5a3b));
      post.position.set(px, 0.28, sz);
      fbr.add(post);
    }
  }
  fbr.position.set(10.95, 0.05, 7.65);
  fbr.rotation.y = -0.45;
  scene.add(fbr);
  obstacles.push({ x: 10.95, z: 7.6, r: 1.25 });
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
// Процедурная текстура «дощатая обшивка» — офлайн, рисуется на canvas
function plankTex(base, seam, planks = 4) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  c.fillStyle = base; c.fillRect(0, 0, 64, 64);
  c.fillStyle = seam;
  const h = 64 / planks;
  for (let i = 0; i <= planks; i++) c.fillRect(0, i * h - 1, 64, 2);
  for (let i = 0; i < planks; i++) c.fillRect(i % 2 ? 40 : 14, i * h, 2, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const wallsTex = plankTex('#f7e7c3', 'rgba(170,130,80,0.4)', 4);
const roofTex = plankTex('#e08e79', 'rgba(120,60,50,0.4)', 5);

const house = new THREE.Group();
const walls = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 2.2),
  new THREE.MeshLambertMaterial({ map: wallsTex }));
walls.position.y = 0.9; walls.castShadow = true;
const roof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 1.5, 4),
  new THREE.MeshLambertMaterial({ map: roofTex }));
roof.position.y = 2.55; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
// конёк крыши
const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 3.1), L(0x8a5a3b));
ridge.position.y = 3.32; ridge.rotation.y = Math.PI / 4 + Math.PI / 2;
// дверь с рамой, ручкой и порогом
const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.08), L(0xffffff));
doorFrame.position.set(0, 0.55, 1.12);
const door = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.0, 0.1), L(0x9a6b4f));
door.position.set(0, 0.5, 1.16);
const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), L(0xffd166));
knob.position.set(0.2, 0.5, 1.22);
const doorstep = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.35), L(0xb9c1c9));
doorstep.position.set(0, 0.04, 1.32);
// круглое окно с рамой + цветочный ящик
const winMat = new THREE.MeshLambertMaterial({ color: 0xfff7cc });
const win = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 24), winMat);
win.rotation.x = Math.PI / 2; win.position.set(-0.8, 1.15, 1.12);
const winRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 8, 24), L(0xffffff));
winRing.position.set(-0.8, 1.15, 1.13);
const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.04), L(0xffffff));
crossH.position.set(-0.8, 1.15, 1.15);
const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.56, 0.04), L(0xffffff));
crossV.position.set(-0.8, 1.15, 1.15);
const flowerBox = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.16), L(0x9a6b4f));
flowerBox.position.set(-0.8, 0.72, 1.14);
const fbGeo = new THREE.SphereGeometry(0.07, 8, 8);
for (const fx of [-1.0, -0.8, -0.6]) {
  const fl = new THREE.Mesh(fbGeo, L([0xf2a0b5, 0xffd166, 0xff8fa3][Math.round((fx + 1) * 5) % 3]));
  fl.position.set(fx, 0.85, 1.14);
  house.add(fl);
}
// мансардное оконце
const attic = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 16), winMat);
attic.rotation.x = Math.PI / 2; attic.position.set(0, 1.7, 1.05);
const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.35), L(0xc98a6d));
chimney.position.set(0.8, 2.9, -0.4);
const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.1, 0.48), L(0x8a5a3b));
chimneyCap.position.set(0.8, 3.32, -0.4);
house.add(walls, roof, ridge, doorFrame, door, knob, doorstep, win, winRing, crossH, crossV, flowerBox, attic, chimney, chimneyCap);
house.position.set(-7, 0.7, -6.5); house.rotation.y = 0.5;
scene.add(house);
obstacles.push({ x: -7, z: -6.5, r: 2.2 });

// Дорожка из камешков от домика к центру полянки
for (let i = 0; i < 4; i++) {
  const t = i / 3;
  const st = new THREE.Mesh(new THREE.CircleGeometry(0.3 - t * 0.04, 14), L(0xd8d0bc));
  st.rotation.x = -Math.PI / 2;
  st.position.set(-6.3 + t * 2.6, 0.045, -5.2 + t * 2.6);
  st.receiveShadow = true;
  scene.add(st);
}

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
obstacles.push({ x: 2.5, z: -6, r: 2.2 });

// Белый штакетник вокруг огородика
{
  const picketM = L(0xfff6e8);
  const picketG = new THREE.BoxGeometry(0.11, 0.5, 0.06);
  const tipG = new THREE.ConeGeometry(0.09, 0.14, 4);
  const addPicket = (px, pz) => {
    const p = new THREE.Mesh(picketG, picketM);
    p.position.set(px, 0.25, pz);
    const tip = new THREE.Mesh(tipG, picketM);
    tip.position.set(px, 0.55, pz); tip.rotation.y = Math.PI / 4;
    const pair = new THREE.Group(); pair.add(p, tip); pair.position.set(0, 0, 0);
    p.position.set(px, 0.25, pz); tip.position.set(px, 0.55, pz);
    garden.add(p, tip);
  };
  for (let px = -2.6; px <= 2.61; px += 0.65) { addPicket(px, -1.4); addPicket(px, 1.4); }
  addPicket(-2.9, -0.7); addPicket(-2.9, 0); addPicket(-2.9, 0.7);
}

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
hedgehog.scale.setScalar(1.16); // крупнее — читается и на телефоне

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
owl.scale.setScalar(1.14); // крупнее — читается и на телефоне

const owlBubble = makeBubbleSprite('🔢', 1.05);
owlBubble.position.set(OWL_POS.x, 2.5, OWL_POS.z);
scene.add(owlBubble);
const owlBubTex = {
  count: owlBubble.material.map,
  star: makeBubbleSprite('⭐', 1).material.map,
};
function setOwlBubble(t) { owlBubble.material.map = t; owlBubble.material.needsUpdate = true; }

// ============ ЛЯГУШКА ============
// строим через функцию: одна и та же лягушка живёт у пруда (Л1) и на речном берегу (Л2).
// (clone(true) у такой группы почему-то теряет «лицевую» сторону — не боремся, строим два раза)
function buildFrogGroup() {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CircleGeometry(0.62, 20), L(0x4faf6a));
  pad.rotation.x = -Math.PI / 2; pad.position.y = 0.06;
  g.add(pad);
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
  g.add(fBody);
  g.userData.body = fBody;
  return g;
}
const frog = buildFrogGroup();
const FROG_POS = { x: 11.5, z: 5.2 };
frog.position.set(FROG_POS.x, 0.02, FROG_POS.z);
frog.rotation.y = Math.atan2(0 - FROG_POS.x, 0 - FROG_POS.z);
scene.add(frog);
obstacles.push({ x: FROG_POS.x, z: FROG_POS.z, r: 0.5 });
frog.scale.setScalar(1.16); // крупнее — читается и на телефоне

const frogBubble = makeBubbleSprite('🧩', 1.05);
frogBubble.position.set(FROG_POS.x, 2.2, FROG_POS.z);
scene.add(frogBubble);
const frogBubTex = {
  puzzle: frogBubble.material.map,
  star: makeBubbleSprite('⭐', 1).material.map,
};
function setFrogBubble(t) { frogBubble.material.map = t; frogBubble.material.needsUpdate = true; }

// ============ КРОТ В КАСКЕ (у огородика — «кто таскает морковку?») ============
function makeMole() {
  const g = new THREE.Group();
  const furC = L(0x6b4f3a);
  // кучка рыхлой земли
  const mound = new THREE.Mesh(new THREE.SphereGeometry(0.95, 18, 12), L(0x7a5a40));
  mound.position.y = -0.55; mound.scale.set(1.35, 0.75, 1.35);
  mound.castShadow = true; mound.receiveShadow = true;
  // голова с шахтёрской каской
  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 20), furC);
  skull.castShadow = true;
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 12), L(0xd99a90));
  snout.position.set(0, -0.06, 0.44); snout.scale.set(1, 0.8, 1.05);
  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), L(0xc9768a));
  noseTip.position.set(0, 0.0, 0.62);
  const eyeGeo = new THREE.SphereGeometry(0.055, 10, 10);
  const eyeL = new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0x2b2118 }));
  eyeL.position.set(-0.2, 0.14, 0.42);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.2;
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.44, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.4),
    L(0xf2c94c)
  );
  helmet.position.y = 0.17;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.055, 20), L(0xd9ad3a));
  brim.position.y = 0.17;
  // фонарик на каске — ночью светится
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
  lamp.position.set(0, 0.36, 0.38);
  const pawGeo = new THREE.SphereGeometry(0.15, 10, 10);
  const pawL = new THREE.Mesh(pawGeo, furC); pawL.position.set(-0.44, -0.34, 0.28); pawL.scale.set(1.15, 0.6, 1.25);
  const pawR = pawL.clone(); pawR.position.x = 0.44;
  head.add(skull, snout, noseTip, eyeL, eyeR, helmet, brim, lamp, pawL, pawR);
  g.add(mound, head);
  g.userData = { head, lamp };
  return g;
}
const MOLE_POS = { x: 4.8, z: -4.6 }; // рядом с огородиком (грядки 2.5,-6)
const mole = makeMole();
mole.position.set(MOLE_POS.x, 0, MOLE_POS.z);
mole.rotation.y = Math.atan2(-2 - MOLE_POS.x, -1 - MOLE_POS.z);
scene.add(mole);
obstacles.push({ x: MOLE_POS.x, z: MOLE_POS.z, r: 0.75 });
mole.scale.setScalar(1.14); // крупнее — читается и на телефоне
const moleBubble = makeBubbleSprite('🥕', 0.85);
moleBubble.position.set(MOLE_POS.x, 2.05, MOLE_POS.z);
scene.add(moleBubble);

// ============ БЕЛКА (у западного дерева — «Прятки-норки») ============
function makeSquirrel() {
  const g = new THREE.Group();
  const bodyG = new THREE.Group();
  const fur = L(0xe08840), cream = L(0xfff0dd), dark = L(0x8a4f22);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 18), fur);
  body.position.y = 0.34; body.scale.set(0.92, 1.15, 0.85); body.castShadow = true;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), cream);
  belly.position.set(0, 0.32, 0.16); belly.scale.set(0.8, 1, 0.5);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 18), fur);
  head.position.set(0, 0.78, 0.08); head.castShadow = true;
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), cream);
  muzzle.position.set(0, 0.72, 0.28); muzzle.scale.set(1, 0.8, 0.9);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), L(0x4a3325));
  nose.position.set(0, 0.76, 0.37);
  const eyeGeo = new THREE.SphereGeometry(0.05, 10, 10);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2b2118 });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.12, 0.83, 0.27);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.12;
  // ушки с тёмными кисточками
  const earGeo = new THREE.ConeGeometry(0.075, 0.22, 8);
  const eL = new THREE.Mesh(earGeo, fur); eL.position.set(-0.14, 1.02, 0.02); eL.rotation.z = 0.18;
  const eR = new THREE.Mesh(earGeo, fur); eR.position.set(0.14, 1.02, 0.02); eR.rotation.z = -0.18;
  const tuftGeo = new THREE.ConeGeometry(0.038, 0.1, 6);
  const tL = new THREE.Mesh(tuftGeo, dark); tL.position.set(-0.165, 1.13, 0.02); tL.rotation.z = 0.18;
  const tR = new THREE.Mesh(tuftGeo, dark); tR.position.set(0.165, 1.13, 0.02); tR.rotation.z = -0.18;
  // большой пушистый хвост — вопросительным знаком за спиной
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), fur);
  tail.position.set(0, 0.72, -0.3); tail.scale.set(0.85, 1.7, 0.55); tail.castShadow = true;
  const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), cream);
  tailTip.position.set(0, 1.12, -0.34); tailTip.scale.set(0.8, 1, 0.5);
  const pawGeo = new THREE.SphereGeometry(0.08, 10, 10);
  const pawL = new THREE.Mesh(pawGeo, fur); pawL.position.set(-0.15, 0.5, 0.26);
  const pawR = pawL.clone(); pawR.position.x = 0.15;
  // орешек в лапках
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), L(0x9c6b3d));
  nut.position.set(0, 0.52, 0.3);
  bodyG.add(body, belly, head, muzzle, nose, eyeL, eyeR, eL, eR, tL, tR, tail, tailTip, pawL, pawR, nut);
  g.add(bodyG);
  g.userData = { body: bodyG, tail, tailTip };
  return g;
}
const SQRL_POS = { x: -7.4, z: 5.6 }; // у дерева на западной опушке
const sq = makeSquirrel();
sq.position.set(SQRL_POS.x, 0, SQRL_POS.z);
sq.rotation.y = Math.atan2(0 - SQRL_POS.x, 0 - SQRL_POS.z);
scene.add(sq);
obstacles.push({ x: SQRL_POS.x, z: SQRL_POS.z, r: 0.55 });
sq.scale.setScalar(1.16); // крупнее — читается и на телефоне
const sqBubble = makeBubbleSprite('🌰', 0.95);
sqBubble.position.set(SQRL_POS.x, 2.3, SQRL_POS.z);
scene.add(sqBubble);
const sqBubTex = {
  nut: sqBubble.material.map,
  star: makeBubbleSprite('⭐', 1).material.map,
};
function setSqBubble(t) { sqBubble.material.map = t; sqBubble.material.needsUpdate = true; }

// ============ СВЕТЛЯЧОК («Звонкие камни») ============
// Ноты-камушки: пентатоника C-D-E-G-A — любая последовательность звучит слаженно.
const ST_NOTES = [
  { f: 523.25, c: 0xf28ba8 }, // до — розовый
  { f: 587.33, c: 0xf5b45e }, // ре — оранжевый
  { f: 659.25, c: 0xf7e07a }, // ми — жёлтый
  { f: 783.99, c: 0x8fd694 }, // соль — зелёный
  { f: 880.00, c: 0x8fc3f0 }, // ля — голубой
];
const FIRE_POS = { x: 7.9, z: 8.7 }; // у северо-восточного бережка пруда
function makeFirefly() {
  const g = new THREE.Group();
  const bodyG = new THREE.Group();
  const chitin = L(0x7d68a8), dark = L(0x55457a);
  // тельце — вытянутое, как капелька
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), chitin);
  body.position.y = 0.5; body.scale.set(0.82, 1.05, 0.95); body.castShadow = true;
  // светящееся брюшко-фонарик
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff3a0 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 14), bulbMat);
  bulb.position.set(0, 0.5, -0.17); bulb.scale.set(0.9, 1.2, 0.9);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), dark);
  head.position.set(0, 0.66, 0.16); head.castShadow = true;
  const eyeGeo = new THREE.SphereGeometry(0.055, 10, 10);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfff6cf });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x2b2118 });
  const eL = new THREE.Mesh(eyeGeo, eyeMat); eL.position.set(-0.085, 0.7, 0.27);
  const eR = eL.clone(); eR.position.x = 0.085;
  const pL = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), pupilMat); pL.position.set(-0.085, 0.7, 0.318);
  const pR = pL.clone(); pR.position.x = 0.085;
  // усики
  const antGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.16, 5);
  const aL = new THREE.Mesh(antGeo, dark); aL.position.set(-0.07, 0.84, 0.2); aL.rotation.z = 0.5;
  const aR = aL.clone(); aR.position.x = 0.07; aR.rotation.z = -0.5;
  // крылышки — полупрозрачные
  const wingMat = new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const wingGeo = new THREE.CircleGeometry(0.17, 12);
  const wL = new THREE.Mesh(wingGeo, wingMat); wL.position.set(-0.16, 0.72, -0.02); wL.rotation.set(-0.5, 0.2, 0.9); wL.scale.set(0.6, 1.15, 1);
  const wR = wL.clone(); wR.position.x = 0.16; wR.rotation.z = -0.9;
  // лапки-точки
  const legGeo = new THREE.SphereGeometry(0.035, 6, 6);
  const legs = [];
  for (let i = 0; i < 3; i++) {
    const lz = 0.1 - i * 0.13;
    const l1 = new THREE.Mesh(legGeo, dark); l1.position.set(-0.14, 0.34 - i * 0.012, lz);
    const l2 = l1.clone(); l2.position.x = 0.14;
    legs.push(l1, l2);
  }
  bodyG.add(body, bulb, head, eL, eR, pL, pR, aL, aR, wL, wR, ...legs);
  g.add(bodyG);
  // тёплый свет фонарика: вечером и ночью ярче
  const lamp = new THREE.PointLight(0xffe98a, 0.55, 5.5, 1.6);
  lamp.position.set(0, 1.0, 0.55); // светит вперёд-вниз: и мордочка, и камушки подсвечены
  g.add(lamp);
  g.userData = { body: bodyG, bulb, bulbMat, lamp, wL, wR };
  return g;
}
const firefly = makeFirefly();
firefly.position.set(FIRE_POS.x, 0, FIRE_POS.z);
firefly.rotation.y = Math.atan2(0 - FIRE_POS.x, -2 - FIRE_POS.z); // смотрит к центру поляны
scene.add(firefly);
obstacles.push({ x: FIRE_POS.x, z: FIRE_POS.z, r: 0.55 });
firefly.scale.setScalar(1.18); // крупнее — читается и на телефоне
const svetBubble = makeBubbleSprite('🎵', 0.95);
svetBubble.position.set(FIRE_POS.x, 2.1, FIRE_POS.z);
scene.add(svetBubble);
const svetBubTex = {
  note: svetBubble.material.map,
  star: makeBubbleSprite('⭐', 1).material.map,
};
function setSvetBubble(t) { svetBubble.material.map = t; svetBubble.material.needsUpdate = true; }
// пять настоящих камушков-ноток полукругом перед Светлячком — те же цвета, что в мини-игре
const fireStones = [];
{
  for (let i = 0; i < ST_NOTES.length; i++) {
    const ang = (-0.62 + i * 0.31); // дуга перед носом Светлячка
    const sx = FIRE_POS.x + Math.sin(firefly.rotation.y + Math.PI + ang) * 1.15;
    const sz = FIRE_POS.z + Math.cos(firefly.rotation.y + Math.PI + ang) * 1.15;
    const st = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), L(ST_NOTES[i].c));
    st.position.set(sx, 0.09, sz); st.scale.set(1, 0.62, 0.92);
    st.castShadow = true; st.receiveShadow = true;
    scene.add(st);
    fireStones.push(st);
  }
}

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
    // Волшебная звезда на макушке — цель сюжета.
    // Сперва светит «тихонько» (только Древу). После главы 2 «Звонкое созвучие» —
    // сияет для всей полянки: золотое гало + свет-маяк + ночной хоровод огоньков.
    const starTop = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0),
      new THREE.MeshBasicMaterial({ color: 0xffe066 }));
    starTop.position.y = 3.65;
    starTop.scale.set(1, 1.35, 1);
    g.add(starTop);
    // гало-мягкое сияние вокруг звезды (включается в главе 2)
    const hc = document.createElement('canvas'); hc.width = hc.height = 128;
    const hx = hc.getContext('2d');
    const hgrad = hx.createRadialGradient(64, 64, 4, 64, 64, 62);
    hgrad.addColorStop(0, 'rgba(255,244,190,0.95)');
    hgrad.addColorStop(0.35, 'rgba(255,230,140,0.45)');
    hgrad.addColorStop(1, 'rgba(255,230,140,0)');
    hx.fillStyle = hgrad; hx.fillRect(0, 0, 128, 128);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(hc), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.position.y = 3.65;
    halo.scale.setScalar(2.4);
    halo.visible = false;
    g.add(halo);
    // тёплый свет-маяк от звезды (сильнее ночью)
    const beacon = new THREE.PointLight(0xffe9a3, 0, 9, 1.7);
    beacon.position.set(0, 3.7, 0);
    g.add(beacon);
    g.userData.star = starTop;
    g.userData.halo = halo;
    g.userData.beacon = beacon;
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

// Древо должно сразу бросаться в глаза: золотая оградка, волшебные искры,
// а ночью — мягкое тёплое свечение (не перебивающее ночную сцену)
{
  const goldM = L(0xf2c14e);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8), goldM);
    const px = TREE_POS.x + Math.cos(a) * 1.15, pz = TREE_POS.z + Math.sin(a) * 1.15;
    post.position.set(px, 0.21, pz);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), goldM);
    ball.position.set(px, 0.48, pz);
    scene.add(post, ball);
  }
}
const TREE_SPARKS = 26;
const treeSparkGeo = new THREE.BufferGeometry();
const tsPos = new Float32Array(TREE_SPARKS * 3);
for (let i = 0; i < TREE_SPARKS; i++) {
  const a = rand() * Math.PI * 2, r = 0.6 + rand() * 1.3;
  tsPos.set([TREE_POS.x + Math.cos(a) * r, 0.4 + rand() * 2.2, TREE_POS.z + Math.sin(a) * r], i * 3);
}
treeSparkGeo.setAttribute('position', new THREE.BufferAttribute(tsPos, 3));
const treeSparkMat = new THREE.PointsMaterial({
  color: 0xffe9a3, size: 0.09, transparent: true, opacity: 0.85,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
const treeSparks = new THREE.Points(treeSparkGeo, treeSparkMat);
scene.add(treeSparks);

// --- Глава 2 «Звонкое созвучие»: засиявшая звезда (достижение «помог всем») ---
let starLit = localStorage.getItem('wm_story_all6') === '1';
// Хоровод звонких огоньков вокруг кроны — танцует по ночам, пока сияет звезда
const CHOIR_N = 14;
const choirGeo = new THREE.BufferGeometry();
const choirPos = new Float32Array(CHOIR_N * 3);
for (let i = 0; i < CHOIR_N; i++) {
  const a = (i / CHOIR_N) * Math.PI * 2;
  const r = 1.6 + (i % 3) * 0.35;
  choirPos.set([Math.cos(a) * r, 2.7 + (i % 4) * 0.28, Math.sin(a) * r], i * 3);
}
choirGeo.setAttribute('position', new THREE.BufferAttribute(choirPos, 3));
const choirMat = new THREE.PointsMaterial({
  color: 0xffe08a, size: 0.21, transparent: true, opacity: 0,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
const choirLights = new THREE.Points(choirGeo, choirMat);
choirLights.position.set(TREE_POS.x, 0, TREE_POS.z);
scene.add(choirLights);
function applyStarLit() {
  const g3 = treeStages[3];
  if (!g3 || !g3.userData.halo) return;
  g3.userData.halo.visible = starLit;
  g3.userData.beacon.intensity = starLit ? 0.5 : 0;
  if (g3.userData.star) g3.userData.star.material.color.setHex(starLit ? 0xfff4b8 : 0xffe066);
}
applyStarLit();
// материалы Дерева для ночного свечения
const treeGlowMats = new Set();
treeStages.forEach(g => g && g.traverse(m => { if (m.material && m.material.isMeshLambertMaterial) treeGlowMats.add(m.material); }));

// ============ ЛОКАЦИИ (Локация 1 «Лесная полянка» + Локация 2 «Речной берег») ============
// Обе полянки живут в ОДНОЙ сцене: Речной берег стоит далеко на севере (z + 150),
// своего центра и своего набора препятствий у навигации нет — препятствия хранятся
// в МИРОВЫХ координатах обеих локаций, а локальным бывает только «центр острова».
const LOCS = [
  { x: 0, z: 0, name: 'Лесная полянка', sub: 'тёплый домик у ручья' },
  { x: 0, z: 150, name: 'Речной берег', sub: 'здесь живёт Бобр-строитель' },
];
let curLoc = 0;
const LOC2 = LOCS[1];
// отдельный «шумовой» генератор для декора Л2 — НЕ трогаем общий rand(),
// чтобы не сдвинуть выверенную рассадку Локации 1
const r2 = (() => { let s = 987; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

// мягкое свечение для огоньков арки
let glowTex2 = null;
function makeGlowTex() {
  if (glowTex2) return glowTex2;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 3, 32, 32, 30);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.4, 'rgba(210,245,255,0.7)');
  rg.addColorStop(1, 'rgba(210,245,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  glowTex2 = new THREE.CanvasTexture(c);
  return glowTex2;
}

// ----- остров Речного берега -----
{
  const ground2 = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R, ISLAND_R * 0.88, 1.8, 48), L(0x8ed081));
  ground2.position.set(LOC2.x, -0.9, LOC2.z);
  ground2.receiveShadow = true;
  scene.add(ground2);
  // разнотравье
  for (let i = 0; i < 12; i++) {
    const a = r2() * Math.PI * 2, rr = 2 + Math.sqrt(r2()) * 11.5;
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(1.0 + r2() * 1.4, 20),
      new THREE.MeshLambertMaterial({ color: r2() > 0.5 ? 0x84cc78 : 0x9adb8a, transparent: true, opacity: 0.5 })
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(LOC2.x + Math.cos(a) * rr, 0.015 + i * 0.001, LOC2.z + Math.sin(a) * rr);
    scene.add(patch);
  }
  for (const [x, z, rr, c] of [[-8, -9, 2.8, 0x7ecb74], [8.6, -7.2, 2.2, 0x86cf78], [-10.5, 7.8, 2.0, 0x94d687]]) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(rr, 24, 16), L(c));
    hill.scale.y = 0.38; hill.position.set(LOC2.x + x, 0, LOC2.z + z); hill.receiveShadow = true;
    scene.add(hill);
  }
}

// ----- РЕЧКА: мягкая S-излучина через весь остров, у берега — мостик -----
// Полочка функции одна на всех: и для воды, и для препятствий, и для бликов.
const riverX = (worldZ) => LOC2.x + 1.3 * Math.sin((worldZ - LOC2.z) * 0.25);
const RIVER_PTS = [];
for (let lz = -14; lz <= 14.01; lz += 1.7) RIVER_PTS.push(lz);
{
  const waterM = L(0x7ecbe8);
  RIVER_PTS.forEach((lz, i) => {
    const w = new THREE.Mesh(new THREE.CircleGeometry(2.3, 28), waterM);
    w.rotation.x = -Math.PI / 2;
    w.position.set(riverX(LOC2.z + lz), 0.045 + i * 0.0004, LOC2.z + lz);
    scene.add(w);
    // река — препятствие, но у мостика (|lz| < 2.4) оставляем проход
    if (Math.abs(lz) >= 2.4) obstacles.push({ x: riverX(LOC2.z + lz), z: LOC2.z + lz, r: 2.05 });
  });
  // кувшинки
  for (const lz of [-7.2, -5.4, 6.6, 8.4]) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.42, 14), L(0x5fbf7a));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(riverX(LOC2.z + lz) + (r2() - 0.5) * 1.6, 0.07, LOC2.z + lz);
    scene.add(pad);
  }
  // камыши по берегам
  const reedRows = [[-11.6, 1], [-9.2, -1], [-6.6, 1], [-4.2, -1], [4.1, 1], [5.9, -1], [7.8, 1], [10.2, -1], [12.2, 1]];
  for (const [lz, side] of reedRows) {
    const bx = riverX(LOC2.z + lz) + side * (2.6 + r2() * 0.5);
    const bz = LOC2.z + lz + (r2() - 0.5) * 0.6;
    const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.5, 8), L(0x5aa860));
    reed.position.set(bx, 0.75, bz);
    reed.rotation.z = (r2() - 0.5) * 0.15;
    const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.3, 4, 8), L(0x8a5a3b));
    tip.position.set(bx + (r2() - 0.5) * 0.06, 1.62, bz);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.9, 6), L(0x6fbf5f));
    leaf.position.set(bx + 0.12, 0.55, bz); leaf.rotation.z = 0.5;
    scene.add(reed, tip, leaf);
  }
}
// блики-блёстки, которые «плывут» по речке (оживляет воду без шейдеров)
const riverFlows = [];
for (let i = 0; i < 7; i++) {
  const fl = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false }));
  fl.rotation.x = -Math.PI / 2;
  fl.scale.set(2.1, 1, 1);
  fl.userData.off = i * 4.1;
  scene.add(fl);
  riverFlows.push(fl);
}

// ----- МОСТИК через речку (проходимый: навигация видит «коридор») -----
{
  const deckM = L(0xb07b4f);
  for (let i = 0; i < 7; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.12, 3.0), i % 2 ? L(0xbd8760) : deckM);
    plank.position.set(LOC2.x - 3.06 + i * 1.02, 0.12, LOC2.z);
    plank.castShadow = true; plank.receiveShadow = true;
    scene.add(plank);
  }
  // перильца: столбики + верхняя планка; в навигации — круглые препятствия
  for (const sz of [-1.55, 1.55]) {
    for (let i = 0; i < 5; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.6, 8), L(0x8a5a3b));
      post.position.set(LOC2.x - 3 + i * 1.5, 0.3 + 0.14, LOC2.z + sz);
      scene.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.1, 0.14), L(0x9a6b4f));
    rail.position.set(LOC2.x, 0.66, LOC2.z + sz);
    scene.add(rail);
    for (let i = 0; i < 5; i++) obstacles.push({ x: LOC2.x - 3 + i * 1.5, z: LOC2.z + sz, r: 0.38 });
  }
}

// ----- ИВЫ (склонённые лиственные «зонтики») -----
function makeWillow(x, z) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.4, 2.5, 10), L(0x9a6b4f));
  trunk.position.y = 1.25; trunk.castShadow = true;
  g.add(trunk);
  const top = new THREE.Mesh(new THREE.SphereGeometry(1.15, 14, 14), L(0x7ecb74));
  top.position.y = 3.05; top.scale.set(1, 1.3, 1); top.castShadow = true;
  g.add(top);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 12), L(i % 2 ? 0x6fbf5f : 0x84cc78));
    leaf.scale.set(0.72, 1.9, 0.72);
    leaf.position.set(Math.cos(a) * 1.05, 2.05, Math.sin(a) * 1.05);
    g.add(leaf);
  }
  g.position.set(x, 0, z);
  swayList.push({ obj: top, speed: 0.9, amp: 0.03 });
  return g;
}
for (const [x, z] of [[-7.5, -8], [7.8, 9.8], [-9.8, 5.2]]) {
  scene.add(makeWillow(LOC2.x + x, LOC2.z + z));
  obstacles.push({ x: LOC2.x + x, z: LOC2.z + z, r: 0.55 });
}

// ----- ХАТКА БОБРА (купол из веточек у воды) -----
{
  const lodge = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), L(0x8a6a4a));
  dome.scale.set(1.25, 0.78, 1.25); dome.position.y = 0.04;
  dome.castShadow = true;
  lodge.add(dome);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.8, 6), L(i % 2 ? 0x6f452c : 0x9a6b4f));
    stick.position.set(Math.cos(a) * 0.95, 0.75, Math.sin(a) * 0.95);
    stick.rotation.z = Math.cos(a) * 0.72; stick.rotation.x = -Math.sin(a) * 0.72;
    lodge.add(stick);
  }
  lodge.position.set(LOC2.x - 6.2, 0, LOC2.z - 4.5);
  scene.add(lodge);
  obstacles.push({ x: LOC2.x - 6.2, z: LOC2.z - 4.5, r: 1.7 });
}
// поленница заготовок — Бобр строит!
{
  const pile = new THREE.Group();
  for (const [dx, dy, ry] of [[-0.5, 0.22, 0.2], [0.45, 0.22, -0.15], [0, 0.62, 0.35]]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.5, 10), L(0xc98d5a));
    log.rotation.z = Math.PI / 2; log.rotation.y = ry;
    log.position.set(dx, dy, 0);
    log.castShadow = true;
    pile.add(log);
  }
  const plank = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.4), L(0xd8a566));
  plank.position.set(0.2, 0.85, 0.3); plank.rotation.y = 0.5;
  pile.add(plank);
  pile.position.set(LOC2.x + 5.8, 0, LOC2.z + 5.5);
  scene.add(pile);
  obstacles.push({ x: LOC2.x + 5.8, z: LOC2.z + 5.5, r: 1.1 });
}
// камешки на берегу
for (const [x, z, rr] of [[8.9, -3.4, 0.45], [-9.2, -2.6, 0.4], [10.6, 4.4, 0.35]]) {
  const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(rr, 2), L(0xb9c1c9));
  stone.position.set(LOC2.x + x, rr * 0.55, LOC2.z + z); stone.castShadow = true;
  scene.add(stone);
  obstacles.push({ x: LOC2.x + x, z: LOC2.z + z, r: rr + 0.08 });
}

// ----- СТРЕКОЗЫ над речкой (дневное оживление Л2) -----
const dragonflies = [];
for (let i = 0; i < 3; i++) {
  const g = new THREE.Group();
  const bodyDf = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.5, 4, 8),
    new THREE.MeshBasicMaterial({ color: [0x35a8e8, 0xe87e9f, 0x4fc46a][i] }));
  bodyDf.rotation.z = Math.PI / 2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8),
    new THREE.MeshBasicMaterial({ color: [0x35a8e8, 0xe87e9f, 0x4fc46a][i] }));
  head.position.set(0.29, 0.01, 0);
  g.add(bodyDf, head);
  // четыре прозрачных крылышка: две пары вдоль тельца
  const wings = [];
  const wGeo = new THREE.PlaneGeometry(0.09, 0.3);
  const wMat = new THREE.MeshBasicMaterial({ color: 0xeaf8ff, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
  for (const [wx, wz, dir] of [[0.07, 0.16, 1], [0.07, -0.16, -1], [-0.07, 0.14, 1], [-0.07, -0.14, -1]]) {
    const w = new THREE.Mesh(wGeo, wMat);
    w.position.set(wx, 0.05, wz); w.rotation.x = -Math.PI / 2;
    g.add(w); wings.push({ w, dir });
  }
  g.userData = { wings, t: i * 2.3, cz: LOC2.z - 4 + i * 4.5 };
  scene.add(g);
  dragonflies.push(g);
}

// ----- ВОЛШЕБНАЯ АРКА (портал между локациями — по ГДД: ивовая арка + закрутка светлячков) -----
function makePortal() {
  const g = new THREE.Group();
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.17, 12, 30, Math.PI), L(0x8a5a3b));
  arch.castShadow = true;
  const arch2 = new THREE.Mesh(new THREE.TorusGeometry(1.86, 0.1, 10, 28, Math.PI), L(0x7ba05a));
  // светящаяся «плёнка» внутри арки
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.48, 26),
    new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false }));
  disc.position.y = 0.12;
  // закрутка светлячков
  const orbs = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex(), color: 0xaef2ff, transparent: true, depthWrite: false }));
    s.scale.setScalar(0.4);
    g.add(s); orbs.push(s);
  }
  g.add(arch, arch2, disc);
  g.userData = { orbs, disc };
  g.visible = false;
  return g;
}
const portalL1 = makePortal();
portalL1.position.set(12.4, 0.02, 0.2);
portalL1.rotation.y = Math.atan2(-12.4, -0.2); // лицом к центру полянки
scene.add(portalL1);
const portalL2 = makePortal();
portalL2.position.set(LOC2.x - 11.5, 0.02, LOC2.z + 3.0);
portalL2.rotation.y = Math.atan2(11.5, -3.0);
scene.add(portalL2);
obstacles.push({ x: 12.4, z: 0.2, r: 0.9 });
obstacles.push({ x: LOC2.x - 11.5, z: LOC2.z + 3.0, r: 0.9 });
// точка подхода к арке на Л1 — с СЕВЕРО-востока (с юга мешает бревнышко у пруда)
const PORTAL_APPR = [{ x: 10.9, z: -1.1 }, { x: LOC2.x - 10.0, z: LOC2.z + 3.0 }];
const LOC_EXIT = [
  { x: 11.15, z: -0.9, ry: -Math.PI / 2 },
  { x: LOC2.x - 10.05, z: LOC2.z + 3.0, ry: Math.atan2(10.05, -3) },
];
function revealPortal(withFx) {
  if (portalL1.visible) return;
  portalL1.visible = true;
  portalL2.visible = true;
  if (!withFx) return;
  spawnBurst(new THREE.Vector3(12.4, 1.6, 0.2), 16);
  play('drop');
}
portalL1.visible = starLit;
portalL2.visible = starLit;

// ============ БОБР-СТРОИТЕЛЬ (Локация 2) ============
function makeBeaver() {
  const g = new THREE.Group();
  const fur = L(0x8a5a3b);
  const darkFur = L(0x6f452c);
  const bodyG = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 18), fur);
  body.position.y = 0.55; body.scale.set(1, 0.94, 1.05); body.castShadow = true;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 14), L(0xd9b48a));
  belly.position.set(0, 0.5, 0.28); belly.scale.set(0.85, 0.85, 0.55);
  // мордочка с носиком и фирменными зубками
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), L(0x9a6b45));
  snout.position.set(0, 0.78, 0.48); snout.scale.set(1, 0.85, 0.9);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), L(0x4a2f22));
  nose.position.set(0, 0.86, 0.65);
  const toothM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const toothGeo = new THREE.BoxGeometry(0.055, 0.09, 0.03);
  const tL = new THREE.Mesh(toothGeo, toothM); tL.position.set(-0.035, 0.72, 0.645);
  const tR = new THREE.Mesh(toothGeo, toothM); tR.position.set(0.035, 0.72, 0.645);
  // глазки
  const eyeGeo = new THREE.SphereGeometry(0.055, 10, 10);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x2b2118 });
  const eL = new THREE.Mesh(eyeGeo, eyeM); eL.position.set(-0.17, 0.92, 0.42);
  const eR = new THREE.Mesh(eyeGeo, eyeM); eR.position.set(0.17, 0.92, 0.42);
  const glintGeo = new THREE.SphereGeometry(0.02, 8, 8);
  const glintM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const gl = new THREE.Mesh(glintGeo, glintM); gl.position.set(-0.155, 0.94, 0.465);
  const gr = new THREE.Mesh(glintGeo, glintM); gr.position.set(0.185, 0.94, 0.465);
  // ушки-кнопки
  const earGeo = new THREE.SphereGeometry(0.1, 10, 10);
  const earL = new THREE.Mesh(earGeo, darkFur); earL.position.set(-0.24, 1.02, 0.05); earL.scale.set(1, 1, 0.55);
  const earR = new THREE.Mesh(earGeo, darkFur); earR.position.set(0.24, 1.02, 0.05); earR.scale.set(1, 1, 0.55);
  // лапки держат дощечку — Бобр всегда при деле
  const pawGeo = new THREE.SphereGeometry(0.12, 10, 10);
  const pL = new THREE.Mesh(pawGeo, darkFur); pL.position.set(-0.3, 0.5, 0.42); pL.scale.set(0.85, 1.1, 0.85);
  const pR = new THREE.Mesh(pawGeo, darkFur); pR.position.set(0.3, 0.5, 0.42); pR.scale.set(0.85, 1.1, 0.85);
  const plank = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.5), L(0xd8a566));
  plank.position.set(0, 0.48, 0.5); plank.rotation.x = 0.5; plank.rotation.z = 0.12;
  // ножки
  const footGeo = new THREE.SphereGeometry(0.14, 10, 10);
  const fL = new THREE.Mesh(footGeo, darkFur); fL.position.set(-0.24, 0.12, 0.16); fL.scale.set(1.1, 0.55, 1.35);
  const fR = new THREE.Mesh(footGeo, darkFur); fR.position.set(0.24, 0.12, 0.16); fR.scale.set(1.1, 0.55, 1.35);
  // хвост-лопасть сзади — «визитная карточка» бобра
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.44, 14, 12), darkFur);
  tail.position.set(0, 0.14, -0.62); tail.scale.set(0.55, 0.15, 1.05);
  tail.castShadow = true;
  // косынка строителя — колечком на шейке (не на мордочке!)
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.08, 10, 18), L(0xe26d5c));
  scarf.position.set(0, 0.64, 0.06); scarf.rotation.x = Math.PI / 2;
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), L(0xd15a4a));
  knot.position.set(0, 0.6, 0.44); knot.scale.set(1.25, 0.9, 0.9);
  bodyG.add(body, belly, snout, nose, tL, tR, eL, eR, gl, gr, earL, earR, pL, pR, plank, fL, fR, scarf, knot);
  g.add(bodyG, tail);
  g.userData = { body: bodyG, tail };
  return g;
}
const BEAVER_POS = { x: LOC2.x + 2.7, z: LOC2.z + 3.7 };
const beaver = makeBeaver();
beaver.position.set(BEAVER_POS.x, 0.02, BEAVER_POS.z);
beaver.rotation.y = Math.atan2(LOC2.x - BEAVER_POS.x, LOC2.z - BEAVER_POS.z); // лицом к мостику
scene.add(beaver);
obstacles.push({ x: BEAVER_POS.x, z: BEAVER_POS.z, r: 0.55 });
beaver.scale.setScalar(1.14); // крупнее — читается и на телефоне
const BEAVER_APPR = { x: BEAVER_POS.x - 1.3, z: BEAVER_POS.z - 1.5 };
const beaverBubble = makeBubbleSprite('🔷', 1.0);
beaverBubble.position.set(BEAVER_POS.x, 2.35, BEAVER_POS.z);
scene.add(beaverBubble);
const beaverBubTex = {
  puzzle: beaverBubble.material.map,
  star: makeBubbleSprite('⭐', 1).material.map,
};
function setBeaverBubble(t) { beaverBubble.material.map = t; beaverBubble.material.needsUpdate = true; }

// ============ РЕЧНАЯ ЛЯГУШКА (Локация 2: узоры на цветных камушках) ============
// Та же героиня в новом месте: прискакала с пруда на речку — сказка цельная,
// а дети встречают знакомую подругу. Модель — клон, отличаем аксессуаром:
// розовая кувшинка на макушке (читается и с высокой камеры).
const FROG2_POS = { x: LOC2.x + 4.15, z: LOC2.z + 7.4 };  // восточный берег, рядом с кувшинками
const FROG2_APPR = { x: LOC2.x + 3.5, z: LOC2.z + 5.7 };  // открытая линия подхода по берегу
const frog2 = buildFrogGroup(); // своя постройка — не clone(): клон почему-то показывал спину
frog2.scale.setScalar(1.16); // как у прудовой: крупнее — читается и на телефоне
frog2.position.set(FROG2_POS.x, 0.02, FROG2_POS.z);
frog2.rotation.y = Math.atan2(FROG2_APPR.x - FROG2_POS.x, FROG2_APPR.z - FROG2_POS.z); // лицом к гостям
{
  // кувшинка-заколка: 6 розовых лепестков + золотая сердцевинка (сбоку макушки — видно всегда)
  const acc = new THREE.Group();
  const petalM = L(0xf7a8c9);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), petalM);
    p.position.set(Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1);
    p.scale.set(1.35, 0.4, 0.85);
    p.rotation.y = -a; // лепестками наружу
    acc.add(p);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffe27a }));
  core.position.y = 0.02;
  acc.add(core);
  acc.position.set(0.26, 0.85, 0.1); // сбоку на макушке, не задевая глаз
  acc.rotation.z = -0.5; acc.rotation.x = 0.25;
  frog2.userData.body.add(acc);
  // большая кувшинка-полянка у самой воды — её любимое место
  const pad2 = new THREE.Mesh(new THREE.CircleGeometry(1.0, 22), L(0x5fbf7a));
  pad2.rotation.x = -Math.PI / 2;
  pad2.position.set(FROG2_POS.x - 0.55, 0.055, FROG2_POS.z + 0.75);
  scene.add(pad2);
  // пара розовых цветков-кувшинок рядом — её «садик»
  for (const [ox, oz] of [[-1.15, 1.5], [-0.05, 1.95]]) {
    const bl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), petalM);
    bl.position.set(FROG2_POS.x + ox, 0.13, FROG2_POS.z + oz);
    bl.scale.set(1.25, 0.55, 1.25);
    scene.add(bl);
  }
}
scene.add(frog2);
obstacles.push({ x: FROG2_POS.x, z: FROG2_POS.z, r: 0.5 });

const frog2Bubble = makeBubbleSprite('🌺', 1.05);
frog2Bubble.position.set(FROG2_POS.x, 2.2, FROG2_POS.z);
scene.add(frog2Bubble);
const frog2BubTex = {
  puzzle: frog2Bubble.material.map,
  star: makeBubbleSprite('⭐', 1).material.map,
};
function setFrog2Bubble(t) { frog2Bubble.material.map = t; frog2Bubble.material.needsUpdate = true; }


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
  g.userData.gait = type || 'bunny'; // у каждого зверя — своя походка
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
const HOUSE_APPR = { x: -5.52, z: -3.78 }; // точка подхода — гарантированно вне зоны дома
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
  // ищем точку появления, свободную от деревьев и построек — волк не «вылезает» из кустов
  let sx = 0, sz = 0, tries = 0;
  do {
    const a = rand() * Math.PI * 2;
    sx = Math.cos(a) * (ISLAND_R - 2);
    sz = Math.sin(a) * (ISLAND_R - 2);
    tries++;
  } while (tries < 12 && obstacles.some(ob => Math.hypot(sx - ob.x, sz - ob.z) < ob.r + 1.0));
  const g = makeWolf();
  g.position.set(sx, 0, sz);
  scene.add(g);
  wolves.push({ g, mode: 'hunt', cooldown: 0, fadeT: 0, stuckT: 0, avoidT: 0, avoidSign: 1 });
}

// Мягкие облачка «пуф!» — эффектное исчезновение без «треугольников» прозрачности
let poofTex = null;
const poofs = [];
function getPoofTex() {
  if (poofTex) return poofTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  rg.addColorStop(0, 'rgba(255,252,240,0.95)');
  rg.addColorStop(0.55, 'rgba(238,236,222,0.5)');
  rg.addColorStop(1, 'rgba(238,236,222,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  poofTex = new THREE.CanvasTexture(c);
  return poofTex;
}
function spawnPoof(pos, n = 5) {
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getPoofTex(), transparent: true, depthWrite: false }));
    s.position.set(pos.x + (rand() - 0.5) * 1.0, pos.y + 0.35 + rand() * 0.6, pos.z + (rand() - 0.5) * 1.0);
    s.scale.setScalar(0.45 + rand() * 0.4);
    s.userData.life = 0;
    s.userData.maxLife = 0.55 + rand() * 0.3;
    scene.add(s);
    poofs.push(s);
  }
}

// Золотая стрелка-подсказка «иди сюда!» — ведёт малыша к Ёжику после вступления
function makeArrowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.lineJoin = 'round';
  g.fillStyle = '#ffd166'; g.strokeStyle = '#ffffff'; g.lineWidth = 9;
  g.beginPath();
  g.moveTo(64, 116);
  g.lineTo(26, 72); g.lineTo(47, 72); g.lineTo(47, 16);
  g.lineTo(81, 16); g.lineTo(81, 72); g.lineTo(102, 72);
  g.closePath();
  g.stroke(); g.fill();
  return new THREE.CanvasTexture(c);
}
const guideArrow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeArrowTex(), transparent: true, depthWrite: false }));
guideArrow.scale.set(0.85, 0.85, 1);
guideArrow.visible = false;
scene.add(guideArrow);
let guideOn = false;
let guideMode = 'hedge'; // 'hedge' | 'portal' | 'beaver'
const guidePos = { x: HEDGE_POS.x, y: 3.05, z: HEDGE_POS.z };
function showGuideArrow() {
  if (localStorage.getItem('wm_met_hedge') === '1') return; // ёжик уже знаком
  guideMode = 'hedge';
  guidePos.x = HEDGE_POS.x; guidePos.y = 3.05; guidePos.z = HEDGE_POS.z;
  guideOn = true;
  guideArrow.visible = true;
}
// та же стрелочка умеет вести и к другим местам (арка, Бобр)
function showGuideArrowAt(x, y, z, mode) {
  guideMode = mode;
  guidePos.x = x; guidePos.y = y; guidePos.z = z;
  guideOn = true;
  guideArrow.visible = true;
}
function hideGuideArrow(mode) {
  if (mode && guideMode !== mode) return; // чужую стрелку не гасим
  guideOn = false;
  guideArrow.visible = false;
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
let gameState = 'loading'; // loading | intro | explore | dialog | minigame | countgame | bridgegame | molegame | sqgame | stonegame | beavergame | celebrate | story | ceremony | travel
let dialogToken = 0;

// ============ УРОВЕНЬ СЛОЖНОСТИ ПО ВОЗРАСТУ (3–4 / 5–6) ============
// 0 = 3–4 года (базовый, самый бережный), 1 = 5–6 лет (чуть сложнее).
// Выбор — на первой заставке И в Родительском уголке; хранится в wm_age_group.
// Задания меняются только ПАРАМЕТРАМИ (без новых голосов): инструкции у всех
// мини-игр и так универсальные, поэтому правило «слова ≡ картинке» не нарушается.
let ageGroup = parseInt(localStorage.getItem('wm_age_group') || '0', 10);
function ageLevel() { return ageGroup; }
function setAgeGroup(v) {
  ageGroup = v;
  localStorage.setItem('wm_age_group', String(v));
  syncAgeUI();
}
function syncAgeUI() {
  document.querySelectorAll('#startGate .age-btns button').forEach(b =>
    b.classList.toggle('on', parseInt(b.dataset.age, 10) === ageGroup));
  document.querySelectorAll('#ageRow button').forEach(b =>
    b.classList.toggle('on', parseInt(b.dataset.age, 10) === ageGroup));
}
function clearPendings() {
  pendingHedge = pendingTree = pendingOwl = pendingFrog = pendingMole = pendingSq = pendingHouse = false;
  pendingBeaver = pendingPortal = pendingFrog2 = false;
  path = null; pathTarget = null; finalTarget = null;
}

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
  grantStickerForWater();
  watering = 1.4;
  pourRain();
  play('drop');
  stopVoice();
  const waterVoices = ['voice/tree_water.mp3', 'voice/tree_water_b.mp3', 'voice/tree_water_c.mp3'];
  speak(waterVoices[(treeWaters - 1) % 3]);
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
      if (treeStage === 3 && localStorage.getItem('wm_story3') !== '1') {
        localStorage.setItem('wm_story3', '1');
        setTimeout(() => showStory({ emoji: '🌟', voice: 'voice/story3.mp3',
          text: 'Чудесно! Звезда зажглась — благодаря тебе! Древо загадало желание: пусть на полянке всегда будет радостно!' }), 2600);
      }
    } else {
      treeRoot.scale.setScalar(1.12);
    }
  }, 1100);
}

// ============ АЛЬБОМ НАКЛЕЕК ============
// v2: у каждой наклейки есть своё место-силуэт. Награда открывается за каждый полив,
// а не за каждые три задания. Старые свободные позиции остаются в wm_album как резервная
// копия; при первом запуске их ключи бережно превращаются в уже приклеенные наклейки.
let tasksDone = parseInt(localStorage.getItem('wm_tasks') || '0', 10);
const STICKERS = [
  { emoji: '💧', name: 'капелька', x: 17, y: 23 },
  { emoji: '🌱', name: 'росток', x: 34, y: 77 },
  { emoji: '🍎', name: 'яблоко', x: 36, y: 48 },
  { emoji: '🦔', name: 'ёжик', x: 16, y: 73 },
  { emoji: '🌳', name: 'Древо', x: 50, y: 60 },
  { emoji: '🦉', name: 'сова', x: 48, y: 27 },
  { emoji: '🐸', name: 'лягушка', x: 70, y: 75 },
  { emoji: '🥕', name: 'морковка', x: 88, y: 73 },
  { emoji: '🐿️', name: 'белочка', x: 63, y: 49 },
  { emoji: '✨', name: 'светлячок', x: 74, y: 30 },
  { emoji: '⭐', name: 'звезда', x: 87, y: 16 },
  { emoji: '🌈', name: 'радуга', x: 48, y: 10 },
  // Глава 2: после обязательной истории остаётся целая необязательная страница.
  { emoji: '🎵', name: 'нотка', x: 17, y: 23 },
  { emoji: '🌟', name: 'сияющая звезда', x: 48, y: 10 },
  { emoji: '🌙', name: 'луна', x: 87, y: 16 },
  { emoji: '🎶', name: 'песенка', x: 74, y: 30 },
  { emoji: '🎼', name: 'мелодия', x: 48, y: 27 },
  { emoji: '💫', name: 'огонёк', x: 63, y: 49 },
  { emoji: '🌉', name: 'волшебная арка', x: 50, y: 60 },
  { emoji: '🌿', name: 'веточка', x: 34, y: 77 },
  { emoji: '🪷', name: 'кувшинка', x: 70, y: 75 },
  { emoji: '🦫', name: 'бобр', x: 88, y: 73 },
  { emoji: '🪵', name: 'брёвнышко', x: 36, y: 48 },
  { emoji: '💎', name: 'речной камушек', x: 16, y: 73 },
];
const ALBUM_PAGES = [
  { title: '🌿 Глава 1', name: 'Друзья Полянки', from: 0, to: 12 },
  { title: '⭐ Глава 2', name: 'Песня Древа', from: 12, to: 24 },
];
const ALBUM_SCHEMA = '2';
const albumEl = document.getElementById('album');
const albumTabs = document.getElementById('albumTabs');
const albumSlots = document.getElementById('albumSlots');
const stickerTray = document.getElementById('stickerTray');
const albumHelp = document.getElementById('albumHelp');
const albumCap = document.getElementById('albumCap');
const albumBtn = document.getElementById('albumBtn');
const albumBadge = document.getElementById('albumBadge');
const stickerReward = document.getElementById('stickerReward');
const rewardSticker = document.getElementById('rewardSticker');
let albumUnlocked = 0;
let albumPlaced = new Set();
let selectedSticker = null;
let activeAlbumPage = 0;
let rewardTimer = 0;

function safeAlbumArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (e) { return []; }
}
function loadAlbumProgress() {
  const schema = localStorage.getItem('wm_album_schema');
  if (schema === ALBUM_SCHEMA) {
    albumUnlocked = parseInt(localStorage.getItem('wm_album_unlocked') || '0', 10);
    albumPlaced = new Set(safeAlbumArray('wm_album_placed'));
  } else {
    // v0.17.1 и раньше: открывалась одна наклейка за три задания, а wm_album хранил
    // координаты только тех наклеек, которые ребёнок уже двигал по странице.
    let legacyPlaced = [];
    try {
      const legacy = JSON.parse(localStorage.getItem('wm_album') || '{}');
      if (legacy && typeof legacy === 'object') legacyPlaced = Object.keys(legacy).map(Number);
    } catch (e) {}
    albumPlaced = new Set(legacyPlaced);
    const lastPlaced = legacyPlaced.length ? Math.max(...legacyPlaced) + 1 : 0;
    albumUnlocked = Math.max(Math.floor(tasksDone / 3), treeWaters, lastPlaced);
    localStorage.setItem('wm_album_schema', ALBUM_SCHEMA);
  }
  albumUnlocked = Math.max(0, Math.min(STICKERS.length, Number.isFinite(albumUnlocked) ? albumUnlocked : 0));
  albumPlaced = new Set([...albumPlaced]
    .map(Number)
    .filter(i => Number.isInteger(i) && i >= 0 && i < albumUnlocked && i < STICKERS.length));
  saveAlbumProgress();
}
function saveAlbumProgress() {
  localStorage.setItem('wm_album_schema', ALBUM_SCHEMA);
  localStorage.setItem('wm_album_unlocked', String(albumUnlocked));
  localStorage.setItem('wm_album_placed', JSON.stringify([...albumPlaced].sort((a, b) => a - b)));
  updateAlbumBadge();
}
function pendingStickerCount() {
  let count = 0;
  for (let i = 0; i < albumUnlocked; i++) if (!albumPlaced.has(i)) count++;
  return count;
}
function updateAlbumBadge() {
  const count = pendingStickerCount();
  if (albumBadge) {
    albumBadge.textContent = count > 9 ? '9+' : String(count);
    albumBadge.style.display = count ? 'flex' : 'none';
  }
  document.body.dataset.albumUnlocked = String(albumUnlocked);
  document.body.dataset.albumPlaced = String(albumPlaced.size);
}
function albumPageAvailable(pageIndex) {
  if (pageIndex === 0) return true;
  const page = ALBUM_PAGES[pageIndex];
  return albumUnlocked > page.from || localStorage.getItem('wm_story_all6') === '1';
}
function pagePlacedCount(pageIndex) {
  const page = ALBUM_PAGES[pageIndex];
  let count = 0;
  for (let i = page.from; i < page.to; i++) if (albumPlaced.has(i)) count++;
  return count;
}
function pagePendingCount(pageIndex) {
  const page = ALBUM_PAGES[pageIndex];
  let count = 0;
  for (let i = page.from; i < Math.min(page.to, albumUnlocked); i++) if (!albumPlaced.has(i)) count++;
  return count;
}
function albumStatusText() {
  const page = ALBUM_PAGES[activeAlbumPage];
  if (pagePlacedCount(activeAlbumPage) === page.to - page.from) return 'Страница собрана — получилась целая история!';
  if (pagePendingCount(activeAlbumPage) > 0) return 'Выбери наклейку внизу, а потом — её светлое место';
  return 'Поливай Древо — следующая наклейка появится после полива';
}
function renderAlbum(message = '') {
  if (!albumPageAvailable(activeAlbumPage)) activeAlbumPage = 0;
  const page = ALBUM_PAGES[activeAlbumPage];
  selectedSticker = selectedSticker !== null
    && selectedSticker >= page.from && selectedSticker < page.to
    && selectedSticker < albumUnlocked && !albumPlaced.has(selectedSticker)
    ? selectedSticker : null;
  albumSlots.innerHTML = '';
  stickerTray.innerHTML = '';
  albumTabs.innerHTML = '';

  ALBUM_PAGES.forEach((item, pageIndex) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'album-tab' + (pageIndex === activeAlbumPage ? ' on' : '');
    tab.textContent = item.title;
    tab.disabled = !albumPageAvailable(pageIndex);
    tab.setAttribute('aria-label', item.name);
    if (!tab.disabled) tab.addEventListener('click', () => {
      activeAlbumPage = pageIndex;
      selectedSticker = null;
      play('pop');
      renderAlbum();
    });
    albumTabs.appendChild(tab);
  });

  albumCap.textContent = `${page.name} • Собрано ${pagePlacedCount(activeAlbumPage)} из ${page.to - page.from}`;
  albumHelp.textContent = message || albumStatusText();

  STICKERS.slice(page.from, page.to).forEach((sticker, pageOffset) => {
    const i = page.from + pageOffset;
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'album-slot';
    slot.dataset.sticker = String(i);
    slot.style.setProperty('--x', sticker.x + '%');
    slot.style.setProperty('--y', sticker.y + '%');
    if (i >= albumUnlocked) {
      slot.classList.add('locked');
      slot.textContent = '✦';
      slot.disabled = true;
      slot.setAttribute('aria-label', 'закрытое место');
    } else {
      slot.textContent = sticker.emoji;
      slot.setAttribute('aria-label', albumPlaced.has(i) ? sticker.name + ' приклеена' : 'место: ' + sticker.name);
      if (albumPlaced.has(i)) {
        slot.classList.add('placed');
        slot.disabled = true;
      } else {
        slot.classList.add('ready');
        if (selectedSticker === i) slot.classList.add('match');
        slot.addEventListener('click', () => tryPlaceSticker(i, slot));
      }
    }
    albumSlots.appendChild(slot);

    const token = document.createElement('button');
    token.type = 'button';
    token.className = 'album-sticker';
    token.dataset.sticker = String(i);
    if (i >= albumUnlocked) {
      token.classList.add('locked');
      token.textContent = '✦';
      token.disabled = true;
      token.setAttribute('aria-label', 'наклейка ещё закрыта');
    } else {
      token.textContent = sticker.emoji;
      token.setAttribute('aria-label', 'наклейка ' + sticker.name);
      if (albumPlaced.has(i)) {
        token.classList.add('used');
        token.disabled = true;
      } else {
        if (selectedSticker === i) token.classList.add('selected');
        token.addEventListener('click', () => selectAlbumSticker(i));
      }
    }
    stickerTray.appendChild(token);
  });
}
function selectAlbumSticker(i) {
  selectedSticker = selectedSticker === i ? null : i;
  play('pickup');
  renderAlbum(selectedSticker === null
    ? albumStatusText()
    : `${STICKERS[i].emoji} Теперь найди такое же светлое место`);
}
function tryPlaceSticker(i, slot) {
  if (selectedSticker === null) {
    // Мягкая помощь для маленького ребёнка: тап по силуэту выбирает нужную наклейку,
    // но второй тап всё равно нужен, чтобы «приклеить» её осознанно.
    selectedSticker = i;
    play('pickup');
    renderAlbum(`${STICKERS[i].emoji} Наклейка выбрана — нажми на это место ещё раз`);
    return;
  }
  if (selectedSticker !== i) {
    slot.classList.remove('gentle-no'); void slot.offsetWidth; slot.classList.add('gentle-no');
    const correct = albumSlots.querySelector(`[data-sticker="${selectedSticker}"]`);
    if (correct) correct.classList.add('match');
    albumHelp.textContent = 'Попробуй ещё — нужное место мерцает ✨';
    play('bad');
    return;
  }
  const sticker = STICKERS[i];
  albumPlaced.add(i);
  selectedSticker = null;
  saveAlbumProgress();
  play('good');
  renderAlbum(`${sticker.emoji} Наклейка на своём месте!`);
}
function openAlbum() {
  selectedSticker = null;
  const firstWaiting = STICKERS.findIndex((_, i) => i < albumUnlocked && !albumPlaced.has(i));
  if (firstWaiting >= 0) activeAlbumPage = ALBUM_PAGES.findIndex(p => firstWaiting >= p.from && firstWaiting < p.to);
  renderAlbum();
  albumEl.style.display = 'block';
  play('pop');
}
function closeAlbum() {
  selectedSticker = null;
  albumEl.style.display = 'none';
}
function showStickerReward(i) {
  if (!stickerReward || !rewardSticker) return;
  rewardSticker.textContent = STICKERS[i].emoji;
  stickerReward.classList.remove('show'); void stickerReward.offsetWidth; stickerReward.classList.add('show');
  albumBtn.classList.remove('rewardPulse'); void albumBtn.offsetWidth; albumBtn.classList.add('rewardPulse');
  clearTimeout(rewardTimer);
  rewardTimer = setTimeout(() => stickerReward.classList.remove('show'), 3200);
}
function grantStickerForWater() {
  if (albumUnlocked >= STICKERS.length) return null;
  const i = albumUnlocked++;
  saveAlbumProgress();
  showStickerReward(i);
  return i;
}
function setAlbumTestState(unlocked, placed = []) {
  albumUnlocked = Math.max(0, Math.min(STICKERS.length, unlocked));
  albumPlaced = new Set(placed.filter(i => i >= 0 && i < albumUnlocked));
  saveAlbumProgress();
}

loadAlbumProgress();
if (albumBtn) albumBtn.addEventListener('click', openAlbum);
document.getElementById('albumClose').addEventListener('click', closeAlbum);
function onTaskDone() {
  tasksDone++;
  localStorage.setItem('wm_tasks', String(tasksDone));
}
// счётчики побед у каждого жителя — для «Как малыш растёт» в Родительском уголке
function bumpWin(k) {
  const key = 'wm_wins_' + k;
  localStorage.setItem(key, String(parseInt(localStorage.getItem(key) || '0', 10) + 1));
}

// ============ ДЛИННАЯ СКАЗКА: ГЛАВА «КОРЕШОК-РУЧЕЁК» ============
// Сначала ребёнок хотя бы раз помогает каждому из шести жителей. После приглашения
// Рассказчицы особое повторное задание Крота открывает ручеёк-росток. При этом
// повторные игры у всех жителей всегда остаются доступны.
const MEADOW_FRIEND_KEYS = ['wm_met_hedge', 'wm_met_owl', 'wm_met_frog', 'wm_met_mole', 'wm_met_sq', 'wm_met_fire'];
function haveMetAllMeadowFriends() {
  return MEADOW_FRIEND_KEYS.every(k => localStorage.getItem(k) === '1');
}
function isMoleSpecialReady() {
  return haveMetAllMeadowFriends()
    && localStorage.getItem('wm_mole_return_hint') === '1'
    && localStorage.getItem('wm_story_mole') !== '1';
}
let sproutGroup = null;
const sproutDots = [];
let sproutGrowT = -1; // -1 = уже выросла (или ещё не начата), >=0 = идёт волна роста
function buildSprout() {
  if (sproutGroup) return sproutGroup;
  sproutGroup = new THREE.Group();
  const N = 13;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    // неровная земляная дорожка от норки к Древу
    const x = MOLE_POS.x + (TREE_POS.x - MOLE_POS.x) * t + Math.sin(t * Math.PI * 3) * 0.4;
    const z = MOLE_POS.z + (TREE_POS.z - MOLE_POS.z) * t + Math.cos(t * Math.PI * 2.2) * 0.3;
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xcde86a, transparent: true, opacity: 0.65, depthWrite: false })
    );
    dot.position.set(x, 0.07, z);
    dot.userData.idx = i;
    sproutGroup.add(dot);
    sproutDots.push(dot);
  }
  // маленький росток у подножия Дерева
  const spr = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.38, 6), L(0x6fbf4a));
  stem.position.y = 0.19;
  const lfGeo = new THREE.SphereGeometry(0.12, 8, 6);
  const lfL = new THREE.Mesh(lfGeo, L(0x86d957)); lfL.scale.set(1.5, 0.42, 0.75); lfL.position.set(-0.13, 0.37, 0); lfL.rotation.z = 0.5;
  const lfR = lfL.clone(); lfR.position.x = 0.13; lfR.rotation.z = -0.5;
  spr.add(stem, lfL, lfR);
  spr.position.set(TREE_POS.x + 0.95, 0, TREE_POS.z + 0.65);
  sproutGroup.add(spr);
  sproutGroup.userData.leafSprout = spr;
  sproutGroup.visible = false;
  scene.add(sproutGroup);
  return sproutGroup;
}
function revealSprout() {
  buildSprout();
  sproutGroup.visible = true;
  sproutGrowT = 0; // волна роста в animate
  sproutDots.forEach(d => d.scale.setScalar(0.001));
  sproutGroup.userData.leafSprout.scale.setScalar(0.001);
}
// если историю уже открыли раньше — ручеёк всегда на месте
if (localStorage.getItem('wm_story_mole') === '1') {
  buildSprout();
  sproutGroup.visible = true;
}
function checkMoleStory() {
  // Защита от случайного раннего вызова: финал Крота возможен только после всех друзей.
  if (!isMoleSpecialReady()) return false;
  localStorage.setItem('wm_story_mole', '1');
  revealSprout();
  showStory({
    key: 'wm_story_mole', emoji: '💧', voice: 'voice/story_sprout.mp3',
    text: 'Крот сдержал слово! Смотри — от его норки к Дереву потянулся светящийся ручеёк-росток! Древо теперь пьёт и под землёй… Продолжение следует!',
  });
  return true;
}

// ============ МИНИ-ИГРА «УРОЖАЙНЫЙ ДЕНЬ» (отдельный экран) ============
const mgEl = document.getElementById('minigame');
const mgField = document.getElementById('mgField');
const mgFinger = document.getElementById('mgFinger');
const basketEls = { red: document.getElementById('basketRed'), green: document.getElementById('basketGreen') };
const mgDom = { apples: [], done: 0, total: 6, lastAction: 0, fingerFlip: 0 };

const MG_PAIRS = [
  { id: 'apples', a: '🍎', b: '🍏', ca: '#e26d5c', cb: '#7fb069' },
  { id: 'orange', a: '🍊', b: '🫐', ca: '#f2994c', cb: '#5b8fd9' },
  { id: 'berry', a: '🍓', b: '🍋', ca: '#e05263', cb: '#f2d24c' },
];
// у каждой пары фруктов — СВОЯ озвучка Ёжика, слова всегда совпадают с картинкой
const HEDGE_ASKS = {
  apples: 'voice/hedge_ask_a.mp3',
  orange: 'voice/hedge_ask_b.mp3',
  berry: 'voice/hedge_ask_c.mp3',
};
function openMinigame() {
  gameState = 'minigame';
  mgDom.done = 0;
  mgDom.lastAction = elapsed;
  mgDom.total = ageLevel() ? 8 : 6; // 5–6 лет: больше плодов — чуть больше работы
  if (!mgDom.pair) mgDom.pair = MG_PAIRS[Math.floor(rand() * MG_PAIRS.length)];
  document.getElementById('mgEmojiA').textContent = mgDom.pair.a;
  document.getElementById('mgDotA').style.background = mgDom.pair.ca;
  document.getElementById('mgEmojiB').textContent = mgDom.pair.b;
  document.getElementById('mgDotB').style.background = mgDom.pair.cb;
  basketEls.red.style.background = mgDom.pair.ca;
  basketEls.green.style.background = mgDom.pair.cb;
  mgEl.style.display = 'flex';
  mgFinger.style.display = 'none';
  Object.values(basketEls).forEach(b => b.classList.remove('glow'));
  // ждём кадр для раскладки
  requestAnimationFrame(() => {
    const rect = mgField.getBoundingClientRect();
    // убрать старые яблоки
    for (const a of mgDom.apples) a.el.remove();
    mgDom.apples = [];
    const half = mgDom.total / 2;
    const kinds = Array(half).fill('red').concat(Array(half).fill('green')).sort(() => rand() - 0.5);
    kinds.forEach((color, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const el = document.createElement('div');
      el.className = 'mg-apple';
      el.textContent = color === 'red' ? mgDom.pair.a : mgDom.pair.b;
      el.dataset.color = color;
      const x = Math.min(rect.width * (0.12 + col * 0.26) + rand() * 8, rect.width - 78);
      // полоса появления плодов — над корзинами, ровно в два ряда и на ЛЮБОЙ высоте экрана
      // (фикс v0.11.1: на низком поле старый зажим «-200» скидывал все плоды в одну кучу наверху)
      const zoneH = Math.max(rect.height - 150, 90);
      const y = Math.max(6, Math.min(rect.height * (0.04 + row * 0.42) + rand() * 6, zoneH));
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
  mgDom.pair = null;
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

// Кнопки подсказок 💡 во всех трёх играх (подсказка — только по желанию ребёнка)
document.getElementById('hintHedgeBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  play('hintGlow');
  mgDom.lastAction = elapsed - 100; // мгновенно включает свечение корзины и пальчик
});
document.getElementById('hintCountBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  play('hintGlow');
  const b = Array.from(cgAnswers.children).find(x => parseInt(x.textContent, 10) === cg.correct);
  if (b) {
    b.classList.add('glow');
    const r = b.getBoundingClientRect();
    cgFinger.style.left = (r.left + r.width * 0.18) + 'px';
    cgFinger.style.top = (r.top - 74) + 'px';
    cgFinger.style.display = 'block';
    cg.fingerShown = true;
  }
});
document.getElementById('hintBridgeBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  play('hintGlow');
  const b = Array.from(bgAnswers.children).find(x => x.dataset.e === bg.answer);
  if (b) {
    b.classList.add('glow');
    const r = b.getBoundingClientRect();
    bgFinger.style.left = (r.left + r.width * 0.18) + 'px';
    bgFinger.style.top = (r.top - 74) + 'px';
    bgFinger.style.display = 'block';
    bg.fingerShown = true;
  }
});

function startDialog() {
  gameState = 'dialog';
  const my = ++dialogToken;
  clearPendings();
  setBubble(bubTex.work);
  play('pop');
  stopVoice();
  hideGuideArrow('hedge');
  // фрукты выбираем ДО озвучки — Ёжик озвучивает именно то, что появится на экране
  mgDom.pair = MG_PAIRS[Math.floor(rand() * MG_PAIRS.length)];
  speak(localStorage.getItem('wm_met_hedge') === '1' ? 'voice/hedge_again.mp3' : 'voice/hedge_hello.mp3');
  speak(HEDGE_ASKS[mgDom.pair.id], { after: true });
  const dx = HEDGE_POS.x - hero.position.x, dz = HEDGE_POS.z - hero.position.z;
  hero.rotation.y = Math.atan2(dx, dz);
  setTimeout(() => { if (gameState === 'dialog' && my === dialogToken) openMinigame(); }, 2400);
}

function celebrate() {
  gameState = 'celebrate';
  dropsCount++;
  refreshDrops(true);
  onTaskDone();
  stopVoice();
  play('fanfare');
  localStorage.setItem('wm_met_hedge', '1'); bumpWin('hedge');
  setTimeout(() => play('drop'), 450);
  setTimeout(() => speak('voice/hedge_win.mp3'), 600);
  spawnBurst(new THREE.Vector3(HEDGE_POS.x, 1.4, HEDGE_POS.z), 14);
  spawnBurst(hero.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 12);
  setBubble(bubTex.star);
  hedgeBubble.visible = true;
  setTimeout(() => {
    gameState = 'explore';
    setBubble(bubTex.apple);
    checkStory();
  }, 2600);
}

// ============ МИНИ-ИГРА «СЧИТАЙ-КА» (Сова, отдельный экран) ============
const cgEl = document.getElementById('countgame');
const cgItems = document.getElementById('cgItems');
const cgAnswers = document.getElementById('cgAnswers');
const cgFinger = document.getElementById('cgFinger');
const cg = { round: 0, total: 2, correct: 0, lastAction: 0, answered: false, fingerShown: false };
const CG_SETS = ['🍓', '🌼', '🍄', '⭐', '🐞', '🍒'];
const CG_ASKS = {
  '🍓': 'voice/ask_berry.mp3', '🌼': 'voice/ask_flower.mp3', '🍄': 'voice/ask_mushroom.mp3',
  '⭐': 'voice/ask_star.mp3', '🐞': 'voice/ask_bug.mp3', '🍒': 'voice/ask_cherry.mp3',
};

function startOwlDialog() {
  gameState = 'dialog';
  const my = ++dialogToken;
  clearPendings();
  setOwlBubble(owlBubTex.count);
  play('pop');
  stopVoice();
  speak(localStorage.getItem('wm_met_owl') === '1' ? 'voice/sova_again.mp3' : 'voice/sova_hello.mp3');
  const dx = OWL_POS.x - hero.position.x, dz = OWL_POS.z - hero.position.z;
  hero.rotation.y = Math.atan2(dx, dz);
  setTimeout(() => { if (gameState === 'dialog' && my === dialogToken) openCountGame(); }, 3000);
}

function openCountGame() {
  gameState = 'countgame';
  cg.round = 0;
  cgEl.style.display = 'flex';
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

  const lv = ageLevel();
  const n = lv
    ? (cg.round === 1 ? 3 + Math.floor(rand() * 4) : 5 + Math.floor(rand() * 5)) // 5–6: 3..6, 5..9
    : (cg.round === 1 ? 2 + Math.floor(rand() * 3) : 3 + Math.floor(rand() * 3)); // 3–4: 2..4, 3..5
  cg.correct = n;
  const emoji = CG_SETS[Math.floor(rand() * CG_SETS.length)];
  // Сова называет именно те картинки, что на экране (договаривает после приветствия)
  speak((CG_ASKS[emoji] || 'voice/sova_ask.mp3'), { after: true });

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
  const cap = lv ? 10 : 7; // старшие считают до 9 — и варианты ответов шире
  while (opts.size < 3 && guard++ < 60) {
    opts.add(Math.max(1, Math.min(cap, n - 2 + Math.floor(rand() * 5))));
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
      else { buildCountRound(); }
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
  stopVoice();
  play('fanfare');
  localStorage.setItem('wm_met_owl', '1'); bumpWin('owl');
  setTimeout(() => play('drop'), 450);
  setTimeout(() => speak('voice/sova_win.mp3'), 600);
  spawnBurst(new THREE.Vector3(OWL_POS.x, 1.6, OWL_POS.z), 14);
  spawnBurst(hero.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 12);
  setOwlBubble(owlBubTex.star);
  owlBubble.visible = true;
  setTimeout(() => {
    gameState = 'explore';
    setOwlBubble(owlBubTex.count);
    checkStory();
  }, 2600);
}

// ============ МИНИ-ИГРА «ВОЛШЕБНЫЙ МОСТИК» (Лягушка, узоры-логика) ============
const bgEl = document.getElementById('bridgegame');
const bgRow = document.getElementById('bgRow');
const bgAnswers = document.getElementById('bgAnswers');
const bgFinger = document.getElementById('bgFinger');
const bg = { round: 0, total: 2, answer: '', lastAction: 0, answered: false, fingerShown: false, shore: false };
const BG_POOL = ['🍄', '🌼', '⭐', '🐞', '🍀', '🍇'];
const BG_POOL2 = ['🔴', '🔵', '🟡', '🟢', '🟣', '🟠']; // цветные речные камушки (Локация 2)

function startFrogDialog() {
  gameState = 'dialog';
  const my = ++dialogToken;
  clearPendings();
  setFrogBubble(frogBubTex.puzzle);
  play('pop');
  stopVoice();
  speak(localStorage.getItem('wm_met_frog') === '1' ? 'voice/frog_again.mp3' : 'voice/frog_hello.mp3');
  const dx = FROG_POS.x - hero.position.x, dz = FROG_POS.z - hero.position.z;
  hero.rotation.y = Math.atan2(dx, dz);
  setTimeout(() => { if (gameState === 'dialog' && my === dialogToken) openBridgeGame(); }, 3200);
}

function startFrog2Dialog() {
  gameState = 'dialog';
  const my = ++dialogToken;
  clearPendings();
  setFrog2Bubble(frog2BubTex.puzzle);
  play('pop');
  stopVoice();
  speak(localStorage.getItem('wm_met_frog2') === '1' ? 'voice/frog2_again.mp3' : 'voice/frog2_hello.mp3');
  const dx = FROG2_POS.x - hero.position.x, dz = FROG2_POS.z - hero.position.z;
  hero.rotation.y = Math.atan2(dx, dz);
  setTimeout(() => { if (gameState === 'dialog' && my === dialogToken) openBridgeGame(true); }, 3200);
}

function openBridgeGame(shore) {
  gameState = 'bridgegame';
  bg.round = 0;
  bg.shore = !!shore;
  // 5–6 лет: у речной Лягушки все 3 раунда (в т.ч. А-Б-В); 3–4 года: 2 раунда попроще
  bg.total = shore ? (ageLevel() ? 3 : 2) : 2;
  bgEl.querySelector('.cg-title').textContent = bg.shore ? '🌺 Речные камушки' : '🐸 Волшебный мостик';
  bgEl.style.display = 'flex';
  speak('voice/frog_ask.mp3', { after: true });
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

  // три разных картинки для узора: на полянке — предметы, на берегу — ЦВЕТНЫЕ камушки
  const picks = [];
  const pool = [...(bg.shore ? BG_POOL2 : BG_POOL)];
  while (picks.length < 3) picks.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  const [A, B, C] = picks;

  // шаблоны узоров: [показанные..., правильный следующий]
  let shown, answer;
  if (!bg.shore) {
    if (bg.round === 1) { shown = [A, B, A, B]; answer = A; } // А-Б-А-Б-?
    else {
      // 3–4 года: узор из двух фигур; 5–6 лет: три фигуры (А-Б-В) — посложнее
      const t = ageLevel() ? 2 : Math.floor(rand() * 2);
      if (t === 0) { shown = [A, A, B, A, A]; answer = B; }      // А-А-Б-А-А-?
      else if (t === 1) { shown = [A, B, B, A, B]; answer = B; } // А-Б-Б-А-Б-?
      else { shown = [A, B, C, A, B]; answer = C; }              // А-Б-В-А-Б-?
    }
  } else {
    // берег: длиннее и чуть хитрее (расширение «Волшебного мостика», темп тот же комфортный)
    if (bg.round === 1) { shown = [A, A, B, A, A]; answer = B; }         // А-А-Б-А-А-?
    else if (bg.round === 2) { shown = [A, B, B, A, B, B]; answer = A; } // А-Б-Б-А-Б-Б-?
    else { shown = [A, B, C, A, B, C]; answer = A; }                     // А-Б-В-А-Б-В-?
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
    b.dataset.e = v; // обязательно: 💡 и авто-подсказки находят правильную кнопку по нему
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
      if (bg.round >= bg.total) { closeBridgeGame(); celebrateFrog(bg.shore); }
      else { buildBridgeRound(); }
    }, 900);
  } else {
    play('bad');
    btn.classList.add('shake');
    setTimeout(() => btn.classList.remove('shake'), 420);
  }
}

function celebrateFrog(shore) {
  gameState = 'celebrate';
  dropsCount++;
  refreshDrops(true);
  onTaskDone();
  stopVoice();
  play('fanfare');
  const px = shore ? FROG2_POS : FROG_POS;
  localStorage.setItem(shore ? 'wm_met_frog2' : 'wm_met_frog', '1'); bumpWin(shore ? 'frog2' : 'frog');
  setTimeout(() => play('drop'), 450);
  setTimeout(() => speak(shore ? 'voice/frog2_win.mp3' : 'voice/frog_win.mp3'), 600);
  spawnBurst(new THREE.Vector3(px.x, 1.4, px.z), 14);
  spawnBurst(hero.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 12);
  if (shore) { setFrog2Bubble(frog2BubTex.star); frog2Bubble.visible = true; }
  else { setFrogBubble(frogBubTex.star); frogBubble.visible = true; }
  setTimeout(() => {
    gameState = 'explore';
    if (shore) setFrog2Bubble(frog2BubTex.puzzle); else setFrogBubble(frogBubTex.puzzle);
    checkStory();
  }, 2600);
}

// ============ МИНИ-ИГРА «ВЕРНИ МОРКОВКУ!» (Крот, отдельный экран) ============
// Механика: Крот выглядывает из норок. Если в лапках МОРКОВКА — стучим ловчее,
// возвращаем её на грядку (счёт до 6). Если лапки пустые — это Крот просто поздороваться
// выскочил: его не трогаем (учим вниманию и выбору по признаку). Zero Fail: промах/ошибка
// никогда не наказываются, морковки не убавляются, игра никогда не «проигрывается».
const mlEl = document.getElementById('molegame');
const mlField = document.getElementById('mlField');
const mlFinger = document.getElementById('mlFinger');
const mlCounter = document.getElementById('mlCounter');
const ML_ROW = 6;  // этап 1: ряд из 5 норок внизу (как раньше)
// 3–4 года: только ряд (6 морковок). 5–6 лет: ряд + большое поле 3×3 (12 морковок).
function mlAll() { return ageLevel() ? 12 : 6; }
const ml = { holes: [], got: 0, timer: 0, lastAction: 0, slow: 0, fingerShown: false, stage: 1 };
// true только для повторного задания после помощи всем шести жителям.
// На обычные повторные игры это не влияет.
let moleSpecialRun = false;

const MOLE_SVG = '<svg viewBox="0 0 100 100" aria-hidden="true">'
  + '<ellipse cx="20" cy="76" rx="11" ry="6" fill="#5c4030"/>'
  + '<ellipse cx="80" cy="76" rx="11" ry="6" fill="#5c4030"/>'
  + '<circle cx="50" cy="52" r="30" fill="#6b4f3a"/>'
  + '<path d="M20 45 A30 30 0 0 1 80 45 Z" fill="#f2c94c"/>'
  + '<ellipse cx="50" cy="46" rx="31" ry="4.5" fill="#d9ad3a"/>'
  + '<circle cx="50" cy="26" r="6.5" fill="#fff3b0"/>'
  + '<circle cx="38" cy="53" r="4" fill="#2b2118"/><circle cx="62" cy="53" r="4" fill="#2b2118"/>'
  + '<circle cx="39.3" cy="51.7" r="1.3" fill="#ffffff"/><circle cx="63.3" cy="51.7" r="1.3" fill="#ffffff"/>'
  + '<ellipse cx="50" cy="65" rx="9.5" ry="7" fill="#d99a90"/>'
  + '<circle cx="50" cy="62.2" r="3.2" fill="#c9768a"/>'
  + '</svg>';

function startMoleDialog() {
  gameState = 'dialog';
  const my = ++dialogToken;
  clearPendings();
  hideGuideArrow('mole-special');
  play('pop');
  stopVoice();
  moleSpecialRun = isMoleSpecialReady();
  if (moleSpecialRun) {
    speak('voice/mole_special.mp3');
  } else {
    speak(localStorage.getItem('wm_met_mole') === '1' ? 'voice/mole_again.mp3' : 'voice/mole_hello.mp3');
    speak('voice/mole_ask.mp3', { after: true });
  }
  const dx = MOLE_POS.x - hero.position.x, dz = MOLE_POS.z - hero.position.z;
  hero.rotation.y = Math.atan2(dx, dz);
  const wait = moleSpecialRun ? 7600 : 2600;
  setTimeout(() => { if (gameState === 'dialog' && my === dialogToken) openMoleGame(); }, wait);
}
function makeMoleHole() {
  const hole = document.createElement('div');
  hole.className = 'ml-hole';
  const mound = document.createElement('div');
  mound.className = 'ml-mound';
  const b = document.createElement('button');
  b.className = 'ml-mole';
  b.type = 'button';
  b.setAttribute('aria-label', 'Крот в норке');
  b.innerHTML = MOLE_SVG + '<span class="ml-carrot">🥕</span>';
  const h = { hole, b, carr: null, up: false, carrot: false, t: 0 };
  h.carr = b.querySelector('.ml-carrot');
  b.addEventListener('pointerdown', (e) => { e.stopPropagation(); moleTap(h); });
  hole.appendChild(mound);
  hole.appendChild(b);
  return h;
}
function buildMoleField(big) {
  // big=false — ряд из 5 норок внизу (знакомый простой режим);
  // big=true  — поле «крестики-нолики» 3×3 с шестью норками по всему экрану
  mlField.innerHTML = '';
  mlField.classList.toggle('big', big);
  ml.holes = [];
  const cells = big ? [0, 2, 3, 5, 6, 8] : [0, 1, 2, 3, 4];
  const total = big ? 9 : 5;
  for (let c = 0; c < total; c++) {
    if (cells.indexOf(c) < 0) {
      const sp = document.createElement('div');
      sp.className = 'ml-spacer';
      mlField.appendChild(sp);
      continue;
    }
    const h = makeMoleHole();
    mlField.appendChild(h.hole);
    ml.holes.push(h);
  }
}
function openMoleGame() {
  gameState = 'molegame';
  ml.got = 0; ml.slow = 0; ml.fingerShown = false; ml.stage = 1;
  ml.lastAction = elapsed; ml.timer = 0.7;
  mlCounter.textContent = '🥕 0 из ' + mlAll();
  buildMoleField(false);
  mlEl.style.display = 'flex';
  mlFinger.style.display = 'none';
}
function closeMoleGame() {
  mlEl.style.display = 'none';
  mlFinger.style.display = 'none';
}
function moleDuck(h, fast) {
  h.up = false;
  h.b.classList.remove('up');
  h.hole.classList.remove('glow');
  ml.timer = Math.max(ml.timer, fast ? 0.7 : 0.95); // спокойные паузы между выглядываниями
}
function moleTap(h) {
  if (gameState !== 'molegame' || !h.up || ml.got >= mlAll()) return;
  ml.lastAction = elapsed;
  mlFinger.style.display = 'none';
  ml.fingerShown = false;
  ml.holes.forEach(x => x.hole.classList.remove('glow'));
  if (h.carrot) {
    ml.got++;
    mlCounter.textContent = '🥕 ' + ml.got + ' из ' + mlAll();
    play('good');
    h.b.classList.add('caught');
    setTimeout(() => h.b.classList.remove('caught'), 380);
    h.carrot = false;
    h.carr.style.display = 'none';
    moleDuck(h, true);
    ml.timer = 0.8; // следующий чуть погодя — темп комфортный малышу
    if (ml.stage === 1 && ml.got >= ML_ROW) {
      if (ageLevel()) {
        // 5–6 лет: маленькая победа — и ВТОРОЙ этап: Крот сам приглашает на большое поле!
        ml.stage = 2;
        ml.timer = 2.0;
        setTimeout(() => {
          if (gameState !== 'molegame') return;
          speak('voice/mole_field.mp3');
          buildMoleField(true);
          ml.lastAction = elapsed;
          ml.timer = 1.6;
        }, 850);
      } else {
        // 3–4 года: ряд пройден — сразу праздник (без большого поля)
        setTimeout(() => { if (gameState === 'molegame') { closeMoleGame(); celebrateMole(); } }, 700);
      }
    } else if (ml.got >= mlAll()) {
      setTimeout(() => { if (gameState === 'molegame') { closeMoleGame(); celebrateMole(); } }, 700);
    }
  } else {
    // лапки пустые — это просто привет! Мягкая «ошибка» без наказания: хихиканье и нырок
    play('bad');
    h.b.classList.add('giggle');
    setTimeout(() => h.b.classList.remove('giggle'), 420);
    moleDuck(h, true);
  }
}
document.getElementById('hintMoleBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  play('hintGlow');
  ml.slow = 8; // «не спеши»: 8 секунд Крот выглядывает подольше — для самых маленьких
  const btn = document.getElementById('hintMoleBtn');
  btn.classList.add('glow');
  setTimeout(() => btn.classList.remove('glow'), 8000);
});
function celebrateMole() {
  gameState = 'celebrate';
  const completedSpecialRun = moleSpecialRun;
  moleSpecialRun = false;
  dropsCount++;
  refreshDrops(true);
  onTaskDone();
  stopVoice();
  play('fanfare');
  localStorage.setItem('wm_met_mole', '1'); bumpWin('mole');
  setTimeout(() => play('drop'), 450);
  setTimeout(() => speak('voice/mole_win.mp3'), 600);
  spawnBurst(new THREE.Vector3(MOLE_POS.x, 1.4, MOLE_POS.z), 14);
  spawnBurst(hero.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 12);
  setTimeout(() => {
    gameState = 'explore';
    // Ручеёк появляется только после особого повторного задания.
    // Первое и любые обычные прохождения Крота остаются свободными.
    if (completedSpecialRun) checkMoleStory();
    else checkStory();
  }, 2600);
}

// ============ МИНИ-ИГРА «ПРЯТКИ-НОРКИ» (Белка, отдельный экран) ============
// Классика на память без проигрыша: Белка показывает оре́х на грибочке, «накрывает»
// его, и малыш вспоминает, где он. 3 раунда: 3, 3 и 4 грибочка (в последнем —
// местами меняются два грибочка — следим глазами). Ошибка — мягкий «плинг» и пробуем дальше.
const sqEl = document.getElementById('sqgame');
const sqField = document.getElementById('sqField');
const sqNut = document.getElementById('sqNut');
const sqFinger = document.getElementById('sqFinger');
const sqMsg = document.getElementById('sqMsg');
// 3–4 года: три раунда по 3 грибочка (без перестановок). 5–6 лет: финал — 4 грибочка + перестановки.
function sqRounds() {
  return ageLevel()
    ? [{ n: 3, shuffle: false }, { n: 3, shuffle: false }, { n: 4, shuffle: true }]
    : [{ n: 3, shuffle: false }, { n: 3, shuffle: false }, { n: 3, shuffle: false }];
}
const SQ_SLOTS = { 3: [18, 45, 72], 4: [12, 35, 58, 81] };
const sg = { round: 0, mushs: [], answer: 0, canTap: false, answered: false, lastAction: 0, fingerShown: false };

function startSqDialog() {
  gameState = 'dialog';
  const my = ++dialogToken;
  clearPendings();
  play('pop');
  stopVoice();
  speak(localStorage.getItem('wm_met_sq') === '1' ? 'voice/sq_again.mp3' : 'voice/sq_hello.mp3');
  speak('voice/sq_ask.mp3', { after: true });
  const dx = SQRL_POS.x - hero.position.x, dz = SQRL_POS.z - hero.position.z;
  hero.rotation.y = Math.atan2(dx, dz);
  setTimeout(() => { if (gameState === 'dialog' && my === dialogToken) openSqGame(); }, 2600);
}
function openSqGame() {
  gameState = 'sqgame';
  sg.round = 0;
  sg.rounds = sqRounds();
  sqEl.style.display = 'flex';
  sqFinger.style.display = 'none';
  buildSqRound();
}
function closeSqGame() {
  sqEl.style.display = 'none';
  sqFinger.style.display = 'none';
}
function buildSqRound() {
  const cfg = sg.rounds[sg.round];
  sg.mushs = [];
  sg.canTap = false; sg.answered = false; sg.fingerShown = false;
  sg.lastAction = elapsed;
  sqFinger.style.display = 'none';
  sqMsg.textContent = 'Смотри: вот оре́шек!';
  Array.from(sqField.querySelectorAll('.sq-shroom')).forEach(el => el.remove());
  const slots = SQ_SLOTS[cfg.n];
  for (let i = 0; i < cfg.n; i++) {
    const b = document.createElement('button');
    b.className = 'sq-shroom';
    b.type = 'button';
    b.textContent = '🍄';
    b.style.left = slots[i] + '%';
    b.dataset.idx = i;
    b.addEventListener('pointerdown', (e) => { e.stopPropagation(); sqTap(i); });
    sqField.appendChild(b);
    sg.mushs.push(b);
  }
  sg.answer = Math.floor(rand() * cfg.n);
  // Белка «выкладывает» орех на выбранный грибочек
  sqNut.style.top = '34%';
  sqNut.style.opacity = '1';
  sqNut.style.left = slots[sg.answer] + '%';
  sqNut.style.display = 'block';
  sqNut.classList.remove('pop'); void sqNut.offsetWidth; sqNut.classList.add('pop');
  setTimeout(() => {
    if (gameState !== 'sqgame') return;
    sqNut.style.display = 'none'; // грибочек «накрыл» орех!
    play('pop');
    const cover = sg.mushs[sg.answer];
    cover.classList.add('right');
    setTimeout(() => { if (cover) cover.classList.remove('right'); }, 550);
    sqMsg.textContent = 'Где оре́шек?';
    if (cfg.shuffle) {
      // внимание-внимание: грибочки плавно меняются местами!
      setTimeout(() => {
        if (gameState !== 'sqgame') return;
        sqSwap(0, 2); play('whoosh');
        setTimeout(() => {
          if (gameState !== 'sqgame') return;
          sqSwap(1, 3); play('whoosh');
          setTimeout(() => { sg.canTap = true; }, 680);
        }, 780);
      }, 500);
    } else {
      sg.canTap = true;
    }
  }, 1600);
}
function sqSwap(a, b) {
  if (!sg.mushs[a] || !sg.mushs[b]) return;
  const la = sg.mushs[a].style.left, lb = sg.mushs[b].style.left;
  sg.mushs[a].style.left = lb;
  sg.mushs[b].style.left = la;
}
function sqTap(i) {
  if (gameState !== 'sqgame' || !sg.canTap || sg.answered) return;
  sg.lastAction = elapsed;
  sg.fingerShown = false;
  sqFinger.style.display = 'none';
  sg.mushs.forEach(m => m.classList.remove('glow'));
  const btn = sg.mushs[i];
  if (i === sg.answer) {
    sg.answered = true;
    play('good');
    btn.classList.add('right');
    sqNut.style.left = btn.style.left;
    sqNut.style.top = '30%';
    sqNut.style.display = 'block';
    sqNut.classList.remove('pop'); void sqNut.offsetWidth; sqNut.classList.add('pop');
    sqMsg.textContent = 'Ура! Он здесь! 🎉';
    setTimeout(() => {
      if (gameState !== 'sqgame') return;
      sg.round++;
      if (sg.round >= sg.rounds.length) { closeSqGame(); celebrateSq(); }
      else buildSqRound();
    }, 1200);
  } else {
    // мягкий отказ: грибочек покачался, оре́х остаётся на месте — пробуем ещё
    play('bad');
    btn.classList.add('shake');
    setTimeout(() => { if (btn) btn.classList.remove('shake'); }, 450);
  }
}
document.getElementById('hintSqBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  play('hintGlow');
  if (gameState !== 'sqgame' || !sg.canTap || sg.answered) return;
  const right = sg.mushs[sg.answer];
  if (!right) return;
  // «подсмотреть»: грибочек слегка приподнимается и виден краешек ореха
  right.classList.add('glow');
  right.style.transform = 'translate(-50%, -74%)';
  sqNut.style.left = right.style.left;
  sqNut.style.opacity = '0.55';
  sqNut.style.display = 'block';
  setTimeout(() => {
    right.style.transform = '';
    right.classList.remove('glow');
    sqNut.style.opacity = '1';
    if (gameState === 'sqgame' && !sg.answered) sqNut.style.display = 'none';
  }, 900);
});
function celebrateSq() {
  gameState = 'celebrate';
  dropsCount++;
  refreshDrops(true);
  onTaskDone();
  stopVoice();
  play('fanfare');
  localStorage.setItem('wm_met_sq', '1'); bumpWin('sq');
  setTimeout(() => play('drop'), 450);
  setTimeout(() => speak('voice/sq_win.mp3'), 600);
  spawnBurst(new THREE.Vector3(SQRL_POS.x, 1.4, SQRL_POS.z), 14);
  spawnBurst(hero.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 12);
  setSqBubble(sqBubTex.star);
  sqBubble.visible = true;
  setTimeout(() => {
    gameState = 'explore';
    setSqBubble(sqBubTex.nut);
    checkStory();
  }, 2600);
}

// ============ МИНИ-ИГРА СВЕТЛЯЧКА «ЗВОНКИЕ КАМНИ» (музыкальная память) ============
// Правила: Светлячок играет песенку на камушках-нотках, ребёнок повторяет.
// Zero Fail: ошибся — мягкий «плинг», Светлячок играет песенку ещё раз, медленнее.
const ST_NOTE_CSS = ['#f28ba8', '#f5b45e', '#f7e07a', '#8fd694', '#8fc3f0'];
// 3–4 года: песенки короче (2–3 ноты). 5–6 лет: до 4 нот.
function stRounds() { return ageLevel() ? [2, 3, 4] : [2, 2, 3]; }
const stEl = document.getElementById('stonegame');
const stField = document.getElementById('stField');
const stMsg = document.getElementById('stMsg');
const stProg = document.getElementById('stProg');
const stFinger = document.getElementById('stFinger');
const st = { round: 0, seq: [], input: 0, canTap: false, lastAction: 0, fingerShown: false, stones: [], timers: [] };

function startSvetDialog() {
  gameState = 'dialog';
  const my = ++dialogToken;
  clearPendings();
  play('pop');
  stopVoice();
  speak(localStorage.getItem('wm_met_fire') === '1' ? 'voice/svet_again.mp3' : 'voice/svet_hello.mp3');
  const dx = FIRE_POS.x - hero.position.x, dz = FIRE_POS.z - hero.position.z;
  hero.rotation.y = Math.atan2(dx, dz);
  setTimeout(() => { if (gameState === 'dialog' && my === dialogToken) openStoneGame(); }, 2400);
}
function openStoneGame() {
  gameState = 'stonegame';
  st.round = 0;
  st.rounds = stRounds();
  st.timers.forEach(clearTimeout); st.timers = [];
  stField.innerHTML = '';
  st.stones = [];
  for (let i = 0; i < ST_NOTES.length; i++) {
    const b = document.createElement('button');
    b.className = 'st-stone';
    b.type = 'button';
    b.style.background = ST_NOTE_CSS[i];
    b.dataset.idx = i;
    b.setAttribute('aria-label', 'камушек ' + (i + 1));
    b.addEventListener('pointerdown', (e) => { e.stopPropagation(); stTap(i); });
    stField.appendChild(b);
    st.stones.push(b);
  }
  stEl.style.display = 'flex';
  stFinger.style.display = 'none';
  buildStRound();
}
function closeStoneGame() {
  st.canTap = false;
  st.timers.forEach(clearTimeout); st.timers = [];
  stEl.style.display = 'none';
  stFinger.style.display = 'none';
}
function buildStRound() {
  st.seq = [];
  let prev = -1;
  for (let i = 0; i < st.rounds[st.round]; i++) {
    let n = Math.floor(Math.random() * ST_NOTES.length);
    if (n === prev) n = (n + 1 + Math.floor(Math.random() * 3)) % ST_NOTES.length; // без одинаковых подряд
    st.seq.push(n); prev = n;
  }
  st.input = 0;
  st.canTap = false; st.fingerShown = false;
  st.lastAction = elapsed;
  stFinger.style.display = 'none';
  st.stones.forEach(s => { s.classList.remove('glow', 'lit', 'shake'); s.disabled = true; });
  stProg.innerHTML = st.rounds.map((_, i) => `<i class="${i < st.round ? 'on' : ''}"></i>`).join('');
  stMsg.textContent = 'Слушай песенку…';
  st.timers.push(setTimeout(() => stPlaySeq(1, () => {
    if (gameState !== 'stonegame') return;
    stMsg.textContent = 'Твоя очередь!';
    st.stones.forEach(s => { s.disabled = false; });
    st.canTap = true;
    st.lastAction = elapsed;
  }), 650));
}
// Светлячок играет песенку: камушки подсвечиваются и звенят по очереди
function stPlaySeq(tempo, cb) {
  const step = 640 * tempo, litFor = 430 * tempo;
  st.seq.forEach((note, i) => {
    st.timers.push(setTimeout(() => {
      if (gameState !== 'stonegame') return;
      const el = st.stones[note];
      el.classList.add('lit');
      playNote(ST_NOTES[note].f);
      stFireflyPulse();
      st.timers.push(setTimeout(() => el.classList.remove('lit'), litFor));
    }, i * step));
  });
  st.timers.push(setTimeout(() => { if (cb) cb(); }, st.seq.length * step + 220 * tempo));
}
// фонарик Светлячка подмигивает в такт (видно за прозрачной карточкой)
function stFireflyPulse() {
  const { bulb } = firefly.userData;
  bulb.scale.set(1.15, 1.55, 1.12);
  setTimeout(() => bulb.scale.set(0.9, 1.2, 0.9), 300);
}
function stTap(i) {
  if (gameState !== 'stonegame' || !st.canTap) return;
  st.lastAction = elapsed;
  st.fingerShown = false;
  stFinger.style.display = 'none';
  st.stones.forEach(s => s.classList.remove('glow'));
  const el = st.stones[i];
  el.classList.add('lit');
  setTimeout(() => el.classList.remove('lit'), 260);
  if (i === st.seq[st.input]) {
    playNote(ST_NOTES[i].f, { dur: 0.42 });
    st.input++;
    if (st.input >= st.seq.length) {
      st.canTap = false;
      st.stones.forEach(s => { s.disabled = true; });
      play('good');
      stMsg.textContent = 'Ура! Песенка получилась! 🎉';
      stProg.innerHTML = st.rounds.map((_, k) => `<i class="${k <= st.round ? 'on' : ''}"></i>`).join('');
      st.timers.push(setTimeout(() => {
        if (gameState !== 'stonegame') return;
        st.round++;
        if (st.round >= st.rounds.length) { closeStoneGame(); celebrateFirefly(); }
        else buildStRound();
      }, 1250));
    }
  } else {
    // мягкий отказ: «плинг», качание камушка — и Светлячок играет ещё раз, помедленнее
    play('bad');
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 450);
    st.canTap = false;
    st.stones.forEach(s => { s.disabled = true; s.classList.remove('glow'); });
    stFinger.style.display = 'none';
    st.input = 0;
    speak('voice/svet_try.mp3');
    stMsg.textContent = 'Слушай ещё разок…';
    st.timers.push(setTimeout(() => stPlaySeq(1.3, () => {
      if (gameState !== 'stonegame') return;
      stMsg.textContent = 'Теперь ты!';
      st.stones.forEach(s => { s.disabled = false; });
      st.canTap = true;
      st.lastAction = elapsed;
    }), 2300));
  }
}
document.getElementById('hintStBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  play('hintGlow');
  if (gameState !== 'stonegame' || !st.canTap) return;
  st.lastAction = elapsed;
  st.fingerShown = false;
  stFinger.style.display = 'none';
  const next = st.stones[st.seq[st.input]];
  if (!next) return;
  // честная подсказка: звенит и светится ровно тот камушек, который нужен сейчас
  next.classList.add('glow', 'lit');
  playNote(ST_NOTES[st.seq[st.input]].f);
  setTimeout(() => { next.classList.remove('lit'); }, 500);
});
function celebrateFirefly() {
  gameState = 'celebrate';
  dropsCount++;
  refreshDrops(true);
  onTaskDone();
  stopVoice();
  play('fanfare');
  localStorage.setItem('wm_met_fire', '1'); bumpWin('fire');
  setTimeout(() => play('drop'), 450);
  setTimeout(() => speak('voice/svet_win.mp3'), 600);
  spawnBurst(new THREE.Vector3(FIRE_POS.x, 1.4, FIRE_POS.z), 14);
  spawnBurst(hero.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 12);
  setSvetBubble(svetBubTex.star);
  svetBubble.visible = true;
  setTimeout(() => {
    gameState = 'explore';
    setSvetBubble(svetBubTex.note);
    checkStory();
  }, 2600);
}

// ============ МИНИ-ИГРА «ДОЩЕЧКИ ДЛЯ МОСТИКА» (Бобр, Локация 2) ============
// Механика: в мостике не хватает дощечек. У пустого места виден силуэт «окошка»
// определённой формы (круглое / квадратное / треугольное / прямоугольное) — малыш
// выбирает такую же среди запасных дощечек. Геометрические формы — тема 3–6 лет,
// озвучка всегда совпадает с картинкой (у каждой формы своя фраза-файл).
// Zero Fail: ошибка = мягкий «плинг» и покачивание, дощечки не отбираются.
const bvrEl = document.getElementById('beavergame');
const bvBridge = document.getElementById('bvBridge');
const bvAnswers = document.getElementById('bvAnswers');
const bvLabel = document.getElementById('bvLabel');
const bvFinger = document.getElementById('bvFinger');
const bv = { round: 0, total: 3, target: '', order: [], answered: false, lastAction: 0, fingerShown: false };
const BV_SHAPES = ['circle', 'square', 'triangle', 'rect'];
// 3–4 года: три формы (круг/квадрат/треугольник). 5–6 лет: все четыре (+ прямоугольник).
function bvShapes() { return ageLevel() ? BV_SHAPES : BV_SHAPES.slice(0, 3); }
const BV_ASK = {
  circle: 'voice/bobr_ask_circle.mp3', square: 'voice/bobr_ask_square.mp3',
  triangle: 'voice/bobr_ask_triangle.mp3', rect: 'voice/bobr_ask_rect.mp3',
};

function startBeaverDialog() {
  gameState = 'dialog';
  const my = ++dialogToken;
  clearPendings();
  hideGuideArrow('beaver');
  setBeaverBubble(beaverBubTex.puzzle);
  play('pop');
  stopVoice();
  speak(localStorage.getItem('wm_met_beaver') === '1' ? 'voice/bobr_again.mp3' : 'voice/bobr_hello.mp3');
  const dx = BEAVER_POS.x - hero.position.x, dz = BEAVER_POS.z - hero.position.z;
  hero.rotation.y = Math.atan2(dx, dz);
  setTimeout(() => { if (gameState === 'dialog' && my === dialogToken) openBeaverGame(); }, 3200);
}

function openBeaverGame() {
  gameState = 'beavergame';
  bv.round = 0;
  bv.total = ageLevel() ? 4 : 3;
  // порядок форм выбираем ДО озвучки: фраза Бобра всегда совпадает с картинкой
  bv.order = [...bvShapes()].sort(() => rand() - 0.5).slice(0, bv.total);
  bvrEl.style.display = 'flex';
  buildBeaverRound();
}
function closeBeaverGame() {
  bvrEl.style.display = 'none';
  bvFinger.style.display = 'none';
}

function buildBeaverRound() {
  bv.round++;
  bv.answered = false;
  bv.fingerShown = false;
  bv.lastAction = elapsed;
  bvBridge.innerHTML = '';
  bvAnswers.innerHTML = '';
  bvFinger.style.display = 'none';
  bv.target = bv.order[bv.round - 1];
  bvLabel.textContent = 'Какой дощечки не хватает?';

  // три окошка мостика: уложенные дощечки, текущее (силуэт-подсказка), пустые
  for (let i = 0; i < bv.total; i++) {
    const slot = document.createElement('div');
    if (i < bv.round - 1) {
      slot.className = 'bv-slot';
      const sh = document.createElement('span');
      sh.className = 'shp ' + bv.order[i];
      slot.appendChild(sh);
    } else if (i === bv.round - 1) {
      slot.className = 'bv-slot wait';
      slot.id = 'bvWait';
      const sh = document.createElement('span');
      sh.className = 'shp ' + bv.target + ' ghost';
      slot.appendChild(sh);
    } else {
      slot.className = 'bv-slot empty';
    }
    slot.style.animationDelay = (i * 0.08) + 's';
    bvBridge.appendChild(slot);
  }

  // варианты: нужная форма + соседи; 5–6 лет к третьему раунду — все четыре
  const nOpts = ageLevel() ? (bv.round >= 3 ? 4 : 3) : 3;
  const opts = [bv.target, ...bvShapes().filter(s => s !== bv.target)].slice(0, nOpts);
  opts.sort(() => rand() - 0.5).forEach(v => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cg-answer bv-answer';
    b.dataset.e = v;
    b.setAttribute('aria-label', 'дощечка');
    const sh = document.createElement('span');
    sh.className = 'shp ' + v;
    b.appendChild(sh);
    b.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    b.addEventListener('click', () => answerBeaver(v, b));
    bvAnswers.appendChild(b);
  });
  speak(BV_ASK[bv.target], { after: true });
}

function answerBeaver(v, btn) {
  if (gameState !== 'beavergame' || bv.answered) return;
  bv.lastAction = elapsed;
  bv.fingerShown = false;
  bvFinger.style.display = 'none';
  Array.from(bvAnswers.children).forEach(b => b.classList.remove('glow'));
  if (v === bv.target) {
    bv.answered = true;
    play('good');
    btn.classList.add('right');
    const wait = document.getElementById('bvWait');
    if (wait) {
      wait.classList.remove('wait');
      wait.classList.add('done');
      wait.innerHTML = '';
      const sh = document.createElement('span');
      sh.className = 'shp ' + v;
      wait.appendChild(sh);
    }
    setTimeout(() => {
      if (bv.round >= bv.total) { closeBeaverGame(); celebrateBeaver(); }
      else { buildBeaverRound(); }
    }, 950);
  } else {
    // мягкий отказ: покачались — и пробуем ещё
    play('bad');
    btn.classList.add('shake');
    setTimeout(() => btn.classList.remove('shake'), 420);
  }
}

function celebrateBeaver() {
  gameState = 'celebrate';
  dropsCount++;
  refreshDrops(true);
  onTaskDone();
  stopVoice();
  play('fanfare');
  localStorage.setItem('wm_met_beaver', '1'); bumpWin('beaver');
  setTimeout(() => play('drop'), 450);
  setTimeout(() => speak('voice/bobr_win.mp3'), 600);
  spawnBurst(new THREE.Vector3(BEAVER_POS.x, 1.4, BEAVER_POS.z), 14);
  spawnBurst(hero.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 12);
  setBeaverBubble(beaverBubTex.star);
  beaverBubble.visible = true;
  setTimeout(() => {
    gameState = 'explore';
    setBeaverBubble(beaverBubTex.puzzle);
    checkStory();
  }, 2600);
}

document.getElementById('hintBvrBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  play('hintGlow');
  const b = Array.from(bvAnswers.children).find(x => x.dataset.e === bv.target);
  if (b) {
    b.classList.add('glow');
    const r = b.getBoundingClientRect();
    bvFinger.style.left = (r.left + r.width * 0.18) + 'px';
    bvFinger.style.top = (r.top - 74) + 'px'; // пальчик НАД кнопкой — не закрывает форму
    bvFinger.style.display = 'block';
  }
  stopVoice();
  speak(BV_ASK[bv.target], { after: true });
});

// ============ СЮЖЕТНЫЕ КАРТОЧКИ («одна большая сказка») ============
const storyOv = document.getElementById('storyOv');
const storyEmoji = document.getElementById('storyEmoji');
const storyText = document.getElementById('storyText');
const STORIES = [
  { key: 'wm_story1', at: 2, emoji: '🌱', voice: 'voice/story1.mp3',
    text: 'Тише… слышишь? Древо Желаний шепчет: каждая добрая помощь делает его сильнее!' },
  { key: 'wm_story2', at: 5, emoji: '🌳', voice: 'voice/story2.mp3',
    text: 'Древо подросло! Оно мечтает вырасти большим и зажечь на макушке волшебную звезду…' },
];
function showStory(s) {
  if (gameState !== 'explore') return;
  gameState = 'story';
  storyEmoji.textContent = s.emoji;
  storyText.textContent = s.text;
  storyOv.style.display = 'flex';
  stopVoice();
  play('pop');
  speak(s.voice);
}
// После главы 2 (да и у «ветеранов» на старте): рассказчица зовёт к волшебной арке.
let pendingPortalArrow = false;
// После приглашения Рассказчицы стрелка мягко указывает на Крота.
let pendingMoleArrow = false;
function maybeAnnouncePortal() {
  if (!starLit || localStorage.getItem('wm_portal_seen') === '1') return;
  localStorage.setItem('wm_portal_seen', '1');
  revealPortal(false);
  pendingPortalArrow = true; // стрелочка к арке встанет сразу после закрытия карточки
  showStory({
    emoji: '🌉', voice: 'voice/portal_hint.mp3',
    text: 'Смотри! На краю полянки появилась волшебная арка из ивовых ветвей. За ней — Речной берег: там живёт Бобр-строитель. Подойди к арке — и она перенесёт нас в гости!',
  });
}
document.getElementById('storyNext').addEventListener('click', () => {
  storyOv.style.display = 'none';
  stopVoice();
  play('pop');
  if (ch2AfterCard) {
    // карточка главы 2 была приглашением — теперь сама церемония
    ch2AfterCard = false;
    setTimeout(() => startChoirCeremony(), 350);
  } else {
    gameState = 'explore';
    if (pendingMoleArrow) {
      pendingMoleArrow = false;
      showGuideArrowAt(MOLE_POS.x, 2.8, MOLE_POS.z, 'mole-special');
    } else if (pendingPortalArrow) {
      pendingPortalArrow = false;
      showGuideArrowAt(portalL1.position.x, 3.5, portalL1.position.z, 'portal');
    }
    // После карточки проверяем следующий сюжетный шаг. Например, после ручейка
    // можно показать подсказку о поливе или начать главу 2.
    setTimeout(() => { if (gameState === 'explore') checkStory(); }, 450);
    setTimeout(() => { if (gameState === 'explore') maybeAnnouncePortal(); }, 900);
  }
});
function checkStory() {
  for (const s of STORIES) {
    if (tasksDone >= s.at && localStorage.getItem(s.key) !== '1') {
      localStorage.setItem(s.key, '1');
      showStory(s);
      break;
    }
  }
  const allMet = haveMetAllMeadowFriends();

  // Сначала — приглашение к особому ПОВТОРНОМУ заданию Крота. Оно появляется
  // только после первой помощи каждому из шести жителей. Другие игры не блокируются.
  if (allMet && localStorage.getItem('wm_story_mole') !== '1') {
    if (localStorage.getItem('wm_mole_return_hint') !== '1' && gameState === 'explore') {
      localStorage.setItem('wm_mole_return_hint', '1');
      pendingMoleArrow = true;
      showStory({
        emoji: '🐾', voice: 'voice/mole_return_hint.mp3',
        text: 'Ты помог всем друзьям на полянке! Когда решишь двигаться дальше, зайди ещё раз к Кроту — кажется, у него есть особое задание для тебя.',
      });
    } else if (gameState === 'explore') {
      showGuideArrowAt(MOLE_POS.x, 2.8, MOLE_POS.z, 'mole-special');
    }
    return;
  }

  // ГЛАВА 2 «Звонкое созвучие» ждёт завершения особого задания и появления ручейка.
  if (allMet && localStorage.getItem('wm_story_mole') === '1'
      && localStorage.getItem('wm_story_all6') !== '1' && gameState === 'explore') {
    if (treeStage === 3) {
      localStorage.setItem('wm_story_all6', '1');
      setTimeout(() => { if (gameState === 'explore') startChapter2(); }, 900);
    } else if (localStorage.getItem('wm_story6hint') !== '1') {
      localStorage.setItem('wm_story6hint', '1');
      setTimeout(() => showStory({ emoji: '🌳', voice: 'voice/story2_hint.mp3',
        text: 'Ты помог всем шестерым друзьям! Осталось одно: поливай Древо капельками, чтобы оно доросло до звезды. Тогда друзья споют самую дружную песню!' }), 700);
    }
  }
}

// ============ ГЛАВА 2 «ЗВОНКОЕ СОЗВУЧИЕ» (церемония у Древа) ============
// Все жители собираются полукругом у Древа, каждый добавляет свой звук,
// Светлячок играет песенку на камушках — и звезда засияет для всей полянки.
// Zero Fail и здесь: церемония — чистая радость, награда за всю Локацию 1.
let ch2AfterCard = false;
let ch2Run = 0;           // защита от повторного запуска
let ch2Timers = [];
let ch2Gather = [];       // плавное схождение жителей к Древу (в animate)
let ch2Hops = new Map();  // радостные подскоки по битам
function startChapter2() {
  ch2AfterCard = true;
  showStory({ emoji: '🎵', voice: 'voice/story2_narr.mp3',
    text: 'Ты помог всем шестерым друзьям! Осталась одна мечта Древа: чтобы его звезда светила не только ему, а всей полянке. Нажимай «Дальше» — начинается самая дружная песня!' });
}
function startChoirCeremony() {
  const my = ++ch2Run;
  ch2Timers.forEach(clearTimeout); ch2Timers = [];
  gameState = 'ceremony';
  stopVoice();
  // герой встаёт перед Древом лицом к звезде
  const standX = TREE_POS.x, standZ = TREE_POS.z + 3.6;
  givePath(standX, standZ);
  // жители плавно сходятся полукругом на дальней стороне и по флангам
  const npcs = [hedgehog, owl, frog, mole, sq, firefly];
  const angles = [-2.2, -1.35, -0.5, 0.5, 1.35, 2.2];
  const names = ['hedge', 'owl', 'frog', 'mole', 'sq', 'fire'];
  ch2Gather = npcs.map((npc, i) => {
    const a = angles[i], r = 2.45;
    return {
      npc, name: names[i],
      ox: npc.position.x, oz: npc.position.z, ory: npc.rotation.y,
      tx: TREE_POS.x + Math.sin(a) * r, tz: TREE_POS.z + Math.cos(a) * r,
      try_: Math.atan2(TREE_POS.x - (TREE_POS.x + Math.sin(a) * r), TREE_POS.z - (TREE_POS.z + Math.cos(a) * r)),
      t: 0,
    };
  });
  // ждём, пока герой подойдёт (но не вечно), затем начинаем песню
  const waitHero = () => {
    if (my !== ch2Run) return;
    const d = Math.hypot(hero.position.x - standX, hero.position.z - standZ);
    if (d < 0.9 || (waitHero.tries = (waitHero.tries || 0) + 1) > 12) {
      hero.rotation.y = Math.atan2(TREE_POS.x - hero.position.x, TREE_POS.z - hero.position.z);
      ch2Beats(my);
    } else {
      ch2Timers.push(setTimeout(waitHero, 700));
    }
  };
  ch2Timers.push(setTimeout(waitHero, 2600));
}
function ch2Beats(my) {
  if (my !== ch2Run) return;
  // каждый житель добавляет свой звук (подскок + облачко вспыхивает)
  const beats = [
    { name: 'hedge', sfx: () => play('pop') },
    { name: 'owl', sfx: () => play('good') },
    { name: 'frog', sfx: () => play('pickup') },
    { name: 'mole', sfx: () => play('tickle') },
    { name: 'sq', sfx: () => play('whoosh') },
    { name: 'fire', sfx: () => [523.25, 659.25, 783.99, 880].forEach((f, i) => playNote(f, { delay: i * 0.14, dur: 0.4 })) },
  ];
  beats.forEach((b, i) => {
    ch2Timers.push(setTimeout(() => {
      if (my !== ch2Run) return;
      const g = ch2Gather.find(c => c.name === b.name);
      if (g) ch2Hops.set(g.npc, 0.5);
      b.sfx();
    }, 900 * (i + 1)));
  });
  // финальный аккорд: звезда ЗАСИЯЛА для всех
  ch2Timers.push(setTimeout(() => {
    if (my !== ch2Run) return;
    play('fanfare');
    setTimeout(() => play('drop'), 350);
    starLit = true;
    applyStarLit();
    revealPortal(true); // свет звезды открыл дорогу на новые земли — появилась волшебная арка
    const g3 = treeStages[3];
    if (g3 && g3.userData.halo) { // вспышка гала
      g3.userData.halo.scale.setScalar(4.2);
      g3.userData.halo.material.opacity = 1;
    }
    const starPos = new THREE.Vector3(TREE_POS.x, 3.65, TREE_POS.z);
    spawnBurst(starPos, 22);
    spawnBurst(starPos.clone().add(new THREE.Vector3(0.8, -0.5, 0.4)), 12);
    spawnBurst(starPos.clone().add(new THREE.Vector3(-0.8, -0.4, -0.3)), 12);
    ch2Gather.forEach(c => ch2Hops.set(c.npc, 0.55)); // все подпрыгивают от радости
    treeRoot.scale.setScalar(1.18);
  }, 900 * 7));
  // Древо благодарит
  ch2Timers.push(setTimeout(() => { if (my === ch2Run) speak('voice/story2_tree.mp3'); }, 900 * 8.2));
  // финал: карточка + жители возвращаются домой
  ch2Timers.push(setTimeout(() => {
    if (my !== ch2Run) return;
    gameState = 'story';
    storyEmoji.textContent = '🌟';
    storyText.textContent = 'Звезда засияла для всей полянки! По ночам вокруг Древа танцуют звонкие огоньки. Свет звезды — как маяк: по нём мы найдём новые земли. Продолжение следует!';
    storyOv.style.display = 'flex';
    // жители плавно плывут обратно на свои места (под карточкой)
    ch2Gather.forEach(c => {
      c.tx = c.ox; c.tz = c.oz; c.try_ = c.ory; c.goingHome = true;
    });
  }, 900 * 10.5));
}

// ============ НАВИГАЦИЯ A* ============
// Сетка «переезжает» вслед за героем: navOX/navOZ — левый нижний угол поля 16×16
// вокруг центра ТЕКУЩЕЙ локации. Препятствия обеих локаций уже мировые.
const NAV_N = 64, NAV_MIN = -16, NAV_CELL = 0.5;
let navOX = NAV_MIN, navOZ = NAV_MIN;
const navBlocked = new Uint8Array(NAV_N * NAV_N);
function cellOf(x, z) {
  return {
    i: Math.max(0, Math.min(NAV_N - 1, Math.round((x - navOX) / NAV_CELL))),
    j: Math.max(0, Math.min(NAV_N - 1, Math.round((z - navOZ) / NAV_CELL))),
  };
}
function worldOf(i, j) { return { x: navOX + i * NAV_CELL, z: navOZ + j * NAV_CELL }; }
function buildNavGrid() {
  navBlocked.fill(0);
  const cx = LOCS[curLoc].x, cz = LOCS[curLoc].z;
  for (let i = 0; i < NAV_N; i++) for (let j = 0; j < NAV_N; j++) {
    const { x, z } = worldOf(i, j);
    if (Math.hypot(x - cx, z - cz) > ISLAND_R - 0.7) { navBlocked[j * NAV_N + i] = 1; continue; }
    for (const ob of obstacles) {
      if (Math.hypot(x - ob.x, z - ob.z) < ob.r + 0.6) { navBlocked[j * NAV_N + i] = 1; break; }
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
// Убираем «сеточную рябь»: точки, отклоняющиеся от прямой соседей меньше чем на
// ~0.18 м — это не поворот, а дрожание квантования сетки 0.5 м. Без чистки герой
// бежит лесенкой и подрагивает влево-вправо даже на «прямой» дороге.
function dejigPath(pts) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
    const vx = c.x - a.x, vz = c.z - a.z;
    const ll = vx * vx + vz * vz;
    let dev = Infinity;
    if (ll > 1e-6) {
      const t = Math.max(0, Math.min(1, ((b.x - a.x) * vx + (b.z - a.z) * vz) / ll));
      dev = Math.hypot(b.x - (a.x + vx * t), b.z - (a.z + vz * t));
    }
    if (dev > 0.18) out.push(b); // только значимые повороты
  }
  out.push(pts[pts.length - 1]);
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
let pathTarget = null; // опорная точка движения: выбирается ОДИН раз, а не каждый кадр
let pendingHedge = false;
let pendingTree = false;
let pendingOwl = false;
let pendingFrog = false;
let pendingMole = false;
let pendingSq = false;
let pendingFire = false;
let pendingBeaver = false;
let pendingFrog2 = false;
let pendingPortal = false;
let pendingHouse = false;
let finalTarget = null;
let repathCount = 0;
let blockedT = 0; // сколько герой упирается в препятствие
let gone = 0; // пройденный путь — двигает анимацию прыжков
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
  path = dejigPath(p);
  pathTarget = null;
  finalTarget = { x, z };
  repathCount = 0;
  blockedT = 0;
  noProgT = 0; lastFinalDist = Infinity;
}
function tapGround(clientX, clientY) {
  if (hiding) return;
  const hit = new THREE.Vector3();
  const rc = castAt(clientX, clientY);
  if (rc.ray.intersectPlane(groundPlane, hit)) {
    if (Math.hypot(hit.x - LOCS[curLoc].x, hit.z - LOCS[curLoc].z) > ISLAND_R - 1) return;
    givePath(hit.x, hit.z);
    const last = path[path.length - 1];
    marker.position.set(last.x, 0.06, last.z);
    markerLife = 1;
    play('tap');
    hideHint();
  }
}

// модификатор спауна волков: щекотуны живут только на Лесной полянке
let downX = 0, downY = 0, downT = 0;
window.addEventListener('pointerdown', (e) => {
  initAudio();
  // первое касание на экране выбора героя — рассказчица объясняет, что тут делать
  if (!selectSpoken && selectEl.style.display === 'flex') {
    selectSpoken = true;
    // чуть ждём: аудиоконтекст успевает проснуться после первого касания
    setTimeout(() => { if (selectEl.style.display === 'flex' && !hero) speak('voice/select_char.mp3'); }, 180);
  }
  downX = e.clientX; downY = e.clientY; downT = performance.now();
});
window.addEventListener('pointerup', (e) => {
  const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
  const dt = performance.now() - downT;
  if (!hero) return;
  // во время вступления тапы по экрану ничего не делают — история не обрывается
  // (пропустить можно специальной кнопкой ⏭)
  if (gameState === 'intro') return;
  if (moved >= 24 || dt >= 500 || tickling > 0) return;
  if (gameState !== 'explore') return;
  if (albumEl.style.display === 'block') return;
  if (chapMapEl.style.display === 'flex') return;
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
    else { pendingFrog = true; givePath(FROG_POS.x - 1.7, FROG_POS.z - 1.6); }
    return;
  }
  // тап по Кроту (кучка земли у огородика)
  const moleHits = rc.intersectObject(mole, true);
  if (moleHits.length) {
    const dx = MOLE_POS.x - hero.position.x, dz = MOLE_POS.z - hero.position.z;
    if (Math.hypot(dx, dz) < 4.2) startMoleDialog();
    else { pendingMole = true; givePath(MOLE_POS.x - 1.5, MOLE_POS.z + 1.4); }
    return;
  }
  // тап по Белке
  const sqHits = rc.intersectObject(sq, true);
  if (sqHits.length) {
    const dx = SQRL_POS.x - hero.position.x, dz = SQRL_POS.z - hero.position.z;
    if (Math.hypot(dx, dz) < 3.4) startSqDialog();
    else { pendingSq = true; givePath(SQRL_POS.x + 1.5, SQRL_POS.z - 1.2); }
    return;
  }
  // тап по Светлячку (или по его звонким камушкам)
  const fireHits = rc.intersectObject(firefly, true);
  const stoneHits = rc.intersectObjects(fireStones, false);
  if (fireHits.length || stoneHits.length) {
    const dx = FIRE_POS.x - hero.position.x, dz = FIRE_POS.z - hero.position.z;
    if (Math.hypot(dx, dz) < 3.4) startSvetDialog();
    else { pendingFire = true; givePath(FIRE_POS.x - 1.6, FIRE_POS.z - 1.5); }
    return;
  }
  // тап по волшебной арке (только когда она уже есть и мы в «её» локации)
  const portalObj = curLoc === 0 ? portalL1 : portalL2;
  if (portalObj.visible && rc.intersectObject(portalObj, true).length) {
    const ap = PORTAL_APPR[curLoc];
    if (Math.hypot(ap.x - hero.position.x, ap.z - hero.position.z) < 2.0) travelTo(1 - curLoc);
    else { pendingPortal = true; givePath(ap.x, ap.z); }
    return;
  }
  // тап по Бобру (Локация 2)
  if (curLoc === 1 && rc.intersectObject(beaver, true).length) {
    const dx = BEAVER_POS.x - hero.position.x, dz = BEAVER_POS.z - hero.position.z;
    if (Math.hypot(dx, dz) < 3.4) startBeaverDialog();
    else { pendingBeaver = true; givePath(BEAVER_APPR.x, BEAVER_APPR.z); }
    return;
  }
  // тап по речной Лягушке (Локация 2)
  if (curLoc === 1 && rc.intersectObject(frog2, true).length) {
    const dx = FROG2_POS.x - hero.position.x, dz = FROG2_POS.z - hero.position.z;
    if (Math.hypot(dx, dz) < 3.4) startFrog2Dialog();
    else { pendingFrog2 = true; givePath(FROG2_APPR.x, FROG2_APPR.z); }
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
  // тап по дому — подойти к двери и войти
  if (rc.intersectObject(house, true).length) {
    pendingHouse = true;
    givePath(HOUSE_APPR.x, HOUSE_APPR.z);
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

// ============ ПУТЕШЕСТВИЕ МЕЖДУ ЛОКАЦИЯМИ ============
// Тап по волшебной арке → мягкая «шторка» с названием места → герой уже там.
const travelOv = document.getElementById('travelOv');
const travelEmoji = document.getElementById('travelEmoji');
const travelName = document.getElementById('travelName');
const travelSub = document.getElementById('travelSub');
let traveling = false;
function jumpToLoc(dest) {
  curLoc = dest;
  navOX = LOCS[dest].x + NAV_MIN;
  navOZ = LOCS[dest].z + NAV_MIN;
  buildNavGrid();
}
function travelTo(dest) {
  if (traveling || !hero) return;
  traveling = true;
  clearPendings();
  stopVoice();
  play('whoosh');
  gameState = 'travel';
  // волки-щекотуны остаются дома на Лесной полянке — эффектный «пуф!», в путь никого не берём
  for (const w of wolves) { spawnPoof(w.g.position, 4); scene.remove(w.g); }
  wolves.length = 0;
  hideGuideArrow();
  travelEmoji.textContent = dest === 1 ? '🌉' : '🏡';
  travelName.textContent = LOCS[dest].name;
  travelSub.textContent = LOCS[dest].sub;
  travelOv.style.display = 'flex';
  setTimeout(() => travelOv.classList.add('on'), 50); // кадр на применение display — потом плавно проявляем
  setTimeout(() => {
    jumpToLoc(dest);
    const ex = LOC_EXIT[dest];
    hero.position.set(ex.x, 0, ex.z);
    hero.rotation.y = ex.ry;
    camera.position.copy(hero.position).add(camOffset);
    lookTarget.copy(hero.position);
    spawnBurst(new THREE.Vector3(ex.x, 1.1, ex.z), 14);
    play('drop');
    gameState = 'explore';
    if (dest === 1) {
      const first = localStorage.getItem('wm_visit_l2') !== '1';
      localStorage.setItem('wm_visit_l2', '1');
      // первый визит: золотая стрелочка показывает, где живёт Бобр
      if (first && localStorage.getItem('wm_met_beaver') !== '1') {
        showGuideArrowAt(BEAVER_POS.x, 3.3, BEAVER_POS.z, 'beaver');
      }
    }
  }, 950);
  setTimeout(() => {
    travelOv.classList.remove('on');
    setTimeout(() => { travelOv.style.display = 'none'; traveling = false; }, 480);
  }, 1550);
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
let selectSpoken = false;
const muteBtn = document.getElementById('muteBtn');
if (muteBtn) {
  muteBtn.textContent = isMuted() ? '🔇' : '🔊';
  muteBtn.addEventListener('click', () => {
    initAudio();
    muteBtn.textContent = toggleMute() ? '🔇' : '🔊';
  });
}
// Большая кнопка «Начало»: понятна и тем, кто не умеет читать. Заодно это тот самый
// «жест пользователя», после которого звук разрешён системой — голос подсказки
// «выбери друга» теперь гарантированно звучит на экране выбора героя.
const startGateEl = document.getElementById('startGate');
setTimeout(() => {
  splashEl.classList.add('fade-out');
  setTimeout(() => { splashEl.style.display = 'none'; startGateEl.style.display = 'flex'; }, 900);
}, 2600);
document.getElementById('startBtn').addEventListener('click', () => {
  initAudio();
  play('pop');
  startGateEl.style.display = 'none';
  selectEl.style.display = 'flex';
  if (!selectSpoken) {
    selectSpoken = true;
    setTimeout(() => { if (selectEl.style.display === 'flex' && !hero) speak('voice/select_char.mp3'); }, 250);
  }
});
// выбор возраста на заставке — сразу применяется и запоминается
document.querySelectorAll('#startGate .age-btns button').forEach(b => {
  b.addEventListener('click', () => { initAudio(); setAgeGroup(parseInt(b.dataset.age, 10)); play('pop'); });
});
syncAgeUI();

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
    document.getElementById('pauseMute').firstChild.textContent = isMuted() ? '🔇' : '🔊';
  });
}
document.getElementById('pauseResume').addEventListener('click', () => {
  paused = false;
  pauseOv.style.display = 'none';
  setGamePaused(false);
  play('pop');
});
// Свёрнутое приложение (кнопка «домой» / экран блокировки) — мир и ВСЕ звуки на паузе.
// Вернулись — звук просыпается сам (если не была открыта ручная пауза).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { setGamePaused(true); }
  else { setGamePaused(paused); }
});

// ============ РОДИТЕЛЬСКИЙ УГОЛОК ============
// Доступ только из паузы и только через «взрослую» задачку —
// для ребёнка ничего не ломается, для родителя всё на виду.
const gateOv = document.getElementById('gateOv');
const gateQ = document.getElementById('gateQ');
const gateAnswers = document.getElementById('gateAnswers');
const parentOv = document.getElementById('parentOv');
const breakOv = document.getElementById('breakOv');
let parentLimitMin = parseFloat(localStorage.getItem('wm_parent_limit') || '0');
let sessSec = 0, playSecUnsaved = 0, breakShown = false;

document.getElementById('pauseMute').addEventListener('click', () => {
  initAudio();
  const m = toggleMute();
  muteBtn.textContent = m ? '🔇' : '🔊';
  document.getElementById('pauseMute').firstChild.textContent = m ? '🔇' : '🔊';
  play('pop');
});
document.getElementById('pauseParent').addEventListener('click', () => {
  play('pop');
  pauseOv.style.display = 'none';
  openGate();
});
function openGate() {
  const a = 6 + Math.floor(Math.random() * 9), b = 5 + Math.floor(Math.random() * 9);
  const sum = a + b;
  gateQ.textContent = a + ' + ' + b + ' = ?';
  const opts = new Set([sum]);
  const deltas = [1, -1, 2, -2, 3, -3, 10, -10];
  while (opts.size < 4) {
    const d = sum + deltas[Math.floor(Math.random() * deltas.length)];
    if (d > 0) opts.add(d);
  }
  const arr = Array.from(opts).sort(() => Math.random() - 0.5);
  gateAnswers.innerHTML = '';
  arr.forEach(v => {
    const bEl = document.createElement('button');
    bEl.type = 'button';
    bEl.textContent = v;
    bEl.addEventListener('click', () => {
      if (v === sum) {
        play('good');
        gateOv.style.display = 'none';
        openParent();
      } else {
        play('bad'); // тихий «плинг» и новый пример — без наказаний и для взрослых
        openGate();
      }
    });
    gateAnswers.appendChild(bEl);
  });
  gateOv.style.display = 'flex';
}
function statRow(label, val) {
  return '<tr><td>' + label + '</td><td>' + val + '</td></tr>';
}
function openParent() {
  const wins = k => parseInt(localStorage.getItem('wm_wins_' + k) || '0', 10);
  const s1 = localStorage.getItem('wm_story_mole') === '1' ? '✅' : 'пока ждёт';
  const s2 = starLit ? '✅' : 'пока ждёт';
  const playMin = Math.round(parseInt(localStorage.getItem('wm_playsec') || '0', 10) / 60);
  document.getElementById('parentStats').innerHTML =
    statRow('🦔 Ёжик — побед', wins('hedge')) +
    statRow('🦉 Сова — побед', wins('owl')) +
    statRow('🐸 Лягушка — побед', wins('frog')) +
    statRow('🦫 Бобр-строитель — побед', wins('beaver')) +
    statRow('🌺 Речная Лягушка — побед', wins('frog2')) +
    statRow('🐾 Крот — побед', wins('mole')) +
    statRow('🐿️ Белка — побед', wins('sq')) +
    statRow('✨ Светлячок — побед', wins('fire')) +
    statRow('📖 Наклейки в альбоме', 'открыто ' + albumUnlocked + ', на местах ' + albumPlaced.size + ' из ' + STICKERS.length) +
    statRow('💧 Капельки сейчас', dropsCount) +
    statRow('🌳 Древо Желаний', 'стадия ' + treeStage + ' из 3 (поливов: ' + treeWaters + ')') +
    statRow('📗 Сказка: «Корешок-ручеёк»', s1) +
    statRow('📗 Сказка: «Звонкое созвучие»', s2) +
    statRow('⏱ Всего в игре', playMin + ' мин');
  renderAgeRow();
  renderLimitRow();
  parentOv.style.display = 'flex';
}
function renderAgeRow() {
  const row = document.getElementById('ageRow');
  if (!row) return;
  row.innerHTML = '';
  [[0, '3–4 года'], [1, '5–6 лет']].forEach(([v, lbl]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = lbl;
    b.dataset.age = String(v);
    if (ageGroup === v) b.classList.add('on');
    b.addEventListener('click', () => { setAgeGroup(v); play('pop'); });
    row.appendChild(b);
  });
}
function renderLimitRow() {
  const row = document.getElementById('limitRow');
  const opts = [[0, 'Выкл'], [10, '10 мин'], [15, '15 мин'], [30, '30 мин'], [45, '45 мин']]; // по ГДД: 15/30/45 (+10 для малышей)
  row.innerHTML = '';
  opts.forEach(([v, lbl]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = lbl;
    if (parentLimitMin === v) b.classList.add('on');
    b.addEventListener('click', () => {
      parentLimitMin = v;
      localStorage.setItem('wm_parent_limit', String(v));
      sessSec = 0; breakShown = false; // новая настройка — новый отсчёт
      play('pop');
      renderLimitRow();
    });
    row.appendChild(b);
  });
}
document.getElementById('parentClose').addEventListener('click', () => {
  parentOv.style.display = 'none';
  pauseOv.style.display = 'flex'; // вернулись в паузу — игра всё ещё заморожена
  play('pop');
});
// «Стереть прогресс»: удерживать 2.5 с — защита от случайных пальчиков
const resetBtn = document.getElementById('parentReset');
const resetOv = document.getElementById('resetOv');
let resetT = null;
resetBtn.addEventListener('pointerdown', () => {
  resetBtn.classList.add('arm');
  resetBtn.textContent = 'Держи ещё — и сказка начнётся сначала…';
  resetT = setTimeout(() => {
    Object.keys(localStorage).filter(k => k.indexOf('wm_') === 0).forEach(k => localStorage.removeItem(k));
    // ЯВНОЕ подтверждение: тёплая заставка + голос «начинаем сначала», потом чистый перезапуск
    parentOv.style.display = 'none';
    paused = false;
    setGamePaused(false);
    resetOv.style.display = 'flex';
    setTimeout(() => resetOv.classList.add('on'), 50);
    play('fanfare');
    speak('voice/reset_done.mp3');
    setTimeout(() => location.reload(), 3000);
  }, 2500);
});
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => resetBtn.addEventListener(ev, () => {
  clearTimeout(resetT);
  if (resetOv.style.display !== 'flex') { // уже сработало — не трогаем кнопку, идёт перезапуск
    resetBtn.classList.remove('arm');
    resetBtn.textContent = 'Стереть прогресс и начать сказку сначала';
  }
}));
// ============ КАРТА СКАЗКИ (главы как в старых играх: клеточки-мостик по миру) ============
const chapMapEl = document.getElementById('chapMap');
const mapPath = document.getElementById('mapPath');
function chapterStates() {
  const ch1 = localStorage.getItem('wm_story_mole') === '1';
  const ch2 = starLit;
  const ch3 = localStorage.getItem('wm_portal_seen') === '1' || localStorage.getItem('wm_visit_l2') === '1';
  const ch3done = localStorage.getItem('wm_met_beaver') === '1' && localStorage.getItem('wm_met_frog2') === '1';
  return [
    { num: 'Глава 1', emoji: '🥕', name: 'Корешок-ручеёк', state: ch1 ? 'done' : 'open',
      voice: 'voice/story1.mp3', text: 'Тише… слышишь? Древо Желаний шепчет: каждая добрая помощь делает его сильнее! А Крот прокопал к нему корешок-ручеёк.' },
    { num: 'Глава 2', emoji: '🌟', name: 'Звонкое созвучие', state: ch2 ? 'done' : (ch1 ? 'open' : 'locked'),
      voice: 'voice/story2_narr.mp3', text: 'Ты помог всем шестерым друзьям — и звезда засияла для всей полянки! Её свет — как маяк: по нему мы найдём новые земли.' },
    { num: 'Глава 3', emoji: '🦫', name: 'Речной берег', state: ch3done ? 'done' : (ch3 ? 'open' : 'locked'),
      voice: 'voice/portal_hint.mp3', text: 'За волшебной аркой — Речной берег! Там живёт Бобр-строитель. Помоги ему собрать мостик из дощечек!' },
  ];
}
function openChapMap() {
  mapPath.innerHTML = '';
  const chs = chapterStates();
  chs.forEach((c, i) => {
    if (i > 0) {
      const dash = document.createElement('div');
      dash.className = 'map-dash' + (chs[i - 1].state === 'done' ? ' lit' : '');
      mapPath.appendChild(dash);
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'map-cell ' + (c.state === 'locked' ? 'locked' : c.state === 'done' ? 'done' : '');
    const st = c.state === 'done' ? '✅' : c.state === 'open' ? '✨' : '🔒';
    b.innerHTML = '<div class="mc-num">' + c.num + '</div><div class="mc-emoji">' + c.emoji + '</div>' +
      '<div class="mc-name">' + c.name + '</div><div class="mc-state">' + st + '</div>';
    b.addEventListener('click', () => {
      if (c.state === 'locked') { play('bad'); return; } // тихий «плинг» — главу откроем по сказке
      play('pop');
      chapMapEl.style.display = 'none';
      // пересмотр главы: та же сюжетная карточка и знакомый голос
      storyEmoji.textContent = c.emoji;
      storyText.textContent = c.text;
      storyOv.style.display = 'flex';
      gameState = 'story';
      stopVoice();
      speak(c.voice);
    });
    mapPath.appendChild(b);
  });
  chapMapEl.style.display = 'flex';
  play('pop');
}
document.getElementById('mapBtn').addEventListener('click', () => {
  initAudio();
  if (gameState !== 'explore') return;
  openChapMap();
});
document.getElementById('mapClose').addEventListener('click', () => {
  chapMapEl.style.display = 'none';
  play('pop');
});
// Мягкая карточка «отдохни» по таймеру
function showBreak() {
  breakShown = true;
  paused = true;
  setGamePaused(true);
  dayT = 0.62; // по ГДД: наступает ночь — полянка засыпает вместе с малышом
  breakOv.style.display = 'flex';
  play('pop');
}
document.getElementById('breakOk').addEventListener('click', () => {
  breakOv.style.display = 'none';
  paused = false;
  setGamePaused(false);
  sessSec = 0; // полный новый интервал после отдыха
  play('good');
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
  hero.scale.setScalar(1.1); // и сам герой чуть крупнее — на телефоне читается лучше
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
    { pos: new THREE.Vector3(10.6, 5, 10.8), look: new THREE.Vector3(11.5, 0.5, 5.2), dur: 4.5 },
  );
  introIdx = 0; introT = 0;
  hedgeBubble.visible = true;
  treeBubble.visible = true;
  play('pop');
  speak('voice/intro.mp3');
  // Облёт подгоняем под РЕАЛЬНУЮ длину рассказа, чтобы голос не обрывался на полуслове.
  const baseDur = introSteps.reduce((s, x) => s + x.dur, 0);
  const base = introSteps.map(x => x.dur);
  try {
    const probe = new Audio('voice/intro.mp3');
    probe.addEventListener('loadedmetadata', () => {
      if (gameState !== 'intro') return;
      if (probe.duration && isFinite(probe.duration) && probe.duration > 3) {
        const k = (probe.duration + 0.5) / baseDur;
        introSteps.forEach((s, i) => { s.dur = base[i] * k; });
      }
    });
  } catch (e) {}
  document.getElementById('skipIntro').style.display = 'block';
}
function finishIntro(skipped) {
  if (gameState !== 'intro') return;
  gameState = 'explore';
  document.getElementById('skipIntro').style.display = 'none';
  const hint = document.getElementById('hint');
  if (hint) hint.style.opacity = '1';
  // в конце — ведём малыша к Ёжику: голос + золотая стрелка над ним
  if (skipped) { stopVoice(); speak('voice/intro_go.mp3'); }
  else speak('voice/intro_go.mp3', { after: true }); // дождётся конца рассказа
  showGuideArrow();
  // Проверяем незавершённый сюжетный шаг и у старых сохранений: если все друзья
  // уже встречены, Рассказчица напомнит про особое задание Крота.
  setTimeout(() => { if (gameState === 'explore') checkStory(); }, 4200);
  // «ветеранам» (звезда уже сияет): ведём к волшебной арке или рассказываем о ней
  if (starLit) {
    if (localStorage.getItem('wm_portal_seen') !== '1') {
      setTimeout(() => { if (gameState === 'explore') maybeAnnouncePortal(); }, 4500);
    } else if (localStorage.getItem('wm_visit_l2') !== '1' && localStorage.getItem('wm_met_hedge') === '1') {
      showGuideArrowAt(portalL1.position.x, 3.5, portalL1.position.z, 'portal');
    }
  }
}
document.getElementById('skipIntro').addEventListener('click', () => finishIntro(true));

// ============ ЦИКЛ ============
buildNavGrid();
const camOffsetBase = new THREE.Vector3(0, 14, 11.5);
const camOffset = camOffsetBase.clone();
let portraitCam = null; // только для скрытого режима портретных скриншотов (#solo-*)
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
  // Скрытые целевые сценарии Крота ускорены: программный SwiftShader рисует
  // заметно реже 60 кадров/с, поэтому без этого E2E-проверка ждала бы минуты.
  const dt = location.hash.indexOf('#shot-mole') === 0 ? 1 / 10 : 1 / 60;
  elapsed += dt;

  // --- ИГРОВОЕ ВРЕМЯ идёт ТОЛЬКО на экране игры: альбом, карта сказки, родительский уголок,
  // стартовая кнопка, карточка отдыха и свёрнутое приложение — всё это ставит мир на паузу
  const uiFrozen = document.hidden
    || (albumEl && albumEl.style.display === 'block')
    || (chapMapEl && chapMapEl.style.display === 'flex')
    || (startGateEl && startGateEl.style.display === 'flex')
    || (parentOv && parentOv.style.display === 'flex')
    || (gateOv && gateOv.style.display === 'flex')
    || (breakOv && breakOv.style.display === 'flex');

  // --- РОДИТЕЛЬСКИЙ УЧЁТ: общее время игры + мягкое напоминание об отдыхе ---
  if (!uiFrozen) {
    sessSec += dt;
    playSecUnsaved += dt;
    if (playSecUnsaved >= 30) {
      playSecUnsaved -= 30;
      localStorage.setItem('wm_playsec', String(parseInt(localStorage.getItem('wm_playsec') || '0', 10) + 30));
    }
    if (parentLimitMin > 0 && !breakShown && sessSec >= parentLimitMin * 60 && gameState === 'explore') showBreak();
  }

  // --- ДЕНЬ/НОЧЬ (во сне в домике ночь пролетает быстро; под открытыми меню — не течёт) ---
  if (!uiFrozen) dayT = (dayT + (dt * (hiding ? 22 : 1)) / DAY_LEN) % 1;
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
      // Идём к ОПОРНОЙ точке, выбранной один раз (самой дальней видимой), — а не пересчитываем
      // её каждый кадр: пересчёт заставлял цель дрожать между двумя соседними точками,
      // и герой «залипал» — крутился влево-вправо даже на ровном открытом месте (баг теста).
      // Прыжки — только от пройденного пути, корпус поворачивается по фактическому смещению.
      if (!pathTarget) {
        pathTarget = path[0];
        for (let i = path.length - 1; i >= 1; i--) {
          if (lineFree({ x: hero.position.x, z: hero.position.z }, path[i])) { pathTarget = path[i]; break; }
        }
      }
      const target = pathTarget;
      const dx = target.x - hero.position.x, dz = target.z - hero.position.z;
      const d = Math.hypot(dx, dz);
      const finalPt = path[path.length - 1];
      const finalDist = Math.hypot(finalPt.x - hero.position.x, finalPt.z - hero.position.z);
      if (lastFinalDist === Infinity || finalDist < lastFinalDist - 0.004) { lastFinalDist = finalDist; noProgT = 0; }
      else noProgT += dt;
      if (d < 0.28 && target !== finalPt) {
        // точка пройдена: отрезаем пройденное, следующая опора — на следующем кадре
        path = path.slice(path.indexOf(target) + 1);
        pathTarget = null;
      } else if (finalDist < 0.4 || noProgT > 1.2) {
        path = null; pathTarget = null; finalTarget = null; noProgT = 0; squashT = 1; // пришли / тихая остановка
      } else if (d > 0.001) {
        const step = Math.min(SPEED * dt, d);
        const sl = slideCollide(hero.position.x + (dx / d) * step, hero.position.z + (dz / d) * step);
        const mdx = sl[0] - hero.position.x, mdz = sl[1] - hero.position.z;
        hero.position.x = sl[0]; hero.position.z = sl[1];
        const moved = Math.hypot(mdx, mdz);
        // уперся в препятствие: копим «застревание» и один раз мягко перестраиваем путь
        if (moved < step * 0.3) {
          blockedT += dt;
          if (blockedT > 0.3 && squashT <= 0) squashT = 0.35; // лёгкий «буп!» носом
          if (blockedT > 0.55 && repathCount < 1 && finalTarget) {
            repathCount++;
            blockedT = 0; noProgT = 0; lastFinalDist = Infinity;
            const np = findPath(hero.position.x, hero.position.z, finalTarget.x, finalTarget.z);
            if (np && np.length) { path = dejigPath(np); pathTarget = null; }
          }
        } else blockedT = 0;
        gone += moved;
        // У каждого героя — свой узнаваемый аллюр (правка по фидбеку v0.9.x):
        // Зайка прыгает спокойно (~2.7 прыжка в сек, не «дрель»), Лисёнок бежит
        // лёгкой трусцой почти без прыжков, Мишка неспешно переваливается с боку на бок.
        const gt = charData.gait || 'bunny';
        let flop = 0.5;
        if (gt === 'bunny') {
          const hop = Math.abs(Math.sin(gone * 2.05)) * 0.115;
          hero.position.y = hop;
          charData.bodyG.rotation.x = 0.05 + hop * 0.75;
          hero.rotation.z *= 0.8;
          flop = 4.5;
        } else if (gt === 'fox') {
          const bob = Math.abs(Math.sin(gone * 3.3)) * 0.045;
          hero.position.y = bob;
          charData.bodyG.rotation.x = 0.05 + bob * 1.2;
          hero.rotation.z = Math.sin(gone * 1.85) * 0.05; // лёгкое покачивание на бегу
          flop = 2.0;
        } else { // bear
          const bob = Math.abs(Math.sin(gone * 2.55)) * 0.055;
          hero.position.y = bob;
          charData.bodyG.rotation.x = 0.04 + bob * 1.0;
          hero.rotation.z = Math.sin(gone * 1.55) * 0.115; // вразвалочку
          flop = 2.2;
        }
        // поворачиваемся плавно и только при заметном смещении + мёртвая зона угла —
        // никакой дрожи головой ни на месте, ни на прямой
        if (moved > Math.max(0.0025, step * 0.35)) {
          const wantYaw = Math.atan2(mdx, mdz);
          let dyy = wantYaw - hero.rotation.y;
          while (dyy > Math.PI) dyy -= Math.PI * 2;
          while (dyy < -Math.PI) dyy += Math.PI * 2;
          if (Math.abs(dyy) > 0.045) hero.rotation.y += dyy * 0.2;
        }
        charData.ears.forEach(e => e.rotation.x = -hero.position.y * flop);
        if (charData.inners) charData.inners.forEach(e => e.rotation.x = -hero.position.y * flop);
      }
    } else {
      hero.position.y += (0 - hero.position.y) * 0.25;
      hero.rotation.z += (0 - hero.rotation.z) * 0.18; // выпрямить корпус после походки
      charData.bodyG.rotation.x += (0 - charData.bodyG.rotation.x) * 0.15;
      charData.ears.forEach(e => e.rotation.x = Math.sin(elapsed * 2) * 0.05);
      if (charData.inners) charData.inners.forEach(e => e.rotation.x = Math.sin(elapsed * 2) * 0.05);
      if (squashT <= 0 && spawnPop <= 0) {
        charData.bodyG.scale.y = 1 + Math.sin(elapsed * 2.6) * 0.012;
        charData.bodyG.scale.x = charData.bodyG.scale.z = 1 - Math.sin(elapsed * 2.6) * 0.006;
      }
    }

    if (gameState === 'explore' && !path && (pendingHedge || pendingTree || pendingOwl || pendingFrog || pendingMole || pendingSq || pendingFire || pendingBeaver || pendingFrog2 || pendingPortal || pendingHouse)) {
      if (pendingHedge) {
        pendingHedge = false;
        const d = Math.hypot(HEDGE_POS.x - hero.position.x, HEDGE_POS.z - hero.position.z);
        if (d < 3.4) startDialog();
      }
      if (pendingMole) {
        pendingMole = false;
        const d = Math.hypot(MOLE_POS.x - hero.position.x, MOLE_POS.z - hero.position.z);
        if (d < 4.4) startMoleDialog();
      }
      if (pendingSq) {
        pendingSq = false;
        const d = Math.hypot(SQRL_POS.x - hero.position.x, SQRL_POS.z - hero.position.z);
        if (d < 3.6) startSqDialog();
      }
      if (pendingFire) {
        pendingFire = false;
        const d = Math.hypot(FIRE_POS.x - hero.position.x, FIRE_POS.z - hero.position.z);
        if (d < 3.6) startSvetDialog();
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
      if (pendingBeaver) {
        pendingBeaver = false;
        const d = Math.hypot(BEAVER_POS.x - hero.position.x, BEAVER_POS.z - hero.position.z);
        if (d < 3.6) startBeaverDialog();
      }
      if (pendingFrog2) {
        pendingFrog2 = false;
        const d = Math.hypot(FROG2_POS.x - hero.position.x, FROG2_POS.z - hero.position.z);
        if (d < 3.6) startFrog2Dialog();
      }
      if (pendingPortal) {
        pendingPortal = false;
        const ap = PORTAL_APPR[curLoc];
        if (Math.hypot(ap.x - hero.position.x, ap.z - hero.position.z) < 2.2) travelTo(1 - curLoc);
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
    if (nightness > 0.7 && wolves.length < 2 && tickling <= 0 && gameState === 'explore' && !hiding && curLoc === 0 && Math.random() < dt * 0.15) spawnWolf();
    if (tickleCooldown > 0) tickleCooldown -= dt;
    for (let wi = wolves.length - 1; wi >= 0; wi--) {
      const w = wolves[wi];
      if (nightness < 0.5) {
        const d = Math.hypot(w.g.position.x, w.g.position.z);
        const ex = w.g.position.x / d, ez = w.g.position.z / d;
        w.g.position.x += ex * 2.5 * dt; w.g.position.z += ez * 2.5 * dt;
        w.g.rotation.y = Math.atan2(ex, ez) - Math.PI / 2;
        // у края полянки волк «растворяется», а не уходит в пустоту
        if (d > ISLAND_R - 0.3) {
          spawnBurst(new THREE.Vector3(w.g.position.x, 0.7, w.g.position.z), 8);
          play('whoosh');
          scene.remove(w.g); wolves.splice(wi, 1);
        }
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
          let dirx = dx / d, dirz = dz / d;
          // временный обход: если недавно застрял — идём под углом
          if (w.avoidT > 0) {
            w.avoidT -= dt;
            const ang = w.avoidSign * 1.05;
            const cs = Math.cos(ang), sn = Math.sin(ang);
            const rx = dirx * cs - dirz * sn, rz = dirx * sn + dirz * cs;
            dirx = rx; dirz = rz;
          }
          // скользим вдоль препятствий, как герой — никаких застреваний в кустах
          const sl = slideCollide(w.g.position.x + dirx * sp, w.g.position.z + dirz * sp);
          const mdx = sl[0] - w.g.position.x, mdz = sl[1] - w.g.position.z;
          w.g.position.x = sl[0]; w.g.position.z = sl[1];
          const moved = Math.hypot(mdx, mdz);
          if (moved < sp * 0.35) w.stuckT = (w.stuckT || 0) + dt; else w.stuckT = Math.max(0, (w.stuckT || 0) - dt * 2);
          if (w.stuckT > 0.5) { w.stuckT = 0; w.avoidT = 0.85; w.avoidSign = rand() < 0.5 ? 1 : -1; }
          // волк никогда не уходит за видимый край полянки
          const dc = Math.hypot(w.g.position.x, w.g.position.z);
          if (dc > 13.4) { const k = 13.4 / dc; w.g.position.x *= k; w.g.position.z *= k; }
          if (moved > 0.0008) w.g.rotation.y = Math.atan2(mdx, mdz) - Math.PI / 2;
          w.g.position.y = Math.abs(Math.sin(elapsed * 8)) * 0.08;
        } else {
          w.g.position.y = 0;
        }
      } else {
        w.cooldown -= dt;
        if (!w.vanishing) {
          w.g.position.y = 0;
          w.fadeT = (w.fadeT || 0) + dt;
          const d = Math.hypot(w.g.position.x, w.g.position.z);
          if (d > 0.001) {
            const ex = w.g.position.x / d, ez = w.g.position.z / d;
            const sl = slideCollide(w.g.position.x + ex * 3 * dt, w.g.position.z + ez * 3 * dt);
            const mdx = sl[0] - w.g.position.x, mdz = sl[1] - w.g.position.z;
            w.g.position.x = sl[0]; w.g.position.z = sl[1];
            if (Math.hypot(mdx, mdz) > 0.0008) w.g.rotation.y = Math.atan2(mdx, mdz) - Math.PI / 2;
          }
          const dc = Math.hypot(w.g.position.x, w.g.position.z);
          if (dc > ISLAND_R - 0.6) { const k = (ISLAND_R - 0.6) / dc; w.g.position.x *= k; w.g.position.z *= k; }
          // недолго убегает — и эффектный «ПУФ!»: волчок-юла, облачка и салют искр
          if (w.fadeT > 1.2) {
            w.vanishing = true;
            w.vanishT = 0;
            spawnPoof(w.g.position, 6);
            spawnBurst(new THREE.Vector3(w.g.position.x, 0.9, w.g.position.z), 16);
            play('pop'); play('whoosh');
          }
        } else {
          w.vanishT += dt;
          const k = Math.max(0.001, 1 - w.vanishT / 0.5);
          w.g.scale.set(k, Math.max(0.001, k * 0.6), k); // сплющивается и сжимается
          w.g.rotation.y += dt * 16;                      // крутится юлой
          w.g.position.y = Math.sin(Math.min(w.vanishT / 0.5, 1) * Math.PI) * 0.5; // подскок
          if (w.vanishT >= 0.5) { scene.remove(w.g); wolves.splice(wi, 1); continue; }
        }
        if (w.cooldown <= 0 && !hiding && !w.vanishing) {
          w.mode = 'hunt'; w.fadeT = 0;
          w.g.scale.setScalar(1);
        }
      }
    }
  }

  // --- ВОЛКИ: не сталкиваются друг с другом ---
  for (let i = 0; i < wolves.length; i++) {
    for (let j = i + 1; j < wolves.length; j++) {
      const a = wolves[i], b = wolves[j];
      const sx = b.g.position.x - a.g.position.x, sz = b.g.position.z - a.g.position.z;
      const sd = Math.hypot(sx, sz);
      if (sd > 0.01 && sd < 1.3) {
        const push = (1.3 - sd) * 0.09;
        a.g.position.x -= sx / sd * push; a.g.position.z -= sz / sd * push;
        b.g.position.x += sx / sd * push; b.g.position.z += sz / sd * push;
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
    // речная Лягушка (Л2) — та же пластика, со сдвигом фазы (не «в унисон»)
    const fhop2 = Math.abs(Math.sin(elapsed * 2.6 + 1.3));
    frog2.userData.body.position.y = fhop2 * 0.1;
    frog2.userData.body.scale.y = 0.92 + fhop2 * 0.08;
    frog2Bubble.position.y = 2.2 + Math.sin(elapsed * 2.2 + 0.9) * 0.08;
    // Крот: голова то выглядывает, то прячется, фонарик светится ночью
    const mp = (Math.sin(elapsed * 1.25) + 1) / 2;
    mole.userData.head.position.y = 0.08 + mp * 0.55;
    mole.userData.head.rotation.y = Math.sin(elapsed * 0.85) * 0.35;
    mole.userData.lamp.material.color.setHex(nightness > 0.3 ? 0xffe27a : 0xfff3b0);
    moleBubble.position.y = 2.1 + Math.sin(elapsed * 2.2) * 0.08;
    // Белка: подпрыгивает, виляет большим хвостом
    sq.userData.body.position.y = Math.abs(Math.sin(elapsed * 2.4)) * 0.06;
    sq.userData.tail.rotation.x = Math.sin(elapsed * 3) * 0.16;
    sq.userData.tailTip.rotation.x = Math.sin(elapsed * 3) * 0.2;
    // Светлячок: парит над камушками, быстро машет крылышками, ночью фонарик ярче
    firefly.userData.body.position.y = 0.12 + Math.sin(elapsed * 2.1) * 0.09;
    firefly.userData.wL.rotation.z = 0.9 + Math.sin(elapsed * 21) * 0.5;
    firefly.userData.wR.rotation.z = -0.9 - Math.sin(elapsed * 21) * 0.5;
    firefly.userData.lamp.intensity = 0.45 + nightness * 1.6 + Math.sin(elapsed * 3.2) * 0.12;
    firefly.userData.bulbMat.color.setHex(nightness > 0.3 ? 0xffd95e : 0xfff3a0);
    svetBubble.position.y = 2.1 + Math.sin(elapsed * 2.2) * 0.08;
    sqBubble.position.y = 2.35 + Math.sin(elapsed * 2.2) * 0.08;
    // Бобр: мягко подпрыгивает, хвост-лопасть покачивается
    const bHop = Math.abs(Math.sin(elapsed * 2.2));
    beaver.userData.body.position.y = bHop * 0.07;
    beaver.userData.body.scale.y = 0.94 + bHop * 0.06;
    beaver.userData.tail.rotation.x = Math.sin(elapsed * 1.1) * 0.12;
    beaverBubble.position.y = 2.35 + Math.sin(elapsed * 2.2) * 0.08;
  }

  // --- ВОЛШЕБНЫЕ АРКИ: закрутка светлячков + мерцание плёнки ---
  for (const p of [portalL1, portalL2]) {
    if (!p.visible) continue;
    const u = p.userData;
    for (let i = 0; i < u.orbs.length; i++) {
      const a = elapsed * 1.7 + (i / u.orbs.length) * Math.PI * 2;
      const rr = 1.15 + Math.sin(a * 3) * 0.18;
      const orb = u.orbs[i];
      orb.position.set(Math.cos(a) * rr, 1.5 + Math.sin(a) * rr, 0.14 * Math.sin(a * 2));
      orb.scale.setScalar(0.3 + (Math.sin(elapsed * 3 + i) * 0.5 + 0.5) * 0.22);
    }
    u.disc.material.opacity = 0.2 + Math.sin(elapsed * 2.4) * 0.07 + nightness * 0.12;
  }

  // --- РЕЧКА: блики-блёстки плывут по течению ---
  for (const fl of riverFlows) {
    const lz = ((elapsed * 1.05 + fl.userData.off) % 28.4) - 14.2;
    fl.position.set(riverX(LOC2.z + lz) + Math.sin(elapsed * 1.3 + fl.userData.off) * 0.65, 0.075, LOC2.z + lz);
    fl.material.opacity = 0.12 + (Math.sin(elapsed * 2 + fl.userData.off) * 0.5 + 0.5) * 0.2;
  }

  // --- СТРЕКОЗЫ: порхают над речкой днём ---
  for (const g of dragonflies) {
    g.userData.t += dt;
    const t = g.userData.t;
    g.visible = nightness < 0.7;
    g.position.set(
      riverX(g.userData.cz) + Math.sin(t * 0.9) * 1.3,
      1.1 + Math.sin(t * 2.2) * 0.24,
      g.userData.cz + Math.sin(t * 0.55) * 2.1
    );
    g.rotation.y = Math.cos(t * 0.55) * 0.9;
    const flap = Math.sin(t * 24) * 0.3;
    for (const { w, dir } of g.userData.wings) w.rotation.z = dir * flap;
  }

  // Длинная сказка: ручеёк-росток от Крота к Дереву (пульс + волна роста при открытии)
  if (sproutGroup && sproutGroup.visible) {
    if (sproutGrowT >= 0) {
      sproutGrowT += dt;
      sproutDots.forEach((d) => {
        const k = Math.min(Math.max((sproutGrowT - d.userData.idx * 0.22) / 0.3, 0.001), 1);
        d.scale.setScalar(k);
      });
      const leafK = Math.min(Math.max((sproutGrowT - sproutDots.length * 0.22) / 0.5, 0.001), 1);
      sproutGroup.userData.leafSprout.scale.setScalar(leafK);
      if (sproutGrowT > sproutDots.length * 0.22 + 1.2) sproutGrowT = -1;
    }
    sproutDots.forEach((d) => {
      d.material.opacity = (0.5 + Math.sin(elapsed * 2 + d.userData.idx * 0.5) * 0.2) * (0.75 + nightness * 0.45);
    });
  }

  // золотая стрелка-проводник: прыгает и машет, пока малыш не подошёл (Ёжик / арка / Бобр)
  if (guideOn) {
    guideArrow.position.set(guidePos.x, guidePos.y + Math.abs(Math.sin(elapsed * 2.6)) * 0.28, guidePos.z);
    guideArrow.material.rotation = Math.sin(elapsed * 2.6) * 0.09;
    const gp = 0.85 + Math.sin(elapsed * 5) * 0.07;
    guideArrow.scale.set(gp, gp, 1);
  }

  // --- ДРЕВО ---
  treeRoot.scale.lerp(new THREE.Vector3(1, 1, 1), 0.06);
  treeRoot.rotation.z = Math.sin(elapsed * 1.4) * 0.015;
  // вращающаяся звезда на выросшем Древе
  if (treeStages[3] && treeStages[3].visible && treeStages[3].userData.star) {
    const st = treeStages[3].userData.star;
    st.rotation.y = elapsed * 1.6;
    const amp = starLit ? 0.18 : 0.08; // после главы 2 звезда «дышит» сильнее
    const sp = 1 + Math.sin(elapsed * 3) * amp;
    st.scale.set(sp, 1.35 * sp, sp);
    const g3 = treeStages[3];
    if (g3.userData.halo && g3.userData.halo.visible) {
      // плавное успокоение гала после вспышки + ночное сияние
      const h = g3.userData.halo;
      const target = 2.4 + Math.sin(elapsed * 3) * 0.35;
      h.scale.setScalar(h.scale.x + (target - h.scale.x) * 0.04);
      h.material.opacity = starLit ? (0.28 + nightness * 0.62) : 0;
    }
    if (g3.userData.beacon) {
      g3.userData.beacon.intensity = starLit ? (0.45 + nightness * 1.9 + Math.sin(elapsed * 3) * 0.22) : 0;
    }
  }
  // хоровод звонких огоньков (глава 2, ночью)
  choirLights.rotation.y = elapsed * 0.55;
  choirLights.visible = !!(treeStages[3] && treeStages[3].visible);
  choirMat.opacity = starLit ? nightness * (0.55 + Math.sin(elapsed * 2.3) * 0.3) : 0;

  // --- ЦЕРЕМОНИЯ ГЛАВЫ 2: жители плавно сходятся к Древу / расходятся домой ---
  if (ch2Gather.length) {
    for (let i = ch2Gather.length - 1; i >= 0; i--) {
      const c = ch2Gather[i];
      c.npc.position.x += (c.tx - c.npc.position.x) * 0.045;
      c.npc.position.z += (c.tz - c.npc.position.z) * 0.045;
      let dr = c.try_ - c.npc.rotation.y;
      while (dr > Math.PI) dr -= Math.PI * 2;
      while (dr < -Math.PI) dr += Math.PI * 2;
      c.npc.rotation.y += dr * 0.06;
      if (Math.hypot(c.tx - c.npc.position.x, c.tz - c.npc.position.z) < 0.04) ch2Gather.splice(i, 1);
    }
  }
  // радостные подскоки по битам песни
  ch2Hops.forEach((t, npc) => {
    const nt = t - dt;
    if (nt <= 0) { npc.position.y = 0; ch2Hops.delete(npc); }
    else { npc.position.y = Math.sin((1 - nt / 0.55) * Math.PI) * 0.3; ch2Hops.set(npc, nt); }
  });
  // мягкое золотое свечение Дерева ночью + медленный хоровод искр
  const tglow = nightness * (0.16 + Math.sin(elapsed * 2) * 0.05);
  treeGlowMats.forEach(m => m.emissive.setRGB(tglow, tglow * 0.82, tglow * 0.25));
  treeSparks.rotation.y = elapsed * 0.5;
  treeSparkMat.opacity = 0.5 + nightness * 0.5;
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
      if (idle > 18) need.classList.add('glow');
      if (idle > 26 && !appleDrag) {
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
    if (rightBtn && idle > 18) rightBtn.classList.add('glow');
    if (rightBtn && idle > 26 && !cg.fingerShown) {
      cg.fingerShown = true;
      const r = rightBtn.getBoundingClientRect();
      cgFinger.style.left = (r.left + r.width * 0.18) + 'px';
      cgFinger.style.top = (r.top - 74) + 'px';
      cgFinger.style.display = 'block';
    }
  }

  // --- ПОДСКАЗКИ В ИГРЕ «ЗВОНКИЕ КАМНИ» (Светлячок) ---
  if (gameState === 'stonegame' && st.canTap) {
    const idle = elapsed - st.lastAction;
    const next = st.stones[st.seq[st.input]];
    if (next && idle > 18) next.classList.add('glow');
    if (next && idle > 26 && !st.fingerShown) {
      st.fingerShown = true;
      const r = next.getBoundingClientRect();
      stFinger.style.left = (r.left + r.width * 0.18) + 'px';
      stFinger.style.top = (r.top - 74) + 'px';
      stFinger.style.display = 'block';
    }
  }

  // --- ИГРА «ВЕРНИ МОРКОВКУ!» (Крот): появление/ныряние + честные авто-подсказки ---
  // Темп (правка по фидбеку v0.10.0): Крот сидит наверху заметно дольше,
  // паузы между выглядываниями спокойные — игра посильна и 3-летнему, и взрослому не «пулемёт».
  if (gameState === 'molegame') {
    if (ml.slow > 0) ml.slow -= dt;
    const upH = ml.holes.find(h => h.up);
    if (upH) {
      upH.t += dt;
      const limit = (upH.carrot ? 3.0 : 2.4) * (ml.slow > 0 ? 1.75 : 1);
      if (upH.t > limit) moleDuck(upH);
    } else if (ml.got < mlAll()) {
      ml.timer -= dt;
      if (ml.timer <= 0) {
        const i = Math.floor(Math.random() * ml.holes.length);
        const h = ml.holes[i];
        h.up = true; h.t = 0;
        // В обычной игре сохраняем дружелюбное чередование. В скрытом E2E-сценарии
        // морковка гарантирована, чтобы случайность не делала проверку нестабильной.
        h.carrot = location.hash.indexOf('#shot-mole') === 0 || Math.random() < 0.72;
        // авто-подсказки по правилам интерфейса: 18 с — свечение, 26 с — пальчик НАД норкой
        const idle = elapsed - ml.lastAction;
        if (idle > 18) { h.carrot = true; h.hole.classList.add('glow'); }
        h.b.classList.add('up');
        h.carr.style.display = h.carrot ? 'block' : 'none';
        play('pop');
        if (idle > 26 && !ml.fingerShown) {
          ml.fingerShown = true;
          const r = h.b.getBoundingClientRect();
          mlFinger.style.left = (r.left + r.width * 0.22) + 'px';
          mlFinger.style.top = (r.top - 74) + 'px';
          mlFinger.style.display = 'block';
        }
      }
    }
  }

  // --- ПОДСКАЗКИ В ИГРЕ «ПРЯТКИ-НОРКИ» ---
  if (gameState === 'sqgame' && sg.canTap && !sg.answered) {
    const idle = elapsed - sg.lastAction;
    const rightBtn = sg.mushs[sg.answer];
    if (rightBtn && idle > 18) rightBtn.classList.add('glow');
    if (rightBtn && idle > 26 && !sg.fingerShown) {
      sg.fingerShown = true;
      const r = rightBtn.getBoundingClientRect();
      sqFinger.style.left = (r.left + r.width * 0.18) + 'px';
      sqFinger.style.top = (r.top - 74) + 'px';
      sqFinger.style.display = 'block';
    }
  }

  // --- ПОДСКАЗКИ В ИГРЕ «ДОЩЕЧКИ ДЛЯ МОСТИКА» (Бобр) ---
  if (gameState === 'beavergame' && !bv.answered) {
    const idle = elapsed - bv.lastAction;
    const rightBtn = Array.from(bvAnswers.children).find(b => b.dataset.e === bv.target);
    if (rightBtn && idle > 18) rightBtn.classList.add('glow');
    if (rightBtn && idle > 26 && !bv.fingerShown) {
      bv.fingerShown = true;
      const r = rightBtn.getBoundingClientRect();
      bvFinger.style.left = (r.left + r.width * 0.18) + 'px';
      bvFinger.style.top = (r.top - 74) + 'px';
      bvFinger.style.display = 'block';
    }
  }

  // --- ПОДСКАЗКИ В ИГРЕ «ВОЛШЕБНЫЙ МОСТИК» ---
  if (gameState === 'bridgegame' && !bg.answered) {
    const idle = elapsed - bg.lastAction;
    const rightBtn = Array.from(bgAnswers.children).find(b => b.dataset.e === bg.answer);
    if (rightBtn && idle > 18) rightBtn.classList.add('glow');
    if (rightBtn && idle > 26 && !bg.fingerShown) {
      bg.fingerShown = true;
      const r = rightBtn.getBoundingClientRect();
      bgFinger.style.left = (r.left + r.width * 0.18) + 'px';
      bgFinger.style.top = (r.top - 74) + 'px';
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

  // облачка «пуф!» растут и тают
  for (let i = poofs.length - 1; i >= 0; i--) {
    const s = poofs[i];
    s.userData.life += dt;
    const k = s.userData.life / s.userData.maxLife;
    s.scale.setScalar(s.scale.x + dt * 3.2);
    s.material.opacity = Math.max(0, 0.95 * (1 - k));
    if (k >= 1) { scene.remove(s); s.material.dispose(); poofs.splice(i, 1); }
  }

  if (markerLife > 0) {
    markerLife -= 0.025;
    marker.material.opacity = Math.max(markerLife, 0) * 0.9;
    marker.scale.setScalar(1 + (1 - Math.max(markerLife, 0)) * 0.8);
  }

  // --- КАМЕРА (в обычном режиме следует; в интро — по ключевым кадрам выше) ---
  if (portraitCam) {
    // режим портретных скриншотов (#solo-*): камера стоит на месте
    camera.position.copy(portraitCam.pos);
    lookTarget.copy(portraitCam.look);
  } else if (hero && gameState !== 'intro') {
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

// --- СКРЫТЫЙ ТЕСТ-РЕЖИМ (только для автоматических скриншотов разметки; в игре не срабатывает) ---
// Открыть с хэшем: #shot-world | #shot-hedge | #shot-owl | #shot-frog | #shot-mole | #shot-sq | #shot-fire
if (location.hash.indexOf('#shot') === 0) {
  setTimeout(() => {
    try {
      splashEl.style.display = 'none';
      selectEl.style.display = 'none';
      // загрузочный таймер игры повторно покажет выбор героя на ~3.5с —
      // первые 8с принудительно держим заставку и выбор скрытыми
      const keepHidden = setInterval(() => {
        splashEl.style.display = 'none';
        selectEl.style.display = 'none';
        startGateEl.style.display = 'none';
      }, 250);
      setTimeout(() => clearInterval(keepHidden), 8000);
      spawnHero('fox');
      gameState = 'explore';
      const kind = location.hash.slice(6);
      if (kind === 'album') {
        setAlbumTestState(8, [0, 1, 2]);
        openAlbum();
      }
      else if (kind === 'album2') {
        setAlbumTestState(17, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
        activeAlbumPage = 1;
        openAlbum();
      }
      else if (kind === 'albumreward') {
        setAlbumTestState(4, [0, 1]);
        dropsCount = 1;
        waterTree();
      }
      else if (kind === 'hedge') { mgDom.pair = MG_PAIRS[0]; openMinigame(); }
      else if (kind === 'owl') openCountGame();
      else if (kind === 'frog') openBridgeGame();
      else if (kind === 'mole') openMoleGame();
      else if (kind === 'molegate') {
        // Точечный тест нового сюжета: все друзья пройдены, ручеёк ещё закрыт.
        MEADOW_FRIEND_KEYS.forEach(k => localStorage.setItem(k, '1'));
        localStorage.removeItem('wm_story_mole');
        localStorage.removeItem('wm_mole_return_hint');
        checkStory();
      }
      else if (kind === 'molespecial') {
        // Точечный тест особого повторного задания (не сбрасывает уже открытый финал).
        MEADOW_FRIEND_KEYS.forEach(k => localStorage.setItem(k, '1'));
        localStorage.setItem('wm_mole_return_hint', '1');
        startMoleDialog();
      }
      else if (kind === 'moleearly') {
        // Защитный тест: один Крот не должен открыть ручеёк раньше остальных.
        MEADOW_FRIEND_KEYS.forEach(k => localStorage.removeItem(k));
        localStorage.setItem('wm_met_mole', '1');
        localStorage.removeItem('wm_story_mole');
        document.body.dataset.moleEarlyOpened = checkMoleStory() ? 'yes' : 'no';
      }
      else if (kind === 'sq') openSqGame();
      else if (kind === 'fire') openStoneGame();
      else if (kind === 'beaver') openBeaverGame();
      else if (kind === 'portal') {
        // волшебная арка у восточного края полянки (+ золотая стрелочка)
        starLit = true; applyStarLit(); revealPortal(false);
        showGuideArrowAt(portalL1.position.x, 3.5, portalL1.position.z, 'portal');
      }
      else if (kind === 'travel') {
        const tv = document.getElementById('travelOv');
        tv.style.display = 'flex';
        setTimeout(() => tv.classList.add('on'), 60);
      }
      else if (kind === 'l2' || kind === 'l2night') {
        // Локация 2: герой стоит у мостика, вид на Бобра и речку
        starLit = true; applyStarLit(); revealPortal(false);
        if (kind === 'l2night') dayT = 0.6;
        jumpToLoc(1);
        hero.position.set(LOC2.x - 1.8, 0, LOC2.z + 3.2);
        hero.rotation.y = Math.atan2(BEAVER_POS.x - hero.position.x, BEAVER_POS.z - hero.position.z);
        camera.position.copy(hero.position).add(camOffset);
        lookTarget.copy(hero.position);
      }
      else if (kind === 'walk' || kind === 'walk2' || kind === 'walk3') {
        // DBG-лог позиции героя — для E2E-проверки плавности движения в Playwright
        setInterval(() => console.log('DBG hp=' + hero.position.x.toFixed(2) + ',' + hero.position.z.toFixed(2) + ' cl=' + curLoc + ' gs=' + gameState), 1000);
        // настоящие маршруты: 'walk' — из дома к арке (потом travelTo), 'walk2' — с берега к арке,
        // 'walk3' — через мостик с западного берега на восточный
        starLit = true; applyStarLit(); revealPortal(false);
        if (kind === 'walk2') {
          jumpToLoc(1);
          hero.position.set(LOC2.x - 6, 0, LOC2.z + 3);
          camera.position.copy(hero.position).add(camOffset);
          lookTarget.copy(hero.position);
          pendingPortal = true;
          givePath(PORTAL_APPR[1].x, PORTAL_APPR[1].z);
        } else if (kind === 'walk3') {
          jumpToLoc(1);
          hero.position.set(LOC2.x - 6.5, 0, LOC2.z - 2.5);
          camera.position.copy(hero.position).add(camOffset);
          lookTarget.copy(hero.position);
          givePath(LOC2.x + 6, LOC2.z + 2.2);
        } else {
          pendingPortal = true;
          givePath(PORTAL_APPR[0].x, PORTAL_APPR[0].z);
        }
      }
      else if (kind === 'frog2') {
        // вид на речную Лягушку у кувшинок (Локация 2)
        jumpToLoc(1);
        hero.position.set(FROG2_APPR.x, 0, FROG2_APPR.z);
        hero.rotation.y = Math.atan2(FROG2_POS.x - FROG2_APPR.x, FROG2_POS.z - FROG2_APPR.z);
        camera.position.copy(hero.position).add(camOffset);
        lookTarget.set(FROG2_POS.x, 0.7, FROG2_POS.z);
      }
      else if (kind === 'frog2g') { jumpToLoc(1); hero.position.set(FROG2_APPR.x, 0, FROG2_APPR.z); openBridgeGame(true); }
      else if (kind === 'whedge' || kind === 'wfrog') {
        // витринные виды нового декора: грядки Ёжика / мостик-дуга Лягушки
        const p = kind === 'whedge'
          ? { hx: HEDGE_POS.x - 3.2, hz: HEDGE_POS.z + 2.6, tx: -4.35, tz: 8.9, ty: 0.7 }
          : { hx: FROG_POS.x - 2.0, hz: FROG_POS.z + 3.4, tx: 10.95, tz: 7.65, ty: 0.5 };
        hero.position.set(p.hx, 0, p.hz);
        hero.rotation.y = Math.atan2(p.tx - p.hx, p.tz - p.hz);
        camera.position.copy(hero.position).add(camOffset);
        lookTarget.set(p.tx, p.ty, p.tz);
      }
      else if (kind === 'pause') { document.getElementById('pauseBtn').click(); }
      else if (kind === 'gate') { paused = true; openGate(); }
      else if (kind === 'parent') { paused = true; openParent(); }
      else if (kind === 'break') { showBreak(); }
      else if (kind === 'choir' || kind === 'choirnight') {
        // сценка главы 2: форсируем взрослое Древо и запускаем церемонию
        if (treeStage !== 3) {
          treeStages[treeStage].visible = false;
          treeStage = 3;
          treeStages[3].visible = true;
        }
        if (kind === 'choirnight') dayT = 0.6;
        starLit = false; applyStarLit();
        startChoirCeremony();
      }
    } catch (e) { document.title = 'SHOT-ERR ' + e.message; }
  }, 900);
}

// --- СКРЫТЫЙ РЕЖИМ ПОРТРЕТОВ (#solo-bunny|fox|bear|hedge|owl|frog|mole|sq|fire[-night]) ---
// Одного жителя ставим на «сцену» лицом к камере — удобно сравнивать скины.
if (location.hash.indexOf('#solo') === 0) {
  setTimeout(() => {
    try {
      splashEl.style.display = 'none';
      selectEl.style.display = 'none';
      // см. примечание в #shot: держим заставку и выбор скрытыми первые 8с
      const keepHiddenSolo = setInterval(() => {
        splashEl.style.display = 'none';
        selectEl.style.display = 'none';
        startGateEl.style.display = 'none';
      }, 250);
      setTimeout(() => clearInterval(keepHiddenSolo), 8000);
      // прячем HUD — чистые портреты
      ['muteBtn', 'pauseBtn', 'drops', 'albumBtn', 'mapBtn', 'hint', 'skipIntro'].forEach(id => {
        const el = document.getElementById(id); if (el) el.style.display = 'none';
      });
      spawnHero('fox');
      hero.visible = false;
      wolves.forEach(w => { w.g.visible = false; });
      gameState = 'explore';
      dayT = 0.12; // утро — ровный мягкий свет
      let name = location.hash.slice(6);
      if (name.endsWith('-night')) { dayT = 0.6; name = name.slice(0, -6); }
      let subj = null, dist = 3.1, lookY = 0.62;
      if (name === 'bunny' || name === 'fox' || name === 'bear') { subj = makeChar(name); scene.add(subj); dist = 3.2; }
      else if (name === 'hedge') subj = hedgehog;
      else if (name === 'owl') { subj = owl; dist = 3.4; lookY = 0.85; }
      else if (name === 'frog') { subj = frog; dist = 2.8; lookY = 0.55; }
      else if (name === 'frog2') { subj = frog2; dist = 2.8; lookY = 0.55; }
      else if (name === 'mole') { subj = mole; dist = 2.3; lookY = 0.5; }
      else if (name === 'sq') { subj = sq; dist = 2.3; lookY = 0.6; }
      else if (name === 'fire') { subj = firefly; dist = 1.55; lookY = 0.62; }
      else if (name === 'beaver') { subj = beaver; dist = 2.6; lookY = 0.6; }
      if (subj) {
        // остальных жителей и их облачка прячем — чистое сравнение скинов
        [[hedgehog, hedgeBubble], [owl, owlBubble], [frog, frogBubble], [mole, moleBubble], [sq, sqBubble], [firefly, svetBubble], [beaver, beaverBubble], [frog2, frog2Bubble]]
          .forEach(([npc, bub]) => { if (npc !== subj) npc.visible = false; if (bub) bub.visible = false; });
        if (subj !== firefly) fireStones.forEach(s => { s.visible = false; });
        subj.position.x = 0; subj.position.z = 12.4; // y не трогаем: у крота «норка», у совы насест
        subj.rotation.y = 0; // лицом к камере (передняя часть модели смотрит на +z)
        portraitCam = { pos: new THREE.Vector3(0, 1.5, 12.4 + dist), look: new THREE.Vector3(0, lookY, 12.4) };
      }
    } catch (e) { document.title = 'SOLO-ERR ' + e.message; }
  }, 900);
}

// Скольжение вдоль препятствий: точку, попавшую внутрь круга, выносим по нормали —
// тангенциальная составляющая движения сохраняется, визуально это плавный обход без отскоков.
function slideCollide(nx, nz) {
  for (const ob of obstacles) {
    const ox = nx - ob.x, oz = nz - ob.z;
    const d = Math.hypot(ox, oz);
    const minD = ob.r + 0.32;
    if (d < minD && d > 1e-4) { const k = minD / d; nx = ob.x + ox * k; nz = ob.z + oz * k; }
  }
  return [nx, nz];
}

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

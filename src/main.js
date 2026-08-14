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
  if (el) { el.style.opacity = '1'; el.textContent = '⚠️ Нужен браузер с WebGL — откройте файл в Chrome/Safari'; }
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xffffff, 0x9ccc8f, 0.95));
const sun = new THREE.DirectionalLight(0xfff2d0, 1.35);
sun.position.set(12, 20, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -22; sun.shadow.camera.right = 22;
sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22;
sun.shadow.camera.near = 2; sun.shadow.camera.far = 60;
sun.shadow.bias = -0.0004;
scene.add(sun);

const L = (c) => new THREE.MeshLambertMaterial({ color: c });
const swayList = [];
const obstacles = []; // {x, z, r} — физика обхода

// ============ ОСТРОВ ============
const ISLAND_R = 15;
const ground = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R, ISLAND_R * 0.88, 1.8, 48), L(0x8ed081));
ground.position.y = -0.9;
ground.receiveShadow = true;
scene.add(ground);
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

for (const [x, z, r, c] of [[-7, -7, 3.4, 0x7ecb74], [9, 6, 2.6, 0x86cf78], [-11, 4, 2.2, 0x94d687]]) {
  const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), L(c));
  hill.scale.y = 0.38;
  hill.position.set(x, 0, z);
  hill.receiveShadow = true;
  scene.add(hill);
}

// Пруд + кувшинки + камыши (пруд — препятствие!)
const pond = new THREE.Mesh(new THREE.CircleGeometry(3.4, 40), L(0x7ecbe8));
pond.rotation.x = -Math.PI / 2;
pond.position.set(5, 0.04, 4);
scene.add(pond);
obstacles.push({ x: 5, z: 4, r: 3.9 });
for (const [dx, dz, s] of [[-1, 0.6, 0.5], [0.9, -1, 0.4], [0.3, 1.4, 0.35]]) {
  const pad = new THREE.Mesh(new THREE.CircleGeometry(s, 14), L(0x5fbf7a));
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(5 + dx, 0.07, 4 + dz);
  scene.add(pad);
}
for (const [dx, dz] of [[3.6, 0.5], [3.3, -1.8]]) {
  const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.4, 8), L(0x5aa860));
  reed.position.set(5 + dx, 0.7, 4 + dz);
  const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.3, 4, 8), L(0x8a5a3b));
  tip.position.set(5 + dx, 1.55, 4 + dz);
  scene.add(reed, tip);
}

// Тропинка
for (let i = 0; i < 6; i++) {
  const t = i / 5;
  const st = new THREE.Mesh(new THREE.CircleGeometry(0.55 - t * 0.1, 16), L(0xf0e3c0));
  st.rotation.x = -Math.PI / 2;
  st.position.set(-1.5 - t * 4.5, 0.05, -1 - t * 4.2);
  st.receiveShadow = true;
  scene.add(st);
}

// ============ ДЕРЕВЬЯ / КУСТЫ / ЦВЕТЫ / ТРАВА ============
function makeTree(x, z, s, crownColor) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.34 * s, 1.5 * s, 12), L(0x9a6b4f));
  trunk.position.y = 0.75 * s;
  trunk.castShadow = true;
  const crown = new THREE.Group();
  const crownMat = L(crownColor);
  const c1 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25 * s, 2), crownMat);
  c1.castShadow = true;
  const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 * s, 2), crownMat);
  c2.position.set(0.6 * s, 0.5 * s, 0.2 * s);
  c2.castShadow = true;
  const c3 = c2.clone();
  c3.position.set(-0.55 * s, 0.4 * s, -0.25 * s);
  crown.add(c1, c2, c3);
  crown.position.y = 1.9 * s;
  g.add(trunk, crown);
  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * Math.PI;
  scene.add(g);
  swayList.push({ obj: crown, amp: 0.04, speed: 1.1 + Math.random() * 0.4 });
  obstacles.push({ x, z, r: 0.55 * s });
}
const treeSpots = [
  [-6, -9, 1.1, 0x6cbf6f], [8.5, -7, 0.9, 0x5cb85c], [-10.5, -3.5, 1.25, 0x8fd07a],
  [-8.5, 6.5, 1.0, 0x6cbf6f], [11.5, 2.5, 0.85, 0x5cb85c], [1.5, 10.5, 1.0, 0x8fd07a],
  [12, -3, 1.05, 0x6cbf6f], [-3, 11, 0.8, 0x5cb85c], [-12.5, 0.5, 0.9, 0x8fd07a], [7.5, 9.5, 1.15, 0x6cbf6f],
];
treeSpots.forEach(([x, z, s, c]) => makeTree(x, z, s, c));

for (const [x, z, r] of [[-3.5, 6, 0.8], [9.5, 0.5, 0.7], [-9, -2, 0.9], [5.5, 7, 0.6], [2, -6, 0.75], [-5, 1.5, 0.65], [12.5, 5, 0.8]]) {
  const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), L(0x74c476));
  bush.position.set(x, r * 0.55, z);
  bush.castShadow = true;
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
  const a = rand() * Math.PI * 2;
  const r = Math.sqrt(rand()) * (ISLAND_R - 1.5);
  const tuft = new THREE.Mesh(tuftGeo, tuftMat);
  tuft.position.set(Math.cos(a) * r, 0.17, Math.sin(a) * r);
  tuft.rotation.y = rand() * Math.PI;
  scene.add(tuft);
}

// ============ ДОМИК / ОГОРОД ============
const house = new THREE.Group();
const walls = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 2.2), L(0xf7e7c3));
walls.position.y = 0.9; walls.castShadow = true;
const roof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 1.5, 4), L(0xe08e79));
roof.position.y = 2.55; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
const door = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.0, 0.1), L(0x9a6b4f));
door.position.set(0, 0.5, 1.15);
const win = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 24), L(0xfff7cc));
win.rotation.x = Math.PI / 2;
win.position.set(-0.8, 1.15, 1.12);
const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.35), L(0xc98a6d));
chimney.position.set(0.8, 2.9, -0.4);
house.add(walls, roof, door, win, chimney);
house.position.set(-7, 0.7, -6.5);
house.rotation.y = 0.5;
scene.add(house);
obstacles.push({ x: -7, z: -6.5, r: 2.5 });

const garden = new THREE.Group();
for (let i = 0; i < 3; i++) {
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 0.55), L(0x8a5a3b));
  bed.position.set(i * 2 - 2, 0.11, 0);
  bed.castShadow = true;
  garden.add(bed);
  for (let j = 0; j < 3; j++) {
    const sprout = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), L(0x7ddb7d));
    sprout.position.set(i * 2 - 2 - 0.5 + j * 0.5, 0.3, 0);
    sprout.scale.y = 0.7;
    garden.add(sprout);
  }
}
garden.position.set(2.5, 0, -6);
garden.rotation.y = -0.3;
scene.add(garden);
obstacles.push({ x: 2.5, z: -6, r: 2.4 });

// Дымок из трубы
const smokes = [];
const smokeMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
for (let i = 0; i < 4; i++) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), smokeMat.clone());
  s.userData.t = i / 4;
  scene.add(s);
  smokes.push(s);
}

// ============ ОБЛАКА (прозрачнеют, когда заяц под ними) ============
const clouds = [];
function makeCloud(x, y, z, s) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
  for (const [dx, dy, dz, r] of [[0, 0, 0, 1.1], [1, 0.15, 0.2, 0.8], [-0.9, 0.1, 0.1, 0.7], [0.3, 0.35, -0.3, 0.6]]) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
    puff.position.set(dx, dy, dz);
    g.add(puff);
  }
  g.scale.setScalar(s);
  g.position.set(x, y, z);
  scene.add(g);
  clouds.push({ g, mat, speed: 0.25 + Math.random() * 0.2, radius: 1.6 * s });
}
makeCloud(-8, 11, -10, 1.4);
makeCloud(6, 13, -14, 1.8);
makeCloud(0, 12, 12, 1.2);

// Птицы вдали
const birds = [];
for (let i = 0; i < 3; i++) {
  const g = new THREE.Group();
  const wingGeo = new THREE.PlaneGeometry(0.5, 0.12);
  const wMat = new THREE.MeshBasicMaterial({ color: 0x5a6b7a, side: THREE.DoubleSide });
  const wL = new THREE.Mesh(wingGeo, wMat); wL.position.x = -0.28; wL.rotation.z = 0.4;
  const wR = new THREE.Mesh(wingGeo, wMat); wR.position.x = 0.28; wR.rotation.z = -0.4;
  g.add(wL, wR);
  scene.add(g);
  birds.push({ g, off: i * 2.5, y: 14 + i });
}

// ============ БАБОЧКИ / ПЫЛЬЦА ============
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
makeButterfly(0.5, 6, 0xffb703);
makeButterfly(-6, 2, 0xff8fa3);
makeButterfly(5, 4, 0xc3aed6);

// Летающая пыльца
const pollenGeo = new THREE.BufferGeometry();
const POLLEN = 50;
const pPos = new Float32Array(POLLEN * 3);
for (let i = 0; i < POLLEN; i++) {
  const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 13;
  pPos[i * 3] = Math.cos(a) * r;
  pPos[i * 3 + 1] = 0.4 + rand() * 2.5;
  pPos[i * 3 + 2] = Math.sin(a) * r;
}
pollenGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pollen = new THREE.Points(pollenGeo, new THREE.PointsMaterial({
  color: 0xfff8c9, size: 0.08, transparent: true, opacity: 0.7, sizeAttenuation: true,
}));
scene.add(pollen);

// ============ ЗАЙЧОНОК ============
const bunny = new THREE.Group();
const fur = L(0xffffff);
const pink = L(0xf7c8d3);
const bodyG = new THREE.Group(); // для squash-and-stretch
const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 24), fur);
body.position.y = 0.55;
body.scale.set(1, 1.05, 0.95);
body.castShadow = true;
const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 24), fur);
head.position.set(0, 1.2, 0.12);
head.castShadow = true;
const earGeo = new THREE.CapsuleGeometry(0.11, 0.5, 6, 12);
const earL = new THREE.Mesh(earGeo, fur);
earL.position.set(-0.17, 1.8, 0.05);
earL.rotation.z = 0.12;
const earR = new THREE.Mesh(earGeo, fur);
earR.position.set(0.17, 1.8, 0.05);
earR.rotation.z = -0.12;
const innerGeo = new THREE.CapsuleGeometry(0.055, 0.32, 6, 12);
const innerL = new THREE.Mesh(innerGeo, pink);
innerL.position.set(-0.17, 1.8, 0.14);
innerL.rotation.z = 0.12;
const innerR = new THREE.Mesh(innerGeo, pink);
innerR.position.set(0.17, 1.8, 0.14);
innerR.rotation.z = -0.12;
const eyeGeo = new THREE.SphereGeometry(0.07, 14, 14);
const dark = new THREE.MeshBasicMaterial({ color: 0x2b2b2b });
const eyeL = new THREE.Mesh(eyeGeo, dark); eyeL.position.set(-0.16, 1.28, 0.46);
const eyeR = new THREE.Mesh(eyeGeo, dark); eyeR.position.set(0.16, 1.28, 0.46);
const glintGeo = new THREE.SphereGeometry(0.022, 8, 8);
const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const gL = new THREE.Mesh(glintGeo, glintMat); gL.position.set(-0.145, 1.305, 0.52);
const gR = new THREE.Mesh(glintGeo, glintMat); gR.position.set(0.175, 1.305, 0.52);
const nose = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), L(0xf2a0b5));
nose.position.set(0, 1.16, 0.5);
const cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), pink);
cheekL.position.set(-0.24, 1.12, 0.36); cheekL.scale.z = 0.5;
const cheekR = cheekL.clone(); cheekR.position.x = 0.24;
const pawGeo = new THREE.SphereGeometry(0.16, 12, 12);
const pawL = new THREE.Mesh(pawGeo, fur);
pawL.position.set(-0.3, 0.14, 0.3); pawL.scale.set(1, 0.55, 1.5);
const pawR = pawL.clone(); pawR.position.x = 0.3;
const tail = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), fur);
tail.position.set(0, 0.5, -0.55);
bodyG.add(body, head, earL, earR, innerL, innerR, eyeL, eyeR, gL, gR, nose, cheekL, cheekR, pawL, pawR, tail);
bunny.add(bodyG);

const blob = new THREE.Mesh(
  new THREE.CircleGeometry(0.55, 24),
  new THREE.MeshBasicMaterial({ color: 0x3f6b46, transparent: true, opacity: 0.16 })
);
blob.rotation.x = -Math.PI / 2;
blob.position.y = 0.02;
bunny.add(blob);
bunny.position.set(1, 0, 2);
scene.add(bunny);

// ============ ФИЗИКА: ОБХОД ПРЕПЯТСТВИЙ ============
// Точку цели выталкиваем из препятствий, чтобы зайцу было куда прийти
function clampTargetOutOfObstacles(p) {
  for (const ob of obstacles) {
    const dx = p.x - ob.x, dz = p.z - ob.z;
    const d = Math.hypot(dx, dz);
    const minD = ob.r + 0.5;
    if (d < minD) {
      const k = d > 0.001 ? minD / d : 1;
      if (d < 0.001) { p.x = ob.x + minD; p.z = ob.z; }
      else { p.x = ob.x + dx * k; p.z = ob.z + dz * k; }
    }
  }
  const edge = Math.hypot(p.x, p.z);
  if (edge > ISLAND_R - 1) {
    p.x *= (ISLAND_R - 1) / edge;
    p.z *= (ISLAND_R - 1) / edge;
  }
}

// Рулевое уклонение: мягко огибает препятствия по дуге
function steeringDir(pos, tgt, out) {
  let dx = tgt.x - pos.x, dz = tgt.z - pos.z;
  const td = Math.hypot(dx, dz);
  if (td < 0.001) { out.set(0, 0); return out; }
  dx /= td; dz /= td;
  let ax = 0, az = 0;
  for (const ob of obstacles) {
    const ox = ob.x - pos.x, oz = ob.z - pos.z;
    const d = Math.hypot(ox, oz);
    const R = ob.r + 1.7; // зона реакции
    if (d < R && d > 0.001) {
      const facing = (dx * ox + dz * oz) / d; // смотрим ли на препятствие
      if (facing > 0.25) {
        // перпендикуляр к направлению на препятствие, в ближнюю к цели сторону
        const px = -oz / d, pz = ox / d;
        const side = (dx * px + dz * pz) >= 0 ? 1 : -1;
        const push = ((R - d) / R) * facing * 1.6;
        ax += px * side * push;
        az += pz * side * push;
      }
    }
  }
  let mx = dx + ax, mz = dz + az;
  const md = Math.hypot(mx, mz);
  out.set(mx / md, mz / md);
  return out;
}

// Жёсткое выталкивание, если всё же вошёл в радиус
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

// Маркер тапа
const marker = new THREE.Mesh(
  new THREE.RingGeometry(0.35, 0.55, 32),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide })
);
marker.rotation.x = -Math.PI / 2;
scene.add(marker);
let markerLife = 0;

// ============ УПРАВЛЕНИЕ ============
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const target = new THREE.Vector3();
let hasTarget = false;
const SPEED = 4;
let elapsed = 0;

function onTap(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlane, hit)) {
    if (Math.hypot(hit.x, hit.z) > ISLAND_R - 1) return;
    target.copy(hit);
    clampTargetOutOfObstacles(target);
    hasTarget = true;
    marker.position.set(target.x, 0.06, target.z);
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

// ============ ЦИКЛ ============
const camOffset = new THREE.Vector3(0, 14, 11.5);
const lookTarget = new THREE.Vector3().copy(bunny.position);
camera.position.copy(bunny.position).add(camOffset);
camera.lookAt(lookTarget);

const moveDir = new THREE.Vector2();
let blinkT = 2.5;
let squashT = 0;
let wasMoving = false;
const rayCam = new THREE.Vector3();
const toCloud = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = 1 / 60;
  elapsed += dt;

  // --- Движение с обходом препятствий ---
  if (hasTarget) {
    steeringDir(bunny.position, target, moveDir);
    bunny.position.x += moveDir.x * Math.min(SPEED * dt, 1);
    bunny.position.z += moveDir.y * Math.min(SPEED * dt, 1);
    resolveCollision(bunny.position);
    const ddx = target.x - bunny.position.x, ddz = target.z - bunny.position.z;
    const dist = Math.hypot(ddx, ddz);
    if (dist < 0.25) {
      hasTarget = false;
      squashT = 1; // приземлились — лёгкий «присест»
    }
    if (Math.abs(moveDir.x) + Math.abs(moveDir.y) > 0.01) {
      const wantYaw = Math.atan2(moveDir.x, moveDir.y);
      let dy = wantYaw - bunny.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      bunny.rotation.y += dy * 0.18; // плавный разворот
    }
    const hop = Math.abs(Math.sin(elapsed * 9)) * 0.24;
    bunny.position.y = hop;
    earL.rotation.x = earR.rotation.x = -hop * 1.3;
    innerL.rotation.x = innerR.rotation.x = -hop * 1.3;
    wasMoving = true;
  } else {
    bunny.position.y += (0 - bunny.position.y) * 0.2;
    earL.rotation.x = earR.rotation.x = Math.sin(elapsed * 2) * 0.05;
    innerL.rotation.x = innerR.rotation.x = earL.rotation.x;
    // «дыхание» в покое
    bodyG.scale.y = 1 + Math.sin(elapsed * 2.6) * 0.012;
    bodyG.scale.x = bodyG.scale.z = 1 - Math.sin(elapsed * 2.6) * 0.006;
    if (wasMoving) { wasMoving = false; }
  }

  // Squash-and-stretch при приземлении
  if (squashT > 0) {
    squashT -= dt * 3;
    const k = Math.max(squashT, 0);
    bodyG.scale.y = 1 - Math.sin(k * Math.PI) * 0.16;
    bodyG.scale.x = bodyG.scale.z = 1 + Math.sin(k * Math.PI) * 0.1;
  }

  // Моргание
  blinkT -= dt;
  if (blinkT < 0) blinkT = 2 + Math.random() * 3;
  const blink = blinkT < 0.12 ? 0.15 : 1;
  eyeL.scale.y += (blink - eyeL.scale.y) * 0.6;
  eyeR.scale.y = eyeL.scale.y;
  gL.visible = gR.visible = blink > 0.5;

  for (const s of swayList) s.obj.rotation.z = Math.sin(elapsed * s.speed + s.obj.position.x) * s.amp;

  // Облака: дрейф + прозрачность, если между камерой и зайцем
  rayCam.subVectors(bunny.position, camera.position);
  const rayLen = rayCam.length();
  rayCam.normalize();
  for (const c of clouds) {
    c.g.position.x += c.speed * dt;
    if (c.g.position.x > 26) c.g.position.x = -26;
    toCloud.subVectors(c.g.position, camera.position);
    const proj = toCloud.dot(rayCam);
    let targetOpacity = 1;
    if (proj > 0 && proj < rayLen) {
      const perp = Math.sqrt(Math.max(toCloud.lengthSq() - proj * proj, 0));
      if (perp < c.radius + 0.8) targetOpacity = 0.35;
    }
    c.mat.opacity += (targetOpacity - c.mat.opacity) * 0.06;
  }

  // Дымок
  for (const s of smokes) {
    s.userData.t += dt * 0.22;
    if (s.userData.t > 1) s.userData.t = 0;
    const t = s.userData.t;
    s.position.set(
      -6.15 + Math.sin(t * 9 + t * 3) * 0.25,
      3.6 + t * 2.2,
      -6.9 + Math.cos(t * 7) * 0.15
    );
    s.scale.setScalar(0.6 + t * 1.6);
    s.material.opacity = 0.45 * (1 - t);
  }

  // Птицы
  for (const b of birds) {
    b.off += dt * 0.6;
    const x = ((b.off * 2.2) % 60) - 30;
    b.g.position.set(x, b.y + Math.sin(b.off) * 0.6, -18 + Math.cos(b.off * 0.5) * 4);
    b.g.rotation.y = Math.PI / 2;
    const flap = Math.sin(b.off * 6) * 0.55;
    b.g.children[0].rotation.z = 0.4 + flap;
    b.g.children[1].rotation.z = -0.4 - flap;
  }

  // Бабочки
  for (const b of butterflies) {
    b.t += dt;
    b.g.position.set(b.cx + Math.cos(b.t * 0.7) * 1.1, 1 + Math.sin(b.t * 2.1) * 0.25, b.cz + Math.sin(b.t * 0.7) * 1.1);
    const flap = Math.sin(b.t * 18) * 0.9;
    b.wL.rotation.y = flap * 0.7;
    b.wR.rotation.y = -flap * 0.7;
  }

  // Пыльца дрейфует
  pollen.rotation.y = elapsed * 0.02;
  pollen.position.y = Math.sin(elapsed * 0.5) * 0.15;

  pond.scale.setScalar(1 + Math.sin(elapsed * 1.6) * 0.012);

  if (markerLife > 0) {
    markerLife -= 0.025;
    marker.material.opacity = Math.max(markerLife, 0) * 0.9;
    marker.scale.setScalar(1 + (1 - Math.max(markerLife, 0)) * 0.8);
  }

  const wanted = new THREE.Vector3().copy(bunny.position).add(camOffset);
  camera.position.lerp(wanted, 0.06);
  lookTarget.lerp(bunny.position, 0.08);
  camera.lookAt(lookTarget);
  // Тень двигается за солнцем-в-сцене
  sun.position.set(bunny.position.x + 12, 20, bunny.position.z + 9);
  sun.target = bunny;

  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

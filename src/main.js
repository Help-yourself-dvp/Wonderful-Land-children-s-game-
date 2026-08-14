import * as THREE from 'three';

// ============ БАЗА ============
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaee3f5);
scene.fog = new THREE.Fog(0xaee3f5, 34, 70);

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
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xffffff, 0x9ccc8f, 1.05));
const sun = new THREE.DirectionalLight(0xfff4d6, 1.15);
sun.position.set(10, 18, 8);
scene.add(sun);

const L = (c) => new THREE.MeshLambertMaterial({ color: c });
const swayList = []; // всё, что покачивается

// ============ ОСТРОВ ============
const ISLAND_R = 15;
const ground = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R, ISLAND_R * 0.88, 1.8, 30), L(0x8ed081));
ground.position.y = -0.9;
scene.add(ground);
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// Холмы
for (const [x, z, r, c] of [[-7, -7, 3.4, 0x7ecb74], [9, 6, 2.6, 0x86cf78], [-11, 4, 2.2, 0x94d687]]) {
  const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), L(c));
  hill.scale.y = 0.38;
  hill.position.set(x, 0, z);
  scene.add(hill);
}

// Пруд + кувшинки + камыши
const pond = new THREE.Mesh(new THREE.CircleGeometry(3.4, 26), L(0x7ecbe8));
pond.rotation.x = -Math.PI / 2;
pond.position.set(5, 0.04, 4);
scene.add(pond);
for (const [dx, dz, s] of [[-1, 0.6, 0.5], [0.9, -1, 0.4], [0.3, 1.4, 0.35]]) {
  const pad = new THREE.Mesh(new THREE.CircleGeometry(s, 10), L(0x5fbf7a));
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(5 + dx, 0.07, 4 + dz);
  scene.add(pad);
}
for (const [dx, dz] of [[3.6, 0.5], [3.3, -1.8]]) {
  const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.4, 6), L(0x5aa860));
  reed.position.set(5 + dx, 0.7, 4 + dz);
  const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.3, 3, 6), L(0x8a5a3b));
  tip.position.set(5 + dx, 1.55, 4 + dz);
  scene.add(reed, tip);
}

// Тропинка к домику
for (let i = 0; i < 6; i++) {
  const t = i / 5;
  const st = new THREE.Mesh(new THREE.CircleGeometry(0.55 - t * 0.1, 12), L(0xf0e3c0));
  st.rotation.x = -Math.PI / 2;
  st.position.set(-1.5 - t * 4.5, 0.05, -1 - t * 4.2);
  scene.add(st);
}

// ============ ДЕРЕВЬЯ / КУСТЫ / ЦВЕТЫ / ТРАВА ============
function makeTree(x, z, s, crownColor) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.34 * s, 1.5 * s, 8), L(0x9a6b4f));
  trunk.position.y = 0.75 * s;
  const crown = new THREE.Group();
  const c1 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25 * s, 0), L(crownColor));
  const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 * s, 0), L(crownColor));
  c2.position.set(0.6 * s, 0.5 * s, 0.2 * s);
  const c3 = c2.clone();
  c3.position.set(-0.55 * s, 0.4 * s, -0.25 * s);
  crown.add(c1, c2, c3);
  crown.position.y = 1.9 * s;
  g.add(trunk, crown);
  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * Math.PI;
  scene.add(g);
  swayList.push({ obj: crown, amp: 0.045, speed: 1.1 + Math.random() * 0.4 });
  return g;
}
const treeSpots = [
  [-6, -9, 1.1, 0x6cbf6f], [8.5, -7, 0.9, 0x5cb85c], [-10.5, -3.5, 1.25, 0x8fd07a],
  [-8.5, 6.5, 1.0, 0x6cbf6f], [11.5, 2.5, 0.85, 0x5cb85c], [1.5, 10.5, 1.0, 0x8fd07a],
  [12, -3, 1.05, 0x6cbf6f], [-3, 11, 0.8, 0x5cb85c], [-12.5, 0.5, 0.9, 0x8fd07a], [7.5, 9.5, 1.15, 0x6cbf6f],
];
treeSpots.forEach(([x, z, s, c]) => makeTree(x, z, s, c));

for (const [x, z, r] of [[-3.5, 6, 0.8], [9.5, 0.5, 0.7], [-9, -2, 0.9], [5.5, 7, 0.6], [2, -6, 0.75], [-5, 1.5, 0.65], [12.5, 5, 0.8]]) {
  const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), L(0x74c476));
  bush.position.set(x, r * 0.55, z);
  scene.add(bush);
}

// Цветы
const flowerColors = [0xf2a0b5, 0xffd166, 0xc3aed6, 0xff8fa3, 0xffffff];
const flowerSpots = [[-2, 3], [0.5, 6], [-6, 2], [3.5, -2.5], [7, 2.5], [-4.5, -5.5], [9.5, 5.5], [1, 8.5], [-7.5, 7.5], [4, -7.5], [-1, -9], [11, -0.5], [-10, 2.5], [6.5, 10]];
flowerSpots.forEach(([x, z], i) => {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.5, 5), L(0x5aa860));
  stem.position.y = 0.25;
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), L(0xfff3d6));
  center.position.y = 0.55;
  g.add(stem, center);
  for (let p = 0; p < 5; p++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 6), L(flowerColors[i % flowerColors.length]));
    const a = (p / 5) * Math.PI * 2;
    petal.position.set(Math.cos(a) * 0.17, 0.55, Math.sin(a) * 0.17);
    petal.scale.set(1, 0.5, 1);
    g.add(petal);
  }
  g.position.set(x, 0, z);
  scene.add(g);
  swayList.push({ obj: g, amp: 0.12, speed: 1.6 + Math.random() });
});

// Травка-пучки
const tuftGeo = new THREE.ConeGeometry(0.09, 0.35, 5);
const tuftMat = L(0x6fbf62);
let seed = 42;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < 60; i++) {
  const a = rand() * Math.PI * 2;
  const r = Math.sqrt(rand()) * (ISLAND_R - 1.5);
  const tuft = new THREE.Mesh(tuftGeo, tuftMat);
  tuft.position.set(Math.cos(a) * r, 0.17, Math.sin(a) * r);
  tuft.rotation.y = rand() * Math.PI;
  scene.add(tuft);
}

// ============ ДОМИК НА ХОЛМЕ ============
const house = new THREE.Group();
const walls = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 2.2), L(0xf7e7c3));
walls.position.y = 0.9;
const roof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 1.5, 4), L(0xe08e79));
roof.position.y = 2.55;
roof.rotation.y = Math.PI / 4;
const door = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.0, 0.1), L(0x9a6b4f));
door.position.set(0, 0.5, 1.15);
const win = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 16), L(0xfff7cc));
win.rotation.x = Math.PI / 2;
win.position.set(-0.8, 1.15, 1.12);
const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.35), L(0xc98a6d));
chimney.position.set(0.8, 2.9, -0.4);
house.add(walls, roof, door, win, chimney);
house.position.set(-7, 0.7, -6.5);
house.rotation.y = 0.5;
scene.add(house);

// Огород с грядками
const garden = new THREE.Group();
for (let i = 0; i < 3; i++) {
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 0.55), L(0x8a5a3b));
  bed.position.set(i * 2 - 2, 0.11, 0);
  garden.add(bed);
  for (let j = 0; j < 3; j++) {
    const sprout = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), L(0x7ddb7d));
    sprout.position.set(i * 2 - 2 - 0.5 + j * 0.5, 0.3, 0);
    sprout.scale.y = 0.7;
    garden.add(sprout);
  }
}
garden.position.set(2.5, 0, -6);
garden.rotation.y = -0.3;
scene.add(garden);

// ============ ОБЛАКА ============
const clouds = [];
function makeCloud(x, y, z, s) {
  const g = new THREE.Group();
  for (const [dx, dy, dz, r] of [[0, 0, 0, 1.1], [1, 0.15, 0.2, 0.8], [-0.9, 0.1, 0.1, 0.7], [0.3, 0.35, -0.3, 0.6]]) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), L(0xffffff));
    puff.position.set(dx, dy, dz);
    g.add(puff);
  }
  g.scale.setScalar(s);
  g.position.set(x, y, z);
  scene.add(g);
  clouds.push({ g, speed: 0.25 + Math.random() * 0.2 });
}
makeCloud(-8, 11, -10, 1.4);
makeCloud(6, 13, -14, 1.8);
makeCloud(0, 12, 12, 1.2);

// ============ БАБОЧКИ ============
const butterflies = [];
function makeButterfly(cx, cz, color) {
  const g = new THREE.Group();
  const wingGeo = new THREE.CircleGeometry(0.16, 8);
  const wL = new THREE.Mesh(wingGeo, L(color));
  const wR = new THREE.Mesh(wingGeo, L(color));
  wL.position.x = -0.14; wR.position.x = 0.14;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.16, 3, 6), L(0x4a3b32));
  body.rotation.x = Math.PI / 2;
  g.add(wL, wR, body);
  scene.add(g);
  butterflies.push({ g, wL, wR, cx, cz, t: Math.random() * 10 });
}
makeButterfly(0.5, 6, 0xffb703);
makeButterfly(-6, 2, 0xff8fa3);
makeButterfly(5, 4, 0xc3aed6);

// ============ ЗАЙЧОНОК ============
const bunny = new THREE.Group();
const fur = L(0xffffff);
const pink = L(0xf7c8d3);
const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 18), fur);
body.position.y = 0.55;
body.scale.set(1, 1.05, 0.95);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 18), fur);
head.position.set(0, 1.2, 0.12);
const earGeo = new THREE.CapsuleGeometry(0.11, 0.5, 4, 8);
const earL = new THREE.Mesh(earGeo, fur);
earL.position.set(-0.17, 1.8, 0.05);
earL.rotation.z = 0.12;
const earR = new THREE.Mesh(earGeo, fur);
earR.position.set(0.17, 1.8, 0.05);
earR.rotation.z = -0.12;
const innerGeo = new THREE.CapsuleGeometry(0.055, 0.32, 4, 8);
const innerL = new THREE.Mesh(innerGeo, pink);
innerL.position.set(-0.17, 1.8, 0.14);
innerL.rotation.z = 0.12;
const innerR = new THREE.Mesh(innerGeo, pink);
innerR.position.set(0.17, 1.8, 0.14);
innerR.rotation.z = -0.12;
// Глаза с бликами
const eyeGeo = new THREE.SphereGeometry(0.07, 10, 10);
const dark = new THREE.MeshBasicMaterial({ color: 0x2b2b2b });
const eyeL = new THREE.Mesh(eyeGeo, dark); eyeL.position.set(-0.16, 1.28, 0.46);
const eyeR = new THREE.Mesh(eyeGeo, dark); eyeR.position.set(0.16, 1.28, 0.46);
const glintGeo = new THREE.SphereGeometry(0.022, 6, 6);
const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const gL = new THREE.Mesh(glintGeo, glintMat); gL.position.set(-0.145, 1.305, 0.52);
const gR = new THREE.Mesh(glintGeo, glintMat); gR.position.set(0.175, 1.305, 0.52);
// Носик и щёчки
const nose = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), L(0xf2a0b5));
nose.position.set(0, 1.16, 0.5);
const cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), pink);
cheekL.position.set(-0.24, 1.12, 0.36); cheekL.scale.z = 0.5;
const cheekR = cheekL.clone(); cheekR.position.x = 0.24;
// Лапки и хвост
const pawGeo = new THREE.SphereGeometry(0.16, 10, 10);
const pawL = new THREE.Mesh(pawGeo, fur);
pawL.position.set(-0.3, 0.14, 0.3); pawL.scale.set(1, 0.55, 1.5);
const pawR = pawL.clone(); pawR.position.x = 0.3;
const tail = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), fur);
tail.position.set(0, 0.5, -0.55);
bunny.add(body, head, earL, earR, innerL, innerR, eyeL, eyeR, gL, gR, nose, cheekL, cheekR, pawL, pawR, tail);

const blob = new THREE.Mesh(
  new THREE.CircleGeometry(0.55, 20),
  new THREE.MeshBasicMaterial({ color: 0x3f6b46, transparent: true, opacity: 0.18 })
);
blob.rotation.x = -Math.PI / 2;
blob.position.y = 0.02;
bunny.add(blob);
scene.add(bunny);

// Маркер тапа
const marker = new THREE.Mesh(
  new THREE.RingGeometry(0.35, 0.55, 24),
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
    hasTarget = true;
    marker.position.set(hit.x, 0.06, hit.z);
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
const lookTarget = new THREE.Vector3();
camera.position.copy(camOffset);

function animate() {
  requestAnimationFrame(animate);
  elapsed += 1 / 60;

  if (hasTarget) {
    const to = new THREE.Vector3().subVectors(target, bunny.position);
    to.y = 0;
    const dist = to.length();
    if (dist < 0.15) {
      hasTarget = false;
    } else {
      const dir = to.normalize();
      bunny.position.addScaledVector(dir, Math.min(SPEED / 60, dist));
      bunny.rotation.y = Math.atan2(dir.x, dir.z);
      const hop = Math.abs(Math.sin(elapsed * 9)) * 0.24;
      bunny.position.y = hop;
      earL.rotation.x = earR.rotation.x = -hop * 1.3;
      innerL.rotation.x = innerR.rotation.x = -hop * 1.3;
    }
  } else {
    bunny.position.y += (0 - bunny.position.y) * 0.2;
    earL.rotation.x = earR.rotation.x = Math.sin(elapsed * 2) * 0.05;
    innerL.rotation.x = innerR.rotation.x = earL.rotation.x;
  }

  for (const s of swayList) s.obj.rotation.z = Math.sin(elapsed * s.speed + s.obj.position.x) * s.amp;
  for (const c of clouds) {
    c.g.position.x += c.speed / 60;
    if (c.g.position.x > 26) c.g.position.x = -26;
  }
  for (const b of butterflies) {
    b.t += 1 / 60;
    b.g.position.set(b.cx + Math.cos(b.t * 0.7) * 1.1, 1 + Math.sin(b.t * 2.1) * 0.25, b.cz + Math.sin(b.t * 0.7) * 1.1);
    const flap = Math.sin(b.t * 18) * 0.9;
    b.wL.rotation.y = flap * 0.7;
    b.wR.rotation.y = -flap * 0.7;
  }
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

  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

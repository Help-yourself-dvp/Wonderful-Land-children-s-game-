import * as THREE from 'three';

// ---------- Базовая сцена ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaee3f5);
scene.fog = new THREE.Fog(0xaee3f5, 30, 60);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (e) {
  const el = document.getElementById('hint');
  if (el) { el.style.opacity = '1'; el.textContent = '⚠️ Это устройство/просмотрщик не поддерживает WebGL — откройте игру в браузере телефона'; }
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);

// Свет: 1 ambient + 1 directional (ГДД 5.2 — без динамических теней)
scene.add(new THREE.HemisphereLight(0xffffff, 0x9ccc8f, 1.0));
const sun = new THREE.DirectionalLight(0xfff4d6, 1.2);
sun.position.set(10, 18, 8);
scene.add(sun);

// ---------- Остров ----------
const ISLAND_R = 14;
const ground = new THREE.Mesh(
  new THREE.CylinderGeometry(ISLAND_R, ISLAND_R * 0.9, 1.6, 28),
  new THREE.MeshLambertMaterial({ color: 0x8ed081 })
);
ground.position.y = -0.8;
scene.add(ground);

// Невидимая плоскость для Raycaster (тап по земле)
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// Пруд
const pond = new THREE.Mesh(
  new THREE.CircleGeometry(3.2, 24),
  new THREE.MeshLambertMaterial({ color: 0x7ecbe8 })
);
pond.rotation.x = -Math.PI / 2;
pond.position.set(4.5, 0.03, 3.5);
scene.add(pond);

// Деревья
function makeTree(x, z, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 1.6 * s, 8),
    new THREE.MeshLambertMaterial({ color: 0x9a6b4f })
  );
  trunk.position.y = 0.8 * s;
  const crown = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.4 * s, 0),
    new THREE.MeshLambertMaterial({ color: 0x6cbf6f })
  );
  crown.position.y = 2.4 * s;
  g.add(trunk, crown);
  g.position.set(x, 0, z);
  g.userData.crown = crown;
  scene.add(g);
  return g;
}
const trees = [makeTree(-6, -4), makeTree(7, -5, 0.8), makeTree(-8, 3, 1.2), makeTree(2, -8, 0.9)];

// Кусты
for (const [x, z, r] of [[-3, 6, 0.8], [9, 1, 0.7], [-9, -2, 0.9], [5, 6.5, 0.6]]) {
  const bush = new THREE.Mesh(
    new THREE.IcosahedronGeometry(r, 0),
    new THREE.MeshLambertMaterial({ color: 0x74c476 })
  );
  bush.position.set(x, r * 0.6, z);
  scene.add(bush);
}

// ---------- Персонаж: зайчонок (заглушка из примитивов) ----------
const bunny = new THREE.Group();
const fur = new THREE.MeshLambertMaterial({ color: 0xffffff });
const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), fur);
body.position.y = 0.55;
const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), fur);
head.position.set(0, 1.2, 0.1);
const earGeo = new THREE.CapsuleGeometry(0.11, 0.55, 4, 8);
const earL = new THREE.Mesh(earGeo, fur);
earL.position.set(-0.18, 1.85, 0.05);
const earR = new THREE.Mesh(earGeo, fur);
earR.position.set(0.18, 1.85, 0.05);
const nose = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshLambertMaterial({ color: 0xf2a0b5 }));
nose.position.set(0, 1.22, 0.5);
bunny.add(body, head, earL, earR, nose);

// Мягкая «тень-пятнышко» (blob shadow)
const blob = new THREE.Mesh(
  new THREE.CircleGeometry(0.55, 20),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 })
);
blob.rotation.x = -Math.PI / 2;
blob.position.y = 0.02;
bunny.add(blob);
scene.add(bunny);

// Маркер тапа: пульсирующее колечко
const marker = new THREE.Mesh(
  new THREE.RingGeometry(0.35, 0.55, 24),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide })
);
marker.rotation.x = -Math.PI / 2;
marker.position.y = 0.05;
scene.add(marker);
let markerLife = 0;

// ---------- Управление Tap-to-Move ----------
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
    // Не даём указать точку за краем острова
    if (Math.hypot(hit.x, hit.z) > ISLAND_R - 1) return;
    target.copy(hit);
    hasTarget = true;
    marker.position.set(hit.x, 0.05, hit.z);
    markerLife = 1;
    hideHint();
  }
}

// Защита от случайных нажатий: тап засчитываем только при быстром отпускании без протяжки
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

// ---------- Игровой цикл ----------
const camOffset = new THREE.Vector3(0, 15, 11);
const lookTarget = new THREE.Vector3();
camera.position.copy(camOffset);

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(renderer.info.render.frame ? 0.05 : 0.05, 0.05);
  elapsed += 1 / 60;

  // Движение зайчонка к цели с «прыгающей» анимацией
  if (hasTarget) {
    const toTarget = new THREE.Vector3().subVectors(target, bunny.position);
    toTarget.y = 0;
    const dist = toTarget.length();
    if (dist < 0.15) {
      hasTarget = false;
    } else {
      const step = Math.min(SPEED * (1 / 60), dist);
      const dir = toTarget.normalize();
      bunny.position.addScaledVector(dir, step);
      bunny.rotation.y = Math.atan2(dir.x, dir.z);
      const hop = Math.abs(Math.sin(elapsed * 9)) * 0.22;
      bunny.position.y = hop;
      // Ушки подпрыгивают
      earL.rotation.x = earR.rotation.x = -hop * 1.2;
    }
  } else {
    bunny.position.y += (0 - bunny.position.y) * 0.2;
  }

  // Деревья слегка покачиваются
  for (let i = 0; i < trees.length; i++) {
    trees[i].userData.crown.rotation.z = Math.sin(elapsed * 1.2 + i) * 0.05;
  }
  // Вода мягко дышит
  pond.scale.setScalar(1 + Math.sin(elapsed * 1.6) * 0.015);

  // Маркер тапа: растёт и тает
  if (markerLife > 0) {
    markerLife -= 0.025;
    marker.material.opacity = Math.max(markerLife, 0) * 0.9;
    marker.scale.setScalar(1 + (1 - Math.max(markerLife, 0)) * 0.8);
  }

  // Камера мягко следует за зайчонком (изометрика, без вращения)
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

/* ─────────────────────────────────────────────────────────
   anatomia.js — Corpo do suíno gerado por código (sem arquivo
   de modelo). O corpo é uma "escultura" feita de elipsoides e
   cápsulas unidas suavemente (campo de distância, SDF) e
   convertida em malha com Marching Cubes. Assim o tronco, a
   paleta, o pernil, a papada e o focinho se fundem como num
   animal de verdade, sem emendas.

   Coordenadas locais (unidade ≈ 1 metro / 1,25):
   +x = para onde o focinho aponta, +y = para cima, z = lados.
   O chão fica em y = CHAO.
   ───────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

export const CHAO = -0.615;
// Pivô do pescoço: a cabeça gira em torno deste ponto (shader + grupo da cabeça)
export const PIVO_CABECA = new THREE.Vector3(0.56, 0.06, 0);

// O campo do Marching Cubes vai de -1 a 1; o porco é deslocado para caber centralizado
const DESLOC_X = 0.12;

/* ── Primitivas de distância (aproximações de Inigo Quilez) ── */
function elipsoide(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const x = (px - cx) / rx, y = (py - cy) / ry, z = (pz - cz) / rz;
  const k0 = Math.sqrt(x * x + y * y + z * z);
  const k1 = Math.sqrt(x * x / (rx * rx) + y * y / (ry * ry) + z * z / (rz * rz));
  return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}

// Cápsula afunilada entre A e B (raio ra em A, rb em B)
function capsula(px, py, pz, ax, ay, az, bx, by, bz, ra, rb) {
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const pax = px - ax, pay = py - ay, paz = pz - az;
  let h = (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz);
  h = h < 0 ? 0 : h > 1 ? 1 : h;
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * h);
}

// União suave: funde duas formas com um "filete" de raio k
function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/* Pernas: [topo, joelho/jarrete, casco] por lado (z positivo; espelhado) */
const PERNAS = [
  // dianteira: antebraço reto, quartela levemente para trás
  { a: [0.40, -0.04, 0.125], b: [0.42, -0.36, 0.13], c: [0.435, -0.55, 0.13], ra: 0.098, rb: 0.056, rc: 0.044 },
  // traseira: coxa forte, jarrete angulado para trás
  { a: [-0.43, -0.02, 0.125], b: [-0.50, -0.32, 0.13], c: [-0.46, -0.55, 0.13], ra: 0.125, rb: 0.06, rc: 0.044 },
];
export const CASCOS = PERNAS.flatMap((p) => [
  new THREE.Vector3(p.c[0], p.c[1], p.c[2]),
  new THREE.Vector3(p.c[0], p.c[1], -p.c[2]),
]);

/* Distância assinada até a pele do suíno (negativo = dentro) */
export function distanciaCorpo(x, y, z) {
  const az = Math.abs(z); // corpo simétrico
  // Tronco: cápsula deitada (linha do dorso reta, como num suíno de terminação)
  let d = capsula(x, y, z / 0.93, -0.44, 0.05, 0, 0.34, 0.062, 0, 0.282, 0.272) * 0.95;
  d = smin(d, elipsoide(x, y, z, -0.45, 0.035, 0, 0.28, 0.29, 0.265), 0.14); // pernil
  d = smin(d, elipsoide(x, y, az, -0.47, -0.02, 0.1, 0.22, 0.25, 0.165), 0.1); // nádegas
  d = smin(d, elipsoide(x, y, z, 0.36, 0.05, 0, 0.26, 0.285, 0.245), 0.14);  // paleta
  d = smin(d, elipsoide(x, y, z, 0.0, -0.1, 0, 0.48, 0.2, 0.232), 0.12);     // barriga
  d = smin(d, elipsoide(x, y, z, 0.60, 0.065, 0, 0.2, 0.225, 0.205), 0.12);  // pescoço
  d = smin(d, elipsoide(x, y, z, 0.77, 0.075, 0, 0.19, 0.175, 0.158), 0.1);  // crânio
  d = smin(d, elipsoide(x, y, z, 0.70, -0.055, 0, 0.15, 0.13, 0.162), 0.08); // papada
  d = smin(d, elipsoide(x, y, z, 0.83, 0.15, 0, 0.13, 0.075, 0.115), 0.08);  // testa

  // Focinho: cone arredondado com a ponta achatada (o "disco")
  let f = capsula(x, y, z, 0.86, 0.045, 0, 1.0, 0.0, 0, 0.096, 0.073);
  f = Math.max(f, x - 1.015);
  d = smin(d, f, 0.07);

  for (const p of PERNAS) {
    d = smin(d, capsula(x, y, az, p.a[0], p.a[1], p.a[2], p.b[0], p.b[1], p.b[2], p.ra, p.rb), 0.075);
    d = smin(d, capsula(x, y, az, p.b[0], p.b[1], p.b[2], p.c[0], p.c[1], p.c[2], p.rb, p.rc), 0.035);
  }
  return d;
}

/* Gradiente numérico (normal da pele num ponto) */
export function normalCorpo(p, alvo = new THREE.Vector3()) {
  const e = 0.004;
  alvo.set(
    distanciaCorpo(p.x + e, p.y, p.z) - distanciaCorpo(p.x - e, p.y, p.z),
    distanciaCorpo(p.x, p.y + e, p.z) - distanciaCorpo(p.x, p.y - e, p.z),
    distanciaCorpo(p.x, p.y, p.z + e) - distanciaCorpo(p.x, p.y, p.z - e),
  );
  return alvo.normalize();
}

/* Encontra a pele partindo de `origem` na direção `dir` (de fora para dentro).
   Usado para encaixar olhos, narinas e sensores exatamente na superfície. */
export function pontoNaPele(origem, dir, alvo = new THREE.Vector3()) {
  const d = dir.clone().normalize();
  const p = origem.clone();
  for (let i = 0; i < 200; i++) {
    const dist = distanciaCorpo(p.x, p.y, p.z);
    if (Math.abs(dist) < 0.0005) break;
    p.addScaledVector(d, dist * 0.8);
  }
  return alvo.copy(p);
}

/* ── Cor da pele (sRGB) por região do corpo ── */
const cor = new THREE.Color();
function ruido3(x, y, z) {
  // ruído barato e determinístico para manchas suaves na pele
  return (
    Math.sin(x * 9.1 + Math.sin(z * 7.3)) * 0.5 +
    Math.sin(y * 11.7 + x * 3.1) * 0.3 +
    Math.sin(z * 13.3 + y * 5.7 + x * 2.3) * 0.2
  );
}
function mistura(a, b, t) { return a + (b - a) * t; }
function passo(e0, e1, v) { const t = Math.min(Math.max((v - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); }

function corDaPele(x, y, z) {
  // Rosa "Large White": base levemente pêssego
  let r = 0.91, g = 0.665, b = 0.585;
  // Dorso um pouco mais claro/creme (pelos claros refletindo)
  const dorso = passo(0.12, 0.33, y);
  r = mistura(r, 0.94, dorso * 0.45); g = mistura(g, 0.76, dorso * 0.45); b = mistura(b, 0.67, dorso * 0.45);
  // Barriga e axilas mais rosadas
  const barriga = passo(-0.05, -0.25, y) * (1 - passo(-0.4, -0.5, y));
  r = mistura(r, 0.93, barriga * 0.6); g = mistura(g, 0.6, barriga * 0.6); b = mistura(b, 0.56, barriga * 0.6);
  // Focinho e ponta: rosa mais intenso e úmido
  const focinho = passo(0.9, 0.99, x);
  r = mistura(r, 0.89, focinho); g = mistura(g, 0.5, focinho); b = mistura(b, 0.49, focinho);
  // Região dos olhos levemente avermelhada
  const olhos = passo(0.05, 0.0, Math.hypot(x - 0.89, y - 0.12) - 0.04);
  r = mistura(r, 0.88, olhos * 0.5); g = mistura(g, 0.6, olhos * 0.5); b = mistura(b, 0.58, olhos * 0.5);
  // Canelas: terra e desgaste perto dos cascos
  const terra = passo(-0.36, -0.54, y);
  r = mistura(r, 0.58, terra * 0.75); g = mistura(g, 0.45, terra * 0.75); b = mistura(b, 0.37, terra * 0.75);
  // Manchas sutis (variação natural da pele)
  const n = ruido3(x * 2.2, y * 2.2, z * 2.2) * 0.035;
  cor.setRGB(r + n, g + n * 0.9, b + n * 0.8, THREE.SRGBColorSpace);
  return cor; // já convertido para o espaço linear de trabalho
}

/* ── Geração da malha ──
   resolucao 112 ≈ 1,4 milhão de células; só as que ficam perto
   do porco são calculadas. Retorna uma BufferGeometry compacta. */
export function gerarGeometriaCorpo(resolucao = 112) {
  const mc = new MarchingCubes(resolucao, new THREE.MeshBasicMaterial(), false, true, 260000);
  mc.isolation = 0;
  const n = mc.size, h = mc.halfsize;
  const campo = mc.field, paleta = mc.palette;

  for (let iz = 0; iz < n; iz++) {
    const z = (iz - h) / h;
    const fora = Math.abs(z) > 0.38;
    for (let iy = 0; iy < n; iy++) {
      const y = (iy - h) / h;
      const foraY = fora || y < -0.66 || y > 0.44;
      for (let ix = 0; ix < n; ix++) {
        const idx = iz * mc.size2 + iy * n + ix;
        const x = (ix - h) / h + DESLOC_X;
        if (foraY || x < -0.82 || x > 1.06) { campo[idx] = -1; continue; }
        const d = distanciaCorpo(x, y, z);
        campo[idx] = -d;
        if (d > -0.05 && d < 0.05) {
          const c = corDaPele(x, y, z);
          paleta[idx * 3] = c.r; paleta[idx * 3 + 1] = c.g; paleta[idx * 3 + 2] = c.b;
        }
      }
    }
  }

  mc.update();
  const total = mc.count;
  const geo = new THREE.BufferGeometry();
  const pos = mc.positionArray.slice(0, total * 3);
  for (let i = 0; i < pos.length; i += 3) pos[i] += DESLOC_X;
  const nor = mc.normalArray.slice(0, total * 3);
  for (let i = 0; i < nor.length; i += 3) {
    const l = Math.hypot(nor[i], nor[i + 1], nor[i + 2]) || 1;
    nor[i] /= l; nor[i + 1] /= l; nor[i + 2] /= l;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(mc.colorArray.slice(0, total * 3), 3));
  geo.computeBoundingSphere();
  geo.computeBoundingBox();

  mc.geometry.dispose();
  return geo;
}

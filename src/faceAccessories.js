// Accesorios 3D que siguen la cara (modo Selfie).
// Unidades en centímetros, en el sistema de coordenadas del "modelo canónico" de MediaPipe:
// x a la derecha de la imagen, y hacia arriba, z hacia la cámara. Referencias:
//   ojos ≈ (±3.2, 2.6, 3.5) · punta de nariz ≈ (0, -1.1, 7.5) · frente ≈ (0, 8.3, 4.5) · mentón ≈ (0, -9.4, 4.3)
import * as THREE from 'three';
import { barGeometry, canvasTexture } from './models.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// "Oclusores": volúmenes invisibles con la forma aproximada de la cabeza y el cuello.
// Escriben profundidad pero no color, así las partes de los accesorios que quedan
// "detrás" de la cabeza (patillas de las gafas, parte trasera del estetoscopio) se ocultan.
// Con ?oclusor en la URL se ven en magenta (útil para depurar el ajuste a la cabeza).
const DEBUG_OCCLUDER = new URLSearchParams(location.search).has('oclusor');
const occluderMat = DEBUG_OCCLUDER
  ? new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.35 })
  : new THREE.MeshBasicMaterial({ colorWrite: false });
const sphereGeo = new THREE.SphereGeometry(1, 32, 24);
function headOccluder() {
  const g = new THREE.Group();
  // Cara (queda detrás de la superficie real del rostro).
  const face = new THREE.Mesh(sphereGeo, occluderMat);
  face.scale.set(7.6, 10.5, 9.0);
  face.position.set(0, 0.5, -4);
  // Cráneo: llega hasta la coronilla (y≈13.5) y la nuca (z≈-13.5).
  const skull = new THREE.Mesh(sphereGeo, occluderMat);
  skull.scale.set(8.0, 10.0, 9.0);
  skull.position.set(0, 3.8, -5.2);
  for (const m of [face, skull]) {
    m.renderOrder = -2;
    g.add(m);
  }
  return g;
}
function neckOccluder() {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.4, 22, 24), occluderMat);
  m.position.set(0, -18, -2.8);
  m.renderOrder = -2;
  return m;
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/* ------------------- Software: gafas + holograma </> -------------------- */

function software() {
  const head = new THREE.Group();
  const body = new THREE.Group();
  head.add(headOccluder());

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f1115, metalness: 0.4, roughness: 0.3 });
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: 0x4cc9f0,
    emissive: 0x1a78b0,
    emissiveIntensity: 0.7,
    transparent: true,
    opacity: 0.5,
    roughness: 0.05,
    metalness: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const frameShape = roundedRect(4.9, 3.4, 1.1);
  frameShape.holes.push(roundedRect(4.1, 2.6, 0.8));
  const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 0.4, bevelEnabled: false, curveSegments: 10 });
  const lensGeo = new THREE.ShapeGeometry(roundedRect(4.1, 2.6, 0.8), 10);

  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 3.25, 2.55, 5.4);
    eye.rotation.y = side * 0.12;
    eye.add(new THREE.Mesh(frameGeo, frameMat));
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.z = 0.2;
    lens.renderOrder = 2;
    eye.add(lens);
    head.add(eye);
    head.add(new THREE.Mesh(barGeometry(V(side * 5.6, 3.1, 5.3), V(side * 7.95, 2.8, -5.5), 0.4), frameMat));
  }
  head.add(new THREE.Mesh(barGeometry(V(-0.95, 3.05, 5.75), V(0.95, 3.05, 5.75), 0.4), frameMat));

  // Holograma flotando sobre la cabeza.
  const tex = canvasTexture(512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 170px monospace';
    ctx.shadowColor = '#4cc9f0';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#9be8ff';
    ctx.fillText('</>', w / 2, h / 2 + 6);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('</>', w / 2, h / 2 + 6);
  });
  const holo = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 5.5),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
  );
  holo.userData.mirrorTextures = [tex];
  holo.renderOrder = 3;
  const holoGroup = new THREE.Group();
  holoGroup.position.set(0, 17, 1);
  holoGroup.add(holo);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(5.5, 0.12, 8, 64),
    new THREE.MeshBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: 0.8, toneMapped: false }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -3.6;
  holoGroup.add(ring);
  head.add(holoGroup);

  // "Bits" que orbitan la cabeza.
  const bitMat = new THREE.MeshBasicMaterial({ color: 0x4cc9f0, toneMapped: false });
  const bits = [];
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), bitMat);
    head.add(b);
    bits.push(b);
  }

  return {
    head,
    body,
    update(t) {
      holoGroup.position.y = 17 + Math.sin(t * 2) * 0.6;
      holo.rotation.y = Math.sin(t * 0.9) * 0.35;
      bits.forEach((b, i) => {
        const a = t * 1.2 + (i * Math.PI * 2) / bits.length;
        b.position.set(Math.cos(a) * 10.5, 12 + Math.sin(a * 2 + i) * 1.2, -3 + Math.sin(a) * 10.5);
        b.rotation.set(a, a * 1.3, 0);
      });
    },
  };
}

/* ---------------- Medicina: espejo frontal + estetoscopio ---------------- */

function medicina() {
  const head = new THREE.Group();
  const body = new THREE.Group();
  head.add(headOccluder());
  body.add(neckOccluder());

  const bandMat = new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.6 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xf1f3f5, metalness: 1, roughness: 0.08 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x22252b, roughness: 0.45, metalness: 0.1 });

  // Banda alrededor de la cabeza.
  const pts = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    pts.push(V(Math.sin(a) * 7.0, 9.6, -4.4 + Math.cos(a) * 8.7));
  }
  const band = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.45, 10, true), bandMat);
  head.add(band);

  // Espejo frontal.
  const mirror = new THREE.Group();
  mirror.position.set(0, 11.6, 5.4);
  mirror.rotation.x = -0.25;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 0.35, 48), chrome);
  disc.rotation.x = Math.PI / 2;
  mirror.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.28, 10, 48), rubber);
  mirror.add(rim);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  hole.position.z = 0.19;
  mirror.add(hole);
  head.add(mirror);
  head.add(new THREE.Mesh(barGeometry(V(0, 9.6, 4.2), V(0, 11.2, 5.2), 0.6), rubber));

  // Estetoscopio colgado del cuello.
  const path = new THREE.CatmullRomCurve3([
    V(4.0, -23.5, 6.6),
    V(5.0, -18.5, 6.0),
    V(6.5, -13.5, 2.5),
    V(6.2, -12.0, -3.0),
    V(3.5, -11.5, -7.5),
    V(-3.5, -11.5, -7.5),
    V(-6.2, -12.0, -3.0),
    V(-6.5, -13.5, 2.5),
    V(-5.0, -18.5, 6.0),
    V(-4.3, -21.5, 6.6),
  ]);
  body.add(new THREE.Mesh(new THREE.TubeGeometry(path, 120, 0.42, 10, false), rubber));
  // Campana (diafragma).
  const bell = new THREE.Group();
  bell.position.set(4.0, -24.6, 6.9);
  const bellDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.8, 40), chrome);
  bellDisc.rotation.x = Math.PI / 2;
  bell.add(bellDisc);
  const bellFace = new THREE.Mesh(new THREE.CircleGeometry(1.5, 40), new THREE.MeshStandardMaterial({ color: 0xdee2e6, roughness: 0.3 }));
  bellFace.position.z = 0.42;
  bell.add(bellFace);
  body.add(bell);
  body.add(new THREE.Mesh(barGeometry(V(4.0, -23.6, 6.7), V(4.0, -23.9, 6.8), 0.6), chrome));
  // Olivas (auriculares) metálicas.
  for (const dx of [-1.4, 1.4]) {
    const tip = V(-4.3 + dx, -25.5, 7.4);
    body.add(new THREE.Mesh(barGeometry(V(-4.3, -21.5, 6.6), tip, 0.32), chrome));
    const olive = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), rubber);
    olive.position.copy(tip);
    body.add(olive);
  }

  return { head, body, update() {} };
}

/* ------------------------- Civil: casco de obra -------------------------- */

function civil() {
  const head = new THREE.Group();
  const body = new THREE.Group();
  head.add(headOccluder());

  const hatMat = new THREE.MeshPhysicalMaterial({
    color: 0xffc300,
    roughness: 0.32,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
  });
  const innerMat = new THREE.MeshStandardMaterial({ color: 0x4a3b06, roughness: 0.8, side: THREE.BackSide });

  // Todo el casco va en un grupo apoyado sobre la frente e inclinado un poco hacia atrás.
  const hat = new THREE.Group();
  hat.position.set(0, 8.7, -3.6);
  hat.rotation.x = 0.17;
  head.add(hat);

  const shell = new THREE.Group();
  const R = 9.0;
  shell.scale.set(1, 0.82, 1.1);
  const domeGeo = new THREE.SphereGeometry(R, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  shell.add(new THREE.Mesh(domeGeo, hatMat));
  shell.add(new THREE.Mesh(domeGeo, innerMat));
  for (const x of [-2.6, 0, 2.6]) {
    const r = Math.sqrt((R + 0.02) ** 2 - x * x);
    const rib = new THREE.Mesh(new THREE.TorusGeometry(r, x === 0 ? 0.6 : 0.42, 10, 48, Math.PI), hatMat);
    rib.rotation.y = Math.PI / 2;
    rib.position.x = x;
    shell.add(rib);
  }
  hat.add(shell);

  // Ala del casco (más larga al frente, como los cascos de obra).
  const brimProfile = [
    new THREE.Vector2(R - 0.3, 0.3),
    new THREE.Vector2(R + 0.9, 0.12),
    new THREE.Vector2(R + 1.9, -0.3),
    new THREE.Vector2(R + 2.4, -0.8),
    new THREE.Vector2(R + 2.5, -1.05),
  ];
  const brimMat = hatMat.clone();
  brimMat.side = THREE.DoubleSide;
  const brim = new THREE.Mesh(new THREE.LatheGeometry(brimProfile, 64), brimMat);
  brim.position.z = 0.6;
  brim.scale.set(0.98, 1, 1.14);
  hat.add(brim);

  // Calcomanía al frente.
  const tex = canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1d3557';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(8, 8, w - 16, h - 16, 24) : ctx.rect(8, 8, w - 16, h - 16);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText('CIVIL', w / 2, h / 2 + 3);
  });
  const sticker = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 2.5),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.4 }),
  );
  sticker.userData.mirrorTextures = [tex];
  // Punto sobre el domo (a 58° de la cima) desplazado un poco hacia afuera según la normal.
  {
    const phi = THREE.MathUtils.degToRad(58);
    const sy = 0.82, sz = 1.1;
    const p = V(0, R * sy * Math.cos(phi), R * sz * Math.sin(phi));
    const n = V(0, Math.cos(phi) / sy, Math.sin(phi) / sz).normalize();
    sticker.position.copy(p.addScaledVector(n, 0.45));
    sticker.rotation.x = -Math.atan2(n.y, n.z);
  }
  hat.add(sticker);

  return { head, body, update() {} };
}

const BUILDERS = { software, medicina, civil };

export function createFaceAccessory(careerId) {
  return (BUILDERS[careerId] ?? software)();
}

// Modelos 3D de los objetos que se colocan en la escena (modo "Objetos 3D" y AR en el piso).
// Se generan por código para no depender de archivos externos ni licencias.
// Unidades: ~1 unidad = tamaño del objeto en pantalla; origen en la base del objeto.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { contactShadow } from './scene.js';

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// Con la cámara frontal la imagen se ve en espejo; los textos se invierten para seguir legibles.
export function setMirrored(root, mirrored) {
  root.traverse((o) => {
    o.userData?.mirrorTextures?.forEach((tex) => {
      tex.repeat.x = mirrored ? -1 : 1;
      tex.offset.x = mirrored ? 1 : 0;
    });
  });
}

// Barra (caja delgada) entre dos puntos: sirve para armar estructuras tipo celosía.
export function barGeometry(a, b, thick) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.BoxGeometry(thick, len, thick);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const mid = a.clone().add(b).multiplyScalar(0.5);
  g.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
  return g;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------------------------- Software: laptop ---------------------------- */

function codeTexture() {
  return canvasTexture(640, 400, (ctx, w, h) => {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, w, 44);
    ['#ff5f56', '#ffbd2e', '#27c93f'].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(26 + i * 24, 22, 8, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#8b949e';
    ctx.font = '20px monospace';
    ctx.fillText('app.js', 110, 29);

    const K = '#ff7b72', F = '#d2a8ff', S = '#a5d6ff', T = '#c9d1d9', C = '#8b949e', N = '#79c0ff';
    const lines = [
      [[K, 'function '], [F, 'crearApp'], [T, '() {']],
      [[T, '  '], [K, 'const '], [T, 'ar = '], [K, 'new '], [N, 'RealidadAumentada'], [T, '();']],
      [[T, '  ar.'], [F, 'agregar'], [T, '('], [S, "'modelo3D'"], [T, ');']],
      [[T, '  ar.'], [F, 'filtro'], [T, '('], [S, "'vivido'"], [T, ');']],
      [[T, '  '], [K, 'return '], [T, 'ar.'], [F, 'capturar'], [T, '();']],
      [[T, '}']],
      [[C, '// Ingeniería de Software']],
    ];
    ctx.font = 'bold 25px monospace';
    lines.forEach((segs, i) => {
      let x = 24;
      ctx.fillStyle = '#484f58';
      ctx.fillText(String(i + 1), x - 8, 88 + i * 40);
      x += 22;
      for (const [col, txt] of segs) {
        ctx.fillStyle = col;
        ctx.fillText(txt, x, 88 + i * 40);
        x += ctx.measureText(txt).width;
      }
    });
    ctx.fillStyle = '#4cc9f0';
    ctx.shadowColor = '#4cc9f0';
    ctx.shadowBlur = 18;
    ctx.font = 'bold 64px monospace';
    ctx.fillText('</>', w - 150, h - 30);
  });
}

function keyboardTexture() {
  return canvasTexture(512, 200, (ctx, w, h) => {
    ctx.fillStyle = '#2a2f38';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#12151a';
    const rows = 5, cols = 14, gap = 5;
    const kw = (w - gap * (cols + 1)) / cols;
    const kh = (h - gap * (rows + 1)) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r === 4 && c > 3 && c < 10) continue;
        ctx.fillRect(gap + c * (kw + gap), gap + r * (kh + gap), kw, kh);
      }
    }
    ctx.fillRect(gap + 4 * (kw + gap), gap + 4 * (kh + gap), 6 * kw + 5 * gap, kh);
  });
}

function laptop() {
  const g = new THREE.Group();
  const alu = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.75, roughness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15181e, metalness: 0.2, roughness: 0.5 });
  const W = 1.2, D = 0.8, T = 0.05;

  const base = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), alu);
  base.position.y = T / 2;
  g.add(base);

  const kb = new THREE.Mesh(
    new THREE.PlaneGeometry(1.04, 0.4),
    new THREE.MeshStandardMaterial({ map: keyboardTexture(), roughness: 0.7 }),
  );
  kb.rotation.x = -Math.PI / 2;
  kb.position.set(0, T + 0.001, -0.1);
  g.add(kb);

  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.2),
    new THREE.MeshStandardMaterial({ color: 0xb3b9c2, metalness: 0.5, roughness: 0.25 }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, T + 0.001, 0.25);
  g.add(pad);

  const hinge = new THREE.Group();
  hinge.position.set(0, T, -D / 2);
  hinge.rotation.x = -0.3;
  g.add(hinge);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(W, 0.78, 0.03), alu);
  lid.position.set(0, 0.39, -0.015);
  hinge.add(lid);
  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.04, 0.74), dark);
  bezel.position.set(0, 0.39, 0.0008);
  hinge.add(bezel);

  const tex = codeTexture();
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.08, 0.675),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  screen.position.set(0, 0.4, 0.0016);
  hinge.add(screen);

  g.add(contactShadow(1.7, 1.2, 0.55));
  g.userData = { footprint: 0.8, width: 1.2, mirrorTextures: [tex] };
  return g;
}

/* ---------------------------- Medicina: corazón --------------------------- */

function heartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(5, 5);
  s.bezierCurveTo(5, 5, 4, 0, 0, 0);
  s.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  s.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  s.bezierCurveTo(16, 7, 16, 0, 10, 0);
  s.bezierCurveTo(7, 0, 5, 5, 5, 5);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 4,
    bevelEnabled: true,
    bevelThickness: 2,
    bevelSize: 1.6,
    bevelSegments: 8,
    curveSegments: 28,
  });
  geo.center();
  geo.rotateZ(Math.PI);
  geo.scale(0.045, 0.045, 0.045);
  return geo;
}

function heart() {
  const g = new THREE.Group();
  const heartMesh = new THREE.Mesh(
    heartGeometry(),
    new THREE.MeshPhysicalMaterial({ color: 0xd90429, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
  );
  const holder = new THREE.Group();
  holder.position.y = 0.6;
  holder.add(heartMesh);
  g.add(holder);

  // Cruz médica que orbita alrededor del corazón.
  const crossMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x33ffaa, emissiveIntensity: 0.35 });
  const cross = new THREE.Group();
  cross.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.065, 0.065), crossMat));
  cross.add(new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.2, 0.065), crossMat));
  g.add(cross);

  // Onda de "pulso" que se expande en el piso con cada latido.
  const pulse = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.47, 64),
    new THREE.MeshBasicMaterial({ color: 0xff4d6d, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  );
  pulse.rotation.x = -Math.PI / 2;
  pulse.position.y = 0.01;
  g.add(pulse);

  g.add(contactShadow(1.0, 1.0, 0.45));

  g.userData = {
    footprint: 0.55,
    width: 1.15,
    update(t) {
      const ph = (t * 1.1) % 1;
      const beat = 1 + 0.1 * Math.exp(-(((ph - 0.08) / 0.045) ** 2)) + 0.06 * Math.exp(-(((ph - 0.28) / 0.05) ** 2));
      heartMesh.scale.setScalar(beat);
      holder.position.y = 0.6 + Math.sin(t * 1.6) * 0.04;
      holder.rotation.y = Math.sin(t * 0.7) * 0.5;
      const a = t * 1.4;
      cross.position.set(Math.cos(a) * 0.72, 0.62 + Math.sin(a * 2) * 0.12, Math.sin(a) * 0.72);
      cross.rotation.set(a * 0.7, a, 0);
      pulse.scale.setScalar(1 + ph * 1.4);
      pulse.material.opacity = 0.8 * (1 - ph);
    },
  };
  return g;
}

/* ------------------------------ Civil: grúa ------------------------------- */

function crane() {
  const g = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf5b700, metalness: 0.35, roughness: 0.45 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x9a9a96, roughness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x3a3f47, metalness: 0.6, roughness: 0.4 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.34), concrete);
  base.position.y = 0.05;
  g.add(base);

  // Torre en celosía.
  const h = 0.06, y0 = 0.1, y1 = 1.1, levels = 8;
  const corners = [[-h, -h], [h, -h], [h, h], [-h, h]];
  const mast = [];
  for (const [x, z] of corners) mast.push(barGeometry(V(x, y0, z), V(x, y1, z), 0.022));
  for (let i = 0; i < levels; i++) {
    const ya = y0 + ((y1 - y0) * i) / levels;
    const yb = y0 + ((y1 - y0) * (i + 1)) / levels;
    for (let k = 0; k < 4; k++) {
      const [ax, az] = corners[k];
      const [bx, bz] = corners[(k + 1) % 4];
      mast.push(barGeometry(V(ax, yb, az), V(bx, yb, bz), 0.012));
      if (i % 2 === 0) mast.push(barGeometry(V(ax, ya, az), V(bx, yb, bz), 0.01));
      else mast.push(barGeometry(V(bx, ya, bz), V(ax, yb, az), 0.01));
    }
  }
  g.add(new THREE.Mesh(mergeGeometries(mast), yellow));

  // Parte giratoria: pluma, contrapluma, cabina, cable y carga.
  const slew = new THREE.Group();
  slew.position.y = y1;
  g.add(slew);

  const jib = [];
  const L = 0.95, n = 12;
  jib.push(barGeometry(V(0, 0, -0.04), V(L, 0, -0.04), 0.014));
  jib.push(barGeometry(V(0, 0, 0.04), V(L, 0, 0.04), 0.014));
  jib.push(barGeometry(V(0, 0.09, 0), V(L, 0.03, 0), 0.014));
  for (let i = 0; i < n; i++) {
    const xa = (L * i) / n, xb = (L * (i + 1)) / n;
    const ya = 0.09 - 0.06 * (xa / L), yb = 0.09 - 0.06 * (xb / L);
    jib.push(barGeometry(V(xa, 0, -0.04), V(xb, yb, 0), 0.008));
    jib.push(barGeometry(V(xa, 0, 0.04), V(xb, yb, 0), 0.008));
    jib.push(barGeometry(V(xb, 0, -0.04), V(xb, 0, 0.04), 0.008));
    if (i === 0) jib.push(barGeometry(V(xa, 0, 0), V(xa, ya, 0), 0.008));
  }
  // Contrapluma.
  jib.push(barGeometry(V(0, 0, -0.04), V(-0.38, 0, -0.04), 0.016));
  jib.push(barGeometry(V(0, 0, 0.04), V(-0.38, 0, 0.04), 0.016));
  for (let i = 1; i <= 4; i++) jib.push(barGeometry(V(-0.095 * i, 0, -0.04), V(-0.095 * i, 0, 0.04), 0.01));
  // Torreta superior y tirantes.
  for (const [x, z] of corners) jib.push(barGeometry(V(x * 0.7, 0, z * 0.7), V(0, 0.28, 0), 0.012));
  jib.push(barGeometry(V(0, 0.28, 0), V(0.62, 0.05, 0), 0.006));
  jib.push(barGeometry(V(0, 0.28, 0), V(-0.36, 0.0, 0), 0.006));
  slew.add(new THREE.Mesh(mergeGeometries(jib), yellow));

  const counterweight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.12), concrete);
  counterweight.position.set(-0.32, -0.05, 0);
  slew.add(counterweight);

  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.09, 0.09),
    new THREE.MeshStandardMaterial({ color: 0x8ecae6, metalness: 0.2, roughness: 0.1 }),
  );
  cab.position.set(0.06, -0.06, 0.1);
  slew.add(cab);

  const trolley = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.1), steel);
  trolley.position.set(0.66, -0.02, 0);
  slew.add(trolley);

  const pendulum = new THREE.Group();
  pendulum.position.set(0.66, -0.03, 0);
  slew.add(pendulum);
  const cableLen = 0.5;
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, cableLen, 6), steel);
  cable.position.y = -cableLen / 2;
  pendulum.add(cable);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 0.035), yellow);
  hook.position.y = -cableLen - 0.02;
  pendulum.add(hook);
  // Viga de acero en I como carga.
  const red = new THREE.MeshStandardMaterial({ color: 0xc1121f, metalness: 0.4, roughness: 0.5 });
  const beam = new THREE.Group();
  const bl = 0.36;
  const flange1 = new THREE.Mesh(new THREE.BoxGeometry(bl, 0.008, 0.05), red);
  const flange2 = flange1.clone();
  const web = new THREE.Mesh(new THREE.BoxGeometry(bl, 0.045, 0.008), red);
  flange1.position.y = 0.0265;
  flange2.position.y = -0.0265;
  beam.add(flange1, flange2, web);
  beam.position.y = -cableLen - 0.075;
  beam.rotation.y = 0.6;
  pendulum.add(beam);

  g.add(contactShadow(0.7, 0.7, 0.5));

  g.userData = {
    footprint: 0.32,
    width: 1.0,
    update(t) {
      slew.rotation.y = Math.sin(t * 0.35) * 0.7;
      pendulum.rotation.z = Math.sin(t * 1.4) * 0.05;
      pendulum.rotation.x = Math.sin(t * 1.1) * 0.03;
      beam.rotation.y = 0.6 + Math.sin(t * 0.5) * 0.3;
    },
  };
  return g;
}

/* ------------------------------------------------------------------------ */

const BUILDERS = { software: laptop, medicina: heart, civil: crane };

// Escala real aproximada (metros) para el modo AR en el piso.
export const REAL_SCALE = { software: 0.3, medicina: 0.3, civil: 0.6 };

export function createWorldModel(careerId) {
  const model = (BUILDERS[careerId] ?? laptop)();
  model.userData.careerId = careerId;
  return model;
}

// Modo "Objetos 3D": modelos sobre la imagen de la cámara que el usuario
// mueve (1 dedo), escala (pellizcar) y gira (dos dedos) antes de tomar la foto.
// Funciona en cualquier navegador (incluido iPhone).
import * as THREE from 'three';
import { createWorldModel, setMirrored } from './models.js';
import { addLights } from './scene.js';

const easeOutBack = (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;

export class ObjectMode {
  constructor(env) {
    this.scene = new THREE.Scene();
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.7;
    addLights(this.scene);
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.05, 100);
    this.items = [];
    this.selected = null;
    this.mirrored = false;
    this.raycaster = new THREE.Raycaster();
    this.pointers = new Map();
    this.gesture = null;
    this.onSelectionChange = () => {};
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  setMirrored(m) {
    this.mirrored = m;
    this.items.forEach((i) => setMirrored(i.model, m));
  }

  // spawn: { ndc, worldWidth } — dónde aparece (punto visible de la pantalla) y
  // el ancho visible del mundo a esa profundidad, para darle un tamaño adecuado.
  add(careerId, spawn) {
    const model = createWorldModel(careerId);
    setMirrored(model, this.mirrored);
    const spin = new THREE.Group();
    spin.add(model);
    const holder = new THREE.Group();
    holder.add(spin);

    const r = model.userData.footprint ?? 0.6;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r * 1.05, r * 1.12, 64),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.006;
    holder.add(ring);

    const z = -3.2;
    if (spawn) {
      const p = this.planePoint(spawn.ndc, z);
      holder.position.set(p.x, p.y, z);
      holder.scale.setScalar((spawn.worldWidth * 0.42) / (model.userData.width ?? 1.2));
    } else {
      holder.position.set(0, -0.95, z);
    }
    holder.rotation.x = 0.28; // vista ligeramente desde arriba, como si estuviera sobre el piso/mesa
    spin.rotation.y = -0.35;
    spin.scale.setScalar(0.001);

    this.scene.add(holder);
    const item = { holder, spin, model, ring, careerId, appear: 0 };
    this.items.push(item);
    this.select(item);
    return item;
  }

  select(item) {
    this.selected = item;
    this.items.forEach((i) => (i.ring.visible = i === item));
    this.onSelectionChange(item);
  }

  removeSelected() {
    const it = this.selected;
    if (!it) return;
    this.scene.remove(it.holder);
    this.items = this.items.filter((i) => i !== it);
    this.select(this.items[this.items.length - 1] ?? null);
  }

  clear() {
    this.items.forEach((i) => this.scene.remove(i.holder));
    this.items = [];
    this.select(null);
  }

  // Durante la captura se ocultan los aros de selección.
  setCaptureMode(on) {
    this.items.forEach((i) => (i.ring.visible = !on && i === this.selected));
  }

  update(t, dt) {
    for (const i of this.items) {
      i.model.userData.update?.(t);
      if (i.appear < 1) {
        i.appear = Math.min(1, i.appear + dt * 3.5);
        i.spin.scale.setScalar(Math.max(0.001, easeOutBack(i.appear)));
      }
    }
  }

  /* ------------------------------ gestos ------------------------------ */

  pick(ndc) {
    this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.camera);
    const hits = this.raycaster.intersectObjects(this.items.map((i) => i.spin), true);
    if (!hits.length) return null;
    return this.items.find((i) => {
      let o = hits[0].object;
      while (o) {
        if (o === i.spin) return true;
        o = o.parent;
      }
      return false;
    });
  }

  // Punto del plano z = constante (frente a la cámara) bajo el dedo.
  planePoint(ndc, z) {
    const dir = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(this.camera).normalize();
    return dir.multiplyScalar(z / dir.z);
  }

  pointerDown(id, px, ndc) {
    this.pointers.set(id, { px, ndc });
    if (this.pointers.size === 1) {
      const hit = this.pick(ndc);
      if (hit && hit !== this.selected) this.select(hit);
      this.startDrag(id);
    } else if (this.pointers.size === 2) {
      this.startPinch();
    }
  }

  startDrag(id) {
    const it = this.selected;
    if (!it) return (this.gesture = null);
    const { ndc } = this.pointers.get(id);
    const p = this.planePoint(ndc, it.holder.position.z);
    this.gesture = { type: 'drag', id, offset: it.holder.position.clone().sub(p) };
  }

  startPinch() {
    const it = this.selected;
    if (!it) return (this.gesture = null);
    const [a, b] = [...this.pointers.values()];
    const mid = { x: (a.ndc.x + b.ndc.x) / 2, y: (a.ndc.y + b.ndc.y) / 2 };
    const p = this.planePoint(mid, it.holder.position.z);
    this.gesture = {
      type: 'pinch',
      dist: Math.hypot(a.px.x - b.px.x, a.px.y - b.px.y) || 1,
      angle: Math.atan2(b.px.y - a.px.y, b.px.x - a.px.x),
      scale: it.holder.scale.x,
      rot: it.spin.rotation.y,
      offset: it.holder.position.clone().sub(p),
    };
  }

  pointerMove(id, px, ndc) {
    if (!this.pointers.has(id)) return;
    this.pointers.set(id, { px, ndc });
    const g = this.gesture;
    const it = this.selected;
    if (!g || !it) return;
    const z = it.holder.position.z;
    if (g.type === 'drag' && g.id === id) {
      const p = this.planePoint(ndc, z).add(g.offset);
      it.holder.position.set(p.x, p.y, z);
    } else if (g.type === 'pinch' && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.px.x - b.px.x, a.px.y - b.px.y);
      const angle = Math.atan2(b.px.y - a.px.y, b.px.x - a.px.x);
      it.holder.scale.setScalar(THREE.MathUtils.clamp((g.scale * dist) / g.dist, 0.25, 4));
      it.spin.rotation.y = g.rot + (angle - g.angle);
      const mid = { x: (a.ndc.x + b.ndc.x) / 2, y: (a.ndc.y + b.ndc.y) / 2 };
      const p = this.planePoint(mid, z).add(g.offset);
      it.holder.position.set(p.x, p.y, z);
    }
  }

  pointerUp(id) {
    this.pointers.delete(id);
    if (this.pointers.size === 1) this.startDrag([...this.pointers.keys()][0]);
    else if (this.pointers.size === 0) this.gesture = null;
  }

  // Computadora: rueda = escalar, Shift + rueda = girar.
  wheel(deltaY, shift) {
    const it = this.selected;
    if (!it) return;
    if (shift) it.spin.rotation.y += deltaY * 0.004;
    else it.holder.scale.setScalar(THREE.MathUtils.clamp(it.holder.scale.x * Math.exp(-deltaY * 0.0015), 0.25, 4));
  }
}

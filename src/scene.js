import * as THREE from 'three';

export function addLights(scene, scale = 1) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x445066, 1.1);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(2 * scale, 4 * scale, 3 * scale);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfd7ff, 0.6);
  fill.position.set(-3 * scale, 1 * scale, 2 * scale);
  scene.add(fill);
}

// Sombra suave "de contacto" para que los objetos parezcan apoyados en algo.
let shadowTex = null;
export function contactShadow(w, d, opacity = 0.5) {
  if (!shadowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity, depthWrite: false, color: 0x000000 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.002;
  m.renderOrder = -1;
  return m;
}

// Modo "AR en el piso" (WebXR + ARCore). Solo Chrome en Android con ARCore:
// detecta superficies reales, el usuario toca para colocar los modelos a escala real.
// Para la foto usa la función 'camera-access' de WebXR (imagen de la cámara + 3D).
import * as THREE from 'three';
import { createWorldModel, REAL_SCALE } from './models.js';
import { addLights } from './scene.js';

// Conversión lineal -> sRGB para los píxeles leídos del render target.
const LIN2SRGB = new Uint8ClampedArray(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  LIN2SRGB[i] = Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
}

export class XRFloorMode {
  constructor(renderer, env, { overlay, onEnd, onCaptured, onStatus }) {
    this.renderer = renderer;
    this.overlay = overlay;
    this.onEnd = onEnd;
    this.onCaptured = onCaptured;
    this.onStatus = onStatus;
    this.scene = new THREE.Scene();
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.8;
    addLights(this.scene, 0.5);
    this.camera = new THREE.PerspectiveCamera();
    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.07, 0.09, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    this.scene.add(this.reticle);
    this.items = [];
    this.session = null;
    this.career = 'software';
    this.captureRequested = false;

    // Los toques sobre botones del overlay no deben colocar objetos.
    overlay.addEventListener('beforexrselect', (e) => {
      if (e.target.closest('button')) e.preventDefault();
    });
  }

  static async isSupported() {
    try {
      return !!navigator.xr && (await navigator.xr.isSessionSupported('immersive-ar'));
    } catch {
      return false;
    }
  }

  get active() {
    return !!this.session;
  }

  async start(careerId) {
    this.career = careerId;
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay', 'camera-access'],
      domOverlay: { root: this.overlay },
    });
    this.session = session;
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType('local');
    await this.renderer.xr.setSession(session);
    const viewer = await session.requestReferenceSpace('viewer');
    this.hitSource = await session.requestHitTestSource({ space: viewer });

    this.binding = null;
    const features = session.enabledFeatures;
    const cameraAccess = features ? features.includes('camera-access') : true;
    if (cameraAccess && 'XRWebGLBinding' in window) {
      try {
        this.binding = new XRWebGLBinding(session, this.renderer.getContext());
      } catch (err) {
        console.warn('Sin acceso a la cámara en WebXR', err);
      }
    }

    session.addEventListener('select', this.onSelect);
    session.addEventListener('end', this.onSessionEnd, { once: true });
    this.onStatus?.('Mueve el teléfono despacio para detectar el piso…');
  }

  stop() {
    this.session?.end();
  }

  onSessionEnd = () => {
    this.hitSource?.cancel?.();
    this.hitSource = null;
    this.session = null;
    this.binding = null;
    this.renderer.xr.enabled = false;
    this.items.forEach((i) => this.scene.remove(i));
    this.items = [];
    this.reticle.visible = false;
    this.onEnd?.();
  };

  setCareer(id) {
    this.career = id;
  }

  onSelect = () => {
    if (!this.reticle.visible) return;
    const model = createWorldModel(this.career);
    const s = REAL_SCALE[this.career] ?? 0.3;
    model.scale.setScalar(s);
    const pos = new THREE.Vector3().setFromMatrixPosition(this.reticle.matrix);
    model.position.copy(pos);
    // Que mire hacia el usuario.
    const camPos = new THREE.Vector3().setFromMatrixPosition(this.renderer.xr.getCamera().matrixWorld);
    model.rotation.y = Math.atan2(camPos.x - pos.x, camPos.z - pos.z) - 0.35;
    this.scene.add(model);
    this.items.push(model);
    this.onStatus?.('¡Listo! Toca de nuevo para agregar otro o presiona el botón para la foto.');
  };

  removeLast() {
    const m = this.items.pop();
    if (m) this.scene.remove(m);
  }

  requestCapture() {
    this.captureRequested = true;
  }

  update(t, frame) {
    this.items.forEach((m) => m.userData.update?.(t));
    if (!frame) return;
    const ref = this.renderer.xr.getReferenceSpace();
    if (this.hitSource) {
      const hits = frame.getHitTestResults(this.hitSource);
      if (hits.length) {
        const pose = hits[0].getPose(ref);
        this.reticle.visible = true;
        this.reticle.matrix.fromArray(pose.transform.matrix);
        if (!this.items.length) this.onStatus?.('Toca la pantalla para colocar el objeto.');
      } else {
        this.reticle.visible = false;
      }
    }
    if (this.captureRequested) {
      this.captureRequested = false;
      let canvas = null;
      try {
        canvas = this.captureFrame(frame, ref);
      } catch (err) {
        console.error('Captura XR', err);
      }
      this.onCaptured?.(canvas);
    }
  }

  // Lee la imagen de la cámara (camera-access) y renderiza la escena 3D en un
  // render target del mismo tamaño; luego las combina en un canvas 2D.
  captureFrame(frame, ref) {
    const pose = frame.getViewerPose(ref);
    const view = pose?.views?.[0];
    if (!view || !this.binding || !view.camera) return null;

    const renderer = this.renderer;
    const gl = renderer.getContext();
    const W = view.camera.width, H = view.camera.height;

    const camTex = this.binding.getCameraImage(view.camera);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, camTex, 0);
    const camPx = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, camPx);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    renderer.resetState();

    // Cámara equivalente a la vista XR actual.
    const cam = new THREE.PerspectiveCamera();
    cam.matrixAutoUpdate = false;
    cam.matrixWorldAutoUpdate = false;
    cam.matrixWorld.fromArray(view.transform.matrix);
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    cam.projectionMatrix.fromArray(view.projectionMatrix);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

    const prevTarget = renderer.getRenderTarget();
    const reticleVisible = this.reticle.visible;
    this.reticle.visible = false;
    const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
    renderer.xr.enabled = false;
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(this.scene, cam);
    const vPx = new Uint8Array(W * H * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, vPx);
    renderer.setRenderTarget(prevTarget);
    renderer.xr.enabled = true;
    rt.dispose();
    this.reticle.visible = reticleVisible;

    // Combinar (los píxeles de WebGL vienen de abajo hacia arriba).
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d');
    const camImg = ctx.createImageData(W, H);
    const virt = ctx.createImageData(W, H);
    const row = W * 4;
    for (let y = 0; y < H; y++) {
      const src = (H - 1 - y) * row, dst = y * row;
      camImg.data.set(camPx.subarray(src, src + row), dst);
      for (let x = 0; x < row; x += 4) {
        const a = vPx[src + x + 3];
        if (!a) continue;
        const k = 255 / a; // des-premultiplicar bordes con antialiasing
        virt.data[dst + x] = LIN2SRGB[Math.min(255, Math.round(vPx[src + x] * k))];
        virt.data[dst + x + 1] = LIN2SRGB[Math.min(255, Math.round(vPx[src + x + 1] * k))];
        virt.data[dst + x + 2] = LIN2SRGB[Math.min(255, Math.round(vPx[src + x + 2] * k))];
        virt.data[dst + x + 3] = a;
      }
    }
    ctx.putImageData(camImg, 0, 0);
    const tmp = document.createElement('canvas');
    tmp.width = W;
    tmp.height = H;
    tmp.getContext('2d').putImageData(virt, 0, 0);
    ctx.drawImage(tmp, 0, 0);
    return out;
  }
}

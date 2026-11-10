// Modo Selfie: detecta rostros con MediaPipe Face Landmarker y les pone accesorios 3D.
import * as THREE from 'three';
import { createFaceAccessory } from './faceAccessories.js';
import { setMirrored } from './models.js';
import { addLights } from './scene.js';

const MAX_FACES = 3;
const SMOOTH = 0.55; // 0 = sin suavizado, 1 = muy suave (más lag)
const BODY_FOLLOW = 0.35; // cuánto gira el "cuerpo" (estetoscopio) con la cabeza

class FaceSlot {
  constructor(scene) {
    this.scene = scene;
    this.acc = null;
    this.visible = false;
    this.misses = 0;
    this.pos = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
  }

  setAccessory(careerId, mirrored) {
    if (this.acc) this.scene.remove(this.acc.head, this.acc.body);
    this.acc = createFaceAccessory(careerId);
    setMirrored(this.acc.head, mirrored);
    setMirrored(this.acc.body, mirrored);
    this.scene.add(this.acc.head, this.acc.body);
    this.setVisible(this.visible);
  }

  setVisible(v) {
    this.visible = v;
    if (this.acc) this.acc.head.visible = this.acc.body.visible = v;
  }

  apply(data) {
    const m = this._m.fromArray(data);
    // La matriz debería venir en orden por columnas (traslación en 12..14). Si no, se transpone.
    if (Math.abs(m.elements[14]) < 1e-6 && Math.abs(m.elements[11]) > 1e-3) m.transpose();
    m.decompose(this._p, this._q, this._s);
    if (!this.visible) {
      this.pos.copy(this._p);
      this.quat.copy(this._q);
    } else {
      this.pos.lerp(this._p, 1 - SMOOTH * 0.6);
      this.quat.slerp(this._q, 1 - SMOOTH * 0.6);
    }
    const { head, body } = this.acc;
    head.position.copy(this.pos);
    head.quaternion.copy(this.quat);
    body.position.copy(this.pos);
    body.quaternion.identity().slerp(this.quat, BODY_FOLLOW);
    this.misses = 0;
    this.setVisible(true);
  }

  miss() {
    if (++this.misses > 4) this.setVisible(false);
  }
}

export class FaceMode {
  constructor(env, video) {
    this.video = video;
    this.scene = new THREE.Scene();
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.8;
    addLights(this.scene, 30);
    // MediaPipe asume una cámara con FOV vertical de 63° en el origen mirando hacia -Z (unidades: cm).
    this.camera = new THREE.PerspectiveCamera(63, 1, 1, 10000);
    this.landmarker = null;
    this.loading = null;
    this.career = 'software';
    this.mirrored = true;
    this.slots = Array.from({ length: MAX_FACES }, () => new FaceSlot(this.scene));
    this.slots.forEach((s) => s.setAccessory(this.career, this.mirrored));
    this.faceCount = 0;
    this.lastVideoTime = -1;
    this.lastTs = 0;
  }

  get ready() {
    return !!this.landmarker;
  }

  load() {
    if (!this.loading) {
      this.loading = (async () => {
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const base = new URL('mediapipe/', document.baseURI).href;
        const fileset = await FilesetResolver.forVisionTasks(base + 'wasm');
        const options = (delegate) => ({
          baseOptions: { modelAssetPath: base + 'face_landmarker.task', delegate },
          runningMode: 'VIDEO',
          numFaces: MAX_FACES,
          outputFacialTransformationMatrixes: true,
          outputFaceBlendshapes: false,
        });
        try {
          this.landmarker = await FaceLandmarker.createFromOptions(fileset, options('GPU'));
        } catch (err) {
          console.warn('GPU no disponible para MediaPipe, usando CPU', err);
          this.landmarker = await FaceLandmarker.createFromOptions(fileset, options('CPU'));
        }
      })().catch((err) => {
        this.loading = null;
        throw err;
      });
    }
    return this.loading;
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  setMirrored(m) {
    this.mirrored = m;
    this.slots.forEach((s) => {
      setMirrored(s.acc.head, m);
      setMirrored(s.acc.body, m);
    });
  }

  setCareer(id) {
    this.career = id;
    this.slots.forEach((s) => s.setAccessory(id, this.mirrored));
  }

  reset() {
    this.slots.forEach((s) => s.setVisible(false));
    this.faceCount = 0;
    this.lastVideoTime = -1;
  }

  update(t) {
    this.slots.forEach((s) => s.acc.update(t));
    const v = this.video;
    if (!this.landmarker || v.readyState < 2 || !v.videoWidth) return;
    if (v.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = v.currentTime;

    // Los timestamps deben ser estrictamente crecientes.
    const ts = Math.max(performance.now(), this.lastTs + 1);
    this.lastTs = ts;
    let res;
    try {
      res = this.landmarker.detectForVideo(v, ts);
    } catch (err) {
      console.warn('detectForVideo', err);
      return;
    }
    const mats = res?.facialTransformationMatrixes ?? [];
    this.slots.forEach((slot, i) => (mats[i] ? slot.apply(mats[i].data) : slot.miss()));
    this.faceCount = mats.length;
  }
}

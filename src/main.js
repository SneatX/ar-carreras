import './style.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CAREERS, careerById } from './careers.js';
import { CameraFeed } from './camera.js';
import { ObjectMode } from './objectMode.js';
import { FaceMode } from './faceMode.js';
import { XRFloorMode } from './xrMode.js';
import {
  FILTERS, filterById, cssFilter, applyFilter, composePhoto, drawFrame, dateLabel,
  toBlob, photoFileName, isIOS, canShareFile, shareFile, download,
} from './photo.js';

const $ = (s) => document.querySelector(s);
const video = $('#video');
const glCanvas = $('#gl');
const stage = $('#stage');
const mirrorEl = $('#mirror');

const state = {
  mode: 'object',
  career: 'software',
  filter: 'normal',
  frame: false,
  busy: false,
  token: 0,
  photo: null,
};

const HINT_OBJECTS = 'Arrastra para mover, pellizca para cambiar el tamaño y gira con dos dedos.';

let renderer, objectMode, faceMode, xrMode;
const cam = new CameraFeed(video);
const TILTS = ['-2.5deg', '1.8deg', '-1.2deg'];
let layout = null;

/* ------------------------------ utilidades ------------------------------ */

let toastTimer;
function toast(msg, ms = 2800) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), ms);
}

let hintTimer;
function hint(msg, ms = 0) {
  $('#hint').textContent = msg;
  clearTimeout(hintTimer);
  if (ms) hintTimer = setTimeout(() => ($('#hint').textContent = ''), ms);
}

function loading(msg) {
  $('#loading').hidden = !msg;
  if (msg) $('#loading p').textContent = msg;
}

const activeMode = () => (state.mode === 'face' ? faceMode : objectMode);

// Qué navegador es: en iPhone cada uno guarda el permiso de cámara en un lugar distinto.
function browserKind() {
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|musical_ly|BytedanceWebview|TikTok|LinkedInApp|Twitter/i.test(ua)) return 'inapp';
  if (/CriOS/.test(ua)) return 'chrome-ios';
  if (/FxiOS/.test(ua)) return 'firefox-ios';
  if (/EdgiOS/.test(ua)) return 'edge-ios';
  if (isIOS()) return 'safari';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

function deniedSteps() {
  switch (browserKind()) {
    case 'inapp':
      return 'Estás en el navegador interno de otra app, que no permite usar la cámara.\nToca el menú (⋯) y elige "Abrir en Safari" o "Abrir en el navegador".';
    case 'chrome-ios':
      return 'Chrome no tiene permiso para usar la cámara del iPhone.\n1. Abre Ajustes del iPhone › Apps › Chrome.\n2. Activa Cámara.\n3. Vuelve aquí y toca Reintentar.\nTambién puedes abrir este mismo link en Safari.';
    case 'firefox-ios':
    case 'edge-ios':
      return 'Este navegador no tiene permiso para usar la cámara.\nActívalo en Ajustes del iPhone › Apps › (tu navegador) › Cámara, o abre el link en Safari.';
    case 'safari':
      return 'Safari tiene la cámara bloqueada para este sitio.\n1. Toca "aA" (o el ícono de ajustes) junto a la dirección.\n2. Entra a Ajustes del sitio web › Cámara y elige Preguntar o Permitir.\n3. Toca Reintentar.\nSi no aparece esa opción, revisa Ajustes del iPhone › Apps › Safari › Cámara.';
    case 'android':
      return 'El navegador tiene la cámara bloqueada para este sitio.\nToca el ícono junto a la dirección › Permisos › Cámara › Permitir, y luego Reintentar.';
    default:
      return 'El navegador tiene la cámara bloqueada para este sitio. Permítela desde el ícono junto a la dirección y toca Reintentar.';
  }
}

function cameraErrorMessage(err) {
  if (!window.isSecureContext) return 'La cámara solo funciona con HTTPS. Abre la app desde una dirección https://';
  if (!navigator.mediaDevices?.getUserMedia) {
    return browserKind() === 'inapp'
      ? deniedSteps()
      : 'Este navegador no permite usar la cámara. Abre el link en Safari (iPhone) o Chrome (Android).';
  }
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return deniedSteps();
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No se encontró una cámara en este dispositivo.';
    case 'NotReadableError':
    case 'AbortError':
      return 'Otra app está usando la cámara. Ciérrala y toca Reintentar.';
    default:
      return 'No se pudo abrir la cámara' + (err?.message ? `: ${err.message}` : '.');
  }
}

// Deja rastro en la consola (el servidor de desarrollo la muestra en la terminal).
async function reportCameraError(err) {
  let perm = 'n/a';
  try {
    perm = (await navigator.permissions?.query({ name: 'camera' }))?.state ?? 'n/a';
  } catch {}
  console.error(`[camara] ${err?.name}: ${err?.message} | navegador=${browserKind()} permiso=${perm} | ${navigator.userAgent}`);
}

/* -------------------------------- layout -------------------------------- */
// El video y el canvas 3D tienen el mismo tamaño interno y se escalan igual
// ("cover") para que los objetos coincidan exactamente con la imagen.
function relayout() {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh || !renderer) return;
  const W = stage.clientWidth, H = stage.clientHeight;
  const s = Math.max(W / vw, H / vh);
  const dw = vw * s, dh = vh * s;
  const ox = (W - dw) / 2, oy = (H - dh) / 2;
  for (const el of [video, glCanvas]) {
    Object.assign(el.style, { width: `${dw}px`, height: `${dh}px`, left: `${ox}px`, top: `${oy}px` });
  }
  layout = { W, H, dw, dh, ox, oy, vw, vh };

  // Resolución del canvas 3D: la del video, subiendo un poco en pantallas densas (máx. 1920).
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  let k = THREE.MathUtils.clamp((dh * dpr) / vh, 1, 1.6);
  k = Math.min(k, 1920 / Math.max(vw, vh));
  if (!xrMode?.active) renderer.setSize(Math.round(vw * k), Math.round(vh * k), false);
  objectMode.setAspect(vw / vh);
  faceMode.setAspect(vw / vh);
  document.documentElement.style.setProperty('--u', `${Math.min(W, H) / 100}px`);
}

function cropOf(l) {
  return { x: -l.ox / l.dw, y: -l.oy / l.dh, w: l.W / l.dw, h: l.H / l.dh };
}

/* -------------------------------- cámara -------------------------------- */

async function startCamera(facing) {
  await cam.start(facing);
  applyCamera();
}

function applyCamera() {
  relayout();
  const m = cam.mirrored;
  mirrorEl.classList.toggle('mirrored', m);
  objectMode.setMirrored(m);
  faceMode.setMirrored(m);
}

async function switchMode(mode) {
  const token = ++state.token;
  state.mode = mode;
  document.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  renderCareerChips();
  updateObjectTools();
  faceMode.reset();

  if (mode === 'face' && !faceMode.ready) {
    loading('Cargando detector de rostro…');
    try {
      await faceMode.load();
    } catch (err) {
      console.error(err);
      loading(null);
      toast('No se pudo cargar el detector de rostro. Revisa tu conexión.');
      if (token === state.token) return switchMode('object');
      return;
    }
    loading(null);
  }
  if (token !== state.token) return;

  try {
    await startCamera(mode === 'face' ? 'user' : 'environment');
  } catch (err) {
    console.error(err);
    toast(cameraErrorMessage(err), 5000);
  }
  if (token !== state.token) return;
  if (mode === 'object') hint(HINT_OBJECTS, 6000);
  else hint('');
}

/* ------------------------------ interfaz -------------------------------- */

function renderCareerChips() {
  const box = $('#careers');
  box.innerHTML = '';
  for (const c of CAREERS) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.style.setProperty('--c', c.color);
    b.style.setProperty('--r', TILTS[CAREERS.indexOf(c)]);
    const face = state.mode === 'face';
    const sub = face ? c.face : c.world;
    b.setAttribute('aria-label', face ? `${c.short}: ${sub}` : `Agregar ${sub.toLowerCase()} (${c.short})`);
    if (face) b.setAttribute('aria-pressed', String(c.id === state.career));
    b.innerHTML = `<span class="em" aria-hidden="true">${c.emoji}</span><span class="txt"><b>${c.short}</b><small>${sub}</small></span>${face ? '' : '<span class="plus" aria-hidden="true">+</span>'}`;
    if (face && c.id === state.career) b.classList.add('active');
    b.addEventListener('click', () => onCareer(c.id));
    box.appendChild(b);
  }
}

// Pantalla (px relativos al escenario) -> coordenadas normalizadas del canvas 3D.
function screenToNdc(x, y) {
  const u = (x - layout.ox) / layout.dw;
  const v = (y - layout.oy) / layout.dh;
  return { x: u * 2 - 1, y: -(v * 2 - 1) };
}

// Los objetos nuevos aparecen dentro de la zona visible, repartidos, y con un
// tamaño proporcional al ancho de la pantalla.
const SPAWN = [[0.5, 0.6], [0.3, 0.5], [0.62, 0.5], [0.36, 0.68], [0.64, 0.68]];
function addObject(id) {
  if (!layout) return objectMode.add(id);
  const [fx, fy] = SPAWN[objectMode.items.length % SPAWN.length];
  const z = -3.2;
  const left = objectMode.planePoint(screenToNdc(0, layout.H * fy), z);
  const right = objectMode.planePoint(screenToNdc(layout.W, layout.H * fy), z);
  const worldWidth = Math.min(Math.abs(right.x - left.x), 4);
  return objectMode.add(id, { ndc: screenToNdc(layout.W * fx, layout.H * fy), worldWidth });
}

function onCareer(id) {
  state.career = id;
  if (state.mode === 'face') {
    faceMode.setCareer(id);
    renderCareerChips();
  } else {
    addObject(id);
  }
  updateFramePreview();
}

function renderFilterChips() {
  const box = $('#filters');
  box.innerHTML = '';
  for (const f of FILTERS) {
    const b = document.createElement('button');
    b.className = 'fchip' + (f.id === state.filter ? ' active' : '');
    b.innerHTML = `<span class="sw" style="filter:${cssFilter(f)}"></span>${f.name}`;
    b.addEventListener('click', () => {
      state.filter = f.id;
      mirrorEl.style.filter = cssFilter(f);
      renderFilterChips();
    });
    box.appendChild(b);
  }
}

function updateObjectTools() {
  const show = state.mode === 'object' && objectMode.items.length > 0;
  $('#object-tools').hidden = !show;
  $('#btn-delete').disabled = !objectMode.selected;
}

function updateFramePreview() {
  const fp = $('#frame-preview');
  fp.hidden = !state.frame;
  const c = careerById(state.career);
  fp.style.setProperty('--career', c.color);
  fp.querySelector('b').textContent = `${c.emoji} ${c.name}`;
  fp.querySelector('small').textContent = dateLabel();
  $('#btn-frame').classList.toggle('on', state.frame);
  $('#btn-frame').setAttribute('aria-pressed', String(state.frame));
  $('#btn-shutter').style.setProperty('--c', c.color);
}

/* -------------------------------- gestos -------------------------------- */

function toLocal(e) {
  const r = stage.getBoundingClientRect();
  let x = e.clientX - r.left;
  const y = e.clientY - r.top;
  if (cam.mirrored) x = layout.W - x;
  return { px: { x, y }, ndc: screenToNdc(x, y) };
}

function bindGestures() {
  stage.addEventListener('pointerdown', (e) => {
    if (state.mode !== 'object' || !layout) return;
    stage.setPointerCapture?.(e.pointerId);
    const p = toLocal(e);
    objectMode.pointerDown(e.pointerId, p.px, p.ndc);
  });
  stage.addEventListener('pointermove', (e) => {
    if (state.mode !== 'object' || !layout) return;
    const p = toLocal(e);
    objectMode.pointerMove(e.pointerId, p.px, p.ndc);
  });
  const up = (e) => state.mode === 'object' && objectMode.pointerUp(e.pointerId);
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener(
    'wheel',
    (e) => {
      if (state.mode !== 'object') return;
      e.preventDefault();
      objectMode.wheel(e.deltaY, e.shiftKey);
    },
    { passive: false },
  );
  // Evita el zoom por gesto en Safari.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}

/* -------------------------------- captura -------------------------------- */

function flash() {
  const f = $('#flash');
  f.classList.remove('go');
  void f.offsetWidth;
  f.classList.add('go');
}

async function capture() {
  if (state.busy || !layout) return;
  state.busy = true;
  $('#btn-shutter').disabled = true;
  try {
    const m = activeMode();
    m.setCaptureMode?.(true);
    renderer.render(m.scene, m.camera);
    const canvas = composePhoto({ video, glCanvas, crop: cropOf(layout), mirrored: cam.mirrored });
    m.setCaptureMode?.(false);
    flash();
    await finishPhoto(canvas);
  } catch (err) {
    console.error(err);
    toast('No se pudo tomar la foto.');
  } finally {
    state.busy = false;
    $('#btn-shutter').disabled = false;
  }
}

async function finishPhoto(canvas) {
  applyFilter(canvas, filterById(state.filter));
  if (state.frame) await drawFrame(canvas, careerById(state.career));
  const blob = await toBlob(canvas);
  const name = photoFileName();
  const file = new File([blob], name, { type: 'image/jpeg' });
  if (state.photo) URL.revokeObjectURL(state.photo.url);
  state.photo = { blob, file, name, url: URL.createObjectURL(blob) };
  $('#result-img').src = state.photo.url;
  $('#result-hint').textContent = isIOS()
    ? 'Para guardarla en Fotos toca "Guardar" y elige "Guardar imagen".'
    : 'Toca "Guardar" para descargarla a tu galería, o compártela directo en tus redes.';
  $('#result').hidden = false;
}

async function savePhoto() {
  const p = state.photo;
  if (!p) return;
  // En iPhone la única forma de llegar a la app Fotos desde la web es el menú de compartir.
  if (isIOS() && canShareFile(p.file)) {
    try {
      await shareFile(p.file);
    } catch (err) {
      console.error(err);
      toast('No se pudo abrir el menú. Mantén presionada la foto y elige "Guardar en Fotos".', 5000);
    }
    return;
  }
  download(p.blob, p.name);
  toast('Foto guardada en Descargas.');
}

async function sharePhoto() {
  const p = state.photo;
  if (!p) return;
  if (canShareFile(p.file)) {
    try {
      await shareFile(p.file);
    } catch (err) {
      console.error(err);
      toast('No se pudo compartir la foto.');
    }
  } else {
    download(p.blob, p.name);
    toast('Este navegador no permite compartir archivos; la foto se descargó para que la subas.', 5000);
  }
}

/* ---------------------------------- XR ---------------------------------- */

function renderXrChips() {
  const box = $('#xr-careers');
  box.innerHTML = '';
  for (const c of CAREERS) {
    const b = document.createElement('button');
    b.className = 'chip' + (c.id === state.career ? ' active' : '');
    b.style.setProperty('--c', c.color);
    b.style.setProperty('--r', TILTS[CAREERS.indexOf(c)]);
    b.innerHTML = `<span class="em">${c.emoji}</span><span class="txt"><b>${c.short}</b><small>${c.world}</small></span>`;
    b.addEventListener('click', () => {
      state.career = c.id;
      xrMode.setCareer(c.id);
      renderXrChips();
    });
    box.appendChild(b);
  }
}

async function enterXR() {
  if (!xrMode || xrMode.active) return;
  cam.stop();
  $('#ui').hidden = true;
  $('#xr-overlay').hidden = false;
  renderXrChips();
  try {
    await xrMode.start(state.career);
  } catch (err) {
    console.error(err);
    toast('No se pudo iniciar AR en el piso en este dispositivo.');
    exitXRUI();
    await startCamera('environment').catch(() => {});
  }
}

function exitXRUI() {
  $('#xr-overlay').hidden = true;
  $('#ui').hidden = false;
}

async function onXREnd() {
  exitXRUI();
  state.busy = false;
  try {
    await startCamera(state.mode === 'face' ? 'user' : 'environment');
  } catch (err) {
    toast(cameraErrorMessage(err), 5000);
  }
}

async function onXRCaptured(canvas) {
  if (!canvas) {
    state.busy = false;
    $('#xr-status').textContent = 'Este navegador no permite capturar la cámara en modo AR. Usa una captura de pantalla o el modo Objetos 3D.';
    return;
  }
  xrMode.stop();
  try {
    await finishPhoto(canvas);
  } catch (err) {
    console.error(err);
    toast('No se pudo guardar la foto.');
  }
}

/* ------------------------------ arranque ------------------------------ */

function bindUI() {
  document.querySelectorAll('.seg button').forEach((b) =>
    b.addEventListener('click', () => b.dataset.mode !== state.mode && switchMode(b.dataset.mode)),
  );
  $('#btn-flip').addEventListener('click', async () => {
    try {
      await startCamera(cam.facing === 'user' ? 'environment' : 'user');
    } catch (err) {
      toast(cameraErrorMessage(err));
    }
  });
  $('#btn-shutter').addEventListener('click', capture);
  $('#btn-filter').addEventListener('click', () => {
    const f = $('#filters');
    f.hidden = !f.hidden;
    $('#btn-filter').classList.toggle('on', !f.hidden);
  });
  $('#btn-frame').addEventListener('click', () => {
    state.frame = !state.frame;
    updateFramePreview();
  });
  $('#btn-delete').addEventListener('click', () => objectMode.removeSelected());
  $('#btn-clear').addEventListener('click', () => objectMode.clear());
  $('#btn-retake').addEventListener('click', () => ($('#result').hidden = true));
  $('#btn-save').addEventListener('click', savePhoto);
  $('#btn-share').addEventListener('click', sharePhoto);

  $('#btn-xr').addEventListener('click', enterXR);
  $('#btn-xr-exit').addEventListener('click', () => xrMode.stop());
  $('#btn-xr-undo').addEventListener('click', () => xrMode.removeLast());
  $('#btn-xr-shutter').addEventListener('click', () => {
    if (state.busy) return;
    state.busy = true;
    xrMode.requestCapture();
  });

  video.addEventListener('resize', relayout);
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', () => setTimeout(relayout, 300));
  bindGestures();
}

let lastT = 0;
function loop(time, frame) {
  const t = time / 1000;
  const dt = Math.min(0.1, t - lastT || 0);
  lastT = t;
  if (xrMode?.active) {
    xrMode.update(t, frame);
    renderer.render(xrMode.scene, xrMode.camera);
    return;
  }
  const m = activeMode();
  m.update(t, dt);
  renderer.render(m.scene, m.camera);
  if (state.mode === 'face' && faceMode.ready) {
    const msg = faceMode.faceCount ? '' : 'Buscando tu rostro… mira a la cámara con buena luz';
    if ($('#hint').textContent !== msg) $('#hint').textContent = msg;
  }
}

async function boot() {
  const errEl = $('#splash-error');
  const btn = $('#btn-start');
  errEl.hidden = true;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    errEl.textContent = cameraErrorMessage();
    errEl.hidden = false;
    reportCameraError({ name: 'NoMediaDevices', message: `secure=${window.isSecureContext}` });
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Abriendo cámara…';

  // Lo primero al tocar el botón es pedir la cámara, para que el navegador muestre el
  // aviso de permiso dentro del gesto del usuario (antes de cargar todo el 3D).
  try {
    await cam.start('environment');
  } catch (err) {
    reportCameraError(err);
    errEl.textContent = cameraErrorMessage(err);
    errEl.hidden = false;
    btn.disabled = false;
    btn.textContent = 'Reintentar';
    return;
  }

  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      canvas: glCanvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    objectMode = new ObjectMode(env);
    faceMode = new FaceMode(env, video);
    objectMode.onSelectionChange = (item) => {
      if (item) state.career = item.careerId;
      updateObjectTools();
      updateFramePreview();
    };
    renderFilterChips();
    bindUI();

    XRFloorMode.isSupported().then((ok) => {
      if (!ok) return;
      xrMode = new XRFloorMode(renderer, env, {
        overlay: $('#xr-overlay'),
        onEnd: onXREnd,
        onCaptured: onXRCaptured,
        onStatus: (msg) => ($('#xr-status').textContent = msg),
      });
      $('#btn-xr').hidden = false;
    });
  }
  applyCamera();

  $('#splash').hidden = true;
  $('#ui').hidden = false;
  state.mode = 'object';
  renderCareerChips();
  if (!objectMode.items.length) addObject('software');
  updateFramePreview();
  hint(HINT_OBJECTS, 7000);
  renderer.setAnimationLoop(loop);

  // Precarga el detector de rostro en segundo plano para que el modo Selfie abra rápido.
  setTimeout(() => faceMode.load().catch(() => {}), 1500);
}

function renderSplash() {
  $('#splash-stack').innerHTML = CAREERS.map(
    (c, i) => `<span class="stk" style="--c:${c.color};--r:${['-4deg', '3deg', '-2deg'][i]};--d:${0.15 + i * 0.14}s"><span class="em">${c.emoji}</span>${c.short}</span>`,
  ).join('');
}

renderSplash();
$('#btn-start').addEventListener('click', boot);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

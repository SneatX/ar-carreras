// Captura: compone cámara + 3D, aplica filtro y marco, y guarda/comparte la imagen.

/* ------------------------------- filtros -------------------------------- */
// Cada filtro se define con funciones de CSS (para la vista previa en vivo) y se
// convierte a la misma matriz de color (según la especificación Filter Effects)
// para aplicarlo idéntico a la foto final, en cualquier navegador.
export const FILTERS = [
  { id: 'normal', name: 'Normal', fx: [] },
  { id: 'vivido', name: 'Vívido', fx: [['saturate', 1.45], ['contrast', 1.08]] },
  { id: 'calido', name: 'Cálido', fx: [['sepia', 0.28], ['saturate', 1.3], ['brightness', 1.03]] },
  { id: 'bn', name: 'B/N', fx: [['grayscale', 1], ['contrast', 1.15]] },
  { id: 'vintage', name: 'Vintage', fx: [['sepia', 0.55], ['contrast', 1.05], ['brightness', 0.96]] },
  { id: 'neon', name: 'Neón', fx: [['hue-rotate', -25], ['saturate', 1.6], ['contrast', 1.1]] },
];

export const filterById = (id) => FILTERS.find((f) => f.id === id) ?? FILTERS[0];

export function cssFilter(f) {
  if (!f.fx.length) return 'none';
  return f.fx.map(([k, v]) => (k === 'hue-rotate' ? `hue-rotate(${v}deg)` : `${k}(${v})`)).join(' ');
}

// Matrices 3x4 (fila: r, g, b, offset en 0..1).
function fxMatrix([k, v]) {
  const a = 1 - v;
  switch (k) {
    case 'grayscale': {
      const g = Math.min(1, v), b = 1 - g;
      return [
        0.2126 + 0.7874 * b, 0.7152 - 0.7152 * b, 0.0722 - 0.0722 * b, 0,
        0.2126 - 0.2126 * b, 0.7152 + 0.2848 * b, 0.0722 - 0.0722 * b, 0,
        0.2126 - 0.2126 * b, 0.7152 - 0.7152 * b, 0.0722 + 0.9278 * b, 0,
      ];
    }
    case 'sepia':
      return [
        0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a, 0,
        0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a, 0,
        0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a, 0,
      ];
    case 'saturate':
      return [
        0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v, 0,
        0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v, 0,
        0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v, 0,
      ];
    case 'hue-rotate': {
      const r = (v * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
      return [
        0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283, 0,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0,
      ];
    }
    case 'contrast': {
      const o = 0.5 - 0.5 * v;
      return [v, 0, 0, o, 0, v, 0, o, 0, 0, v, o];
    }
    case 'brightness':
      return [v, 0, 0, 0, 0, v, 0, 0, 0, 0, v, 0];
    default:
      return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
  }
}

// B ∘ A (primero A, luego B)
function compose(A, B) {
  const R = new Array(12);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      R[i * 4 + j] = B[i * 4] * A[j] + B[i * 4 + 1] * A[4 + j] + B[i * 4 + 2] * A[8 + j];
    }
    R[i * 4 + 3] = B[i * 4] * A[3] + B[i * 4 + 1] * A[7] + B[i * 4 + 2] * A[11] + B[i * 4 + 3];
  }
  return R;
}

export function applyFilter(canvas, filter) {
  if (!filter.fx.length) return;
  const M = filter.fx.map(fxMatrix).reduce(compose);
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const o0 = M[3] * 255, o1 = M[7] * 255, o2 = M[11] * 255;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    d[i] = M[0] * r + M[1] * g + M[2] * b + o0;
    d[i + 1] = M[4] * r + M[5] * g + M[6] * b + o1;
    d[i + 2] = M[8] * r + M[9] * g + M[10] * b + o2;
  }
  ctx.putImageData(img, 0, 0);
}

/* ------------------------------- captura -------------------------------- */

// crop: región visible en pantalla, normalizada (0..1) respecto al cuadro de video.
export function composePhoto({ video, glCanvas, crop, mirrored, maxSide = 1920 }) {
  const vw = video.videoWidth, vh = video.videoHeight;
  const sw = crop.w * vw, sh = crop.h * vh;
  const k = Math.min(1, maxSide / Math.max(sw, sh));
  const W = Math.round(sw * k), H = Math.round(sh * k);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.save();
  if (mirrored) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, crop.x * vw, crop.y * vh, sw, sh, 0, 0, W, H);
  const gw = glCanvas.width, gh = glCanvas.height;
  ctx.drawImage(glCanvas, crop.x * gw, crop.y * gh, crop.w * gw, crop.h * gh, 0, 0, W, H);
  ctx.restore();
  return c;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function dateLabel(d = new Date()) {
  return d.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Marco tipo foto impresa (mismas medidas que #frame-preview en style.css):
// borde blanco de 3u, franja inferior de 17u con el sticker de la carrera y la fecha.
const FRAME_FONT = '"Anybody", ui-sans-serif, system-ui, -apple-system, sans-serif';

export async function drawFrame(canvas, career) {
  try {
    await Promise.all([document.fonts.load(`800 40px ${FRAME_FONT}`), document.fonts.load(`600 40px ${FRAME_FONT}`)]);
  } catch {}
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const u = Math.min(W, H) / 100;
  const side = 3 * u, strip = 17 * u;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, side);
  ctx.fillRect(0, 0, side, H);
  ctx.fillRect(W - side, 0, side, H);
  ctx.fillRect(0, H - strip, W, strip);

  // Sticker con el nombre de la carrera, girado -2°.
  if ('fontStretch' in ctx) ctx.fontStretch = 'expanded';
  ctx.font = `800 ${5 * u}px ${FRAME_FONT}`;
  const label = `${career.emoji} ${career.name}`;
  const tw = ctx.measureText(label).width;
  const padX = 2.6 * u, h = 7.6 * u;
  const cy = H - strip / 2;
  ctx.translate(4 * u + (tw + 2 * padX) / 2, cy);
  ctx.rotate((-2 * Math.PI) / 180);
  ctx.fillStyle = career.color;
  roundRectPath(ctx, -(tw + 2 * padX) / 2, -h / 2, tw + 2 * padX, h, 2 * u);
  ctx.fill();
  ctx.fillStyle = '#121766';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, -tw / 2, 0.2 * u);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if ('fontStretch' in ctx) ctx.fontStretch = 'normal';
  ctx.font = `600 ${3.2 * u}px ${FRAME_FONT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#121766';
  const date = dateLabel();
  const dw = ctx.measureText(date).width;
  // La fecha solo cabe si el sticker no la tapa (en fotos verticales angostas va debajo).
  if (4 * u + tw + 2 * padX + 3 * u + dw < W - 4 * u) ctx.fillText(date, W - 4 * u, cy);
  ctx.restore();
}

export const toBlob = (canvas, type = 'image/jpeg', q = 0.92) =>
  new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob falló'))), type, q));

export function photoFileName(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `foto-ar-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.jpg`;
}

/* --------------------------- guardar / compartir ------------------------- */

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function canShareFile(file) {
  try {
    return !!navigator.canShare && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

// Solo archivos (sin texto): así iOS muestra "Guardar imagen" y las apps reciben la foto.
export async function shareFile(file) {
  try {
    await navigator.share({ files: [file] });
    return 'shared';
  } catch (err) {
    if (err?.name === 'AbortError') return 'cancelled';
    throw err;
  }
}

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

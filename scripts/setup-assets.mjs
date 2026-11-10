// Copia los archivos de MediaPipe (wasm + modelo de rostro) a public/ para servirlos
// desde el mismo origen (sin depender de CDNs y con soporte offline vía service worker).
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSrc = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const outDir = join(root, 'public/mediapipe');
const wasmOut = join(outDir, 'wasm');
mkdirSync(wasmOut, { recursive: true });

function copyIfChanged(src, dst) {
  if (existsSync(dst) && statSync(dst).size === statSync(src).size) return;
  copyFileSync(src, dst);
  console.log('copiado', dst.replace(root + '/', ''));
}

for (const f of [
  'vision_wasm_internal.js', 'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm',
]) copyIfChanged(join(wasmSrc, f), join(wasmOut, f));

const modelSrc = join(root, 'assets-src/face_landmarker.task');
const modelDst = join(outDir, 'face_landmarker.task');
if (existsSync(modelSrc)) {
  copyIfChanged(modelSrc, modelDst);
} else if (!existsSync(modelDst)) {
  const url = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
  console.log('descargando modelo de rostro…');
  const res = await fetch(url);
  if (!res.ok) throw new Error('No se pudo descargar el modelo: ' + res.status);
  writeFileSync(modelDst, Buffer.from(await res.arrayBuffer()));
}

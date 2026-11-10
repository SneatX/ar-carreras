# AR Carreras

Aplicación web de **Realidad Aumentada** para tomarse fotos con elementos 3D de tres carreras:
**Ingeniería de Software**, **Medicina** e **Ingeniería Civil**. Funciona desde el navegador del
celular (iPhone y Android), se puede **instalar** en la pantalla de inicio (PWA) y no necesita servidor
propio: todo se procesa en el dispositivo.

## Funciones

| Modo | Qué hace | Dispositivos |
|---|---|---|
| **Objetos 3D** | Coloca modelos 3D sobre la cámara: laptop con código, corazón que late y grúa torre animada. Se mueven con un dedo, se escalan pellizcando y se giran con dos dedos. Se pueden poner varios a la vez. | Todos |
| **Selfie** | Detecta hasta 3 rostros y les pone accesorios 3D que siguen la cabeza: gafas + holograma `</>` (Software), espejo frontal + estetoscopio (Medicina) y casco de obra (Civil). | Todos |
| **AR piso** | Detecta el piso o una mesa real y deja los modelos anclados a escala real. | Solo Chrome en Android con ARCore (el botón aparece únicamente si el dispositivo lo soporta) |

Además:
- **Filtros** en vivo (Vívido, Cálido, B/N, Vintage, Neón) que se aplican igual a la foto final.
- **Marco** opcional con el nombre de la carrera y la fecha.
- **Captura** con el botón del obturador → vista previa → **Guardar** o **Compartir** con un toque
  (menú nativo del sistema: Instagram, WhatsApp, Facebook, X, etc.).
  - En iPhone, "Guardar" abre el menú del sistema y se elige **Guardar imagen** (va a la app Fotos).
  - En Android/computadora, "Guardar" descarga la foto (queda en la galería, carpeta Descargas).

## Tecnologías

- **Three.js**: renderizado 3D (modelos generados por código, sin archivos externos).
- **MediaPipe Face Landmarker** (Google): seguimiento del rostro en tiempo real (468 puntos + matriz 3D de la cabeza).
- **WebXR + ARCore**: detección de superficies reales en Android.
- **Vite**: servidor de desarrollo y compilación.
- **PWA**: manifest + service worker (instalable y funciona sin conexión tras la primera visita).

## Correr el proyecto

Requisitos: Node.js 20+.

```bash
npm install
npm run dev        # servidor HTTPS en la red local
```

La cámara del navegador **solo funciona con HTTPS** (o `localhost`). El servidor de desarrollo usa un
certificado autofirmado:

1. Conecta el celular a la **misma red Wi-Fi** que la computadora.
2. Abre la dirección `https://<IP-de-la-computadora>:5173` que muestra la terminal.
3. Safari/Chrome mostrarán una advertencia de certificado: en iPhone toca *Mostrar detalles → visitar
   este sitio web*; en Android *Configuración avanzada → Continuar*.
4. Toca **Abrir cámara** y permite el acceso.

Para instalarla: en iPhone (Safari) *Compartir → Agregar a pantalla de inicio*; en Android (Chrome)
*menú ⋮ → Instalar app*.

### Compilar y publicar

```bash
npm run build      # genera dist/ (archivos estáticos)
npm run preview    # prueba la versión compilada
```

`dist/` se puede subir tal cual a GitHub Pages, Netlify o Vercel (usa rutas relativas).

## Estructura

```
src/
  main.js             interfaz, modos, captura y guardado
  camera.js           acceso a la cámara (frontal/trasera)
  objectMode.js       modo Objetos 3D + gestos táctiles
  models.js           modelos 3D: laptop, corazón, grúa
  faceMode.js         seguimiento del rostro (MediaPipe)
  faceAccessories.js  accesorios 3D para la cara + oclusores
  xrMode.js           AR en el piso con WebXR (Android)
  photo.js            composición de la foto, filtros, marco, guardar/compartir
  careers.js          las 3 carreras y sus elementos
public/               manifest, service worker, íconos
scripts/              copia de los archivos de MediaPipe, generador de íconos
```

## Cómo se resolvieron los retos

- **Integración 3D + entorno real**: en Selfie se usa la matriz de transformación facial de MediaPipe con
  la misma cámara virtual (FOV 63°) para que los accesorios coincidan con la cara; volúmenes invisibles
  ("oclusores") con forma de cabeza y cuello ocultan las partes que quedan detrás. En Objetos 3D hay sombras de
  contacto y una inclinación de cámara para que los modelos parezcan apoyados. En Android, WebXR ancla
  los modelos a superficies reales.
- **Rendimiento**: modelos con pocas geometrías (las estructuras de la grúa se fusionan en una sola malla),
  detección facial acelerada por GPU (con respaldo en CPU), resolución del canvas limitada y carga diferida
  del detector facial (solo se descarga al usarlo, y se precarga en segundo plano).
- **Interfaz**: un solo obturador, selección de carrera con un toque, gestos estándar del celular.
- **Baja latencia**: la detección corre en cada cuadro nuevo del video y se suaviza para evitar temblores.

## Depuración

- `?oclusor` al final de la URL muestra en magenta los volúmenes de la cabeza usados para ocultar los
  accesorios.

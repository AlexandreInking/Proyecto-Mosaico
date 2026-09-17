# Mosaico 0.2.20 — Manual funcional completo

Fecha de verificación: 3 de agosto de 2026.

Este manual describe exclusivamente funciones disponibles en la aplicación Desktop Windows actual. La versión instalada muestra cuatro áreas: **Assets**, **Editor**, **Pipelines** y **Maps**. Todas comparten el mismo workspace y el mismo catálogo de imágenes. `WebApp` no es requisito de instalación, ejecución ni distribución.

## 1. Instalación y apertura

### Instalador personalizado

El archivo de distribución es `mosaico-setup-0.2.20.exe`.

1. Ejecuta el instalador.
2. Elige si quieres crear un acceso directo en el escritorio.
3. Elige si Mosaico debe abrirse al terminar.
4. Pulsa **Instalar**.

La instalación se realiza para el usuario actual y no requiere permisos de administrador. El acceso directo abre directamente `mosaico-desktop.exe`: no ejecuta compilaciones, no inicia una terminal y no necesita que Node.js, pnpm o Rust estén instalados en el equipo final.

La desinstalación se realiza desde **Configuración de Windows → Aplicaciones instaladas → Mosaico**.

### Primera apertura

Mosaico abre en **Assets**. La barra superior contiene:

- Guardar workspace `.mws`.
- Abrir workspace `.mws`.
- Selector de idioma: inglés, español o ruso.
- Estado de plataforma y conexión.

Los nombres creados por el usuario —Assets, documentos, carpetas, capas, snapshots y nodos personalizados— se conservan literalmente al cambiar de idioma.

## 2. Workspace compartido

Un workspace reúne el catálogo de Assets y los estados de Editor, Pipelines y Maps.

### Guardar `.mws`

Pulsa el icono de descarga de la barra superior. Mosaico crea un ZIP autocontenido con extensión `.mws` que incluye:

- Todos los Assets del catálogo, una sola vez por hash SHA-256.
- Documentos y estado de Editor.
- Grafos, viewport, timeline, snapshots y nodos personalizados de Pipelines.
- Mapas, tilesets y estado de Maps.
- Pestaña activa y selección actual.

### Abrir `.mws`

Pulsa el icono de archivo de la barra superior y selecciona el workspace. Mosaico valida el manifiesto, rutas internas, tipos, tamaños y hashes antes de restaurar el estado.

### Límites de seguridad

- Tamaño máximo del workspace comprimido: 256 MiB.
- Tamaño máximo por entrada: 64 MiB.
- Máximo de Assets registrados por workspace: 1024.
- Las rutas internas que no pertenecen a la estructura admitida se rechazan.
- Un Asset cuyo tamaño, tipo o SHA-256 no coincide no se importa.
- Un archivo inválido no reemplaza el estado que ya está abierto.

### Persistencia local

Editor, Pipelines y Maps guardan borradores locales. Cambiar de pestaña no descarta el trabajo. Pipelines conserva además grafo, viewport, timeline y snapshots al recargar la aplicación. Los Assets se almacenan en IndexedDB.

El `.mws` es la copia portable; el borrador local sirve para continuar en el mismo equipo.

## 3. Assets

Assets es la fuente compartida de imágenes para todos los editores.

### Importación

Puedes importar PNG y GIF mediante el botón **Import**, el selector de archivos o arrastrando archivos sobre la vista. Por cada archivo válido se conserva:

- Nombre original.
- Blob original.
- Tipo MIME.
- Dimensiones.
- Tamaño en bytes.
- SHA-256.
- Fecha de importación.
- Thumbnail.
- Metadatos de frames y duración cuando es GIF animado.

La deduplicación usa SHA-256: importar nuevamente el mismo contenido no crea otra copia.

### Exploración

El buscador filtra por nombre, tipo MIME o hash. Seleccionar una tarjeta abre un preview pixelado grande y un panel lateral con formato, dimensiones, tamaño, animación y hash completo. Las acciones para Editor, Pipelines y Maps permanecen junto a esas propiedades. Si no hay Assets se muestra un estado vacío y una zona de importación. Al arrastrar PNG o GIF sobre la vista aparece un indicador de importación.

### Enviar un Asset

Con un Asset seleccionado:

- **Open in Editor** crea o abre un documento editable desde la imagen.
- **Add to Pipelines** cambia a Pipelines y crea un nodo Asset enlazado.
- **Use in Maps** abre la configuración de tileset usando la imagen seleccionada.

También puedes arrastrar una tarjeta de Asset desde el catálogo o desde el explorador integrado de Pipelines. El drag transporta el ID estable del Asset, no duplica el Blob.

## 4. Editor de pixel art

Editor trabaja con documentos raster por capas y frames.

### Documentos

- Crea lienzos entre 1×1 y 4096×4096 píxeles.
- Mantiene varios documentos abiertos mediante pestañas.
- Marca documentos modificados.
- Restaura documentos locales al volver a abrir la aplicación.
- Abre `.mpe`, `.mosaico` legacy, JSON, PNG, JPEG, WebP y GIF.
- Guarda proyectos nuevos como `.mpe`.

### Herramientas de dibujo

- **Lápiz (P):** pinta píxeles con el color activo.
- **Borrador (E):** escribe transparencia.
- **Relleno (G):** rellena una región conectada.
- **Línea (L):** crea líneas; Shift restringe el ángulo.
- **Rectángulo (R):** dibuja rectángulos; puede usar relleno.
- **Elipse (O):** dibuja elipses; puede usar relleno.
- **Selector de color (I):** toma un color del lienzo.
- **Mano (H):** desplaza la vista.
- **Selección (M):** activa uno de cuatro modos: rectangular, elíptico, lazo o varita mágica.

Mantén pulsado o usa clic derecho sobre los grupos de forma y selección para abrir sus variantes. La rueda hace zoom alrededor del cursor y el clic medio desplaza el lienzo. La tecla `0` centra y ajusta.

### Color y formas

El selector de color controla el color principal. El inspector muestra hasta 32 colores usados y permite reutilizarlos. La opción **Relleno de formas** decide si rectángulos y elipses se dibujan rellenos.

### Selecciones

Las selecciones pueden reemplazar, sumar con Shift o restar con Alt. Se puede:

- Seleccionar todo.
- Invertir o deseleccionar.
- Copiar, cortar, pegar y eliminar píxeles seleccionados.
- Mover la selección desde el lienzo.

Atajos: `Ctrl+C`, `Ctrl+X`, `Ctrl+V`; `Alt+Shift+Delete` borra la selección. Al pulsar el lienzo, este recupera el foco aunque antes estuvieras editando un campo. Después de copiar puedes deseleccionar y seguir pegando desde el portapapeles interno del Editor.

### Capas y carpetas

- Crear capas y carpetas.
- Renombrar con doble clic.
- Reordenar y mover capas dentro o fuera de carpetas mediante drag-and-drop.
- Expandir o contraer carpetas.
- Mostrar u ocultar capas.
- Bloquear o desbloquear capas.
- Eliminar capas, manteniendo siempre al menos una capa raster válida.

Los cambios forman parte del historial. `Ctrl+Z` deshace; `Ctrl+Y` o `Ctrl+Shift+Z` rehace.

### Dibujo seamless

El menú **Vista** permite trabajar sin repetición o con repetición horizontal, vertical o total. Las pinceladas y formas se reflejan en los bordes correspondientes. Las guías entre celdas pueden mostrarse u ocultarse.

### Timeline de animación

- Reproducir o pausar.
- Añadir un frame vacío.
- Duplicar el frame activo.
- Eliminar un frame, conservando al menos uno.
- Ajustar duración individual entre 10 y 60 000 ms.
- Activar onion skin.
- Seleccionar frames desde la tira inferior.
- Cambiar de frame con `PageUp` y `PageDown`.
- Redimensionar altura y ancho de controles del timeline.
- Ocultar o mostrar el timeline desde **Vista**.

### Layout

Inspector, panel de capas y timeline son redimensionables. Puedes guardar layouts con nombre, aplicarlos, eliminarlos o volver al layout inicial.

### Exportación y transferencia

El diálogo de exportación permite:

- PNG con transparencia.
- JPEG con calidad configurable.
- WebP con calidad configurable y transparencia opcional.
- GIF animado respetando duración de frames.
- Escala entera, limitada automáticamente por tamaño seguro.
- Spritesheet horizontal PNG.
- Tilesheet horizontal PNG.

Transferencias disponibles:

- Frame activo como sprite PNG hacia Assets.
- Animación completa como GIF hacia Assets.
- Frames como tilesheet PNG hacia Assets.
- Tilesheet directamente hacia Maps.

El spritesheet no puede superar 16 384 píxeles de ancho ni 67 108 864 píxeles totales.

## 5. Pipelines

Pipelines es un compositor procedural local basado en nodos. Evalúa superficies RGBA, valores, booleanos, vectores y arrays. Una entrada Surface ausente o inválida produce transparencia real; no se generan imágenes de relleno.

### Canvas

- Doble clic en espacio vacío, `Space` o `F2` abre la palette.
- La rueda cambia el zoom.
- Arrastrar el fondo hace pan.
- **Ajustar** encuadra el grafo.
- Shift permite selección aditiva de nodos.
- `Delete` o `Backspace` elimina nodos o conexiones seleccionados.
- El botón de papelera limpia nodos, conexiones, keyframes y snapshots; la acción entra en undo.
- Deshacer y rehacer están disponibles en el menú **Editar**.

Las conexiones usan puertos tipados. No se aceptan auto-conexiones, puertos inexistentes, duplicados ni tipos incompatibles. Los nodos pueden exponer parámetros como puertos de entrada; el ojo del Inspector muestra u oculta ese puerto. Ocultarlo elimina conexiones que quedarían inválidas.

### Assets dentro de Pipelines

El panel izquierdo incluye preview real y explorador compartido de Assets. Puedes:

- Buscar por nombre, tipo o hash.
- Arrastrar un Asset sobre el canvas para crear un nodo Asset enlazado.
- Arrastrarlo sobre un nodo Asset para cambiar su fuente.
- Arrastrarlo al destino del Inspector cuando hay un nodo Asset seleccionado.
- Soltar un PNG, JPEG, WebP o GIF externo sobre el canvas para importarlo y crear el nodo.

Los GIF se decodifican por frames cuando `ImageDecoder` está disponible. El frame mostrado depende del tiempo actual del timeline.

### Palette

La palette contiene búsqueda y pestañas horizontales: **All**, **Array**, **Compose**, **Data**, **Filter**, **Generator**, **I/O**, **Math & Logic**, **Time**, **Transform** y **Vector**. `Enter` añade el primer resultado; `Escape` cierra. **All** incluye los nodos publicados y los nodos personalizados del usuario.

### Inspector

Al seleccionar un nodo, el Inspector muestra:

- Familia y descripción.
- Entradas y salidas.
- Conexiones actuales.
- Asset fuente cuando corresponde.
- Parámetros `number`, `float`, `range`, `select`, `color`, `asset`, `vector2`, texto, booleano y array.
- Límites, paso, unidad y opciones definidas por el nodo.
- Control Eye/EyeOff para convertir parámetros en puertos visibles.

Los cambios de parámetros actualizan la evaluación local. Rotation usa precisión decimal dentro de 0.00–359.99°. Las operaciones binarias de superficies toman el tamaño de A y adaptan B con nearest-neighbor.

### Timeline por frames

- Mostrar u ocultar desde el botón del toolbar.
- Redimensionar verticalmente entre 140 y 520 px.
- Reproducir, pausar, detener y repetir.
- FPS de render entre 1 y 60; valor inicial 12.
- Definir inicio y final del rango de render.
- Scrubbing por milisegundos.
- Ver thumbnails RGBA reales de cada frame generado.
- Seleccionar frames individuales, seleccionar todos o limpiar la selección.
- Crear keyframe para el primer parámetro numérico del nodo/pista seleccionada.
- Seleccionar un keyframe pulsando su rombo.
- Eliminar un keyframe individual con clic derecho sobre el rombo.
- Capturar snapshots únicamente cuando existe resultado RGBA real.
- Restaurar tiempo y nodo seleccionado desde un snapshot.

Los frames renderizados no se guardan como superficies dentro del borrador: se regeneran desde grafo, Assets, parámetros y keyframes.

### Transferir a Editor

El botón de transferencia abre un diálogo para asignar nombre y elegir:

- Frame actual.
- Frames seleccionados.

La transferencia copia RGBA y duración directamente, crea un documento en Editor y cambia automáticamente a esa pestaña. No usa GIF intermedio ni modifica Assets.

### Exportar resultados

El botón de descarga ofrece:

- **PNG single:** frame actual.
- **PNG spritesheet:** frames seleccionados en horizontal.
- **GIF animated:** frames seleccionados con sus duraciones.

Si ningún frame contiene salida RGBA válida, el botón no genera un archivo ficticio y muestra un diagnóstico.

### Guardado de Pipelines

El menú **Archivo** permite crear, abrir y guardar `.mpl`, además de limpiar el borrador local. Un `.mpl` incluye grafo, parámetros, conexiones, viewport, timeline, snapshots, definiciones personalizadas usadas y Assets referenciados.

Límites del paquete `.mpl`:

- 64 MiB comprimidos.
- 50 MiB por entrada.
- 256 nodos.
- 1024 conexiones.
- 4096 keyframes.
- 24 snapshots.
- 256 Assets referenciados.

Se validan rutas, manifiesto, schema, tamaño y SHA-256 antes de aceptar el paquete.

### Nodos personalizados

El menú **Nodos → Crear nodo personalizado** abre dos interfaces:

- Constructor visual para Invert, Flip, Rotate, Zoom, Color y Gradient.
- DSL seguro para declarar inputs, parámetros, outputs y expresiones.

Ejemplo válido:

```text
input source: Surface
param amount: Float = 1
output result: Surface

result = invert(source)
```

Tipos admitidos: Surface, Color, Gradient, Value, Int, Float, Bool, Vector2, Vector3, Vector4, Array, Point, Path, Matrix y String.

Operaciones DSL registradas: `resize`, `flip`, `rotate`, `zoom`, `invert`, `select`, `replace`, `outline`, `blend`, `add`, `subtract`, `multiply`, `divide`, `color` y `gradient`.

El parser admite referencias, literales, llamadas y aritmética `+`, `-`, `*`, `/`. Valida identificadores, tipos, outputs asignados y operaciones conocidas. No ejecuta JavaScript arbitrario.

### Catálogo de nodos funcionales

Todos los nodos de esta sección están publicados en la palette y tienen evaluator CPU 2D.

#### I/O

Asset, Preview, Resource Loader, Get Pixel, Region System, UV Workflow y Script.

#### Data

Int, Float, Seed y Rough.

#### Math & Logic

Number, Absolute, Add, Subtract, Multiply, Divide, Ceil, Floor, Round, Clamp, Lerp, Max, Min, Modulo, Square Root, Sine, Cosine, Tangent, Normalize, Evaluate, Bool, Compare, If, Switch, Not, And, Or, Xor, Nor y Nand.

#### Vector

Vector2, Vector3, Vector4, Angle, Distance, Vector Add, Vector Distance, Vector Length, Vector Normalize, Vector Scale, Direction y Velocity.

#### Array

Number Array, Array Find, Array Get, Array Length, Array Range, Array Reverse, Array Set, Array Shuffle, Array Sort, Array Split, Array Zip y Array Randomizer.

#### Generator

Solid, Gradient, Linear Gradient, Radial Gradient, Bilinear Gradient, Normalized Gradient, Checkerboard, Grid, Grid Triangular, Stripe, Draw Curve, Draw Path, Draw Shape, Draw Group y Draw Text.

Ruido: Noise, Cellular Noise, Perlin, Simplex, White Noise, Blue Noise, Gaussian Noise, Impulse Noise, Pink Noise, Brown Noise, FBM, Turbulent Noise, Rings Noise, Rays Noise, Euclidean Noise, Voronoi Noise, Manhattan Noise, Chebyshev Noise, Worley Noise, Tricubic Noise, Discrete Noise, Seamless Noise y Spots Noise.

Efectos por frame: Bloom, Godray, MK Godray, Particle, Particle Spawn, Pixel Cloud, Trail y VFX.

#### Transform

Resize, Flip, Rotate, Zoom, Movement, Atlas, Corner Warp, Crop, Deform, Displace, Lattice Warp, Mirror, Move, Move To, Nine Slice, Padding, Pivot, Polar Distance, Repeat, Scale, Skew, Tile y Transform.

#### Filter

Invert, Select, Replace, Outline, Color, Alpha Cut, Blur, Blur Directional, Blur Gaussian, Brightness Contrast, Color Adjust, Color Replace, Colorize, Dither, Dither Bayer, Dither Cluster, Edge Detect, Glow, Hue Saturation Value, Level, Palette Apply, Match Palette, Pixelate, Posterize, Shadow, Shading, Sharpen, Threshold, Alpha To Color, Clean Edge y Half Tone.

#### Compose

Blend, Mask, Mix, Remap, Stack, Frame Blend y Frame Bypass.

#### Time y sistemas

Time, Delta Time, Condition, Delay, Feedback, Iteration, Loop, Loop Start y Loop End.

## 6. Maps

Maps edita mapas ortogonales basados en tilesets.

### Documentos de mapa

- Nuevo mapa con nombre, dimensiones en tiles y tamaño de celda.
- Fondo transparente o color sólido.
- Grid visible opcional.
- Varios documentos abiertos mediante pestañas.
- Cierre con control de cambios sin guardar.
- Apertura de `.mtm`, `.mosaico` legacy y JSON compatible.
- Guardado autocontenido `.mtm`.

### Herramientas

- **Lápiz (P):** pinta el stamp seleccionado.
- **Borrador (E):** elimina tiles.
- **Selector de tile (I):** toma un tile del mapa.
- **Balde (G):** rellena regiones.
- **Línea (L)**, **Rectángulo (R)** y **Elipse (O):** pintan patrones geométricos.
- **Selección (M):** selecciona una región para moverla o transformarla.
- **Mano (H):** desplaza la vista.

La rueda hace zoom al cursor, el clic medio desplaza y `0` ajusta el mapa. `+` y `-` cambian el zoom.

### Selección y transformaciones

Sobre una selección puedes copiar, cortar, pegar, duplicar o eliminar. También puedes aplicar Flip X, Flip Y y rotaciones de 90°, 180° o 270°.

Atajos: `Ctrl+C`, `Ctrl+X`, `Ctrl+V`, `Ctrl+Z`, `Ctrl+Y`; `Alt+Shift+Delete` elimina la selección. La selección permanece activa al usar paneles o menús; el canvas recupera el foco al pulsarlo y permite pegar aunque ya no exista una selección activa.

### Tilesets

La importación acepta PNG, JPEG y WebP externos o imágenes ya disponibles internamente. El diálogo permite definir:

- Nombre.
- Ancho y alto del tile.
- Márgenes X/Y.
- Separación X/Y.
- Offset X/Y.
- Zoom de preview.

La previsualización muestra el slicing, regiones no usadas y separaciones. Se puede hacer pan y zoom dentro del preview. Tras importar, el tileset puede renombrarse, eliminarse y visualizarse con zoom configurable.

La cuadrícula de tiles usa virtualización para no montar todos los botones a la vez. Shift selecciona un rango y crea un stamp de varios tiles.

### Pintado y animación de tiles

El stamp seleccionado se pinta con las herramientas. **Animar selección** convierte los tiles del stamp en frames con FPS entre 1 y 60; los tiles pintados reproducen esa secuencia en loop.

### Capas y carpetas

- Crear capas y carpetas.
- Renombrar mediante doble clic.
- Arrastrar para reordenar o cambiar de carpeta.
- Expandir y contraer carpetas.
- Mostrar, ocultar, bloquear, desbloquear y eliminar.
- Mantener selección, viewport e historial por documento.

### Propiedades del mapa

- Redimensionar ancho y alto con ancla.
- Mostrar u ocultar grid.
- Elegir color del grid.
- Ajustar mapa a la vista.
- Guardar, aplicar, eliminar y restablecer layouts de paneles.
- Redimensionar inspector, tilesets y capas.

### Exportación

- `.mtm`: proyecto autocontenido con documento y Assets de tileset.
- JSON neutral: estructura legible con mapa, capas, tiles y tilesets.
- PNG: render raster de capas visibles con nearest-neighbor.
- ZIP neutral: `map.json` más Assets.

La exportación se bloquea si existen referencias de tiles huérfanas. El PNG admite hasta 16 384×16 384 y 67 108 864 píxeles. Los paquetes de mapa admiten hasta 256 MiB y validan rutas, tamaños y hashes.

## 7. Formatos

| Extensión | Contenido | Uso |
|---|---|---|
| `.mws` | Workspace completo y Assets | Copia portable de todo el trabajo |
| `.mpe` | Documento de Editor | Intercambio de sprites y animaciones editables |
| `.mpl` | Pipeline, Assets usados, timeline y snapshots | Intercambio de grafos procedurales |
| `.mtm` | Mapa autocontenido y tilesets | Intercambio de mapas |
| `.mosaico` | Documento legacy | Solo apertura compatible |
| `.png` | Imagen o spritesheet | Exportación sin pérdida |
| `.jpg` | Imagen raster | Exportación sin alpha |
| `.webp` | Imagen raster | Exportación con calidad configurable |
| `.gif` | Animación | Importación de Assets y exportación animada |
| `.zip` | Mapa neutral más Assets | Integración externa |

Cuando el navegador soporta File System Access API, Mosaico usa el selector nativo de ubicación. En otros entornos descarga el archivo mediante enlace temporal.

## 8. Diagnósticos y recuperación

- La barra inferior muestra estado, cantidad de Assets y errores agrupados.
- Los errores de importación no eliminan Assets válidos existentes.
- Pipelines muestra diagnósticos de ciclos, entradas faltantes, conexiones incompatibles, Assets inválidos y evaluadores no disponibles.
- Una salida inválida se sustituye por RGBA transparente para impedir que sobreviva un resultado anterior.
- Maps evita exportar referencias huérfanas.
- Los formularios limitan tamaños, FPS, duración, escalas y rangos antes de ejecutar tareas costosas.
- Las operaciones largas de mapa muestran progreso y botón **Cancelar**.

## 9. Resumen de atajos

| Contexto | Atajo | Acción |
|---|---|---|
| Editor/Maps | `P E I G L R O M H` | Cambiar herramienta |
| Editor/Maps | `0` | Ajustar canvas |
| Editor/Maps | rueda | Zoom al cursor |
| Editor/Maps | clic medio | Pan |
| Editor/Maps | `Ctrl+Z` | Deshacer |
| Editor/Maps | `Ctrl+Y` | Rehacer |
| Editor/Maps | `Ctrl+C/X/V` | Copiar, cortar, pegar selección |
| Editor/Maps | `Alt+Shift+Delete` | Borrar selección |
| Editor | `PageUp/PageDown` | Frame anterior/siguiente |
| Pipelines | doble clic, `Space`, `F2` | Abrir palette |
| Pipelines | `Delete/Backspace` | Eliminar selección |
| Pipelines | Shift + clic | Selección múltiple |
| Pipelines | rueda | Zoom del grafo |
| Pipelines | arrastrar fondo | Pan del grafo |

## 10. Flujo recomendado

1. Importa PNG o GIF en **Assets**.
2. Envía la imagen a **Editor**, **Pipelines** o **Maps**.
3. Edita el sprite, compón un grafo o construye un mapa.
4. Transfiere resultados entre áreas cuando convenga.
5. Exporta imágenes, animaciones o mapas desde el editor correspondiente.
6. Guarda un `.mws` para conservar el workspace completo y transportarlo a otro equipo.

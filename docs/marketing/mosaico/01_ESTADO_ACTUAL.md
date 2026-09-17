# Mosaico — estado actual verificable

**Corte:** 3 de agosto de 2026 · **HEAD:** `80131ed` · **versión Desktop:** `0.2.20`

## Resumen

Mosaico es hoy una aplicación Desktop Windows local para producción 2D: catálogo de assets, editor de Pixel Art, editor ortogonal de mapas y editor visual de pipelines. La UI React/TypeScript corre dentro de Tauri. El baseline WPF queda preservado como implementación histórica F1.

La promesa comercial defendible es:

> **Importa, edita y transforma tus assets 2D en un mismo workspace, y conéctalos con sprites, tilesets y mapas reutilizables.**

No es todavía una suite completa de generación de juegos, IA, colaboración cloud ni integración universal con engines.

## Superficies implementadas

| Superficie | Estado | Capacidades observadas |
|---|---|---|
| Assets | Implementado | Importación, drag/drop, búsqueda, hash, deduplicación, catálogo y referencias estables. El selector principal visible prioriza PNG/GIF. |
| Pixel Art | Implementado | Lienzo RGBA, lápiz, borrador, relleno, línea, rectángulo, elipse, picker, selección, capas, carpetas, visibilidad, bloqueo, paleta, undo/redo, frames, onion skin, timeline y exportación. |
| Pipelines | Implementado en alpha | Grafo visual, puertos tipados, previews, evaluación CPU local, snapshots, timeline, jobs con progreso/cancelación y paquetes `.mpl`. Incluye nodos publicados de asset, transform, filtro, generator, math, vector, array, lógica y noise. |
| Mapas | Implementado | Mapas ortogonales, tilesets, capas y carpetas, zoom/pan, pincel, borrador, fill, línea, rectángulo, elipse, selección, copiar/cortar/pegar, resize, animación, diagnósticos, autotile básico y exportación JSON/PNG/ZIP. |
| Workspace | Implementado | Pestañas de Assets, Pixel Art, Pipelines y Mapas; persistencia local/autosave best-effort; paquete portable `.mws` con assets, hashes y referencias. |
| Canvas | Implementado | Viewports Pixel/Pixi y mapa ortogonal Pixi, picking, zoom, pan, culling y presupuestos de rendimiento probados. |
| Desktop | Implementado | Tauri 2, shell local/offline, splash, updater configurado, NSIS e instalador branded para Windows. |
| Web | Fuera de alcance del release | El monorepo conserva cliente y servidor como superficie técnica histórica; no forman parte del instalador ni del soporte Desktop. |
| WPF | Preservado | Baseline F1 con mapas, tilesets, capas, herramientas básicas, `.mosaico` y `.mosaicpack`. No debe mezclarse con la superficie Tauri actual. |

## Flujos que sí se pueden mostrar

1. Importar una imagen.
2. Encontrarla en el catálogo y abrirla en un editor.
3. Dibujar, seleccionar, organizar capas y animar frames.
4. Crear un pipeline visual, conectar nodos, evaluar y exportar un resultado.
5. Importar un tilesheet, definir tamaño/margen/spacing, crear un mapa y pintar.
6. Configurar autotile básico por terreno o contorno.
7. Guardar workspace, mapa o pipeline en formatos propios y exportar artefactos neutrales.

## Formatos y límites

| Área | Formato/límite observado |
|---|---|
| Workspace | `.mws`; paquete máximo documentado de 256 MB y entradas de asset hasta 64 MB. |
| Pipeline | `.mpl`; hasta 256 nodos, 1.024 edges y 4.096 keyframes. |
| Pixel Art | Documento RGBA; hasta 1.024 frames, 128 capas y paleta máxima de 256 colores según contrato. |
| Mapa | `.mtm`; formato actual `mosaico-map` v3, ortogonal, hasta 4.096×4.096, 64 tilesets, 128 capas y 1.000.000 de celdas ocupadas. |
| Imagen | PNG/JPEG/WebP/GIF en contratos/pipeline; fuente máxima de 50 MB y presupuesto de 67.108.864 píxeles. |
| Exportación | PNG/JPEG/WebP/GIF, spritesheets, JSON neutral, PNG y ZIP según editor. |
| Seguridad | Validación Zod, IDs estables, geometría y bounds; detección de ciclos, hashes y ZIP con rutas inseguras rechazadas. |

## Plataformas reales

- **Windows Desktop:** superficie soportada y objetivo de venta; Tauri/NSIS, instalador y shell offline.
- **Web:** no soportada ni distribuida en este release.
- **Linux/macOS/mobile:** sin build y matriz de pruebas suficiente para anunciarlos como soportados.
- **GitHub updater:** está configurado en Desktop, pero no prueba que exista una publicación externa activa.

## Lo que no debe anunciarse como disponible

- IA generativa de imágenes, mapas, ciudades, quests, diálogos, economía o habilidades.
- WFC completo, generación procedural 2D completa, 3D, audio o simulación.
- Colaboración, cuentas, pagos, DRM, suscripciones o sincronización cloud.
- Importadores/exportadores maduros para Unity, Godot u otros engines.
- Marketplace de plugins o scripting productivo sin restricciones.
- “Reemplaza Aseprite, Tiled, Godot y Unity” como claim general.

## Verificación del corte

`pnpm test` ejecutó 232 pruebas y terminó con código 0: suites estructurales T0/T1/T2, contratos, servidor, pipeline, dominio, persistencia, canvas y UI. El documento histórico afirmaba 212 pruebas y un estado anterior del worktree; esos datos no se reutilizan.

Antes de llamar a Mosaico “estable” todavía hacen falta:

1. `pnpm typecheck` y `pnpm build` en el corte final.
2. Instalación y apertura en Windows limpio.
3. Flujo manual: importar → editar → guardar → cerrar → reabrir → exportar → actualizar/reparar.
4. Licencia del producto, términos, privacidad, terceros, changelog y canal de soporte.
5. Screenshots y video hechos con la build real.
6. Completar licencia, terceros, changelog, soporte y prueba en Windows limpio antes de venta pública.

## Evidencia local

- [`README.md`](../../../README.md)
- [`docs/MANUAL_FUNCIONAL_ACTUAL.md`](../../MANUAL_FUNCIONAL_ACTUAL.md)
- `Shared/ui/src/AppShell.tsx`
- `Shared/ui/src/PixelArtEditor.tsx`
- `Shared/ui/src/PipelineEditor.tsx`
- `Shared/ui/src/MapEditor.tsx`
- `Shared/contracts/src/authoring.ts`
- `Shared/contracts/src/pipeline.ts`
- `Shared/ui/src/workspace-media.ts`
- `Shared/ui/src/pipeline-media.ts`
- `DesktopApp/src-tauri/tauri.conf.json`
- `WebApp/server/start/routes.ts`
- `Shared/**/tests` y `tests/t0`, `tests/t1`, `tests/t2`

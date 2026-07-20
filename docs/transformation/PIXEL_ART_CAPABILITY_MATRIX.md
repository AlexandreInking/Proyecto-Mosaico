# Matriz de capacidades raster y pixel-art

**Estado:** baseline de producto aprobado con T1.
**Referencia funcional:** documentación pública de Aseprite consultada el 20 de julio de 2026.
**Regla legal:** diseño e implementación clean-room. No copiar código, assets, iconos, temas ni marca de Aseprite.

## Escala de cumplimiento

- `P0`: paridad base necesaria para editor utilizable.
- `P1`: paridad profesional.
- `M+`: diferenciador propio de Mosaico.
- Una capacidad solo cuenta como terminada con prueba automática, walkthrough manual y persistencia.

| Área | Capacidades verificables | Prioridad | Fase objetivo |
|---|---|---:|---:|
| Documento | RGB/RGBA/indexado/grises, tamaño, perfil, guardado versionado, recovery | P0 | T2P |
| Capas | raster, grupos, fondo, visibilidad, lock, opacity, blend modes, linked cels | P0/P1 | T2P-T3P |
| Animación | frames, cels, duración, timeline, tags, onion skin, playback | P0 | T2P |
| Dibujo | pencil, eraser, line, curve, rectangle, ellipse, fill, spray, contour, custom brushes | P0/P1 | T2P-T3P |
| Pixel precision | pixel-perfect stroke, grid/snap, symmetry, tiled mode, dithering, shading ramps | P1 | T3P |
| Selección | rect/lasso/wand/color range, add/subtract/intersect, mask, move/transform | P0/P1 | T2P-T3P |
| Color | foreground/background, palettes, indexed remap, gradients, replace color, color wheel | P0/P1 | T2P-T3P |
| Transformación | crop, trim, resize canvas/sprite, rotate, flip, skew y batch sobre cels | P0/P1 | T2P-T3P |
| Tilemaps | tilesets, tilemap layers, pixel/tile edit, reuse, huérfanos, ortho/iso/hex | P0/M+ | T2/T4 |
| Export | PNG/JPEG/WebP/GIF, secuencias, spritesheets, atlas/JSON, Godot/Unity | P0/M+ | T1/T3 |
| Automatización | command palette, atajos, macros, CLI, scripting con permisos, plugins aislados | P1/M+ | T4P |
| Pipeline | recetas no destructivas, provenance, batch, diffs, validación, perfiles | M+ | T1/T3 |
| Generación | patrones, autotile, WFC, mapas/ciudades/quests/diálogos/economía/skills | M+ | T4/T5 |
| Colaboración | comentarios, review de diffs, historial durable; tiempo real fuera de alcance inicial | M+ | T8+ |

## Entregas del editor

- `T2P — Pixel Core`: documento, lienzo pixel-perfect, pencil/eraser/fill, capas, selección rectangular, paleta, undo/redo, frames/cels y PNG.
- `T3P — Pixel Pro`: herramientas restantes, onion skin, tags, slices, indexed color, brushes, simetría, dithering, transformación avanzada y spritesheets.
- `T4P — Pixel Automation`: macros, CLI, scripting aislado, extensiones con permisos y generadores conectados al documento.

T1 no afirma paridad Aseprite. T1 entrega infraestructura de assets/recetas que el editor usará sin duplicar almacenamiento, historial ni exportación.

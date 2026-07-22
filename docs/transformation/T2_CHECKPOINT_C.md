# Evidencia T2 — Checkpoint C

**Estado:** PASS humano Web/Desktop
**Fecha:** 21 de julio de 2026

## Resultado visible

- `Mapas` y `Pixel Art` están habilitados dentro del `AppShell` compartido.
- WebApp y DesktopApp consumen el mismo componente y renderer.
- Mapa ortogonal: grid, clip, culling, pan, zoom al cursor y picking.
- Pixel Art: nearest-neighbor, grid, clip, pan, zoom y picking estricto.
- Canvas Lab queda como harness interno de diagnóstico; no es producto ni gate humano.
- `Pixel Art` es ahora primer módulo y vista inicial en ambas plataformas.
- El lanzador Desktop prioriza el binario Tauri actual; ya no abre artefactos T0 antiguos.

## Evidencia automatizada

| Gate | Resultado |
|---|---:|
| Canvas unit/performance | 12/12 PASS |
| UI compartida | 2/2 PASS |
| Canvas typecheck | PASS |
| UI typecheck | PASS |
| Build WebApp | PASS |
| Build DesktopApp | PASS |
| Bundle inicial Web gzip | 88.13 KiB |
| Bundle inicial Desktop gzip | 88.05 KiB |
| Chunk Authoring lazy gzip | 93.03 KiB |

Benchmark Windows/Node 24, fixture 100.000 tiles ocupados:

- picking p95: 0.0003 ms;
- creación fría de índice: 26.4540 ms;
- culling estable p95: 5.9165 ms, dentro de frame 60 FPS.

## Browser real

Chrome sobre `http://127.0.0.1:5173`:

- módulo `Mapas`: canvas `1920×726`, picking activo, `overflowX=0`;
- módulo `Pixel Art`: canvas `1920×726`, grid 16×16, `overflowX=0`;
- navegación ocurre dentro de `Asset Pipeline AI`; no abre aplicación separada.

## Revisión

- Correctitud: bounds, clipping, picking y composición cubiertos por tests.
- Arquitectura: dominio/render/UI separados; Web y Desktop comparten UI.
- Seguridad: sin entrada externa ni HTML dinámico en este slice.
- Rendimiento: índice espacial evita escaneo completo en frames estables.
- Límite honesto: todavía no hay herramientas de pintura integradas ni importación TMX/Aseprite; pertenecen al siguiente bloque vertical.

## Incidencia y revalidación Desktop

El `FAIL C Desktop` del propietario fue válido: `Mosaico.cmd` abría primero un artefacto manual T0, aunque DesktopApp ya consumía `AppShell`. Se corrigió orden del lanzador, se reconstruyó Tauri y se resolvió incompatibilidad CSP de Pixi mediante su módulo estático `pixi.js/unsafe-eval`.

Validación técnica local: binario Tauri actual, `Pixel Art` activo al abrir, canvas visible, `Assets` y `Mapas` disponibles, sin error CSP. Propietario confirmó `PASS C Desktop` el 21 de julio de 2026.

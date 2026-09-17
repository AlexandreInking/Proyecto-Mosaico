# T2 Checkpoint A — contratos y dominio

**Resultado:** PASS
**Fecha:** 21 de julio de 2026
**Rama:** `feature/asset-pipeline-dual-app`

## Entregado

- Contratos Zod versionados para mapa ortogonal v2 y sprite RGBA v1.
- Fixtures mínimos legales de mapa y sprite.
- Dominio ortogonal sparse e inmutable: set/erase/fill, layers, tilesets, huérfanos y fingerprint.
- Dominio Pixel Core inmutable: RGBA, set/erase/fill, layers y fingerprint.
- `PixelBuffer` no expone almacenamiento mutable.
- Límites de bounds, IDs, layers, tilesets, celdas y canales.

## Evidencia automática

- Contratos: 8 pruebas PASS.
- Dominio: 12 pruebas PASS.
- Pipeline T1: 15 pruebas PASS.
- UI: 2 pruebas PASS.
- API: 1 prueba PASS.
- Estructura/gates T0-T1: 9 pruebas PASS.
- TypeScript estricto: 7 workspaces PASS.
- Builds: WebApp client, WebApp server y DesktopApp frontend PASS.
- Búsqueda de imports prohibidos en `Shared/domain` y `Shared/contracts`: cero React, PixiJS o Tauri.

## Invariantes demostrados

1. Pintar/borrar/fill no mutan revisión anterior.
2. Coordenadas fuera de bounds y layers bloqueadas no mutan documento.
3. Eliminar tileset conserva TileRefs y genera diagnóstico agrupado.
4. Mapa siempre conserva al menos una layer.
5. Sprite no expone buffer RGBA mutable.
6. Orden de pintura no cambia fingerprint semántico final.

## Diferido correctamente a Ola B

- Command registry, inversas y undo/redo (`T2-04`).
- Serialización v2, migración v1 y round-trip (`T2-05`).
- Autosave/recovery (`T2-06`).

## Gate siguiente

Ola B requiere aprobación humana explícita. No hay validación visual en Checkpoint A porque UI aún no fue modificada; primer programa visual nuevo llega en Checkpoint D.

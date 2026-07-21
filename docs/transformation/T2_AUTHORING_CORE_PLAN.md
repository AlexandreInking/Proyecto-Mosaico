# Plan T2 — Authoring Core dual

**Estado:** Aprobado; Checkpoint C PASS e integrado en Web/Desktop
**SPEC:** `T2_AUTHORING_CORE_SPEC.md`

## Arquitectura y dependencias

```text
schemas v2
  → dominio mapa/sprite
    → comandos + historial
      → persistencia/migración
        → canvas/picking
          → MapEditor / PixelEditor compartidos
            → adapters Web/Desktop
              → exportadores + gate dual
```

PixiJS y adapters dependen del dominio; dominio nunca depende del renderer. Registro de comandos será frontera futura para nodos, macros, scripting y chat.

## Ola A — Contratos y dominio

### T2-01: Schemas de autoría v2 — completado

- Aceptación: Zod valida mapa, tileset, layers, TileRefs, sprite y revisión; rechaza IDs duplicados, bounds y presupuestos inválidos.
- Verificación: fixtures válidos/rotos y `pnpm --filter @mosaico/contracts test`.
- Dependencias: T1.
- Archivos: `Shared/contracts`, `fixtures/t2`.
- Tamaño: M.

### T2-02: Dominio ortogonal sparse — completado

- Aceptación: create/set/erase/fill/layers/tilesets son puros; huérfanos sobreviven; hash semántico determinista.
- Verificación: unit/property tests, negativos y límites.
- Dependencias: T2-01.
- Archivos: `Shared/domain/src/map`, `Shared/domain/tests`.
- Tamaño: M.

### T2-03: Pixel document mínimo — completado

- Aceptación: RGBA/layers/pixel/fill producen estado válido y hash determinista.
- Verificación: golden pixels, bounds y alpha tests.
- Dependencias: T2-01.
- Archivos: `Shared/domain/src/sprite`, tests.
- Tamaño: M.

### Checkpoint A

- [x] Tests, typecheck y builds duales verdes.
- [x] Documentos versionados y fingerprints deterministas.
- [x] Estado previo no muta tras pintar, borrar o fill.
- [x] Sin React/Pixi/Tauri en dominio.
- [ ] `apply → inverse` y round-trip pertenecen a T2-04/T2-05 en Ola B.

Evidencia: `T2_CHECKPOINT_A.md`.

## Ola B — Comandos, historial y persistencia

### T2-04: Command registry e historial

- Aceptación: stroke/fill/layer/tileset usan transacciones; undo/redo restaura hashes; registro declara schemas de parámetros.
- Verificación: secuencias y límites de historia.
- Dependencias: T2-02/T2-03.
- Archivos: `Shared/domain/src/commands`, tests.
- Tamaño: M.

### T2-05: Formato v2 y migrador v1

- Aceptación: lectura v1 y v2; escritura canónica v2; IDs/huérfanos preservados; entradas peligrosas rechazadas.
- Verificación: golden fixture WPF, round-trip y corrupt corpus.
- Dependencias: T2-01/T2-02.
- Archivos: `Shared/domain/src/serialization`, fixtures, tests.
- Tamaño: M.

### T2-06: Stores, autosave y recovery

- Aceptación: Web reabre revisión; snapshot corrupto no reemplaza confirmado; adapters cumplen mismo contract.
- Verificación: IndexedDB fake/real browser y fault injection.
- Dependencias: T2-05.
- Archivos: `Shared/persistence`, tests.
- Tamaño: M.

### Checkpoint B

- [x] Guardar/reabrir conserva hash semántico.
- [x] Recovery elige última revisión válida.
- [x] Primer programa puede crear documentos aunque canvas aún sea básico.

Evidencia: `T2_CHECKPOINT_B.md`.

## Ola C — Canvas compartido

### T2-07: Viewport ortogonal PixiJS

- Aceptación: clip, pan, zoom al cursor, HiDPI y picking exacto; tiles fuera de viewport nunca se renderizan.
- Verificación: projection/picking tests, browser screenshots y benchmark.
- Dependencias: T2-02.
- Archivos: `Shared/canvas/src/map`, tests.
- Tamaño: M.

### T2-08: Canvas Pixel Core

- Aceptación: píxeles se renderizan nearest, grid/snap correctos, stroke nunca sale de bounds.
- Verificación: golden render y browser interaction tests.
- Dependencias: T2-03/T2-04.
- Archivos: `Shared/canvas/src/sprite`, tests.
- Tamaño: M.

### Checkpoint C

- [x] p95 frame/picking medidos en fixture y entorno.
- [x] Resize de ventana no produce overflow horizontal ni solapamiento.
- [x] Canvas desacoplado de paneles React e integrado en ambas aplicaciones.

Evidencia: `T2_CHECKPOINT_C.md`.

Desde este checkpoint, Olas D y E se ejecutan como un bloque vertical mayor. No habrá aprobación por ticket interno: siguiente validación humana ocurre cuando edición mapa y pixel produzca archivos reales en Web y Desktop.

## Ola D — Flujos de producto

### T2-09: MapEditor vertical

- Aceptación: nuevo mapa, tileset tabs/import preview, palette, paint/erase/fill, layers y console funcionan end-to-end.
- Verificación: component tests + walkthrough Web.
- Dependencias: T2-04/T2-06/T2-07.
- Archivos: `Shared/ui/src/map`, estilos, tests.
- Tamaño: M por sub-slice; dividir nuevo mapa, tilesets, tools y layers en commits.

### T2-10: PixelEditor vertical

- Aceptación: nuevo sprite, palette, pencil/eraser/fill, layers, undo/redo y PNG funcionan end-to-end.
- Verificación: component tests + golden PNG + walkthrough Web.
- Dependencias: T2-04/T2-06/T2-08.
- Archivos: `Shared/ui/src/pixel`, estilos, tests.
- Tamaño: M por sub-slice.

### T2-11: Navegación y workspace

- Aceptación: Assets/Mapas/Pixel Art activos, documentos preservan estado al cambiar módulo y atajos tienen foco correcto.
- Verificación: UI tests y teclado manual.
- Dependencias: T2-09/T2-10.
- Archivos: `Shared/ui/src/AppShell.tsx`, módulos, tests.
- Tamaño: M.

### Checkpoint D

- WebApp ejecuta ambos flujos completos.
- Misma UI y documentos se compilan en Desktop.
- Usuario recibe primer walkthrough intermedio antes de exportadores.

## Ola E — Interoperabilidad y cierre

### T2-12: Adapters Desktop y guardado atómico

- Aceptación: Tauri abre/guarda/exporta sin acceso nativo directo desde React; cancelación no muta documento.
- Verificación: Rust tests, contract tests y paquete Desktop.
- Dependencias: T2-06/T2-11.
- Archivos: `DesktopApp/src-tauri`, adapter TS.
- Tamaño: M.

### T2-13: Export neutral, Godot y Unity

- Aceptación: export determinista; ambos motores consumen fixture mínimo; no ejecuta contenido importado.
- Verificación: golden hashes y smoke de importadores.
- Dependencias: T2-05/T2-09/T2-12.
- Archivos: `Shared/domain/src/export`, fixtures, tests.
- Tamaño: M.

### T2-14: Oracle, benchmark y gate dual

- Aceptación: WPF v1 y TS v2 coinciden semánticamente; Web/Desktop empaquetados; gate registra hashes, entorno y resultados.
- Verificación: `pnpm gate:t2`, MG-T2 Web/Desktop y recorder humano.
- Dependencias: todas.
- Archivos: scripts, tests/t2, docs/manual.
- Tamaño: M.

### Checkpoint E — Cierre T2

- SPEC: 10/10 criterios con evidencia.
- Cero S0/S1; auditoría de dependencias verde.
- `PASS T2 Web` y `PASS T2 Desktop` humanos.
- LegacyWpf marcado deprecado, conservado en repositorio.
- T3/T2P siguiente no inicia sin aprobación.

## Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| T2 demasiado grande | Alto | checkpoints ejecutables y commits verticales; no activar funciones incompletas |
| Divergencia v1/v2 | Alto | oracle semántico y golden fixtures antes de UI |
| Canvas filtra fuera de bounds | Alto | clipping doble: culling/render y validación de comando |
| Memoria de mapas/sprites | Alto | sparse chunks, límites, viewport culling, benchmarks |
| PixiJS/Tauri inestable | Medio | adapter angosto y renderer sustituible; dominio neutral |
| Pixel Core retrasa mapa | Medio | dominios paralelos después de schemas; UI en sub-slices independientes |
| Futuro nodo/chat exige rehacer comandos | Alto | command registry tipado desde T2; ejecución externa aún deshabilitada |

## Aprobación requerida

SPEC, PLAN y ADR-005 aprobados por propietario el 21 de julio de 2026. Checkpoints A/B/C PASS. Ola C integrada. Siguiente ejecución: bloque vertical D–E, pendiente de autorización.

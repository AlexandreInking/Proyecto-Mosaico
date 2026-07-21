# SPEC T2 — Authoring Core dual

**Estado:** Aprobado; Checkpoint A PASS, Ola B en ejecución (T2-04 PASS)
**Fecha:** 21 de julio de 2026
**Alcance:** T2 completo + primer slice ejecutable T2P
**Arquitectura:** ADR-003, ADR-004 y ADR-005

## 1. Objetivo

Convertir Mosaico de pipeline de resize en herramienta de autoría 2D utilizable. La misma UI React debe permitir crear, abrir, editar y guardar un mapa ortogonal por tiles y crear un documento pixel-art básico. Mapas y sprites comparten catálogo, comandos, historial, persistencia y exportación.

Esta fase construye base limpia para la meta Aseprite + Tiled + TileKit + Tile Composer. WFC, proceduralidad, IA por chat, nodos visuales y scripting se apoyarán en contratos de comandos/documentos creados aquí, pero no aparecerán como capacidades activas hasta tener ejecución real y gate propio.

## 2. Usuarios y flujos

### Diseñador de mapas

1. Crea mapa ortogonal indicando nombre, ancho/alto en celdas y celda base.
2. Importa uno o más tilesets PNG con tile, margen y spacing configurables.
3. Selecciona tile visualmente, pinta/borra dentro del mapa y navega con pan/zoom.
4. Crea, renombra, reordena, bloquea, oculta y elimina capas.
5. Deshace/rehace; guarda, reabre y exporta datos neutrales para Godot/Unity.
6. Si elimina tileset usado, ve marcador huérfano y diagnóstico agrupado, sin perder referencia.

### Artista pixel

1. Crea sprite RGBA con ancho/alto y fondo transparente.
2. Dibuja con pencil/eraser/fill usando paleta mínima.
3. Gestiona capas raster básicas y undo/redo.
4. Guarda/reabre documento y exporta PNG pixel-perfect.
5. Puede añadir PNG exportado al catálogo/tileset sin duplicar bytes por hash.

## 3. Alcance funcional

### 3.1 Shell de autoría

- `Assets`, `Mapas` y `Pixel Art` activos; navegación conserva documento abierto.
- Layout común: navegador izquierdo, viewport central, inspector derecho, consola inferior y statusbar.
- Ningún módulo futuro activo o falso; nodos, Mundo e IA permanecen “Planificado”.

### 3.2 Dominio compartido

- Nuevo workspace `Shared/domain` sin React, PixiJS, Tauri ni AdonisJS.
- IDs estables, schemas versionados y validación estricta.
- Comandos puros y transaccionales; `execute`, `undo`, `redo` producen estado nuevo o delta reversible.
- Registro de comandos tipado prepara command palette, nodos, macros, scripting y chat; ninguna extensión ejecuta código arbitrario todavía.
- Límites: mapa 1…4096 por eje, 128 capas, 64 tilesets, 1 000 000 celdas ocupadas; sprite 1…4096 por eje y 128 capas.

### 3.3 Editor de mapas ortogonal

- Documento v2: metadata, orientación, grid, layers, tilesets y referencias sparse.
- Viewport acelerado con clipping visual y lógico, HiDPI, pan, zoom al cursor y picking exacto.
- Pencil, eraser y fill acotado; stroke completo equivale a una transacción undoable.
- Tilesets con preview sin gaps artificiales, tabs nombrados y tab `+ Importar`.
- Importador muestra preview 2×2 y controles tile width/height, margin X/Y y spacing X/Y.
- Layers: add/delete/rename/reorder/visibility/lock; mínimo una capa.
- Tileset removido conserva `TileRef`; renderer usa tile de error magenta/negro y consola agrupa huérfanos.
- Adaptador de migración lee manifiesto v1 de `.mosaico`; escritor canónico v2 no descarta IDs ni referencias huérfanas.

### 3.4 Pixel Core inicial

- Documento sprite v1 RGBA con capas raster y una cel/frame inicial.
- Canvas nearest-neighbor con grid opcional y clipping.
- Pencil, eraser y bucket fill; tamaño de pincel 1…32; color RGBA.
- Add/delete/rename/reorder/visibility/lock para capas raster; mínimo una capa.
- Undo/redo por stroke u operación.
- Persistencia versionada y export PNG sin suavizado.
- Timeline, onion skin, tags, selecciones y herramientas profesionales permanecen T2P posterior; no se simulan.

### 3.5 Persistencia y plataforma

- Web: IndexedDB y File System Access/download cuando exista; fallback de import/export mediante picker/download.
- Desktop: mismo contrato; Tauri adapter para diálogo y guardado atómico se incorpora sin llamadas Tauri desde React.
- Autosave local con revisión, recuperación tras cierre inesperado y aviso si existe snapshot más nuevo.
- Archivos no confiables se validan antes de construir estado; límites previenen zip bombs y asignaciones excesivas.

### 3.6 Exportación

- Mapa neutral JSON v2 determinista y paquetes `.mosaico` versionados.
- Exportadores Godot 4 y Unity generan datos/import metadata mínimos mediante adapters; nunca ejecutan scripts importados.
- Sprite exporta PNG; integración con atlas queda T3.

## 4. Tecnología

- TypeScript estricto, React 19, Vite 7 y Zod existentes.
- PixiJS 8 para canvas de mapa/sprite; Canvas2D queda fallback de pruebas, no segunda UI.
- Vitest para dominio/componentes; pruebas de navegador para picking, clipping, persistencia y resize responsive.
- Tauri 2 para filesystem Desktop; AdonisJS permanece API de capacidades, sin persistencia cloud T2.

## 5. Comandos

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm gate:t2
pnpm dev:web
pnpm dev:desktop
```

## 6. Estructura objetivo

```text
Shared/contracts/       schemas públicos v2
Shared/domain/          mapa, sprite, comandos, historial, migraciones
Shared/canvas/          renderer/picking/viewport PixiJS
Shared/persistence/     puertos y adapters browser
Shared/ui/              shell, MapEditor, PixelEditor, paneles comunes
DesktopApp/src-tauri/   adapter de archivos/guardado atómico
tests/t2/               gates estructurales e interoperabilidad
fixtures/t2/            mapas, sprites, tilesets y archivos corruptos
docs/manual/            walkthrough dual MG-T2
```

## 7. Estilo de código

Estado de dominio permanece explícito, serializable e inmutable en fronteras:

```ts
export interface MapCommand {
  readonly id: string
  apply(document: MapDocument): CommandResult<MapDocument>
}

export interface CommandResult<T> {
  readonly value: T
  readonly inverse: Command<T>
  readonly diagnostics: readonly DomainDiagnostic[]
}
```

- Nombres de dominio en inglés; texto UI en español.
- Sin `any`, singletons mutables ni acceso a navegador dentro de dominio.
- IDs, orden y serialización deterministas.
- Un comando no deja estado parcial al fallar.

## 8. Estrategia de pruebas

- Unitarias: coordenadas, sparse cells, fill, capas, huérfanos, comandos, historia y sprite pixels.
- Property/corpus: `apply → undo` restaura hash; round-trip conserva hash semántico; strokes nunca escriben fuera de bounds.
- Golden: migración v1→v2, export neutral, PNG de sprite y marcador huérfano.
- Componentes: navegación, controles, accesibilidad, tabs de tilesets/layers y consola agrupada.
- Browser: clipping real, picking HiDPI, pan/zoom, IndexedDB/reopen y viewport responsive.
- Desktop: build Tauri, apertura, importación, guardado y recuperación sobre paquete ligado al commit.
- Oracle: fixture compartido compara hash semántico WPF v1 y dominio TypeScript migrado.

## 9. Límites de decisión

### Siempre

- Prueba antes de implementación de lógica.
- Mismo componente/contrato en Web y Desktop.
- Guardado atómico o descarga explícita; original/backup preservados.
- Mensaje exacto de revisión manual al terminar cada checkpoint ejecutable.

### Requiere nueva aprobación

- Cambiar formato v2 después de publicar fixture estable.
- Añadir ejecución de scripts/plugins, proveedor IA o persistencia cloud.
- Eliminar LegacyWpf.
- Activar iso/hex antes de gates geométricos propios.

### Nunca en T2

- Copiar código, assets, formato o identidad de Aseprite/Tiled/TileKit/Tile Composer.
- Ejecutar contenido importado.
- Ocultar tiles huérfanos o descartar referencias desconocidas.
- Mostrar nodos, IA, WFC o herramientas Pixel Pro como funcionales sin implementación.

## 10. Criterios de éxito

1. Web y Desktop crean, editan, guardan y reabren mismo mapa ortogonal.
2. Importan tileset configurable; selección y pintura coinciden a cualquier zoom/DPI.
3. Pintura y preview quedan recortados al viewport y bounds lógicos.
4. Capas/tilesets se eliminan; tiles usados pasan a marcador huérfano y diagnóstico agrupado.
5. Undo/redo restaura hash antes/después de strokes, fill y cambios de layers.
6. Fixture `.mosaico` v1 migra y round-trip conserva IDs, layers, TileRefs y hash semántico.
7. Web y Desktop crean sprite, dibujan, gestionan capas, reabren y exportan PNG exacto.
8. UI permanece responsive; viewport objetivo p95 ≤16.7 ms en benchmark documentado.
9. Builds, tests, seguridad, recuperación y walkthrough MG-T2 pasan en ambas apps.
10. LegacyWpf solo se marca deprecado después de PASS humano dual; no se elimina.

## 11. No incluido todavía

- Iso/hex, objetos, colisiones, terrains/autotile, WFC y generación procedural.
- Timeline, onion skin, selecciones, indexado y herramientas Pixel Pro.
- Editor visual de nodos, runtime de nodos personalizados, scripting y marketplace.
- Chat IA y proveedores externos.
- Colaboración cloud, pagos y cuentas.

Estas capacidades conservan prioridad del roadmap; T2 crea contratos y datos que consumirán sin migración destructiva.

## 12. Gate de aprobación

SPEC, PLAN y ADR-005 aprobados explícitamente por propietario el 21 de julio de 2026. Ola A autorizada.

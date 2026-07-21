# Plan de transformación y migración dual

**Estado:** T0 y T1 completados; T2 Ola B implementada, Checkpoint B pendiente de gate integral
**Fecha:** 21 de julio de 2026
**Regla:** desde cada fase implementable existe programa arrancable, fixture y validación manual antes de avanzar.

## Estrategia

Migración por sustitución gradual. WPF queda congelado como baseline; no recibe funciones nuevas salvo correcciones críticas. Primero se construye un slice React compartido, luego shells Web/Tauri, después se migra mapa F1 y finalmente se amplía hacia pipelines e IA.

## Fase T0 — Contratos y monorepo

**Objetivo:** establecer estructura sin perder baseline.

Tareas:

- Crear workspaces `Shared`, `DesktopApp`, `WebApp`.
- Fijar Node LTS compatible, TypeScript estricto, Vite y React.
- Definir schemas versionados para workspace, assets, recetas, jobs y diagnósticos.
- Crear puertos de plataforma y adapters falsos para pruebas.
- Configurar lint, typecheck, unit tests y build reproducible.
- Mover solución .NET a `DesktopApp/LegacyWpf` conservando historial mediante `git mv`.
- Adaptar `Mosaico.cmd` para elegir baseline o nueva app durante migración.

Aceptación:

- [ ] WebApp muestra shell compartido.
- [ ] DesktopApp Tauri muestra el mismo shell.
- [ ] LegacyWpf todavía compila y abre fixture F1.
- [ ] Test prueba que ambas entradas renderizan mismo identificador de versión UI.

Validación manual: abrir las tres superficies, comparar layout/tema/teclado y cerrar sin errores.

## Fase T1 — Catálogo e imagen mínima

**Objetivo:** primer producto dual útil.

Tareas:

- Importación PNG/JPEG/WebP por adapters web/desktop.
- Hash, metadata, thumbnail y catálogo.
- Receta no destructiva `resize -> convert -> export`.
- Cola de jobs, progreso, cancelación y consola agrupada.
- Persistencia local Desktop; sesión/proyecto temporal Web antes de cuentas.
- Manifiesto de procedencia y comparación entrada/salida.

Aceptación:

- [x] Mismo fixture genera metadata y manifiesto normalizados mediante pipeline/UI compartidos por ambas apps.
- [x] Cancelar no crea salida confirmada.
- [x] Archivo corrupto no bloquea UI y produce diagnóstico agrupado.
- [x] Original conserva hash.

Gate automático y validación humana Web/Desktop `PASS` sobre commit `8e583e2d4487a4c5291dfc6dace38b3c5c47d58b`.

Validación manual: importar fixture, ejecutar receta, cancelar otra, exportar y comparar.

## Fase T2 — Paridad del editor de mapas

**Objetivo:** reemplazar WPF sin perder F1.

Tareas:

- Portar modelo/commands necesarios a dominio TypeScript o adapter de compatibilidad temporal.
- Implementar viewport PixiJS con clip, pan/zoom, picking y HiDPI.
- Portar tilesets, capas, herramientas, undo/redo y consola.
- Leer `.mosaico` existente y escribir versión migrada sin pérdida.
- Mantener marcador de tile huérfano y eliminación reversible.
- Revalidar exportación neutral y Unity/Godot.

Aceptación:

- [ ] Walkthrough F1 completo pasa en DesktopApp y WebApp.
- [ ] Pintado jamás sale del viewport lógico o visual.
- [ ] Round-trip conserva IDs, capas y referencias huérfanas.
- [ ] Oracle WPF y nueva app coinciden en fixture semántico.

Validación manual: MG-02 adaptado en ambas apps. Solo entonces LegacyWpf queda deprecado.

## Fases T2P-T4P — Editor raster y pixel-art profesional

**Objetivo:** cumplir y superar la matriz funcional de referencia sin copiar Aseprite.

- T2P entrega Pixel Core ejecutable: documento sprite, lienzo, herramientas esenciales, capas y animación base.
- T3P entrega Pixel Pro: herramientas avanzadas, paletas/indexado, timeline profesional y spritesheets.
- T4P entrega automatización: macros, CLI, scripting aislado e integración procedural.
- Estas fases se intercalan con T2-T4: comparten canvas, comandos, historial, tilesets y exportadores.

Aceptación: cada fila de `PIXEL_ART_CAPABILITY_MATRIX.md` necesita evidencia automática y manual. Nunca se declara “paridad” por semejanza visual.

## Fase T3 — Pipeline profesional de sprites

**Objetivo:** completar flujo 2D.

Tareas:

- Remoción de fondo con máscara corregible.
- Upscale mediante adapter ONNX/proveedor versionado.
- Atlas determinista con padding/extrusión.
- Perfiles de compresión por destino.
- Batch, presets, diff visual y presupuestos de memoria.

Aceptación:

- [ ] Máscara puede editarse antes de aplicar.
- [ ] Atlas repite hash bajo entorno declarado.
- [ ] No hay bleeding en fixture de bordes.
- [ ] Export Godot/Unity consume atlas y manifiesto.

Validación manual: procesar pack de sprites real, inspeccionar bordes a zoom alto y usarlo en mapa.

## Fase T4 — Patrones, procedural y WFC

**Objetivo:** recuperar y ampliar diferenciador original.

Tareas:

- Portar reglas/autotiling.
- Implementar presets deterministas básicos.
- Implementar WFC Simple Tiled antes de Overlapping.
- Preview, variantes, regiones bloqueadas, cancelación y explicación.
- Topologías isométrica y hexagonal detrás de gates propios.

Aceptación:

- [ ] Misma semilla/versión reproduce resultado.
- [ ] Incremental equivale a recálculo completo.
- [ ] Contradicción WFC conserva documento y explica causa.
- [ ] Usuario puede aceptar, editar y deshacer generación.

Validación manual: generar tres variantes, bloquear región, regenerar y editar salida.

## Fase T5 — IA estructurada RPG

**Objetivo:** generar contenido coherente sin generar imágenes.

Tareas:

- WorldBible y schemas para mundo/ciudad/quest/diálogo/economía/skills.
- Adapter de proveedor IA con salida JSON, timeout, cuotas y redacción de secretos.
- Validadores de referencias, ciclos, progresión, conectividad y balance básico.
- Pipeline plan IA -> validación -> materialización determinista -> simulación.
- Inspector de procedencia, diff y aceptación parcial.

Aceptación:

- [ ] Salida no conforme nunca muta proyecto.
- [ ] Cada entidad referencia IDs válidos o diagnóstico concreto.
- [ ] Quest principal es alcanzable según simulador de prerequisitos.
- [ ] Economía de fixture no crea recurso infinito no declarado.
- [ ] Regeneración respeta bloqueos y WorldBible.

Validación manual: crear pequeño RPG, cambiar una restricción y verificar cambios localizados.

## Fase T6 — Modelos 3D

**Objetivo:** pipeline glTF/GLB listo para motor.

Tareas:

- Inspección y validación glTF/GLB.
- Optimización, deduplicación y compresión.
- Generación de LOD con preview y métricas.
- Conversión de texturas y perfiles de destino.
- Export e integración de fixture en Unity/Godot.

Aceptación:

- [ ] Jerarquía/materiales/animaciones preservados según contrato.
- [ ] Cada LOD declara reducción y error geométrico medido.
- [ ] Salida abre en validadores y motores objetivo.

Validación manual: comparar modelo original y LODs en visor y motor.

## Fase T7 — Audio

**Objetivo:** preparar audio reproducible.

Tareas:

- Metadata, waveform y reproducción segura.
- Trim, loudness, sample rate/canales y conversión.
- Loop points y validación de discontinuidad.
- Perfiles por destino y batch.

Aceptación:

- [ ] No clipping nuevo fuera de tolerancia.
- [ ] Loop fixture no produce click detectable por métrica y escucha.
- [ ] Original permanece intacto y salida tiene procedencia.

Validación manual: escucha A/B con auriculares y prueba en motor.

## Fase T8 — Servicio web durable

**Objetivo:** operación online real, aún sin pagos.

Tareas:

- PostgreSQL, object storage y cuentas.
- Upload multipart con límites y cuarentena.
- Workers aislados, reintentos idempotentes y cuotas técnicas.
- Sincronización explícita de proyectos; conflictos visibles.
- Retención, borrado y exportación de datos.

Aceptación:

- [ ] Reinicio no pierde job ni duplica salida.
- [ ] Usuario A nunca accede a datos de B.
- [ ] Borrado elimina datos según política y emite recibo auditable.
- [ ] Coste estimado aparece antes de job pesado.

Validación manual: dos cuentas, carga, job, interrupción, reanudación y borrado.

## Fase T9 — Comercialización

Fuera de prioridad actual. Incluye suscripción Web, licencia Desktop, entitlement offline, actualizaciones firmadas y soporte. Requiere ADR legal/comercial y threat model separado.

## Gates comunes T0–T8

Cada fase requiere:

1. App Desktop y Web arrancables desde comando documentado.
2. Build, typecheck, tests y fixtures verdes.
3. Caso feliz, cancelación y recuperación.
4. Walkthrough manual informado al usuario con lista exacta de revisión.
5. Benchmark ligado a commit y entorno.
6. Cero S0/S1; S2 solo con waiver y fecha.
7. Aprobación humana explícita antes de fase siguiente.

## Orden inmediato tras aprobación

1. Crear estructura T0 y toolchain.
2. Mover WPF a `DesktopApp/LegacyWpf` con rutas reparadas.
3. Levantar shell React compartido en WebApp.
4. Empaquetar mismo shell en Tauri.
5. Entregar ejecutables T0 y guion manual.

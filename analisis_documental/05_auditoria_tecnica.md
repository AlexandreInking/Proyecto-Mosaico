# Auditoría técnica: arquitectura, formato, algoritmos y rendimiento

**Alcance:** PM-03, PM-04, PM-05, PM-07, PM-08, PM-09 y PM-10.  
**Autoridad aplicada:** PM-00 y PM-02; PM-14 solo gobierna secuencia.  
**Fecha:** 19 de julio de 2026.  
**Modo:** auditoría documental; no modifica especificaciones fuente.

## 1. Dictamen ejecutivo

La dirección técnica es sólida, pero el corpus **no está listo para iniciar Fase 1**. Sí está listo para una **Fase 0 condicionada**, dedicada a convertir propuestas en decisiones verificadas. PM-00 establece que PM-02 manda sobre contratos y que cambios en formato, topología, identidad, threading o reglas requieren ADR (`documentos/00_Indice_Maestro_y_Gobernanza.md:68-78,92`). PM-14 confirma que Fase 0 debe elegir stack, validar coordenadas, guardado/chunks y automatización, y producir ADR, repositorio, CI, proyecto ejemplo y presupuestos (`documentos/14_Roadmap_Backlog_ADR_y_Plantillas.md:33-42`).

**Veredicto:** `GO CONDICIONADO` para Fase 0; `NO-GO` para Fase 1 hasta cerrar B-01 a B-08 y aceptar los ADR mínimos de §13.

Fortalezas:

- Separación correcta de topología, proyección, semántica y visual (`PM-04:29-31,46-74`).
- Dominio aislado de UI y formatos, con comandos como única vía de mutación (`PM-03:41-71,111-124`).
- Escritor único, snapshots inmutables y aplicación transaccional de deltas (`PM-03:138-149,187-189`; `PM-10:95-110`).
- Persistencia orientada a atomicidad, recuperación, migración y diffs razonables (`PM-05:158-222`).
- Reglas, PCG y WFC producen resultados/deltas sin mutar directamente el documento (`PM-07:220-231`; `PM-08:170-174`; `PM-09:225-236`).
- Roadmap en slices ejecutables, compatible con prueba manual al cierre de cada fase (`PM-14:29-31,44-108`).

Debilidades decisivas:

- Stack, renderer, sistemas operativos, formato definitivo, historial, plugins y máquina de benchmark siguen abiertos (`PM-00:118-127`; `PM-03:195-211`; `PM-10:83-94`).
- Casi ningún contrato define ownership de memoria, threading exacto, compatibilidad binaria, códigos de error, límites numéricos o semántica de cancelación.
- Presupuestos carecen de corpus, dimensiones, densidad, capas, frío/caliente, resolución, percentil de memoria y máquina reproducible.
- Formato recomendado mezcla JSON y binarios, pero no define esquema, canonicalización, protocolo multifichero ni política de compatibilidad.

## 2. Escala de severidad

| Nivel | Significado |
|---|---|
| **Bloqueante** | Impide decidir stack/contrato o iniciar Fase 1 sin alto riesgo de reescritura o pérdida. |
| **Alta** | Debe cerrarse antes de implementar el subsistema afectado. |
| **Media** | Puede resolverse durante fase previa al subsistema; exige prueba o especificación. |
| **Baja** | Mejora precisión, mantenibilidad o trazabilidad; no bloquea prototipo. |

## 3. Jerarquía, dependencias y estado autoritativo

### 3.1 Mapa de contratos

```text
PM-02 requisitos aprobados
  -> PM-03 límites, comandos, jobs, snapshots
     -> PM-04 topología/proyección/orden espacial
     -> PM-05 documento/identidad/formato/transacción
     -> PM-07 reglas sobre snapshot -> delta
     -> PM-08 PCG sobre snapshot -> resultado semántico
        -> PM-07 materialización visual
     -> PM-09 WFC como solver localizado -> delta
     -> PM-10 renderer/cachés/scheduler/benchmarks

PM-14 ordena implementación; no puede rebajar PM-02 ni sustituir ADR.
```

Dependencias permitidas explícitas: todas apuntan al dominio; importadores traducen hacia modelo interno; renderer no modifica documento (`PM-03:61-71`). Los subsistemas especializados consumen contratos del dominio y conservan estructuras propias no autoritativas (`PM-03:53-55`). Esto concuerda con adaptadores externos fuera del núcleo exigidos por REQ-IO-004 (`PM-02:124-129`).

### 3.2 Estado autoritativo propuesto por documentos

| Estado | Autoritativo | Derivado/efímero | Evidencia |
|---|---|---|---|
| Proyecto | documento, IDs, propiedades, procedencia aceptada, migraciones, reglas incorporadas | — | `PM-03:168-185` |
| Sesión | — | selección, herramienta, cámara, paneles, jobs, caches | `PM-03:96-108` |
| Render | — | mallas, instancias, texturas por chunk | `PM-03:176-185`; `PM-10:67-69` |
| Reglas | paquete/revisión y output aceptado con procedencia | índices, predicados, bitsets, coincidencias | `PM-05:147-156`; `PM-07:159-168` |
| PCG | preset/versión/semilla y resultado aceptado | previews/resultados no aceptados | `PM-08:170-186`; `PM-03:182-183` |
| WFC | delta aceptado y metadatos requeridos aún por definir | wave, dominios, cola, supports, trail | `PM-03:182`; `PM-09:45-61,119-132` |

**Hueco:** PM-03 enumera “procedencia aceptada” como autoritativa, pero PM-05 permite agruparla por región (`PM-05:149-156`) y no define qué granularidad conserva capacidad de edición/regeneración de REQ-RULE-007. Tampoco determina si semilla, modelo, catálogo, versión del solver y política de contradicción WFC quedan persistidos.

## 4. Auditoría PM-03: arquitectura y threading

### Contratos válidos

- Arquitectura de proceso local modular, puertos/adaptadores y comandos (`PM-03:35-37`).
- Presentación no serializa ni ejecuta algoritmos; aplicación coordina mutaciones; dominio ignora UI/SO/formato (`PM-03:39-59`).
- Toda mutación autoritativa usa comando/transacción; grandes comandos guardan deltas, no copias completas (`PM-03:111-124`).
- Eventos ocurren después del commit e incluyen región/revisión (`PM-03:126-136`).
- Jobs reciben contexto/cancelación y devuelven resultado inmutable o plan; aplicación aplica en hilo de documento (`PM-03:138-149`).
- Escritor único y control optimista por revisión (`PM-03:187-189`).

### Huecos

- **B-01 Bloqueante:** “hilo de documento” no define dispatcher, afinidad, orden total, reentrancia ni si coincide con UI. Sin esto, deadlocks, commits fuera de orden y latencia de input quedan abiertos. Evidencia: `PM-03:149,187-189`.
- **A-01 Alta:** `IEditorCommand.Execute` sin contrato explícito de atomicidad ante excepción, validación previa, redo, merge/coalescing, memoria máxima y ownership del delta (`PM-03:111-124`). REQ-EDIT-004 exige retorno exacto de secuencias aleatorias (`PM-02:68-72`).
- **A-02 Alta:** política de conflicto de snapshots usa “reevalúa, fusiona o solicita decisión” sin algoritmo por tipo de job (`PM-03:187-189`). Cada servicio debe declarar una sola política por operación.
- **A-03 Alta:** eventos carecen de contrato de entrega: sync/async, orden, fallos de handlers, backpressure y ciclo de vida de payload (`PM-03:126-136`).
- **M-01 Media:** interfaces públicas son pseudocódigo y PM-00 dice que no son API estable (`PM-00:78`); falta especificación de módulo de PM-14 con threading/persistencia/errores (`PM-14:190-206`).

### Recomendación de threading para spike

Un único `DocumentDispatcher` serializa validación y commits. UI envía comandos cortos; nunca espera jobs bajo lock. Workers usan `DocumentSnapshot(revision)` inmutable. Resultado incluye `baseRevision`, footprint de lectura/escritura, delta, métricas y diagnóstico. Commit acepta solo revisión igual; merge automático únicamente para footprints disjuntos demostrado por prueba. Cancelación detiene cálculo, no revierte un commit ya publicado. Eventos salen después del commit, en orden de revisión, mediante cola acotada; caches pueden coalescer invalidaciones.

## 5. Auditoría PM-04: espacio, grillas y orden

### Contratos válidos

- `GridCoordinate` no representa píxeles; axial recomendado para hex (`PM-04:35-44,104-127`).
- `IGridTopology` gobierna relaciones discretas y `IGridProjection` geometría visual (`PM-04:46-74`).
- Floor division/mod para chunks negativos (`PM-04:129-138`), necesario para REQ-MAP-001 (`PM-02:56`).
- Picking usa polígono real, índice espacial y tolerancia independiente de zoom (`PM-04:151-155`).
- Clave estable de render `(layerOrder, depthBand, depthKey, manualBias, stableId)` (`PM-04:170-178`).

### Huecos

- **B-02 Bloqueante:** `GridCoordinate(A,B,C)` sobrecarga `C` como nivel sin unidad/rango; `SpatialConfiguration` no tiene esquema validable. Falta fijar convenciones de ejes, origen, handedness, unidades, tamaño cero/negativo, overflow y límites (`PM-04:35-44`; `PM-05:64-74`).
- **A-04 Alta:** `GridDirection` contiene `Id` e `Index`, pero no se define estabilidad/orden canónico por topología. Bitmasks dependen exactamente de ese orden (`PM-04:41,46-57`; `PM-07:41-55`).
- **A-05 Alta:** `IGridTopology.Edges`, `GridShape`, `GridHit`, `Polygon2D`, `RectD` no poseen semántica de borde/inclusión, precisión ni tolerancias (`PM-04:46-74`).
- **A-06 Alta:** isométrico escalonado/oblicuo está descrito, no formalizado con transformaciones inversas o fixtures (`PM-04:87-102`).
- **M-02 Media:** orden isométrico admite overrides, pero no define persistencia, rango ni resolución de solapes parciales (`PM-04:170-178`; `PM-10:79-81`).
- **M-03 Media:** elevación puede afectar proyección/navegación/bordes, pero no se define unidad ni relación con `C`, layer o baseline (`PM-04:180-182`).

## 6. Auditoría PM-05: modelo y persistencia

### Contratos válidos

- IDs estables, independientes de orden y textura; células identificadas por mapa/capa/coordenada (`PM-05:48-60`).
- Chunks como unidad de almacenamiento, invalidación y streaming; vacío no materializado (`PM-05:110-114`).
- Propiedades desconocidas conservadas en round-trip (`PM-05:132-141`).
- Carpeta de proyecto separa fuentes, cache y autosave (`PM-05:158-173`).
- Guardado temporal, validación, sync, rename, backup y dirty-state posterior al éxito (`PM-05:190-201`).
- Migraciones versionadas, reportadas y probadas como cadenas completas (`PM-05:207-218`).
- Carga impone límites y evita path traversal/bombas (`PM-05:224-233`).

### Huecos

- **B-03 Bloqueante:** formato es solo recomendación; no existe JSON Schema/esquema binario, canonicalización byte a byte, codificación, orden de propiedades, normalización de rutas, NaN/Infinity, números, fechas o extensiones desconocidas (`PM-05:158-188,220-222`). REQ-IO-001 exige esquema documentado y migraciones (`PM-02:124`).
- **B-04 Bloqueante:** transacción multifichero ofrece dos alternativas sin elegir ni definir recovery state machine (`PM-05:190-205`). El rename atómico individual no garantiza atomicidad del proyecto.
- **A-07 Alta:** 128 bits “o equivalente” deja representación y generación abiertas; falta detección/resolución de colisiones, namespace, casing y orden canónico (`PM-05:48-60`).
- **A-08 Alta:** chunk size configurable “dentro de límites”, pero faltan límites, cambio de tamaño/migración, encoding por tipo de capa y hashing (`PM-05:110-114`).
- **A-09 Alta:** estrategia JSON+binario no define vinculación transaccional, integridad, endianness, compresión, checksums o compatibilidad (`PM-05:173`).
- **A-10 Alta:** autosave no especifica ubicación por SO, cifrado/privacidad, cuota, TTL, resolución de cambios externos ni recuperación de múltiples documentos (`PM-05:203-205`; REQ-PROJ-003/005 en `PM-02:48-50`).
- **M-04 Media:** backup rotativo carece de cantidad, cuota, momento de purga y UX de restauración (`PM-05:198,203-205`).
- **M-05 Media:** “propiedad desconocida se conserva” no define modificación segura cuando el nodo padre cambia ni límites por valor (`PM-05:132-141`).

## 7. Auditoría PM-07: reglas, Wang y autotiling

### Contratos válidos

- Capacidad incremental por topología, con bitmasks 4/8/6 (`PM-07:33-55`).
- Condiciones serializables sin código arbitrario (`PM-07:83-96`).
- Orden determinista de conflictos y desempate por ID estable (`PM-07:126-137`), alineado con REQ-RULE-005 (`PM-02:93`).
- Invalida por métrica topológica y aplica delta atómico (`PM-07:145-157`).
- Manual no se reemplaza por defecto y autoría explícita (`PM-07:170-181`).
- Aleatoriedad local por hash evita deriva global (`PM-07:183-191`).

### Huecos

- **B-05 Bloqueante para Fase 3:** semántica formal de condiciones ausente: `EMPTY` vs fuera de mapa, `OUTSIDE` finito/infinito, null/desconocido, lectura de capa ausente, ciclos y evaluación de `SAME_AS` (`PM-07:83-96`).
- **A-11 Alta:** “especificidad” y “alcance” no tienen fórmula; dos implementaciones compatibles podrían elegir distinto (`PM-07:126-135`).
- **A-12 Alta:** fases pueden leer original/anterior/ambos, pero no existe grafo formal de dependencias, convergencia, límite de iteraciones ni semántica de escrituras multi-capa (`PM-07:111-124,206-214`).
- **A-13 Alta:** footprint/invalidation no cubre salidas que crean objetos, shapes o efectos fuera del radio de lectura (`PM-07:98-109,145-157`).
- **M-06 Media:** hash reproducible no fija algoritmo, serialización de inputs ni estabilidad entre versiones/plataformas (`PM-07:183-191`).
- **M-07 Media:** pesos inválidos se diagnostican, pero faltan reglas para cero, negativos, NaN y suma cero (`PM-07:126-135,206-214`).

## 8. Auditoría PM-08: generación procedural

### Contratos válidos

- Generador declara parámetros, topologías, entradas/salidas, coste y preview (`PM-08:33-46`).
- Request incluye snapshot, máscaras, preset, restricciones y presupuesto (`PM-08:48-59`).
- Streams separados/versionados garantizan aislamiento de aleatoriedad (`PM-08:61-69`).
- Pipeline separa mapa semántico de reglas visuales (`PM-08:71-81`).
- Preview no muta; aceptar crea un comando (`PM-08:170-174`).
- Métricas y property tests previstos (`PM-08:196-215`).

### Huecos

- **A-14 Alta:** `Plan` es síncrono y no recibe cancelación; no se define si puede ser costoso ni qué congela respecto del snapshot (`PM-08:33-46`).
- **A-15 Alta:** presupuesto de tiempo/intentos no define comportamiento al vencer: resultado parcial, fallo, mejor candidato o diagnóstico (`PM-08:48-59`).
- **A-16 Alta:** reparación determinista puede “relajar umbral”, pero no distingue restricciones duras/blandas ni exige consentimiento para degradar garantías (`PM-08:143-168`).
- **M-08 Media:** streams por nombre/versión no fijan PRNG, derivación, rango, serialización ni compatibilidad multiplataforma (`PM-08:61-69`).
- **M-09 Media:** composición declara inputs/outputs, pero falta sistema de tipos, DAG/ciclos, cacheabilidad, versionado de nodos y propagación de diagnósticos (`PM-08:117-130`).
- **M-10 Media:** lista amplia de algoritmos en REQ-PCG-002 (`PM-02:101-106`) no coincide exactamente con Fase 5: Voronoi y Poisson quedan fuera del roadmap (`PM-14:89-97`). Como PM-02 manda, PM-14 debe explicitar diferimiento o fase.

## 9. Auditoría PM-09: WFC

### Contratos válidos

- WFC no sustituye estructura ni garantías globales (`PM-09:29-31,221-223`).
- Modelos Simple Tiled y Overlapping claramente separados (`PM-09:35-43`).
- Bitsets, supports, heap versionado y trail evitan copias completas (`PM-09:45-61,73-105,119-132`).
- Inicialización imposible falla sin reinicios ciegos (`PM-09:63-71`).
- Completion localizada preserva exterior/bloqueados (`PM-09:189-191`).
- Paraleliza variantes, no wave compartida (`PM-09:207-219`).

### Huecos

- **A-17 Alta:** política normal de contradicción es “robusta y limitada” sin orden, límites de backtracks/restarts/tiempo ni resultado al agotarse (`PM-09:107-117`).
- **A-18 Alta:** entropía con pesos no define pesos cero/negativos/NaN, precisión flotante ni método reproducible de selección (`PM-09:73-85`). REQ-WFC-003 exige reproducción por semilla (`PM-02:114`).
- **A-19 Alta:** topologías no rectangulares y dirección opuesta no están formalizadas para compatibilidad/support counters (`PM-09:57-60,87-105`).
- **A-20 Alta:** restricciones blandas alteran fitness/pesos, pero no define interacción con backtracking, relajación y determinismo (`PM-09:134-151`).
- **M-11 Media:** Overlapping no fija tratamiento de bordes, wrap, N par, tile central, simetrías o frecuencia tras transformaciones (`PM-09:153-174`).
- **M-12 Media:** diagnóstico causal detallado tiene “mayor coste” sin cuota de memoria o degradación (`PM-09:107-117,193-205`).
- **M-13 Media:** API devuelve estado y delta, pero ownership/disposal de buffers, parcialidad y compatibilidad de revisión no están expresados (`PM-09:225-236`).

## 10. Auditoría PM-10: render, rendimiento y concurrencia

### Contratos válidos

- Pipeline visible y cacheado por chunks (`PM-10:33-45,67-69`).
- Cámara en doble precisión y transformación cerca del origen de viewport (`PM-10:47-49`).
- Batching respeta límites semánticos (`PM-10:55-57`).
- Workers, snapshots, revisión base, cancelación/coalescing (`PM-10:95-110`).
- Caches purgables y memoria instrumentada (`PM-10:112-121`).
- Escenas cubren ortogonal, iso, hex, infinito, reglas y WFC (`PM-10:148-155`).

### Huecos y contradicciones

- **B-06 Bloqueante:** objetivos 60 FPS y p95 <16,7 ms no tienen máquina, SO, GPU/API, resolución, DPI, tamaño/densidad de escena, estado de caché ni ventana de muestreo (`PM-02:135`; `PM-10:83-94,148-155`).
- **B-07 Bloqueante:** stack/renderer está abierto (`PM-03:195-199,205-211`), pero decisiones de atlas, batching, accesibilidad y automatización dependen de él. Es trabajo central de Fase 0 (`PM-14:33-42`).
- **A-21 Alta:** `frame p95 <16,7 ms` deja 5% de frames por encima del umbral y no controla stutter. Añadir p99 y máximo de pausa/1% low.
- **A-22 Alta:** “feedback mismo frame” es ambiguo sin frecuencia de input, VSync y separación feedback/commit (`PM-10:87-90`).
- **A-23 Alta:** memoria solo “proporcional” carece de techo absoluto, presupuesto por subsistema y comportamiento ante presión (`PM-10:91,112-121`).
- **A-24 Alta:** cache visual con sprites sobresalientes no define bounds máximos ni invalidación de animación/asset reload (`PM-10:67-77`).
- **M-14 Media:** culling deja quadtree/R-tree/BVH a medición, correcto para Fase 0, pero requiere corpus y criterio de selección (`PM-10:51-53`).
- **M-15 Media:** carga lazy y reescritura de archivos pequeños no define umbral ni coordinación con guardado/autosave (`PM-10:131-133`).

## 11. Matriz y máquina de benchmark inicial recomendadas

Decisión provisional para Fase 0, sujeta a ADR y medición real:

| Clase | Plataforma | Hardware/entorno | Uso |
|---|---|---|---|
| **Baseline obligatoria** | Windows 11 x64 | 4C/8T, iGPU compatible con API elegida, 16 GB RAM, NVMe; 1920×1080 100% | Puerta de rendimiento; representa equipo modesto vigente. |
| **Referencia desarrollo** | Windows 11 x64 | 8C/16T, GPU discreta de gama media, 32 GB, NVMe; 2560×1440 | Perfilado diario, no sustituye baseline. |
| **Compatibilidad** | Ubuntu LTS x64 | 4C/8T, Mesa/iGPU, 16 GB | Validar framework, archivos, rutas, input y renderer. |
| **Compatibilidad** | macOS soportado por framework | Apple Silicon base, 16 GB; Retina escalada | Validar packaging, Metal, HiDPI y accesibilidad. |
| **Variación visual** | baseline Windows | 4K a 150/200%, monitor 60 Hz | HiDPI, zoom fraccionario, bleeding y legibilidad. |

La máquina baseline debe fijarse por modelo real antes de congelar presupuestos. Si solo se dispone de una máquina, registrar CPU, GPU/driver, RAM/velocidad, disco, SO/build, energía, resolución/DPI, runtime, commit y temperatura; ejecutar en frío y caliente. No comprar hardware antes de seleccionar stack.

Corpus mínimo:

| Escena | Parámetros que deben congelarse |
|---|---|
| Ortogonal medio | 256×256, 4 capas densas, tiles 32 px, 10% animados. |
| Ortogonal infinito | 1.000 chunks materializados dispersos, coordenadas negativas/extremas, 5% visibles. |
| Isométrico | 256×256, 2 tile layers, 10.000 objetos altos, paralaje. |
| Hex | radio 256, 3 capas, navegación + grid overlay. |
| Reglas | al menos 1.000 reglas, patrones 3×3 y 7×7, edición de 1/100/10.000 celdas. |
| WFC | 128×128 y 256×256; catálogos 64/256/1.024 patrones; compatibilidad densa/esparsa; soluble/imposible. |
| Persistencia | proyectos 10 MB/100 MB/1 GB, frío/caliente, fallo inyectado en cada fase. |

Métricas: frame p50/p95/p99, peor pausa, input-to-feedback, commit, apertura time-to-interactive, memoria residente/pico/asignaciones, draw calls, chunks reconstruidos, throughput, cancel latency, backtracks y tamaño en disco. Cada benchmark debe repetir, guardar raw data y fallar CI por regresión acordada, no por ruido de una muestra.

## 12. Registro consolidado de bloqueos

| ID | Severidad | Hallazgo | Cierre exigido |
|---|---|---|---|
| B-01 | Bloqueante | Hilo de documento/dispatcher no especificado. | ADR threading + spike de input/job/commit/cancelación. |
| B-02 | Bloqueante | Convenciones espaciales y `SpatialConfiguration` incompletas. | Contrato de coordenadas + fixtures ortho/iso/hex/negativas. |
| B-03 | Bloqueante | Formato v0 sin esquema/canonicalización. | Esquema experimental, corpus y round-trip canónico. |
| B-04 | Bloqueante | Atomicidad multifichero sin protocolo elegido. | ADR journal vs manifest generations + fault injection. |
| B-05 | Bloqueante F3 | Semántica de reglas no formalizada. | Especificación ejecutable y casos exhaustivos. |
| B-06 | Bloqueante | Presupuestos no reproducibles. | Máquina/corpus/harness fijados. |
| B-07 | Bloqueante | Stack y renderer sin elegir. | Spikes comparables + ADR-001. |
| B-08 | Bloqueante | Estado “base aprobable” contradice decisiones abiertas. | Cambiar a “borrador auditado / Fase 0” hasta ADR aceptados. |

## 13. ADR candidatos y orden de cierre

1. **ADR-001 Stack de escritorio, renderer y plataformas.** Comparar al menos dos candidatos con viewport, input, HiDPI, accesibilidad, automatización y packaging; requerido por `PM-03:195-199` y `PM-14:37`.
2. **ADR-002 Modelo de threading y scheduler.** Dispatcher de documento, UI affinity, snapshots, stale results, eventos, cancelación y backpressure.
3. **ADR-003 Formato de proyecto v0.** Carpeta, esquema, IDs, canonicalización, chunks/binarios, extensiones y compatibilidad.
4. **ADR-004 Guardado multifichero, autosave y recuperación.** Protocolo, fsync, journal/generaciones, backups, cambio externo y pruebas de fallo.
5. **ADR-005 Contrato espacial v1.** Ejes, unidades, direcciones canónicas, precisión, tolerancias, chunking, elevación y fixtures.
6. **ADR-006 Determinismo multiplataforma.** PRNG, hash, float, seeds/streams, versionado y definición de reproducibilidad para reglas/PCG/WFC.
7. **ADR-007 Benchmark y presupuestos.** Máquina, corpus, harness, métricas, ruido/regresión y CI dedicada.
8. **ADR-008 Semántica del motor de reglas.** Condiciones, fases, DAG, conflicto, footprint, procedencia y límites.
9. **ADR-009 Política WFC.** Pesos, contradicción, límites, parcialidad, diagnósticos y memoria.
10. **ADR-010 Historial de comandos.** Sesión vs persistente, coalescing, cuota y compatibilidad con formato; abierto en `PM-03:210`.

ADR-001 a ADR-007 deben cerrarse durante Fase 0. ADR-008/009 pueden quedar propuestos con spikes, pero deben aceptarse antes de Fases 3/6. ADR-010 debe decidirse antes de congelar Fase 1 porque REQ-EDIT-004 solo exige persistencia durante sesión (`PM-02:71`) y no justifica historial entre sesiones.

## 14. Puerta de salida de Fase 0

Fase 0 termina solo con evidencia ejecutable:

- Repositorio privado, CI y licencia decidida; PM-14 lo exige (`PM-14:42,302`).
- Aplicación spike instalable que abre una ventana y permite paneo/zoom/picking/pintura sobre escena ortogonal; variantes iso/hex prueban transformaciones, aunque no sean producto.
- Harness headless para coordenadas, chunks negativos, comandos, round-trip, fault injection y benchmark.
- Formato v0 marcado experimental, esquema versionado y migración de fixture anterior simulada.
- Demostración de job cancelable sobre snapshot y rechazo limpio de resultado obsoleto.
- Baseline de frame, input, memoria, apertura, guardado y WFC sintético en máquina documentada.
- ADR-001 a ADR-007 aceptados; cada uno con reversión y evidencia según plantilla (`PM-14:157-188`).
- Proyecto ejemplo versionado y guion de prueba manual de 10–15 minutos.
- Cero pérdida ante fallo de guardado inyectado; round-trip conserva IDs y contenido, como exige REQ-PROJ-001/REQ-NFR-005 (`PM-02:46,139`).

## 15. Ajuste recomendado del roadmap para ejecución manual por fase

PM-14 ya exige slices ejecutables (`PM-14:29-31`). Convertir cada cierre desde Fase 1 en puerta explícita:

1. Build instalable/versionado para plataformas activas.
2. Proyecto ejemplo y guion manual reproducible.
3. Smoke automatizado equivalente al camino manual esencial.
4. Evidencia: captura/log/reporte, defectos hallados y métricas.
5. Revisión de regresión contra fase anterior.
6. Decisión humana: avanzar, corregir o recortar; no avanzar con pérdida de datos, crash reproducible o requisito P0 roto.

Aplicación concreta:

- **F1:** crear, pintar, capas, undo/redo, guardar/reabrir, CSV/PNG (`PM-14:44-55`).
- **F2:** objetos, chunks negativos, autosave/recovery y CLI (`PM-14:57-66`).
- **F3:** editar semántica, aplicar reglas, inspeccionar procedencia y regenerar local (`PM-14:68-77`).
- **F4:** abrir/probar proyecto iso, staggered y hex con picking/orden (`PM-14:79-87`).
- **F5:** preview/cancelar/aceptar PCG, repetir semilla y validar (`PM-14:89-97`).
- **F6:** completar con WFC, forzar contradicción y explicar causa (`PM-14:99-108`).
- **F7:** round-trip declarado y rechazo seguro de plugin incompatible (`PM-14:110-116`; `PM-02:125,128`).

## 16. Conclusión

No hay contradicción estructural fatal entre PM-03/04/05/07/08/09/10. El diseño comparte un núcleo consistente: intención semántica, estado autoritativo único, operaciones por deltas y derivados reconstruibles. Problema no es dirección; es falta de decisiones cerradas y magnitudes verificables. Fase 0 debe tratarse como laboratorio con productos de evidencia, no como inicio informal de implementación. Cumplida puerta §14, arquitectura puede pasar a `GO` para Fase 1; antes, riesgo de fijar formato, threading o renderer por accidente es alto.

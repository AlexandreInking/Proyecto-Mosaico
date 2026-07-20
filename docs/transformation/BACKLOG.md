# Backlog ejecutable de transformación

**Estado:** Propuesto. IDs estables `TRN-*`.

| ID | Fase | Tarea | Dependencias | Verificación |
|---|---|---|---|---|
| TRN-001 | T0 | Crear workspace npm y carpetas `Shared`, `DesktopApp`, `WebApp` | ADR-003 aprobado | build de tres workspaces |
| TRN-002 | T0 | Definir schemas Asset/Recipe/Job/Diagnostic | TRN-001 | schema tests y fixtures inválidos |
| TRN-003 | T0 | Crear puertos de plataforma y fakes | TRN-002 | contract tests |
| TRN-004 | T0 | Crear shell React y tokens compartidos | TRN-001 | visual smoke Web/Desktop |
| TRN-005 | T0 | Integrar Tauri 2 | TRN-003/004 | app desktop arranca offline |
| TRN-006 | T0 | Crear AdonisJS API health/capabilities | TRN-003 | API test |
| TRN-007 | T0 | Reubicar WPF como LegacyWpf | TRN-001 | 36 Core + 14 WPF + launcher |
| TRN-008 | T0 | Crear gate dual y guía manual T0 | TRN-004/005/006/007 | gate reproducible |
| TRN-101 | T1 | Importar imagen por adapters | T0 | mismo fixture/metadata |
| TRN-102 | T1 | Catálogo, hash y thumbnails | TRN-101 | golden manifest |
| TRN-103 | T1 | Motor de recetas DAG | TRN-002 | orden/ciclo/cancel tests |
| TRN-104 | T1 | Resize/conversión/export | TRN-103 | golden images + tolerancia |
| TRN-105 | T1 | Consola agrupada y progreso | TRN-103 | agrupación/cancelación |
| TRN-106 | T1 | Persistencia local y web temporal | TRN-101/103 | reopen round-trip |
| TRN-201 | T2 | Portar viewport PixiJS | T0 | clip/picking/HiDPI tests |
| TRN-202 | T2 | Adaptar formato `.mosaico` | TRN-002 | fixture F1 round-trip |
| TRN-203 | T2 | Portar layers/tilesets/tools | TRN-201/202 | walkthrough MG-02 |
| TRN-204 | T2 | Gate de paridad y deprecación WPF | TRN-203 | oracle + aprobación humana |
| TRN-301 | T3 | Background removal adapter | T1 | mask fixtures |
| TRN-302 | T3 | Upscale adapter | T1 | quality/perf corpus |
| TRN-303 | T3 | Atlas/bleed protection | T1 | deterministic atlas |
| TRN-304 | T3 | Texture profiles | TRN-303 | engine smoke |
| TRN-401 | T4 | Reglas y autotiling | T2 | incremental equivalence |
| TRN-402 | T4 | Generadores deterministas | TRN-401 | seed corpus |
| TRN-403 | T4 | WFC Simple Tiled | TRN-401 | contradiction corpus |
| TRN-404 | T4 | Isométrico | TRN-201 | projection/picking tests |
| TRN-405 | T4 | Hexagonal | TRN-201 | neighbor/projection tests |
| TRN-501 | T5 | WorldBible + ContentGraph | T0 | schema/reference tests |
| TRN-502 | T5 | IA provider adapter | TRN-501 | fake provider + invalid JSON |
| TRN-503 | T5 | Ciudad/mapa estructurado | TRN-402/502 | connectivity simulation |
| TRN-504 | T5 | Quest/diálogo | TRN-502 | reachability/branch tests |
| TRN-505 | T5 | Economía/skills | TRN-502 | cycle/balance tests |
| TRN-506 | T5 | Diff, bloqueos y aceptación parcial | TRN-503/504/505 | undo/provenance tests |
| TRN-601 | T6 | glTF inspect/validate | T1 | conformance fixtures |
| TRN-602 | T6 | Optimize/compress | TRN-601 | engine smoke + size report |
| TRN-603 | T6 | LOD pipeline | TRN-601 | geometric error report |
| TRN-701 | T7 | Audio inspect/waveform | T1 | metadata fixtures |
| TRN-702 | T7 | Transform/convert/loop | TRN-701 | loudness/loop tests |
| TRN-801 | T8 | Auth/project DB/object store | T1 | isolation integration tests |
| TRN-802 | T8 | Durable worker queue | TRN-801 | restart/idempotency tests |
| TRN-803 | T8 | Retention/export/delete | TRN-801 | privacy walkthrough |

## Definition of Ready

- Requisito y riesgo enlazados.
- Fixture legal y versionado disponible.
- Contrato de entrada/salida y pérdida definido.
- UI, Desktop y Web impactados identificados.
- Criterio automático y guion manual escritos antes del código.

## Definition of Done

- Cambio integrado en ambas superficies o capacidad marcada honestamente.
- Tests y gate de fase verdes.
- Operación cancelable y recuperable.
- Procedencia y diagnóstico visibles.
- Documentación y licencias actualizadas.
- Usuario recibe mensaje exacto de qué revisar.


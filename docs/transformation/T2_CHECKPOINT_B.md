# Evidencia T2 — Checkpoint B

**Estado:** PASS técnico
**Fecha:** 21 de julio de 2026
**Commit de cierre técnico:** `138efc5`

## Alcance verificado

- Registro versionado de comandos mapa/sprite con schemas, capacidades y procedencia.
- Stroke, fill, capas y tilesets pasan por transacciones con historial acotado.
- Undo/redo restaura fingerprint semántico exacto.
- JSON canónico mapa v2 y sprite v1; round-trip estable.
- Lector mapa acepta v2 y migra manifiesto WPF v1.
- Migración preserva IDs, orden, referencias conocidas y tiles huérfanos.
- Límites, rutas peligrosas, JSON corrupto y metadata inconsistente se rechazan.
- Store compartido memoria/IndexedDB; autosave y confirmado usan mismo contrato.
- Recovery elige mayor revisión válida; snapshot corrupto o canal fallido no reemplaza confirmado.

## Evidencia automatizada

| Gate | Resultado |
|---|---:|
| Estructurales T0/T1 | 9/9 PASS |
| Shared contracts/domain/pipeline/ui/persistence | 56/56 PASS |
| Typecheck packages | 8/8 PASS |
| Build WebApp | PASS |
| Build DesktopApp | PASS |
| Build Web API | PASS |

Pruebas nuevas de Ola B: 7 command/history, 7 serialization/migration y 5 persistence/recovery.

## Browser real

Chrome headless con perfil temporal y origen localhost ejecutó `IndexedDbAuthoringStore`:

1. write autosave;
2. read y comparar revisión/payload;
3. delete;
4. read confirma ausencia.

Resultado observado por CDP: `{"title":"PASS INDEXEDDB","body":"PASS INDEXEDDB"}`.

## Gate

- Guardar/reabrir conserva fingerprint: PASS.
- Recovery elige última revisión válida: PASS.
- Crear documentos sin canvas final: PASS mediante dominio ejecutable y fixtures.
- Ola C no iniciada; requiere autorización del propietario.

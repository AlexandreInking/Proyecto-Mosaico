# Checkpoint F1: editor ortogonal por tiles

**Fecha:** 2026-07-19  
**Estado automático:** PASS de desarrollo  
**Estado humano:** PENDING_HUMAN

## Evidencia automática

- Build Release: 0 errores, 0 advertencias.
- Core: 36/36 pruebas.
- WPF: 14/14 pruebas, incluidos clipping, culling visible, tema oscuro, atomicidad, tabs, paginación, marcador de tile huérfano y consola agrupada.
- Export fixture SHA-256: `08C7CD8D11BB891E9DC36A469A319DD7B06BAF764C71C547AD70CB8D2A89A13C`.
- Unity 6.3.11f1 batchmode: exit 0, `MOSAICO_IMPORT_SMOKE_PASS`.
- Importación real: mapa 16×10, 2 capas, 163 celdas, 3 texturas, 13 sprites y 13 tiles.
- UI inspeccionada con mapa real: paleta, panel de capas, tiles 8/16/64, overhang y clipping.

## Frontera comercial

Editor gratuito: `Proyecto_Mosaico`.  
Importador propietario: repositorio hermano `Proyecto_Mosaico_Unity_Importer`.

El importador no usa red, telemetría, DRM ni ejecución de contenido del bundle. Valida paths ZIP, límites, geometría y SHA-256.

## Gate restante

Ejecutar `scripts/phase1-gate.ps1` sobre commit limpio y completar `docs/manual/MG-02-editor-tilemaps.md`. F2 permanece cerrada hasta `PASS` humano.

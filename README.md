# Proyecto Mosaico — Documentación y gobernanza

Este repositorio contiene la documentación técnica y de producto de Proyecto Mosaico. Ola 1 está cerrada y Fase 0 está autorizada de forma condicionada para spikes descartables; Fase 1 todavía no está aprobada.

## Contenido

- `documentos/`: quince capítulos canónicos, numerados del 00 al 14. Toda edición normativa empieza aquí.
- `Proyecto_Mosaico_Dossier_Completo.md`: artefacto generado desde los capítulos; no editar directamente.
- `diagramas/`: diagramas en PNG y sus fuentes Graphviz `.dot`.
- `analisis_documental/`: inventario, trazabilidad, auditorías, backlog y dictamen.
- `tools/docs/` y `tests/docs/`: generación y verificaciones documentales reproducibles.

## Verificación

Requiere Python 3.11 o posterior. El generador y los validadores usan solo biblioteca estándar. El render PDF y su prueba requieren las dependencias de `requirements-docs.txt`.

```text
python -m unittest discover -s tests/docs -v
python tools/docs/build_dossier.py
python tools/docs/build_dossier.py --check
python tools/docs/check_docs.py
python tools/docs/check_traceability.py
python tools/docs/render_pdf.py
```

El primer comando prueba la lógica. Los dos siguientes regeneran y comprueban el dossier. Los validadores rechazan rutas no portables, metadatos incoherentes y trazabilidad incompleta. El último genera `output/pdf/Proyecto_Mosaico_Dossier_Completo.pdf`.

## Orden de lectura recomendado

1. `00_Indice_Maestro_y_Gobernanza.md`
2. `01_Vision_Producto_y_Alcance.md`
3. `02_Especificacion_de_Requisitos.md`
4. `03_Arquitectura_de_Software.md`
5. Continúe en orden numérico hasta el documento 14.

Los capítulos son la fuente de verdad. Cambios de requisitos, arquitectura, formato, seguridad o gates requieren la autoridad definida en PM-00.

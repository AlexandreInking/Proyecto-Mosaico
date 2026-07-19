# Plan de implementación: Fase 1

## Orden

1. Contratos, fixtures y modelo.
2. Comandos reversibles y capas.
3. Persistencia segura.
4. Shell, tilesets, paleta y viewport.
5. Export neutral.
6. Importador Unity separado y smoke real.
7. Gate automático y walkthrough humano.

## Tareas

- [x] T1 — Schema y fixtures propios
  - Aceptación: atlas 8×8, 16×16, rectangular y tile grande tienen oracle de slicing.
  - Verificación: entradas/rutas/IDs inválidos fallan.

- [x] T2 — Dominio tilesets/capas
  - Aceptación: IDs estables, múltiples tilesets y orden/visibilidad/locking.
  - Verificación: pruebas RED/GREEN y hash determinista.

- [x] T3 — Edición reversible
  - Aceptación: pincel, borrador, fill, selección y operaciones de capa restauran hash con undo/redo.
  - Verificación: pruebas unitarias y secuencia combinada.

- [x] T4 — Persistencia `.mosaico`
  - Aceptación: round-trip conserva semántica/assets; ZIP hostil no muta destino.
  - Verificación: integración y fault injection básico.

- [x] T5 — Iconos Lucide y shell oscuro
  - Aceptación: toolbar iconográfica, menús textuales, docks y accesibilidad.
  - Verificación: prueba WPF y render 100/150/200%.

- [x] T6 — Importar tilesets y paleta
  - Aceptación: preview valida corte; paleta muestra miniaturas reales/IDs.
  - Verificación: fixtures con tamaños distintos.

- [x] T7 — Canvas y capas
  - Aceptación: render por orden, overhang, herramientas y panel de capas completos.
  - Verificación: pruebas + walkthrough parcial ejecutable.

- [x] T8 — Export `.mosaicpack`
  - Aceptación: bundle determinista, atomizado y sin código.
  - Verificación: golden/hash y lector independiente.

- [x] T9 — Importador Unity comercial separado
  - Aceptación: package UPM privado convierte bundle a prefab Grid/Tilemaps.
  - Verificación: compilación Unity sin errores.

- [x] T10 — Smoke Unity real
  - Aceptación: Unity batchmode exit 0 y reporte PASS con capas, sprites y coordenadas.

- [ ] T11 — Gate F1 (automático PASS; walkthrough humano pendiente)
  - Aceptación: build/tests/export/smoke PASS; walkthrough manual queda `PENDING_HUMAN` hasta operador.

## Checkpoints ejecutables

- A: núcleo y pruebas Core.
- B: editor permite importar, pintar, capas, guardar y reabrir.
- C: export + importador Unity pasan smoke real.
- D: usuario ejecuta walkthrough; F2 solo abre tras PASS.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Atlas grandes congelan UI | Límites, culling y miniaturas bajo demanda |
| Undo consume memoria | Deltas, no snapshots completos |
| Tiles grandes solapan | Preview nativo y ancla explícita |
| ZIP malicioso | Límites y validación entry-by-entry |
| Importador se filtra | Repo privado hermano, sin submodule |
| Unity cambia API | 6000.3 LTS fijado y smoke batchmode |

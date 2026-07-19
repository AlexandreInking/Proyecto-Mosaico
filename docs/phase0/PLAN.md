# Plan de implementación: Ola 1 a spike manual F0

## Decisiones

- Slice vertical antes que subsistemas horizontales.
- WPF es harness descartable; núcleo no conoce UI.
- Formato JSON de un archivo es experimental; atomicidad multifichero queda abierta.
- Primer gate manual prueba solo capacidades realmente implementadas.
- Timeboxes: S0 ortogonal, una sesión; S1 semántico, dos días; S2 regeneración, dos días. Un spike que no produce evidencia dentro del límite termina en NO-GO o nuevo ADR, no en ampliación silenciosa.

## Tareas

### P1 — Cierre documental

- [ ] DOC-004: usuario, antiusuario y TR-01/TR-02/TR-03 en PM-01.
- [ ] DOC-005: contratos de métricas F0/F1.
- [ ] DOC-006: gate F0 idéntico en PM-01 y PM-14.
- [ ] DOC-007: 56 requisitos con prioridad aprobada y validador bidireccional.
- [ ] DOC-008: gate ejecutable por fase y MG-01.
- [ ] DOC-009: límites hostiles y política de scripts/plugins.

**Checkpoint O1:** validadores verdes; revisión Producto/UX, Arquitectura y QA/Seguridad; autorización ya dada por usuario para continuar hasta ejecutable manual.

### P2 — Contratos F0 mínimos

- [ ] ADR-001 condicionado para stack/renderer.
- [ ] Contrato espacial ortogonal y coordenadas negativas.
- [ ] Formato experimental de un archivo y estrategia atómica.
- [ ] Máquina/fixture/protocolo de benchmark registrados sin inventar hardware.

### P3 — Slice 1: dominio ortogonal

- [ ] RED: pruebas de celdas, coordenadas negativas y hash.
- [ ] GREEN: `MapDocument`, `GridCoordinate` y almacenamiento disperso.
- [ ] RED/GREEN: comando de pincelada y undo/redo.

**Checkpoint:** runner automático verde y build limpio.

### P4 — Slice 2: persistencia

- [ ] RED: round-trip conserva ID/celdas/hash.
- [ ] RED: entrada fuera de límites se rechaza sin mutar estado.
- [ ] GREEN: JSON v0 experimental y guardado atómico de archivo único.

**Checkpoint:** fixture golden, pruebas verdes y archivo reabrible.

### P5 — Slice 3: host manual

- [ ] Viewport con grid, picking, pan y zoom.
- [ ] Pincel/borrador, undo/redo y estado visible.
- [ ] Nuevo, abrir, guardar como y diagnóstico de error.
- [ ] Accesos por teclado y foco visible.

**Checkpoint:** build Release y walkthrough reducido MG-01.

### P6 — Evidencia y entrega

- [ ] Script de gate construye, prueba y lanza binario del mismo commit.
- [ ] Benchmark básico produce JSON con muestras y percentiles.
- [ ] Revisión manual/visual; cero S0/S1 conocidos.
- [ ] Commits atómicos, rama publicada e integración tras verificación.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| WPF se vuelve UI final por inercia | Asamblea separada, ADR condicionado y comparador obligatorio |
| Formato experimental se congela | Campo `formatVersion: 0`, fixtures marcados experimentales |
| Guardado se presenta como multifichero seguro | Limitar afirmación a archivo único y conservar ADR abierto |
| Gate manual excede capacidades | Walkthrough reducido ahora; MG-01 completo permanece gate F1 |
| Benchmark sin hardware | Registrar “no disponible” y no aprobar presupuesto hasta capturarlo |

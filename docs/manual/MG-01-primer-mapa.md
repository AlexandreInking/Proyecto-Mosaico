# MG-01: primer mapa ortogonal

**Estado:** reducido para spike F0; gate F1 completo pendiente
**Operador:** distinto del implementador para aprobación final

## Preparación

1. Confirmar checkout limpio; el script rechaza cambios sin versionar.
2. Ejecutar `powershell -ExecutionPolicy Bypass -File scripts/manual-gate.ps1` desde raíz.
3. Anotar Windows, resolución, escala y hardware disponible.
4. Usar ventana abierta por script o ejecutable indicado en `output/gate/gate-result.json`.

## Walkthrough reducido F0

1. Abrir `fixtures/phase0/sample.mosaic.json`; confirmar ID terminado en `4444`, cinco celdas y contenido negativo.
2. Crear mapa `Prueba Ñ` de 32×18.
3. Pintar patrón en coordenadas positivas.
4. Desplazar viewport y pintar en coordenadas negativas.
5. Mantener arrastre rápido para confirmar pincelada continua, sin huecos.
6. Cambiar a borrador y borrar una celda.
7. Ejecutar undo y redo desde botones y `Ctrl+Z`/`Ctrl+Y`; anotar hash antes/después.
8. Guardar como `prueba.mosaic.json`; anotar ID, hash y conteo.
9. Crear otro mapa y elegir **Cancelar** en aviso: documento anterior debe permanecer.
10. Repetir y elegir **No**: puede descartarse. Reabrir `prueba.mosaic.json`.
11. Confirmar mismo ID, tamaño, hash y celdas; cámara puede reencuadrarse.
12. Abrir `fixtures/phase0/invalid-null-cells.mosaic.json`; debe mostrar causa/acción sin crash ni reemplazar documento.
13. Probar `0` para encuadrar y confirmar foco visible alrededor del lienzo.

## Aceptación F0

- [ ] Viewport, pan, zoom y picking responden sin error visible.
- [ ] Coordenadas negativas corresponden a celda mostrada.
- [ ] Pincelada, undo y redo conservan hash esperado.
- [ ] Reapertura conserva ID y contenido.
- [ ] Error incluye recurso, causa y acción.
- [ ] Abrir no inicia red, procesos, scripts ni plugins.
- [ ] Atajos documentados funcionan sin capturar letras mientras se edita nombre.
- [ ] Cero S0/S1 conocido.

**Excepción F0:** pintura, pan y zoom espacial requieren mouse. `REQ-NFR-006` no se considera cumplido; permanece gate de Fase 1.

## Extensión obligatoria para gate F1

Importar sprite sheet versionado; fill; capas Ground/Details, bloqueo y orden; save/load completo; exportación CSV/PNG y golden files; modificación externa; path de exportación inválido; pasada 100/150/200 %; recorrido completo sin mouse cuando sea aplicable.

## Evidencia

Registrar resultado `PASS`, `FAIL` o `BLOCKED`, commit, toolchain, fixture/hash, comandos, exit codes, métricas, logs redactados, capturas de creación/reapertura y firma del operador. Si se corrige código, repetir gate completo.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/record-manual-result.ps1 `
  -Status PASS -Operator "Nombre" -Display "1920x1080 100%" -Notes "Resumen"
```

Evidencia automática y manual vive en `output/gate/gate-result.json`. Un `PASS` humano aprueba solo spike F0; no abre Fase 1.

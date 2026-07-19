# MG-01: primer mapa ortogonal

**Estado:** reducido para spike F0; gate F1 completo pendiente
**Operador:** distinto del implementador para aprobación final

## Preparación

1. Confirmar checkout limpio y anotar commit.
2. Ejecutar `powershell -ExecutionPolicy Bypass -File scripts/manual-gate.ps1`.
3. Anotar Windows, resolución, escala y hardware disponible.
4. Abrir el binario Release producido por ese comando.

## Walkthrough reducido F0

1. Crear mapa `Prueba Ñ` de 32×18.
2. Pintar patrón en coordenadas positivas.
3. Desplazar viewport y pintar en coordenadas negativas.
4. Mantener arrastre para confirmar una pincelada continua.
5. Cambiar a borrador y borrar una celda.
6. Ejecutar undo y redo desde botones y teclado.
7. Guardar como `prueba.mosaic.json`.
8. Cerrar y reabrir el archivo.
9. Confirmar mismo ID, tamaño y celdas; cámara puede reiniciarse.
10. Intentar abrir un JSON inválido y comprobar diagnóstico sin crash.

## Aceptación F0

- [ ] Viewport, pan, zoom y picking responden sin error visible.
- [ ] Coordenadas negativas corresponden a celda mostrada.
- [ ] Pincelada, undo y redo conservan hash esperado.
- [ ] Reapertura conserva ID y contenido.
- [ ] Error incluye recurso, causa y acción.
- [ ] Abrir no inicia red, procesos, scripts ni plugins.
- [ ] Flujo principal tiene alternativa por teclado.
- [ ] Cero S0/S1 conocido.

## Extensión obligatoria para gate F1

Importar sprite sheet versionado; fill; capas Ground/Details, bloqueo y orden; save/load completo; exportación CSV/PNG y golden files; modificación externa; path de exportación inválido; pasada 100/150/200 %; recorrido completo sin mouse cuando sea aplicable.

## Evidencia

Registrar resultado `PASS`, `FAIL` o `BLOCKED`, commit, toolchain, fixture/hash, comandos, exit codes, métricas, logs redactados, capturas de creación/reapertura y firma del operador. Si se corrige código, repetir gate completo.

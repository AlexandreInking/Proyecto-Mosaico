# MG-02: editor ortogonal por tiles

**Estado:** walkthrough humano F1 pendiente  
**Operador:** persona distinta del implementador  
**Regla:** Fase 2 no abre hasta registrar `PASS`

## Preparación

1. Confirmar que repositorios del editor y del importador Unity están en commits limpios. Gate formal rechaza cambios rastreados o no rastreados en cualquiera.
2. Desde la raíz, ejecutar sin `-AllowDirty` ni `-NoLaunch`:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/phase1-gate.ps1
   ```

3. Verificar `output/gate/phase1/gate-result.json`: `schema=mosaico-phase1-gate-v2`, `formal=true`, `automaticStatus=PASS` y `launchStatus=STARTED`.
4. Registrar versión de Windows, cuatro configuraciones de pantalla de matriz, escala y GPU.
5. Usar exclusivamente ejecutable abierto e indicado por gate. Este abre `fixtures/phase1/sample.mosaico` del paquete evaluado.
6. Confirmar que paquete contiene `sample.mosaico`, `sample.mosaicpack`, `atlas-8.png`, `atlas-16.png`, `atlas-large.png`, `atlas-rectangular.png` y `README.md`.
7. Confirmar que importador vive en repositorio hermano privado y no dentro del editor gratuito.

JSON automático liga prueba a commits del editor e importador; limpieza de ambos; hashes SHA-256 del EXE, DLL, fixtures, paquete publicado, paquete UPM y evidencia parseada de Core, WPF y Unity. `-AllowDirty` y `-NoLaunch` sirven solo para diagnóstico: resultado nunca admite registro humano.

## Recorrido editor

1. Confirmar menú textual y toolbar vertical con iconos, tooltips y foco visible.
2. En **Tilesets**, verificar `Terreno 16`, `Detalles 8` y `Edificio 64`.
3. En **Tiles**, seleccionar distintos IDs y comprobar miniatura/ID activo.
4. Importar `atlas-rectangular.png` como tiles de 16×8; confirmar preview de 6 tiles.
5. Pintar tiles 8×8, 16×16 y 64×64. Ninguno puede invadir menú, toolbar, paneles o status bar.
6. Verificar que tile 64×64 conserva tamaño, se ancla abajo a su celda y sobresale sobre celdas vecinas.
7. Crear capa `Prueba`; subirla, bajarla, ocultarla y bloquearla.
8. Con capa bloqueada, intentar pintar/borrar/fill: mapa no cambia y UI informa bloqueo.
9. Pintar varios tiles en `Prueba`, eliminar esa capa con icono papelera y confirmar que desaparece. `Ctrl+Z` debe restaurar capa, contenido, orden y estado; `Ctrl+Y` debe volver a eliminarla.
10. Usar selección rectangular. Ejecutar fill limitado, borrar selección, deshacer y rehacer cada operación.
11. Combinar pincel, borrador, picker, mano, zoom y `0` para encuadrar.
12. Guardar como `output/evidence/phase1/prueba-f1.mosaico`, cerrar/abrir y comprobar tilesets, capas, IDs, coordenadas y visibilidad.

## Qué revisar ahora: eliminación y consola

1. Reabrir `fixtures/phase1/sample.mosaico` desde paquete evaluado.
2. Seleccionar pestaña `Detalles 8` y pulsar papelera del panel Tilesets. Confirmar diálogo: celdas colocadas no deben borrarse.
3. Verificar que cada tile afectado se vuelve patrón magenta/negro con X blanca, siempre recortado al mapa y sin cubrir UI.
4. Abrir consola inferior. Debe mostrar **un grupo** `MISSING_TILESET`, no una fila por celda; badge debe indicar cantidad agregada y mostrar hasta cuatro ubicaciones de ejemplo.
5. Plegar y desplegar consola. Mapa debe recuperar espacio al plegarse.
6. Usar `Ctrl+Z`: pestaña, imágenes y tiles originales deben volver; consola debe quedar en `0 errores`. Usar `Ctrl+Y`: marcador y grupo deben reaparecer. Finalmente usar `Ctrl+Z` para restaurar.
7. Repetir eliminación, guardar como `output/evidence/phase1/tileset-huerfano.mosaico`, cerrar/reabrir. Marcadores y grupo deben persistir.
8. Intentar exportar proyecto huérfano: debe rechazarse con `PROJECT_HAS_ERRORS`; no debe producir bundle parcial.
9. Reabrir `sample.mosaico` original para continuar prueba normal.
10. Exportar dos veces dentro de `output/evidence/phase1/`; ambos archivos deben tener SHA-256 idéntico. No escribir evidencia manual fuera de `output/`, porque ensuciaría worktree y recorder la rechazaría.

## Recorrido Unity

1. Abrir Unity 6.3 LTS y un proyecto vacío real.
2. Instalar `Packages/com.proyectomosaico.unity-importer/package.json` mediante **Add package from disk**.
3. Copiar `.mosaicpack` dentro de `Assets/`.
4. Confirmar artefacto principal `Grid`, un `Tilemap` por capa y orden correcto.
5. Confirmar coordenada Mosaico `(8,5)` en Unity `(8,-5,0)` y sprite grande sin escalado.
6. Confirmar que capa oculta no renderiza y locking queda en `MosaicoMapMetadata`.
7. Desconectar red y reimportar: resultado debe ser idéntico.

## Matriz visual

- 1920×1080 a 100%.
- 1920×1080 a 150%.
- 2560×1440 o mayor a 100%.
- Ventana restaurada al tamaño mínimo permitido.

## Aceptación

- [ ] Sprite sheets se cortan con conteo, preview e IDs correctos.
- [ ] Paleta coloca tiles por `tilesetId + tileId`, no píxeles.
- [ ] Capas crean, ordenan, ocultan y bloquean correctamente.
- [ ] Capas y tilesets se eliminan con confirmación y undo/redo exacto.
- [ ] Tiles huérfanos tienen marcador visible; consola agrupa referencias similares y sobrevive reapertura.
- [ ] Exportación queda bloqueada mientras existan referencias huérfanas.
- [ ] Guardar/reabrir conserva assets y semántica.
- [ ] Selección, fill, borrador y undo/redo son exactos.
- [ ] Tiles grandes y canvas quedan recortados dentro de UI.
- [ ] Exportaciones repetidas son deterministas.
- [ ] Unity importa Grid/Tilemaps/sprites dentro de proyecto real.
- [ ] Atajos, tooltips, foco y contraste resultan utilizables.
- [ ] Cero defecto S0/S1 abierto.

Registrar `PASS`, `FAIL` o `BLOCKED`. Operador, display y notas siempre obligatorios. `PASS` exige al menos una captura; recomendado: una por configuración de matriz visual y una del resultado Unity:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/record-phase1-manual.ps1 `
  -Status PASS `
  -Operator "Nombre" `
  -Display "Windows 11; GPU RTX 3060; 1920x1080 100%; 1920x1080 150%; 2560x1440 100%; ventana mínima" `
  -Notes "Sin defectos S0/S1" `
  -Captures "output/evidence/phase1/1920-100.png","output/evidence/phase1/1920-150.png","output/evidence/phase1/2560-100.png","output/evidence/phase1/ventana-minima.png","output/evidence/phase1/unity.png"
```

Antes de escribir `manual-result.json`, script vuelve a comprobar worktrees, commits, cada archivo y manifiestos completos de ambos paquetes, fixtures y evidencia automática. También guarda tamaño y SHA-256 de cada captura. Archivo añadido, eliminado o modificado invalida registro. Si cambia código, importador, paquete o evidencia, repetir gate completo.

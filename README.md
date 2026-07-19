# Proyecto Mosaico

Editor gratuito de mapas por tiles para videojuegos. Fase 1 implementa mapas ortogonales con múltiples sprite sheets, capas, edición reversible y exportación neutral `.mosaicpack`.

**Estado:** gate automático F1 aprobado; walkthrough humano pendiente. Isométrico y hexagonal pertenecen a fases posteriores.

## Inicio rápido

Requiere Windows 10/11 y .NET SDK 10.0.300.

- Doble clic en `Abrir Mosaico.cmd` para abrir el paquete Release preparado.
- Desde código fuente:

  ```powershell
  dotnet run --project src/Mosaico.App/Mosaico.App.csproj -c Release
  ```

## Funciones F1

- Importación PNG con tamaño de tile, margen, espaciado y preview 2×2.
- Una pestaña compacta por tileset y pestaña `+` para importar otro.
- Tiles por `tilesetId + tileId` colocados en coordenadas de mapa; no editor de píxeles.
- Capas ordenables, visibles y bloqueables.
- Pincel, borrador, fill, picker, selección y undo/redo.
- Tamaño de celda configurable al crear mapa o después.
- Guardado `.mosaico` autocontenido y exportación determinista `.mosaicpack`.
- UI WPF oscura inspirada en editores gráficos, con menú textual e iconos Lucide.

Atajos principales: `Ctrl+N`, `Ctrl+O`, `Ctrl+S`, `Ctrl+Shift+S`, `Ctrl+Z`, `Ctrl+Y`, `M`, `B`, `E`, `G`, `I`, `H`, `Z`, `Delete`, `Escape` y `0` para encuadrar.

## Verificación F1

```powershell
dotnet build ProyectoMosaico.slnx -c Release
dotnet run --project tests/Mosaico.Core.Tests/Mosaico.Core.Tests.csproj -c Release
dotnet run --project tests/Mosaico.App.Tests/Mosaico.App.Tests.csproj -c Release
powershell -ExecutionPolicy Bypass -File scripts/phase1-gate.ps1
```

Gate exige worktree limpio, ejecuta 32 pruebas Core, 12 pruebas WPF, smoke real en Unity 6.3 y publica paquete ligado al commit. Seguir [MG-02](docs/manual/MG-02-editor-tilemaps.md) y registrar veredicto con:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/record-phase1-manual.ps1 `
  -Status PASS -Operator "Nombre" `
  -Display "1920x1080 100%; 1920x1080 150%; 2560x1440 100%; ventana mínima" `
  -Notes "Sin fallos" -Captures "output/evidence/phase1/captura.png"
```

## Arquitectura y negocio

- `src/Mosaico.Core/`: modelo, comandos, persistencia y exportación sin dependencia de WPF.
- `src/Mosaico.App/`: shell WPF, viewport, paletas y paneles.
- `tests/`: pruebas Core, WPF y benchmarks.
- `fixtures/phase1/`: mapas, bundles y atlas reproducibles.
- `docs/adr/ADR-002-export-and-unity-importer-boundary.md`: contrato editor/importadores.

Editor vive en repositorio privado durante desarrollo y se distribuirá gratis. Importador Unity es producto propietario separado, en repositorio privado independiente, pensado para distribución comercial. Bundle exportado no ejecuta código, scripts ni plugins.

## Documentación canónica

`documentos/` contiene quince capítulos normativos, numerados 00–14. `Proyecto_Mosaico_Dossier_Completo.md` es artefacto generado; no editar directamente. Verificación documental:

```text
python -m unittest discover -s tests/docs -v
python tools/docs/build_dossier.py --check
python tools/docs/check_docs.py
python tools/docs/check_traceability.py
```

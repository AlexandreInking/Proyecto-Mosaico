# Proyecto Mosaico

Plataforma en transformación para pipelines de assets y diseño procedural de videojuegos. Objetivo: preparar sprites, modelos y audio; optimizar, convertir, generar atlas/LOD; editar mapas; y generar contenido RPG estructurado mediante patrones, proceduralidad, WFC e IA validada.

**Estado:** Mosaico es una aplicación Desktop Windows descargable, local y offline, construida con Tauri 2. El editor WPF queda preservado como baseline histórico. `WebApp` permanece en el repositorio como superficie técnica no incluida en este producto ni en el Hito 1.1. Ver [Hito 1.1](docs/alpha-0.1/HITO_1_1.md), [auditoría](docs/alpha-0.1/AUDITORIA_HITO_1_1.md) y documentación histórica de [transformación](docs/transformation/PLAN.md).

## Dirección de producto

- `DesktopApp`: aplicación descargable para Windows, local y offline.
- `WebApp`: fuera del alcance del producto y del release Alpha 0.1.
- React/TypeScript dentro de Tauri 2; PixiJS para lienzos.
- IA genera mapas, ciudades, quests, diálogos, economía y árboles de habilidades como datos tipados. No genera imágenes.
- Pagos, DRM, suscripciones y servicios web quedan fuera de este hito.

## Descarga Desktop

- Instalador Windows: `DesktopApp/dist/mosaico-setup-0.2.20.exe`.
- Para regenerarlo: `pnpm installer:build`.
- `Mosaico.cmd` abre el binario Tauri compilado; no recompila ni inicia una webapp.

## Baseline WPF histórico

Requiere Windows 10/11 y .NET SDK 10.0.300.

- Doble clic en `Mosaico.cmd` para abrir el paquete Release preparado.
- Desde código fuente:

  ```powershell
  dotnet run --project DesktopApp/LegacyWpf/src/Mosaico.App/Mosaico.App.csproj -c Release
  ```

## Funciones F1

- Importación PNG con tamaño de tile, margen, espaciado y preview 2×2.
- Una pestaña compacta por tileset y pestaña `+` para importar otro.
- Tiles por `tilesetId + tileId` colocados en coordenadas de mapa; no editor de píxeles.
- Capas ordenables, visibles y bloqueables.
- Eliminación reversible de capas y tilesets. Tiles huérfanos muestran marcador magenta en vez de desaparecer.
- Consola inferior agrupa errores equivalentes por tileset ausente y muestra conteo total.
- Pincel, borrador, fill, picker, selección y undo/redo.
- Tamaño de celda configurable al crear mapa o después.
- Guardado `.mosaico` autocontenido y exportación determinista `.mosaicpack`.
- UI WPF oscura inspirada en editores gráficos, con menú textual e iconos Lucide.

Atajos principales: `Ctrl+N`, `Ctrl+O`, `Ctrl+S`, `Ctrl+Shift+S`, `Ctrl+Z`, `Ctrl+Y`, `M`, `B`, `E`, `G`, `I`, `H`, `Z`, `Delete`, `Escape` y `0` para encuadrar.

## Verificación F1

```powershell
dotnet build DesktopApp/LegacyWpf/ProyectoMosaico.slnx -c Release
dotnet run --project DesktopApp/LegacyWpf/tests/Mosaico.Core.Tests/Mosaico.Core.Tests.csproj -c Release
dotnet run --project DesktopApp/LegacyWpf/tests/Mosaico.App.Tests/Mosaico.App.Tests.csproj -c Release
powershell -ExecutionPolicy Bypass -File scripts/phase1-gate.ps1
```

Gate exige worktree limpio, ejecuta 36 pruebas Core, 14 pruebas WPF, smoke real en Unity 6.3 y publica paquete ligado al commit. Seguir [MG-02](docs/manual/MG-02-editor-tilemaps.md) y registrar veredicto con:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/record-phase1-manual.ps1 `
  -Status PASS -Operator "Nombre" `
  -Display "1920x1080 100%; 1920x1080 150%; 2560x1440 100%; ventana mínima" `
  -Notes "Sin fallos" -Captures "output/evidence/phase1/captura.png"
```

## Arquitectura actual y migración

- `DesktopApp/LegacyWpf/src/Mosaico.Core/`: modelo, comandos, persistencia y exportación del baseline.
- `DesktopApp/LegacyWpf/src/Mosaico.App/`: shell WPF conservado hasta paridad T2.
- `Shared/`: contratos y UI React consumidos por DesktopApp.
- `DesktopApp/app` + `DesktopApp/src-tauri`: entrada Vite y host local Tauri.
- `WebApp/client` + `WebApp/server`: superficie técnica no distribuida.
- `tests/`: pruebas Core, WPF y benchmarks.
- `fixtures/phase1/`: mapas, bundles y atlas reproducibles.
- `docs/adr/ADR-002-export-and-unity-importer-boundary.md`: contrato editor/importadores.

El baseline WPF conserva historial y compatibilidad de referencia; el producto actual se distribuye solo como Desktop Windows. Bundle exportado no ejecuta código, scripts ni plugins.

## Documentación canónica

`documentos/` contiene quince capítulos normativos, numerados 00–14. `Proyecto_Mosaico_Dossier_Completo.md` es artefacto generado; no editar directamente. Verificación documental:

```text
python -m unittest discover -s tests/docs -v
python tools/docs/build_dossier.py --check
python tools/docs/check_docs.py
python tools/docs/check_traceability.py
```

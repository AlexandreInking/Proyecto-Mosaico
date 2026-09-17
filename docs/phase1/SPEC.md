# Especificación ejecutable: Fase 1 — editor ortogonal por tiles

**Estado:** baseline histórico implementado; congelado durante transformación T0-T2

**Objetivo:** editor ortogonal utilizable con sprite sheets, tiles reales, capas, persistencia y exportación consumible mediante importador Unity separado

## Objetivo

Mosaico F1 permite importar uno o varios sprite sheets PNG, cortarlos en tiles, seleccionar tiles por ID y colocarlos en capas de un mapa ortogonal. El usuario puede editar, guardar, reabrir y exportar sin perder IDs ni coordenadas. El baseline exporta un bundle neutral; el importador Unity oficial permanece separado.

> Esta especificación no gobierna funciones nuevas. Sirve como oracle de paridad para `../transformation/PLAN.md`, Fase T2.

## Decisiones

- Host: WPF sobre `.NET 10`, Windows-only durante F1.
- Motor inicial: Unity 6.3 LTS `6000.3.11f1`, instalado localmente.
- Orientación F1: `orthogonal`; isométrico y hexagonal continúan en F4.
- Celda base del mapa: 8…2048 px por eje.
- Cada tileset define tile, margen y espaciado propios. Tiles grandes se anclan a una celda y pueden sobresalir sin escalar.
- Proyecto `.mosaico`: ZIP con `project.json` y PNG internos.
- Export `.mosaicpack`: ZIP determinista con `manifest.json` y PNG; nunca código ejecutable.
- Importador Unity: package UPM en repositorio privado separado. Sin DRM, telemetría ni red.
- Iconografía: Lucide, licencia ISC y procedencia incluidas.

## Modelo

- `MapProject`: ID, nombre, orientación, ancho/alto, tamaño de celda, tilesets, capas y capa activa.
- `TilesetDefinition`: ID estable, nombre, asset PNG, dimensiones, tile, margen, espaciado y conteo.
- `TileLayer`: ID estable, nombre, orden, visible, bloqueada y diccionario disperso `GridCoordinate → TileRef`.
- `TileRef`: `tilesetId + tileId`; ID local row-major desde cero.
- Slicing por eje: `floor((image - 2*margin + spacing) / (tile + spacing))`.

## Herramientas

- Selección rectangular y borrado de selección.
- Pincel, borrador y fill 4-conexo.
- Picker, mano y zoom 25%…800%.
- Una pincelada/fill/operación de capa es una transacción reversible.
- Capa bloqueada rechaza mutación; capa oculta no renderiza.
- Eliminar capa o tileset es reversible. Eliminar tileset conserva `TileRef` colocados como referencias huérfanas.
- Proyecto con referencias huérfanas puede guardarse/reabrirse para evitar pérdida silenciosa, pero no exportarse.

## UI

- Tema oscuro neutro inspirado en editores profesionales, sin copiar marca ni assets de Photoshop.
- Menú textual: Archivo, Editar, Mapa, Capa, Tileset, Exportar, Ayuda.
- Toolbar vertical compacta con iconos, tooltip, shortcut y `AutomationName`; sin texto visible.
- Centro: pestaña de documento y viewport recortado.
- Derecha: paleta Tiles/Tilesets y panel Capas con visibilidad, bloqueo, orden y eliminación.
- Inferior: consola plegable de errores agrupados; debajo, coordenada, zoom, capa activa, tile activo y estado.
- `TileRef` cuyo tileset no existe renderiza patrón magenta/negro con una X blanca, nunca vacío silencioso.
- Contraste WCAG AA, foco visible y comandos accesibles por teclado.

## Formatos y seguridad

Contenido `.mosaico`:

```text
project.mosaico
├── project.json
└── assets/<tileset-id>.png
```

Contenido `.mosaicpack`:

```text
map.mosaicpack
├── manifest.json
└── assets/<tileset-id>.png
```

- PNG únicamente en F1; validar firma, dimensiones, hash y tamaño.
- Máximo 64 MiB comprimidos y 16.777.216 píxeles decodificados por imagen; 4.096 tiles por tileset; 256 MiB por archivo; 64 tilesets; 256 capas; 1.000.000 de celdas ocupadas.
- Paleta muestra como máximo 256 tiles por página para acotar controles y bitmaps activos.
- Rechazar entradas ZIP absolutas, con drive, `..`, ADS o rutas ambiguas; leer entry-by-entry sin extraer libremente.
- Escritura temporal en mismo directorio, validación y reemplazo atómico.
- Coordenadas Mosaico: X derecha/Y abajo. Unity: `(x,y) → (x,-y,0)`.

## Contrato Unity

El `ScriptedImporter` comercial registra `.mosaicpack`, crea sprites mediante rects de textura, `Grid`, un `Tilemap` por capa y coloca tiles con `Tilemap.SetTile`. PPU inicial 100; `Grid.cellSize=(cellWidth/100,cellHeight/100,0)`.

Fuentes oficiales:

- https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AssetImporters.ScriptedImporter.html
- https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Tilemaps.Tilemap.SetTile.html
- https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Sprite.Create.html
- https://learn.microsoft.com/en-us/dotnet/standard/io/zip-tar-best-practices
- https://learn.microsoft.com/en-us/dotnet/desktop/wpf/controls/how-to-crop-an-image
- https://lucide.dev/license

## Comandos

```powershell
dotnet build DesktopApp/LegacyWpf/ProyectoMosaico.slnx -c Release
dotnet run --project DesktopApp/LegacyWpf/tests/Mosaico.Core.Tests/Mosaico.Core.Tests.csproj -c Release
dotnet run --project DesktopApp/LegacyWpf/tests/Mosaico.App.Tests/Mosaico.App.Tests.csproj -c Release
powershell -ExecutionPolicy Bypass -File scripts/phase1-gate.ps1
```

## Estructura

```text
DesktopApp/LegacyWpf/src/Mosaico.Core/  dominio, comandos y formatos
DesktopApp/LegacyWpf/src/Mosaico.App/   shell WPF, paleta, capas y viewport
assets/icons/lucide/       iconos + licencia
fixtures/phase1/           atlas y proyectos propios
tests/                     unitarias, integración y WPF
docs/phase1/               spec, plan y evidencia

Repositorio separado:
Proyecto_Mosaico_Unity_Importer/
├── Packages/com.proyectomosaico.unity-importer/
└── Tests/MosaicoImporterFixture/
```

## Estilo

```csharp
public readonly record struct TileRef(Guid TilesetId, int TileId);
```

IDs forman el contrato; UI no inventa IDs ni modifica colecciones internas directamente.

## Pruebas

- Unitarias: slicing, referencias, capas, locking, fill, selección y deltas.
- Integración: round-trip, ZIP hostil, hashes y export determinista.
- WPF: estado de tools, paleta, capas, clipping y accesibilidad básica.
- Diagnóstico: referencias huérfanas agrupadas, marcador visual, persistencia y bloqueo de exportación.
- Unity real: batchmode importa bundle, crea prefab y valida capas/sprites/coordenadas.
- Manual: importar → pintar/fill/borrar → capas → guardar/reabrir → exportar → abrir resultado Unity.

## Límites

Siempre: TDD, build verde por incremento, validar entradas hostiles, incluir licencias y mantener importador fuera del repo gratuito.  
Pedir antes: dependencias NuGet, DRM, telemetría, login, red o publicación del importador comercial.  
Nunca: ejecutar contenido importado, generar assets Unity desde app gratuita, copiar assets de marca o afirmar iso/hex antes de su gate.

## Criterios de éxito

- Dos PNG con tiles de distinto tamaño muestran conteos, miniaturas e IDs correctos.
- Tiles reales se colocan por coordenada en capas ordenables, ocultables y bloqueables.
- Selección, pincel, borrador y fill tienen undo/redo exacto.
- Capas y tilesets pueden eliminarse; referencias huérfanas son visibles, agrupadas y persistentes.
- Guardar/reabrir conserva hash semántico y hashes de assets.
- Export repetido produce bytes idénticos y no contiene código.
- Importador separado crea prefab Grid/Tilemaps y pasa smoke real en Unity 6000.3.11f1.
- Ejecutable Release pasa walkthrough humano antes de F2.

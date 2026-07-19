---
title: "Proyecto Mosaico - Modelo espacial, grillas y proyecciones"
subtitle: "Topologías, sistemas de coordenadas, selección, vecinos, orden y geometría"
author: "Proyecto Mosaico - documentación de diseño"
date: "19 de julio de 2026"
lang: es-ES
documentclass: article
papersize: a4
fontsize: 10pt
mainfont: "Lato"
sansfont: "Lato"
monofont: "DejaVu Sans Mono"
geometry: margin=1.8cm
toc: true
toc-depth: 3
numbersections: true
colorlinks: true
---

> **Documento:** PM-04  
> **Versión:** 0.1.1 - Auditoría incorporada
> **Estado:** Auditado; no aprobado para implementación, con correcciones previas a Fase 0.
> **Nombre del producto:** Proyecto Mosaico es un nombre provisional.


# Principio central

El sistema no codifica "top-down", "plataformas" o "isométrico" como matrices incompatibles. Define topologías lógicas y proyecciones visuales. Los perfiles de juego añaden semántica y validadores, pero no cambian la identidad de una celda.

![Cadena de transformaciones espaciales](../diagramas/spatial_transform.png)

# Tipos fundamentales

```csharp
public readonly record struct GridCoordinate(int A, int B, int C = 0);
public readonly record struct WorldPosition(double X, double Y);
public readonly record struct ScreenPosition(double X, double Y);
public readonly record struct GridDirection(string Id, int Index);
```

`GridCoordinate` no debe interpretarse directamente como píxeles. En hexagonal puede contener axial `q,r`; en mapas con elevación, `C` puede representar nivel lógico y no profundidad visual.

# Contrato de topología

```csharp
public interface IGridTopology
{
    IReadOnlyList<GridDirection> Directions { get; }
    GridCoordinate Neighbor(GridCoordinate cell, GridDirection direction);
    int Distance(GridCoordinate a, GridCoordinate b);
    IEnumerable<GridCoordinate> Ring(GridCoordinate center, int radius);
    IEnumerable<GridCoordinate> CellsIntersecting(GridShape shape);
    IReadOnlyList<GridEdge> Edges(GridCoordinate cell);
}
```

La topología responde relaciones discretas. La proyección responde geometría visual.

# Contrato de proyección

```csharp
public interface IGridProjection
{
    WorldPosition CellOrigin(GridCoordinate cell);
    GridHit WorldToCell(WorldPosition position);
    Polygon2D CellPolygon(GridCoordinate cell);
    RectD Bounds(IEnumerable<GridCoordinate> cells);
}
```

`GridHit` incluye celda candidata, coordenada local, distancia al centro y borde más cercano. Esto mejora pintura y selección en celdas no rectangulares.

# Cuadrícula ortogonal

Transformación base:

```text
worldX = column * tileWidth
worldY = row * tileHeight
```

Vecindad cardinal de cuatro direcciones y opcional diagonal de ocho. El perfil lateral usa la misma topología, pero añade gravedad, plataformas unidireccionales, pendientes y conceptos como "superficie expuesta".

# Isométrico de diamante

Una proyección típica:

```text
worldX = (column - row) * tileWidth / 2
worldY = (column + row) * tileHeight / 2
```

La inversa produce valores fraccionarios y debe resolver el polígono real de la celda. Redondear sin prueba geométrica causa selección incorrecta cerca de bordes.

El orden visual no debe confundirse con el orden lógico. Los objetos altos usan un punto de apoyo o baseline. El renderer ordena por clave de profundidad y permite override explícito.

# Isométrico escalonado y oblicuo

Las variantes escalonadas desplazan filas o columnas pares/impares. El documento guarda orientación del stagger, índice par o impar y dimensiones. La proyección oblicua aplica una transformación afín, pero las herramientas siguen operando en coordenadas lógicas.

# Hexagonal

Se recomienda representación axial para algoritmos:

```text
(q, r)
```

Con coordenada cúbica derivada:

```text
x = q
y = -q-r
z = r
x + y + z = 0
```

La distancia:

```text
max(abs(dx), abs(dy), abs(dz))
```

Debe soportarse pointy-top y flat-top. Los offsets odd-r, even-r, odd-q y even-q son formatos de interoperabilidad, no el dominio interno preferido.

# Coordenadas negativas y chunks

Se usa floor division, no truncamiento hacia cero:

```text
chunkA = floorDiv(cellA, chunkWidth)
localA = floorMod(cellA, chunkWidth)
```

La propiedad `0 <= localA < chunkWidth` debe cumplirse también para valores negativos.

# Capas con distinto espacio

Una capa puede estar ligada a la cuadrícula, al mundo o a la pantalla:

- Tile layer: coordenadas de celda.
- Object layer: espacio mundo continuo.
- Image layer: espacio mundo con repetición opcional.
- Overlay de UI: espacio pantalla.

Los offsets y paralaje se aplican después de la proyección del contenido.

# Selección y picking

La selección rectangular en pantalla no siempre es rectangular en la grilla. El sistema transforma el polígono de selección a mundo y solicita a la topología las celdas intersectadas. Para pinceles, se usa el centro o una regla configurable de cobertura.

El picking de objetos emplea un índice espacial y respeta orden visual, bloqueo de capa, transparencia opcional y tolerancia de pantalla independiente del zoom.

# Formas y regiones

Se definen formas lógicas reutilizables:

- Celda, borde y vértice.
- Rectángulo de celdas.
- Anillo y disco topológico.
- Línea discreta.
- Polígono en espacio mundo.
- Máscara arbitraria de celdas.

Los generadores y reglas trabajan con estas abstracciones en lugar de bucles específicos por topología.

# Orden de renderizado

Cada instancia produce una clave:

```text
(layerOrder, depthBand, depthKey, manualBias, stableId)
```

`stableId` elimina parpadeos cuando dos elementos tienen la misma profundidad. Los mapas laterales suelen usar orden de capa; isométrico puede usar baseline Y y nivel; hexagonal puede usar fila proyectada.

# Elevación y múltiples niveles

La elevación es un atributo separado de la coordenada de capa. Puede afectar proyección, sombra, navegación y compatibilidad de bordes. No debe codificarse exclusivamente moviendo el sprite, porque el gameplay necesita conocerla.

# Invariantes y pruebas

- `WorldToCell(CellOrigin(c)+centerOffset)` devuelve `c`.
- Vecindad es recíproca donde la topología lo declare.
- La distancia es cero solo para la misma celda.
- Ring de radio `n` no contiene duplicados.
- Conversión de chunk funciona con extremos negativos.
- Selección visual en zoom alto y bajo devuelve las mismas celdas lógicas.

# Extensión futura

Una API de topología permite triángulos, grids irregulares o grafos de nodos. Sin embargo, el MVP no debe generalizar más de lo necesario. Ortogonal e isométrico comparten mucha infraestructura; hexagonal valida que el contrato no dependa de cuatro vecinos.


## Referencias técnicas de inspiración

Estas referencias se emplean para estudiar conceptos y formatos, no para copiar código, recursos gráficos ni interfaces:

- Tiled, documentación oficial: https://doc.mapeditor.org/
- Tiled, formato JSON: https://doc.mapeditor.org/en/stable/reference/json-map-format/
- Tiled, repositorio oficial: https://github.com/mapeditor/tiled
- TileKit, descripción oficial: https://rxi.itch.io/tilekit
- Unity 2D Tilemap y Rule Tile: https://docs.unity3d.com/6000.4/Documentation/Manual/tilemaps/tilemaps-landing.html
- Unity 2D Tilemap Extras: https://docs.unity3d.com/Packages/com.unity.2d.tilemap.extras@8.0/manual/RuleTile-introduction.html
- Wave Function Collapse, repositorio de referencia: https://github.com/mxgmn/WaveFunctionCollapse

Toda dependencia o reutilización de código deberá pasar por una revisión específica de licencia, atribución y compatibilidad con el modelo de distribución del producto.

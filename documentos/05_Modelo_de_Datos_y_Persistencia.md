---
title: "Proyecto Mosaico - Modelo de datos y persistencia"
subtitle: "Identidad, documentos, chunks, propiedades, formato nativo, migraciones y recuperación"
author: "Proyecto Mosaico - documentación de diseño"
date: "18 de julio de 2026"
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
header-includes:
  - |-
    \input{/mnt/data/proyecto_mosaico_documentacion/src/header.tex}
---

> **Documento:** PM-05  
> **Versión:** 0.1.0 - Base de diseño  
> **Estado:** Base aprobable para iniciar implementación; sujeto a ADR y control de cambios.  
> **Nombre del producto:** Proyecto Mosaico es un nombre provisional.


# Objetivos

El formato debe preservar intención, permitir diffs razonables, soportar proyectos grandes y evolucionar sin destruir contenido. La serialización no debe exponer todas las decisiones internas ni depender del orden accidental de colecciones.

# Agregados principales

```text
Project
├── ProjectManifest
├── Maps[]
├── Tilesets[]
├── RulePackages[]
├── GeneratorPresets[]
├── Scripts[]
└── ExternalResources[]
```

Cada mapa contiene configuración espacial, capas, propiedades, referencias a recursos y metadatos de generación aceptada.

# Identidad

Se usan identificadores estables de 128 bits o equivalente. Un ID no cambia al renombrar, mover, reordenar o exportar. Los IDs numéricos compactos pueden existir en cachés o formatos externos, pero no son identidad autoritativa.

Tipos con identidad propia:

- Proyecto, mapa, tileset y tile.
- Capa y objeto.
- Paquete y regla.
- Preset de generador.
- Clase de propiedad.

Las celdas se identifican por mapa, capa y coordenada; no necesitan UUID individual salvo contenido generado con procedencia compleja.

# Modelo de mapa

```csharp
public sealed record MapDocument(
    MapId Id,
    SpatialConfiguration Spatial,
    ImmutableArray<LayerNode> Layers,
    ImmutableArray<TilesetBinding> Tilesets,
    PropertyBag Properties,
    GenerationMetadata Generation);
```

`SpatialConfiguration` referencia topología, proyección, tamaño de tile, chunk y parámetros de stagger o hex.

# Capas

Una jerarquía usa `LayerNode` con propiedades comunes:

```text
name, visible, locked, opacity, blendMode,
offset, parallax, tint, tags, properties
```

Subtipos:

- `TileLayer`: chunks de celdas visuales.
- `SemanticLayer`: valores de vocabulario o tags.
- `ObjectLayer`: entidades y geometría libre.
- `ImageLayer`: recurso, repetición y transformación.
- `CollisionLayer`: shapes o materialización derivada.
- `NavigationLayer`: costes, bloqueos y conectividad.
- `GroupLayer`: hijos ordenados.
- `GeneratedLayer`: salida derivada con política de edición.

# Celdas y referencias a tiles

Una celda visual contiene una referencia a tile y flags de transformación. Se evita acoplar el ID del tile a su posición en una textura.

```csharp
public readonly record struct TileInstance(
    TileId Tile,
    TileTransform Transform,
    VariantSeed Variant,
    GenerationStamp? GeneratedBy);
```

`VariantSeed` permite que una regla conserve una variante aleatoria mientras no cambie su contexto.

# Chunks

Los chunks son unidades de almacenamiento, invalidación y streaming. El tamaño es configurable por mapa dentro de límites. Una capa vacía no materializa chunks.

Cada chunk guarda revisión y codificación. Puede comprimirse por run-length, paleta local o compresión general. La elección es detalle de formato y debe medirse con corpus reales.

# Objetos

Un objeto contiene transformación, shape, clase, propiedades y posible referencia a tile o prefab.

Shapes mínimas:

- Punto.
- Rectángulo y rectángulo rotado.
- Elipse.
- Polígono.
- Polilínea.
- Texto.
- Tile object.

Las referencias entre objetos usan IDs y se validan al cargar.

# Propiedades tipadas

Tipos base:

```text
bool, int64, double, string, color, enum,
fileRef, assetRef, objectRef, classInstance, array
```

Las clases de propiedad definen campos, valores por defecto, restricciones y documentación. Una propiedad desconocida se conserva durante round-trip para compatibilidad hacia delante.

# Tilesets

Un tileset guarda fuente visual, regiones, anclas, colisiones, animaciones, tags, pesos y metadatos de terreno. Los recursos de imagen se referencian mediante URI de proyecto o asset ID, con ruta relativa como pista reparable.

# Reglas y procedencia

Una salida generada registra:

```text
packageId, ruleId, ruleRevision,
anchor, seed, generationPass, sourceRevision
```

La procedencia puede almacenarse por grupo o región para no inflar cada celda. El diseño debe equilibrar depuración y tamaño.

# Formato nativo

Se recomienda un proyecto como carpeta:

```text
project.mosaic.json
maps/
tilesets/
rules/
presets/
assets/
.cache/        # no versionar
.autosave/     # no versionar
```

Los archivos de mapa pueden usar JSON legible para metadatos y bloques binarios o comprimidos para chunks grandes. El manifiesto declara versión y hashes opcionales.

# Ejemplo simplificado

```json
{
  "format": "mosaico-project",
  "version": "1.0",
  "projectId": "...",
  "maps": ["maps/forest.mosaic-map.json"],
  "tilesets": ["tilesets/forest.mosaic-tileset.json"],
  "rulePackages": ["rules/forest-rules.json"]
}
```

Los números de versión de esquema son distintos de la versión de la aplicación.

# Escritura atómica

El guardado sigue:

1. Serializar a archivos temporales en el mismo volumen.
2. Validar estructura y, cuando proceda, volver a leer.
3. Sincronizar buffers.
4. Reemplazar mediante rename atómico.
5. Conservar backup rotativo.
6. Actualizar dirty state solo después de éxito.

Para proyectos multifichero se usa journal de transacción o un manifiesto de generación que permita detectar guardados incompletos.

# Autosave y recuperación

Autosave guarda deltas o snapshots en ubicación separada y nunca reemplaza el guardado manual. Al iniciar, se compara revisión y se ofrece recuperación con vista de diferencias. Los autosaves antiguos se purgan por política de espacio.

# Migraciones

Cada migración es idempotente cuando sea posible, está versionada y produce un informe. Antes de migrar se conserva una copia. Se prueban cadenas completas, no solo migraciones adyacentes.

```csharp
public interface IProjectMigration
{
    SchemaVersion From { get; }
    SchemaVersion To { get; }
    MigrationReport Apply(MigrationContext context);
}
```

# Diffs y control de versiones

Se mantiene orden estable y serialización canónica. Los chunks pueden almacenarse en archivos independientes para evitar conflictos masivos. Se ofrece un diff semántico capaz de explicar celdas, objetos, propiedades y reglas, no solo líneas JSON.

# Validación de carga

Límites obligatorios:

- Profundidad de JSON y tamaño de strings.
- Número máximo configurable de capas, objetos y patrones.
- Dimensiones y memoria estimada de imágenes.
- Coordenadas y tamaños numéricos válidos.
- Rechazo de rutas que escapen del proyecto.
- Descompresión con límites para evitar bombas.

# Compatibilidad externa

Importar Tiled significa mapear un subconjunto documentado y preservar extensiones desconocidas cuando sea viable. La exportación debe producir un reporte de conversiones, aproximaciones y pérdidas. Nunca se prometerá round-trip perfecto sin una suite de corpus que lo demuestre.

# Pruebas esenciales

- Round-trip canónico.
- Fuzzing de parsers.
- Archivos truncados en cada byte crítico.
- Fallo de disco durante cada fase de guardado.
- Migración desde todas las versiones soportadas.
- Proyecto movido de carpeta.
- Recursos ausentes y relocalizados.
- IDs duplicados y referencias circulares.


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

---
title: "Proyecto Mosaico - Importación, exportación, plugins e integraciones"
subtitle: "Puertos, compatibilidad, reportes de pérdida, CLI y extensibilidad segura"
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

> **Documento:** PM-11  
> **Versión:** 0.1.0 - Base de diseño  
> **Estado:** Base aprobable para iniciar implementación; sujeto a ADR y control de cambios.  
> **Nombre del producto:** Proyecto Mosaico es un nombre provisional.


# Principio

El formato interno representa el producto; los formatos externos son adaptadores. No se debe deformar el dominio para imitar cada particularidad de un motor.

![Arquitectura de plugins](/mnt/data/proyecto_mosaico_documentacion/assets/plugin_architecture.png)

# Importadores

```csharp
public interface IImporter
{
    ImporterDescriptor Describe();
    ProbeResult Probe(Stream input, ImportContext context);
    Task<ImportResult> ImportAsync(
        ImportRequest request,
        CancellationToken token);
}
```

El importador devuelve documento o delta, warnings, recursos requeridos, extensiones no interpretadas y nivel de fidelidad.

# Exportadores

```csharp
public interface IExporter
{
    ExporterDescriptor Describe();
    ExportPlan Plan(ProjectSnapshot project, ExportOptions options);
    Task<ExportReport> ExportAsync(
        ExportPlan plan,
        CancellationToken token);
}
```

`Plan` detecta pérdida antes de escribir. El reporte lista conversiones, omisiones, aproximaciones y archivos producidos.

# Compatibilidad con Tiled

Se definirá una matriz por característica:

- Orientaciones.
- Capas.
- Tilesets y colecciones.
- Objetos y shapes.
- Propiedades y clases.
- Animaciones y colisiones.
- Wang sets.
- Chunks e infinite maps.
- Parallax y blend.

Cada celda de matriz será soportada, aproximada, preservada como extensión o no soportada. La aplicación no debe afirmar "compatible con Tiled" sin especificar el nivel.

# Unity

El exportador puede producir assets intermedios, JSON consumible, Tilemaps o prefabs mediante un paquete companion. Se recomienda que la integración del motor sea un repositorio separado con versión de protocolo, para evitar dependencias de Unity dentro del editor.

Flujo:

```text
Proyecto Mosaico
 -> exportación determinista
 -> paquete/importador Unity
 -> Tilemaps, GameObjects, colliders y metadata
```

# Godot

Estrategia equivalente: exportar datos y proporcionar addon que crea TileMap/TileMapLayer, objetos y recursos. La API concreta se encapsula por versión del motor.

# Motores propios

Se ofrece formato runtime compacto y un SDK pequeño. El usuario puede escribir exportador mediante plugin o CLI. Se documentan coordenadas, transformaciones y propiedades sin obligar a cargar el formato completo de edición.

# CLI

Comandos iniciales:

```text
mosaico validate <project>
mosaico export <project> --target tiled|unity|godot|runtime
mosaico generate <project> --map <id> --preset <id> --seed <n>
mosaico render <map> --output preview.png
mosaico migrate <project> --to <version>
mosaico inspect <project>
```

La CLI usa el mismo núcleo y produce JSON opcional para CI.

# Plugin API

Extensiones permitidas:

- Importador y exportador.
- Herramienta de editor.
- Generador.
- Validador y quick fix.
- Panel o inspector.
- Tipo de propiedad y editor.
- Comando y acción de menú.

La API expone DTO, servicios y comandos. No entrega referencias mutables a colecciones internas.

# Manifiesto

```json
{
  "id": "com.example.cave-tools",
  "version": "1.2.0",
  "api": ">=1.0 <2.0",
  "entry": "CaveTools.dll",
  "permissions": ["project-read", "project-write"],
  "capabilities": ["generator", "validator"]
}
```

# Seguridad de plugins

Niveles posibles:

1. Plugins locales de confianza en el mismo proceso.
2. Plugins firmados y permisos declarados.
3. Plugins aislados en proceso con IPC.
4. Scripting sandbox limitado.

El MVP puede comenzar con nivel 1, pero debe advertir que un plugin tiene los permisos del usuario. Antes de un marketplace se requiere aislamiento y firma.

# Versionado de API

SemVer con políticas claras. Cambios aditivos compatibles dentro de major. Deprecaciones con al menos una ventana publicada. Un plugin incompatible no se carga parcialmente.

# Recursos y paths

Todos los adaptadores usan un servicio de resolución que impide path traversal y normaliza URIs. Exportadores escriben en staging y reemplazan destinos al terminar.

# Hooks

Se evitan hooks arbitrarios en cada punto. Se ofrecen eventos limitados:

- Proyecto abierto/cerrado.
- Antes y después de guardar.
- Comandos confirmados.
- Asset recargado.
- Exportación iniciada/finalizada.

Un plugin no puede cancelar silenciosamente guardado sin explicar causa.

# Paquetes reutilizables

Tilesets, reglas, clases y presets pueden distribuirse como paquete con manifiesto, recursos, licencia, versión y dependencias. Un lockfile fija versiones para builds reproducibles.

# Integración con Git

El editor no implementa un cliente Git completo. Ofrece archivos estables, diff semántico, merge asistido para capas y comandos para abrir herramientas externas. La integración profunda puede ser plugin.

# Telemetría e informes

Importadores y exportadores registran duración, warnings y hashes, no contenido del proyecto. Un bundle de soporte puede incluir manifiestos y logs con redacción previa.

# Pruebas

- Corpus de archivos externos por versión.
- Round-trip dentro del subconjunto prometido.
- Golden files y normalización.
- Rutas Unicode, largas y relativas.
- Plugins incompatibles y maliciosos simulados.
- Cancelación y fallo de disco.
- Builds reproducibles desde CLI.


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

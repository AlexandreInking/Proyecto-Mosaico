---
title: "Proyecto Mosaico - Marco de generación procedural 2D"
subtitle: "Generadores, semillas, máscaras, validación, reparación, presets y composición"
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

> **Documento:** PM-08  
> **Versión:** 0.1.1 - Auditoría incorporada
> **Estado:** Auditado; no aprobado para implementación, con correcciones previas a Fase 0.
> **Nombre del producto:** Proyecto Mosaico es un nombre provisional.


# Propósito

La generación procedural no es un botón de ruido. Es un pipeline de decisiones reproducibles, restricciones, validación y reparación. Debe producir un mapa semántico o un plan de cambios que después atraviese reglas visuales.

# Contrato de generador

```csharp
public interface IMapGenerator
{
    GeneratorDescriptor Describe();
    GenerationPlan Plan(GenerationRequest request);
    Task<GenerationResult> GenerateAsync(
        GenerationContext context,
        CancellationToken token);
}
```

El descriptor declara parámetros tipados, topologías compatibles, capas de entrada, outputs, coste estimado y capacidades de preview.

# Request y contexto

Una solicitud contiene:

- Región objetivo.
- Snapshot base.
- Semilla maestra.
- Máscaras de editable, bloqueado, requerido y prohibido.
- Preset versionado.
- Restricciones globales.
- Presupuesto de tiempo o intentos.
- Nivel de diagnóstico.

# Semillas y streams

La semilla maestra deriva streams independientes:

```text
layout, terrain, connections, decoration, enemies, loot
```

Cada stream se identifica por nombre y versión. Añadir una nueva llamada aleatoria a decoración no debe alterar el layout.

# Pipeline general

1. Normalizar parámetros.
2. Construir estructura abstracta.
3. Rasterizar o asignar regiones.
4. Garantizar conexiones obligatorias.
5. Aplicar terrenos y atributos.
6. Validar.
7. Reparar o reintentar.
8. Emitir mapa semántico y métricas.
9. Aplicar reglas visuales como etapa separada.

# Generadores base

## Random walk

Adecuado para cuevas, túneles y manchas orgánicas. Parámetros: caminantes, persistencia de dirección, grosor, objetivo de cobertura y límites. Requiere limpieza de bolsillos y validación de conectividad.

## BSP

Divide una región y coloca habitaciones en hojas. Las conexiones siguen el árbol, garantizando una base conectada. Debe permitir habitaciones irregulares y corredores con ancho.

## Cellular automata

Inicia ruido binario y aplica reglas de vecinos. Debe conservar la región principal, eliminar componentes mínimos y conectar regiones requeridas.

## Laberintos

DFS, Prim, Kruskal, Eller o Wilson. El producto expone propiedades comprensibles: ciclos, callejones, ancho, salas y densidad, no únicamente el nombre del algoritmo.

## Ruido y campos

Campos de elevación, humedad, temperatura o densidad. Se combinan octavas y curvas. Los umbrales producen biomas, pero la accesibilidad y las carreteras se resuelven después.

## Voronoi

Divide territorio en regiones y construye un grafo de adyacencia. Útil para provincias, biomas, parcelas o zonas de influencia.

## Poisson disk

Distribuye puntos con separación mínima. Útil para árboles, asentamientos y recursos. Puede usar densidad espacial variable.

## Generación por grafos y módulos

Primero crea un grafo de progresión; luego coloca habitaciones o módulos con conectores. La geometría debe satisfacer puertas, solapamiento, distancia y jerarquía narrativa.

# Composición de generadores

Los generadores se conectan como nodos:

```text
Grafo de progreso
 -> layout de habitaciones
 -> conexión de corredores
 -> campos de bioma
 -> distribución de puntos
 -> validación
```

Cada nodo declara sus inputs y outputs. El editor permite guardar el pipeline como preset, pero el MVP puede comenzar con pipelines codificados y presets parametrizados.

# Máscaras y restricciones espaciales

- `Locked`: no modificar.
- `Editable`: área permitida.
- `Required`: debe contener un tipo o conexión.
- `Forbidden`: no puede contenerlo.
- `Influence`: campo de peso.
- `Boundary`: condiciones de borde.

Las máscaras pueden provenir de selección, capa, objetos, propiedades o salida de otro generador.

# Validadores

- Conectividad entre puntos requeridos.
- Caminabilidad y anchura mínima.
- Distancia entre inicio, objetivos y salida.
- Conteo y distribución de regiones.
- Densidad de terreno.
- Ausencia de componentes pequeños.
- Restricciones de salto para lateral.
- Coste máximo de ruta.
- Cobertura de reglas visuales.

Cada validador devuelve severidad, evidencia, ubicación, métricas y posibles reparaciones.

# Reparación

Estrategias:

- Abrir corredor entre componentes.
- Mover punto de interés a región válida.
- Ensanchar paso.
- Relajar umbral.
- Regenerar subregión.
- Repetir con stream derivado.

Las reparaciones se registran y son deterministas. El usuario puede comparar resultado antes y después.

# Preview y variantes

Una ejecución no toca el documento. Produce `GenerationResult` con delta, mapa semántico temporal, métricas y diagnostics. Variantes se calculan con semillas derivadas y pueden mostrarse en mosaico de previews.

Aceptar genera un solo comando. El resultado guarda preset, versión y semilla para reproducción.

# Ejecución por lotes

La CLI puede generar cientos de semillas y exportar métricas. Esto permite buscar presets robustos y descubrir casos extremos.

```text
mosaico generate project --map cave --preset large-cave   --seeds 1..1000 --validate --report report.json
```

# Presets

Un preset contiene valores, restricciones y versión del generador. Al cambiar el esquema, se migra o se marca incompatible. Los presets pueden empaquetarse con reglas y tilesets.

# Perfil lateral

Los generadores laterales operan con gravedad y capacidad de movimiento. Un validador de salto usa modelo simplificado configurable: velocidad horizontal, altura, coyote time y tamaño del personaje. No pretende sustituir la física exacta del motor; identifica errores obvios y exporta una prueba reproducible.

# Perfil hexagonal

Los algoritmos utilizan distancia hexagonal, anillos y conectividad de seis lados. Ríos y carreteras se representan como conexiones de borde. Los campos pueden muestrearse en centros hexagonales.

# Observabilidad

Métricas por ejecución:

- Duración por fase.
- Intentos y reparaciones.
- Celdas procesadas.
- Componentes y rutas.
- Distribución de terrenos.
- Memoria pico.
- Semilla y versiones.

# Pruebas

- Reproducibilidad por semilla.
- Invariantes por topología.
- Cancelación en cada fase.
- Comparación de incremental y completo cuando aplique.
- Corpus de semillas difíciles.
- Property-based: todas las salidas respetan límites y máscaras.


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

---
title: "Proyecto Mosaico - Motor Wave Function Collapse"
subtitle: "Modelos, dominios, entropía, propagación, backtracking, restricciones y depuración"
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

> **Documento:** PM-09  
> **Versión:** 0.1.0 - Base de diseño  
> **Estado:** Base aprobable para iniciar implementación; sujeto a ADR y control de cambios.  
> **Nombre del producto:** Proyecto Mosaico es un nombre provisional.


# Rol dentro del producto

WFC es un solucionador especializado para completar configuraciones bajo restricciones locales. No sustituye al generador estructural ni garantiza progresión global. Se usa después de fijar esqueleto, regiones obligatorias o límites.

![Ciclo principal de WFC](/mnt/data/proyecto_mosaico_documentacion/assets/wfc_cycle.png)

# Modelos soportados

## Simple Tiled Model

Cada opción es un tile o módulo y define compatibilidades por dirección. Es apropiado para carreteras, tuberías, habitaciones modulares y fachadas.

## Overlapping Model

Extrae patrones N por N de una muestra. Dos patrones son compatibles cuando su solapamiento coincide. Es apropiado para texturas estructuradas y estilos donde las reglas explícitas serían numerosas.

# Estructuras de datos

```csharp
public sealed class WaveState
{
    public BitSet[] Domains;
    public EntropyHeap Queue;
    public SupportCounters Supports;
    public DecisionStack Decisions;
}
```

Cada celda tiene un dominio de patrones posibles. Compatibilidades se precompilan:

```text
compatible[direction][pattern] -> bitset de patrones vecinos
```

# Inicialización

1. Crear dominio completo por celda.
2. Aplicar restricciones de región y topología.
3. Precolapsar contenido fijado.
4. Aplicar límites o condiciones de borde.
5. Propagar hasta consistencia inicial.

Si la inicialización contradice, el problema está en los constraints o el catálogo; no debe consumirse tiempo en reinicios ciegos.

# Entropía

Para pesos `w_i`:

```text
H = ln(sum(w)) - sum(w * ln(w)) / sum(w)
```

Se añade ruido determinista mínimo para desempate. La cola debe invalidar entradas obsoletas por revisión, evitando actualizar cada nodo de forma costosa.

# Observación

Se escoge la celda no resuelta con menor entropía. La opción se selecciona con peso usando un stream derivado de semilla, celda y profundidad de decisión. Se registra un frame para backtracking.

# Propagación

Versión conceptual:

```csharp
while (queue.TryPop(out var cell))
{
    foreach (var direction in topology.Directions)
    {
        var neighbor = topology.Neighbor(cell, direction);
        var allowed = UnionCompatible(state.Domains[cell], direction);
        var reduced = state.Domains[neighbor] & allowed;
        if (reduced != state.Domains[neighbor])
            Reduce(neighbor, reduced);
    }
}
```

La versión optimizada usa contadores de soporte: una posibilidad se elimina cuando ya no existe ningún patrón vecino que la soporte en una dirección.

# Contradicciones

Un dominio vacío produce contradicción. Estrategias configurables:

- Reinicio con semilla derivada.
- Backtracking cronológico.
- Backjumping basado en causas.
- Reparación local reabriendo un radio.
- Relajación explícita de constraints blandos.

El modo normal usa una política robusta y limitada. El modo de depuración conserva cadenas causales detalladas con mayor coste.

# Backtracking

Un frame guarda la decisión y un trail de reducciones. No se copia toda la wave.

```text
DecisionFrame
- cell
- chosenPattern
- remainingAlternatives
- trailStart
- randomState or deterministic key
```

Al retroceder se restauran dominios hasta `trailStart`, se elimina la opción fallida y se propaga.

# Restricciones duras y blandas

Duras:

- Celda fija.
- Opción prohibida.
- Borde obligatorio.
- Máscara bloqueada.
- Compatibilidad local.

Blandas:

- Preferencia por densidad.
- Penalización de repetición.
- Cercanía a un terreno.
- Conteo deseado.

Las blandas modifican pesos o fitness, pero no deben disfrazarse como garantía. Requisitos globales importantes se validan fuera de WFC.

# Condiciones de borde

Opciones:

- Wrap toroidal.
- Borde vacío.
- Patrón exterior fijo.
- Compatibilidad libre.
- Perímetro precolapsado.

El comportamiento forma parte del preset y de la reproducibilidad.

# Extracción Overlapping

1. Recorrer ventanas N por N.
2. Canonicalizar patrón.
3. Añadir rotaciones/reflejos permitidos.
4. Contar frecuencia.
5. Construir compatibilidad por offsets de solapamiento.
6. Mapear patrones a tile central o bloque de salida.

La deduplicación usa hash y comparación completa para evitar colisiones.

# Simple Tiled y sockets

Cada tile puede declarar sockets por dirección. La compatibilidad puede ser igualdad, tabla o predicado precompilado. Los sockets deben distinguir orientación, altura y polaridad cuando sea necesario.

Ejemplo:

```text
road:straight:east-west
cliff:height-2:solid
river:flow-out
river:flow-in
```

# Completion localizada

El exterior de la selección se convierte en condición de borde. Las celdas bloqueadas se precolapsan. Una banda alrededor se incluye como contexto, pero no se modifica. El resultado solo contiene delta interior.

# Depurador

Vistas:

- Entropía por celda.
- Número de opciones.
- Patrones candidatos.
- Compatibilidades faltantes.
- Decisiones y profundidad.
- Cadena causal de eliminación.
- Hotspots de contradicción en múltiples semillas.

El inspector debe responder: qué opciones había, qué las eliminó y qué decisión originó la restricción.

# Rendimiento

Optimizaciones:

- Bitsets compactos y vectorizados.
- Catálogos por topología.
- Support counters.
- Cola de entropía con revisiones.
- Pool de buffers.
- Snapshots y trails.
- Partición por regiones cuando las restricciones permiten independencia.

La paralelización dentro de una wave es compleja; es más seguro paralelizar variantes independientes o extracción de patrones.

# Limitaciones explícitas

WFC no garantiza ruta inicio-salida, economía de juego, ritmo narrativo ni ausencia de grandes estructuras repetitivas. Esas propiedades requieren esqueleto, constraints adicionales, validación o búsqueda.

# API propuesta

```csharp
Task<WfcResult> SolveAsync(
    WfcModel model,
    WfcRegion region,
    WfcConstraints constraints,
    WfcOptions options,
    CancellationToken token);
```

`WfcResult` contiene estado, delta, semilla, estadísticas, contradicciones, backtracks y diagnósticos.

# Pruebas

- Todas las adyacencias de salida son válidas.
- La misma semilla reproduce el resultado.
- Las celdas fijas no cambian.
- El solver detecta modelos imposibles.
- Backtracking restaura dominios y cola.
- Overlapping reconstruye muestras pequeñas conocidas.
- Fuzzing de catálogos y restricciones.
- Benchmarks por tamaño, patrones y densidad de restricciones.


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

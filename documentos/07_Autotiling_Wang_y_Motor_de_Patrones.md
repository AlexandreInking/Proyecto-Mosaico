---
title: "Proyecto Mosaico - Autotiling, Wang y motor de patrones"
subtitle: "Condiciones, coincidencia, fases, conflictos, actualización incremental y depuración"
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

> **Documento:** PM-07  
> **Versión:** 0.1.1 - Auditoría incorporada
> **Estado:** Auditado; no aprobado para implementación, con correcciones previas a Fase 0.
> **Nombre del producto:** Proyecto Mosaico es un nombre provisional.


# Objetivo

Transformar un mapa de intención o un contexto vecinal en capas visuales y de juego coherentes. El motor debe cubrir casos sencillos con bitmasks y casos complejos con patrones arbitrarios, sin convertir cada pincelada en un recálculo global.

# Niveles de capacidad

1. Bitmask por direcciones.
2. Terrenos Wang por bordes y esquinas.
3. Reglas declarativas de patrones.
4. Pasadas encadenadas y salidas multi-capa.
5. Validadores de cobertura y conflictos.

# Bitmasks

Una topología expone direcciones ordenadas. La máscara activa un bit cuando la condición de vecino se cumple. Ortogonal cardinal usa 4 bits; ortogonal completo, 8; hexagonal, 6.

```csharp
ulong ComputeMask(CellContext c, NeighborPredicate predicate)
{
    ulong mask = 0;
    for (int i = 0; i < c.Topology.Directions.Count; i++)
        if (predicate(c.Neighbor(i))) mask |= 1UL << i;
    return mask;
}
```

La tabla no debe asumir un layout gráfico específico. Un editor visual ayuda a mapear máscaras y detectar casos sin asignación.

# Wang y conectores

Cada borde o esquina recibe una etiqueta de terreno. Dos tiles son compatibles cuando sus etiquetas enfrentadas satisfacen la relación. Además de igualdad, pueden existir tablas como ROAD conecta con BRIDGE o CLIFF_HIGH solo con CLIFF_HIGH.

Se separa:

- Descriptor de compatibilidad.
- Catálogo de tiles candidatos.
- Selección ponderada y transformaciones permitidas.

# Regla de patrón

```csharp
public sealed record PatternRule(
    RuleId Id,
    RulePhase Phase,
    int Priority,
    GridPattern Input,
    ImmutableArray<PatternOutput> Output,
    double Weight,
    TransformationPolicy Transformations,
    RuleGuard? Guard);
```

El patrón usa offsets topológicos respecto de un ancla. Esto permite representar un anillo hexagonal sin forzarlo a una matriz rectangular.

# Condiciones

- `EXACT(value)`: valor exacto.
- `ANY`: no restringe.
- `EMPTY`: ausencia.
- `NOT(condition)`: negación.
- `TAG(tag)`: el valor posee tag.
- `ONE_OF(set)`: pertenece a conjunto.
- `SAME_AS(offset)`: igual a otra posición.
- `OUTSIDE`: fuera del dominio o región.
- `PROPERTY(predicate)`: propiedad tipada.
- `LAYER(layerId, condition)`: consulta otra capa.

Las condiciones deben ser serializables y validables sin ejecutar código arbitrario.

# Salidas

Una salida puede:

- Colocar o borrar tile.
- Asignar valor semántico derivado.
- Crear objeto o stamp.
- Añadir colisión o coste de navegación.
- Elegir variante ponderada.
- Emitir una marca para una fase posterior.

Cada salida declara política de conflicto: reemplazar generado, preservar manual, combinar, error o escribir en otra capa.

# Fases

Ejemplo de pipeline:

```text
10 - Base de terreno
20 - Bordes y transiciones
30 - Estructuras
40 - Sombras y overlays
50 - Decoración
60 - Colisión y navegación derivadas
```

Las fases evitan que una decoración altere el patrón de terreno salvo que se declare. Una fase puede leer el mapa semántico original, el resultado anterior o ambos.

# Resolución de coincidencias

Cuando varias reglas coinciden:

1. Fase activa.
2. Mayor prioridad explícita.
3. Mayor especificidad, medida por restricciones efectivas.
4. Patrón con mayor alcance, si el paquete lo configura.
5. Selección ponderada reproducible entre equivalentes.
6. ID estable para desempate final.

El editor muestra la lista y permite simular cambios de prioridad.

# Transformaciones

Rotaciones y reflejos solo se aplican si la topología y el arte lo permiten. Cada transformación remapea offsets, direcciones, outputs y flags del tile. Las simetrías hexagonales difieren de las ortogonales.

Una regla transformada conserva un ID derivado para diagnóstico, pero no se serializa como regla duplicada.

# Actualización incremental

Al editar una celda se calcula el conjunto de anclas potencialmente afectadas. Para un patrón de radio `r`, no basta siempre un cuadrado: se usa la métrica de la topología.

```text
changedCells
 -> expandir por alcance máximo de reglas lectoras
 -> invalidar outputs generados por esas anclas
 -> reevaluar en orden de fase
 -> aplicar delta atómico
```

Se mantiene un índice inverso desde celda fuente a resultados generados o desde ancla a footprint. Esto permite retirar exactamente la salida antigua.

# Índices de reglas

Para evitar probar todas las reglas:

- Indexar por fase y tipo de capa.
- Elegir una condición discriminante del patrón.
- Indexar por valor central, tag o conector.
- Precompilar condiciones a predicados y bitsets.

La optimización se valida con perfiles; no debe complicar el formato público.

# Contenido manual y generado

Cada celda o instancia conoce su autoría:

```text
Manual
Generated(rule, anchor, revision)
FrozenFromGenerated
Imported
```

Por defecto, las reglas no reemplazan contenido manual. El usuario puede congelar una región, liberar resultados congelados o regenerar solo outputs generados.

# Aleatoriedad estable

La variante se deriva de:

```text
hash(projectSeed, mapId, ruleId, anchor, phase, variantChannel)
```

Así una edición lejana no cambia todas las flores. La aleatoriedad global secuencial se evita para resultados incrementales.

# Editor de reglas

Debe incluir:

- Lienzo de patrón adaptado a topología.
- Paleta de condiciones.
- Vista de salidas por capa.
- Transformaciones permitidas.
- Prioridad, peso y fase.
- Casos de ejemplo positivos y negativos.
- Botón para buscar coincidencias en el mapa.
- Cobertura de máscaras y reglas inalcanzables.

# Diagnósticos

- Regla nunca coincidente.
- Outputs fuera de rango permitido.
- Conflicto permanente con regla de mayor prioridad.
- Referencia a tile o capa inexistente.
- Ciclo entre fases derivadas.
- Conjunto Wang sin candidatos para una firma.
- Variantes con pesos inválidos.

# Pruebas

Se generan mapas exhaustivos para máscaras pequeñas, pruebas property-based para transformaciones y corpus dorados para paquetes complejos. La incrementalidad se compara contra un recálculo completo y ambos deben producir el mismo estado.

# API de ejecución

```csharp
RuleEvaluationResult Evaluate(
    RuleProgram program,
    MapSnapshot input,
    CellRegion dirtyRegion,
    RuleEvaluationOptions options,
    CancellationToken token);
```

El resultado contiene delta, diagnósticos, métricas y procedencia; no modifica el documento.


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

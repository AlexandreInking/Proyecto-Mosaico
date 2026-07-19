---
title: "Proyecto Mosaico - Visión de producto y alcance"
subtitle: "Propuesta de valor, usuarios, escenarios, límites y métricas de éxito"
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

> **Documento:** PM-01  
> **Versión:** 0.1.1 - Auditoría incorporada
> **Estado:** Auditado; no aprobado para implementación, con correcciones previas a Fase 0.
> **Nombre del producto:** Proyecto Mosaico es un nombre provisional.


# Resumen ejecutivo

Proyecto Mosaico es un editor de mapas y niveles 2D independiente del motor. Permite que una persona combine cuatro maneras de trabajar en un mismo documento:

- Colocación manual precisa de tiles y objetos.
- Pintura semántica, donde se dibuja WATER, ROAD, WALL o PLATFORM sin escoger cada sprite.
- Transformación automática mediante reglas locales, patrones y terrenos.
- Generación procedural y WFC, con previsualización, bloqueo de regiones, validación y edición posterior.

El producto no intenta reproducir un editor pictórico de mapas. Las capas, máscaras, imágenes y paralaje existen para componer niveles, no para sustituir una aplicación de ilustración.

![Flujo de intención a exportación](../diagramas/semantic_pipeline.png)

# Problema que resuelve

Los editores de tilemaps tradicionales son excelentes para colocar contenido, pero el trabajo repetitivo de bordes, esquinas, transiciones, variaciones y decoraciones consume tiempo y produce errores. Las herramientas procedurales, por otro lado, suelen generar resultados difíciles de corregir o desconectados del flujo manual. Mosaico une ambos mundos y conserva la autoría del diseñador.

La persona debe poder decir:

> Aquí hay agua, este corredor debe permanecer, completa el bosque, no cambies esta habitación, aplica el estilo de invierno y valida que el jugador pueda llegar a la salida.

El sistema traduce esa intención en capas visuales y de juego, explica qué reglas actuaron y permite revertir cada operación.

# Usuarios objetivo

## Diseñador de niveles 2D

Necesita construir niveles cenitales, plataformas, metroidvanias, tácticos hexagonales o escenarios isométricos. Valora herramientas predecibles, atajos, capas, objetos, colisiones, pruebas de navegación e integración con el motor.

## Artista técnico de tiles

Prepara tilesets, animaciones, colisiones, tags, Wang sets, conectores y reglas de patrones. Necesita depuración visual y reutilización de paquetes de reglas.

## Diseñador procedural

Crea generadores, restricciones y presets. Necesita semillas reproducibles, métricas, validadores, comparación de resultados y ejecución por lotes.

## Programador de herramientas o motor

Integra formatos, escribe plugins y exportadores, automatiza builds y valida contenido en CI.

## Equipo pequeño o creador independiente

Busca reducir tareas repetitivas sin construir un editor interno. Necesita instalación sencilla, documentación local y un camino gradual desde uso manual hasta automatización.

# Escenarios principales

## Nivel lateral

El usuario dibuja la ruta principal y plataformas obligatorias. Un validador usa parámetros de salto para detectar huecos imposibles. Las reglas añaden superficies, bordes, pendientes y fondos. Un generador propone rutas opcionales, pero respeta regiones bloqueadas.

## Mundo cenital

Se pintan terrenos semánticos y caminos. El motor de patrones resuelve costas, transiciones y decoraciones. Voronoi y ruido generan biomas; un grafo garantiza conexiones entre asentamientos.

## Táctico hexagonal

Cada hexágono conserva terreno, elevación, coste y cobertura. Las reglas visuales resuelven costas y carreteras en seis direcciones. El exportador produce datos de navegación y una representación compatible con el motor.

## Ciudad isométrica

El usuario fija calles y parcelas. Un generador coloca huellas de edificios. WFC completa módulos compatibles de fachadas y tejados. El orden de renderizado se deriva de anclas y profundidad, con correcciones manuales cuando sea necesario.

## Completion de una región

El usuario selecciona un área incompleta, bloquea el perímetro y pide a WFC que la complete. Puede explorar variantes con la misma estructura, aceptar una o restaurar el estado anterior.

# Propuesta de valor

1. **Universalidad estructural:** distintas vistas comparten un dominio y no son productos aislados.
2. **Intención separada del arte:** cambiar de tileset o estación no exige rehacer el diseño lógico.
3. **Procedural editable:** la generación produce comandos y procedencia, no una caja negra irreversible.
4. **Explicabilidad:** el inspector muestra regla, semilla, versión y causa de una decisión.
5. **Integración abierta:** formato documentado, CLI, plugins e importadores/exportadores desacoplados.
6. **Calidad de herramienta profesional:** recuperación, atomicidad, rendimiento, accesibilidad y pruebas visuales.

# Alcance funcional

El producto incluirá mapas finitos e infinitos, capas especializadas, tilesets, objetos, propiedades tipadas, animaciones, colisiones, navegación, topologías múltiples, reglas, generadores, WFC, importación, exportación, CLI y plugins.

El editor podrá contener imágenes libres y grupos con paralaje, pero no ofrecerá en las primeras versiones pintura raster avanzada, filtros fotográficos, pinceles artísticos complejos ni un catálogo comercial de stamps.

# Fuera de alcance inicial

- Motor de juego completo, física en tiempo real o scripting de gameplay general.
- Editor vectorial profesional.
- Colaboración simultánea multiusuario estilo documento en línea.
- Marketplace dentro de la aplicación.
- Generación de arte mediante modelos de imagen como requisito central.
- Compatibilidad perfecta con cada extensión privada de todos los motores.
- Sustitución total de Tiled desde la primera versión.

# Diferenciación frente a herramientas existentes

Mosaico no se define por tener más botones, sino por mantener un modelo semántico y procedural como parte nativa del documento. La compatibilidad con Tiled es una capacidad de intercambio; TileKit inspira la transformación por patrones; Rule Tile ilustra reglas vecinales; WFC aporta resolución de restricciones. La implementación debe ser propia, coherente y gobernada por los requisitos del producto.

# Métricas de éxito

## Métricas de tarea

- Tiempo para construir un área repetitiva frente a colocación manual.
- Número de correcciones manuales requeridas después de aplicar reglas.
- Porcentaje de operaciones que se pueden deshacer sin pérdida.
- Éxito de importación y exportación en proyectos de referencia.
- Tiempo de aprendizaje para completar un tutorial real.

## Métricas de calidad

- Cero pérdidas de datos en pruebas de fallo de proceso y energía simulada.
- Cero adyacencias inválidas en suites de autotiling y WFC.
- Presupuesto de interacción sostenido en mapas grandes de referencia.
- Tasa de archivos antiguos migrados correctamente.
- Cobertura de teclado de los flujos esenciales.

## Métricas de adopción

- Proyectos creados y exportados, no solo instalaciones.
- Reutilización de paquetes de reglas y presets.
- Número de formatos y motores mantenidos por plugins externos.
- Retención de usuarios que completan el primer mapa.

# Estrategia de producto

La primera versión debe ser un editor ortogonal excelente y una demostración clara del mapa semántico. Isométrico y hexagonal se añaden cuando el contrato topológico ha sido probado. WFC aparece después de que el motor de reglas, el sistema de transacciones y los validadores sean confiables.

La prioridad no es acumular algoritmos. Es conseguir que una persona pueda alternar de forma natural entre pintar, generar, inspeccionar, corregir y exportar.

# Riesgos de producto

- Interfaz demasiado compleja por exponer todos los conceptos simultáneamente.
- Resultados procedurales técnicamente válidos pero artísticamente pobres.
- Expectativas irreales de compatibilidad con herramientas existentes.
- Convertir el sistema semántico en una obligación en vez de una ventaja opcional.
- Hacer que cada topología tenga un flujo distinto y fragmentar la experiencia.

La mitigación principal es una UX progresiva: modo básico para edición directa, modo de reglas para autores de tilesets y modo procedural para usuarios avanzados.

# Criterio de salida de la fase de descubrimiento

La visión se considera validada cuando tres prototipos verticales demuestran: edición ortogonal manual completa; transformación semántica por patrones con actualización incremental; y regeneración localizada reproducible con conservación de regiones bloqueadas.


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

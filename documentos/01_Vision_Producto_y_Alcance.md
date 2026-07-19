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
> **Versión:** 0.2.0 - Ola 1 incorporada
> **Estado:** Aprobado
> **Alcance de aprobación:** Fase 0 condicionada; Fase 1 permanece no aprobada.
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

# Usuario primario F0-F1

La hipótesis primaria es un creador independiente o diseñador de niveles 2D con experiencia básica o intermedia en tilemaps, que trabaja solo o en un equipo de hasta cinco personas sobre escritorio Windows. Construye niveles ortogonales cenitales o laterales, usa teclado y mouse, y necesita editar, deshacer, guardar, reabrir y exportar sin programar plugins.

Reclutamiento para validación: al menos seis meses creando mapas 2D, un proyecto terminado o prototipo jugable, experiencia con Tiled, Unity Tilemap, Godot TileMap o equivalente y ninguna participación previa en el diseño de Mosaico. Cada ronda usa cinco participantes y registra experiencia y herramienta habitual.

Antiusuario F0-F1: equipo AAA que exige colaboración simultánea o pipeline propietario; artista que busca pintura raster/vectorial profesional; desarrollador cuyo objetivo principal es plugins o CI; usuario que exige isométrico, hexagonal, WFC o procedural avanzado desde el primer uso; y usuario móvil/tablet. Estos perfiles siguen siendo futuros o secundarios, pero no deciden el primer slice.

Problema verificable: construir y mantener niveles ortogonales obliga a repetir colocación y correcciones, mientras automatizaciones existentes suelen ser difíciles de corregir o revertir. La primera evidencia debe demostrar edición directa predecible y cero pérdida antes de medir automatización.

# Tareas de referencia

| ID | Tarea | Éxito | Requisitos | Fase |
|---|---|---|---|---|
| TR-01 | Crear mapa ortogonal 32×18, pintar, borrar, deshacer/rehacer, guardar, cerrar, reabrir y exportar | Estado semántico e IDs iguales; exportación válida; sin rescate | REQ-PROJ-001, REQ-MAP-004, REQ-EDIT-001/004, REQ-ASSET-001, REQ-IO-003, REQ-NFR-006 | Spike reducido F0; completo F1 |
| TR-02 | Pintar WATER, inspeccionar regla, modificar una celda y deshacer | Incremental igual a recálculo completo; usuario explica causa y reversión | REQ-MAP-005, REQ-EDIT-004, REQ-RULE-001/006/007 | Spike F0; entrega F3 |
| TR-03 | Previsualizar regeneración localizada con semilla y región bloqueada, cancelar, aceptar y deshacer | Cancelación no muta; semilla reproduce; bloqueos intactos | REQ-EDIT-004, REQ-PCG-003…006 | Spike F0; entrega F5 |

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

## Contratos métricos F0-F1

Toda ejecución registra ID, tipo, REQ, hipótesis, fixture y hash, unidad, método, muestra, entorno, baseline, objetivo, umbral de fallo, evidencia, acción posterior y dueño. Baseline desconocido nunca cuenta como éxito.

| ID | Tipo | Baseline | Objetivo | Muestra y método | Fallo |
|---|---|---|---|---|---|
| USER-TR01-001 | Usuario | Herramienta habitual, medido en ronda | ≥4/5 completan sin ayuda crítica; mediana ≤20 min y no peor que baseline | Cinco usuarios, Windows 11, fixture fijo, observación y cronómetro | Corregir flujo/onboarding y repetir |
| FUNC-RT-001 | Funcional | Corpus inicial | 100 % conserva hash semántico e IDs | Corpus canónico; comparación automática antes/después | Cualquier diferencia es S0 |
| FUNC-UNDO-001 | Funcional | Matriz inicial | 100 % restaura hash previo y redo final | Herramientas esenciales y secuencias deterministas | Divergencia es S0 |
| FUNC-SAVE-001 | Integridad | Sin baseline aceptable | Tras fallo existe versión anterior o nueva completa; cero mezclas | Fault injection en cada etapa | Spike rechazado |
| PERF-FRAME-001 | Benchmark | Se mide en F0 | Frame p95 ≤16,7 ms | Build Release, fixture y máquina publicados, 30 muestras | Optimizar o rechazar stack |
| PERF-BRUSH-001 | Benchmark | Se mide en F0 | Commit p95 <50 ms | Misma máquina/fixture, 30 muestras | Optimizar o reducir alcance con decisión |
| SEC-OPEN-001 | Seguridad | Cero actividad esperada | Cero procesos, red o escrituras fuera de roots al abrir | Fixture canario y observación de efectos | S0/S1, fase abierta |

Evidencia de usuario, evidencia funcional y benchmark se reportan por separado. S0/S1 no admite waiver; S2 exige dueño, justificación y caducidad.

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

La visión se considera validada cuando una matriz `hipótesis → spike → evidencia → decisión` demuestra TR-01, TR-02 y TR-03; compara stack/renderer en viewport, input, HiDPI, accesibilidad, packaging y automatización; prueba atomicidad y chunks; registra ADR, formato experimental y presupuestos; y obtiene revisión humana de Producto/UX, Arquitectura, QA y Seguridad. Cada spike se marca descartable. F0 no promete formato estable, compatibilidad externa ni UI final. Cero S0/S1 puede permanecer abierto.


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

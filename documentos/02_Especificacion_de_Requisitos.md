---
title: "Proyecto Mosaico - Especificación de requisitos"
subtitle: "Requisitos funcionales, no funcionales, reglas de aceptación y trazabilidad"
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

> **Documento:** PM-02  
> **Versión:** 0.1.1 - Auditoría incorporada
> **Estado:** Auditado; no aprobado para implementación, con correcciones previas a Fase 0.
> **Nombre del producto:** Proyecto Mosaico es un nombre provisional.


# Convenciones

Cada requisito posee un identificador permanente. El texto puede aclararse, pero el identificador no se reutiliza para una necesidad diferente. Los criterios indicados son mínimos; las historias y pruebas de cada sprint pueden añadir restricciones.

Prioridades sugeridas:

- **P0:** integridad de datos, contratos del núcleo y capacidades necesarias para cualquier uso.
- **P1:** MVP utilizable y diferenciación inicial.
- **P2:** ampliación de topologías, algoritmos e integraciones.
- **P3:** optimizaciones o flujos especializados.

# Requisitos del sistema

### Gestión de proyectos y documentos

| ID | Requisito | Criterio mínimo de aceptación |
|---|---|---|
| REQ-PROJ-001 | Crear, abrir, guardar y cerrar proyectos sin pérdida de datos | Una prueba round-trip conserva el documento completo y los identificadores estables. |
| REQ-PROJ-002 | Soportar varios mapas, tilesets y recursos dentro de un proyecto | El explorador muestra dependencias y permite abrir cada recurso. |
| REQ-PROJ-003 | Detectar modificaciones externas y ofrecer recarga o conservación local | La aplicación nunca sobrescribe silenciosamente cambios externos. |
| REQ-PROJ-004 | Mantener historial de migraciones de formato | Un archivo de versiones anteriores se actualiza mediante migraciones registradas. |
| REQ-PROJ-005 | Proveer guardado automático y recuperación tras fallo | Una sesión interrumpida puede restaurarse sin sustituir el último guardado confirmado. |

### Topologías, mapas y capas

| ID | Requisito | Criterio mínimo de aceptación |
|---|---|---|
| REQ-MAP-001 | Crear mapas ortogonales finitos e infinitos | Las coordenadas positivas y negativas funcionan mediante chunks. |
| REQ-MAP-002 | Crear mapas isométricos de diamante y escalonados | Selección, pintura y exportación mantienen correspondencia celda-mundo. |
| REQ-MAP-003 | Crear mapas hexagonales pointy-top y flat-top | Cada celda expone exactamente seis vecinos coherentes. |
| REQ-MAP-004 | Permitir perfiles de uso cenital y lateral sobre cuadrícula ortogonal | El perfil modifica ayudas, validadores y herramientas sin cambiar el almacenamiento base. |
| REQ-MAP-005 | Gestionar capas de tiles, objetos, imágenes, grupos, semántica, colisión y navegación | Cada tipo conserva propiedades comunes y datos especializados. |
| REQ-MAP-006 | Aplicar visibilidad, bloqueo, opacidad, offset, paralaje y orden | El viewport y la exportación respetan los valores. |
| REQ-MAP-007 | Soportar múltiples tilesets por mapa | Los identificadores permanecen estables al reordenar tilesets. |

### Edición interactiva

| ID | Requisito | Criterio mínimo de aceptación |
|---|---|---|
| REQ-EDIT-001 | Pintar, borrar, rellenar y dibujar formas | Cada herramienta produce una transacción única de undo. |
| REQ-EDIT-002 | Seleccionar, mover, copiar, pegar, rotar y reflejar regiones | La transformación preserva capas y referencias. |
| REQ-EDIT-003 | Editar objetos libres, polígonos, polilíneas, puntos y texto | Los vértices admiten snapping y edición numérica. |
| REQ-EDIT-004 | Disponer de undo/redo transaccional y persistente durante la sesión | Una secuencia aleatoria de acciones vuelve exactamente a los estados previos. |
| REQ-EDIT-005 | Ofrecer atajos configurables y comandos buscables | Todo comando relevante puede ejecutarse desde teclado y paleta. |
| REQ-EDIT-006 | Mostrar reglas, colisiones, navegación, chunks y semántica como overlays | Los overlays no alteran los datos y pueden combinarse. |

### Tilesets y assets

| ID | Requisito | Criterio mínimo de aceptación |
|---|---|---|
| REQ-ASSET-001 | Importar sprite sheets con tamaño, margen y separación | La región de cada tile coincide con los parámetros y no presenta bleeding. |
| REQ-ASSET-002 | Importar colecciones de imágenes individuales | Cada imagen genera una definición de tile estable. |
| REQ-ASSET-003 | Definir propiedades, tags, animaciones y colisiones por tile | Los datos se serializan y exportan. |
| REQ-ASSET-004 | Detectar recursos faltantes y permitir relocalización | Las referencias se reparan sin modificar IDs lógicos. |
| REQ-ASSET-005 | Generar miniaturas y cachés sin contaminar el proyecto | Los artefactos derivados pueden eliminarse y reconstruirse. |

### Autotiling y reglas

| ID | Requisito | Criterio mínimo de aceptación |
|---|---|---|
| REQ-RULE-001 | Soportar bitmasks de 4, 8 y 6 vecinos según topología | Los casos canónicos producen el tile esperado. |
| REQ-RULE-002 | Soportar Wang edges, corners y combinaciones | Las transiciones se resuelven y actualizan vecinos. |
| REQ-RULE-003 | Definir patrones de tamaño arbitrario con ancla | La coincidencia funciona en bordes y coordenadas negativas. |
| REQ-RULE-004 | Admitir EXACT, ANY, EMPTY, NOT, TAG, ONE_OF y SAME_AS | Cada condición posee pruebas positivas y negativas. |
| REQ-RULE-005 | Resolver conflictos por fase, prioridad, especificidad y peso | El resultado es determinista para una semilla fija. |
| REQ-RULE-006 | Actualizar solo la región afectada por una edición | El coste depende del radio máximo de regla, no del tamaño total del mapa. |
| REQ-RULE-007 | Registrar procedencia de contenido generado | El inspector identifica regla, ancla, revisión y semilla. |

### Generación procedural

| ID | Requisito | Criterio mínimo de aceptación |
|---|---|---|
| REQ-PCG-001 | Ejecutar generadores mediante una interfaz común | Cada generador declara parámetros, entrada, salida y validadores. |
| REQ-PCG-002 | Proveer BSP, random walk, cellular automata, laberintos, ruido, Voronoi y grafos | Cada algoritmo incluye preset y prueba reproducible. |
| REQ-PCG-003 | Usar semillas deterministas y flujos aleatorios separados | Cambiar decoración no altera necesariamente la estructura. |
| REQ-PCG-004 | Permitir previsualizar, aceptar, cancelar y regenerar una selección | Cancelar no modifica el documento. |
| REQ-PCG-005 | Bloquear regiones y preservar contenido manual | La regeneración local no toca celdas protegidas. |
| REQ-PCG-006 | Validar conectividad, densidad, accesibilidad y restricciones de conteo | Los fallos generan diagnóstico y acciones de reparación. |

### Wave Function Collapse

| ID | Requisito | Criterio mínimo de aceptación |
|---|---|---|
| REQ-WFC-001 | Implementar Simple Tiled Model con compatibilidad direccional | La salida no contiene adyacencias prohibidas. |
| REQ-WFC-002 | Implementar modelo Overlapping con extracción N por N | Los patrones, frecuencias y solapamientos se derivan de la muestra. |
| REQ-WFC-003 | Usar entropía ponderada y desempate reproducible | Una misma semilla reproduce decisiones. |
| REQ-WFC-004 | Propagar dominios mediante bitsets y soportes | Los benchmarks cumplen el presupuesto definido. |
| REQ-WFC-005 | Detectar contradicciones y ofrecer reinicio, backtracking y reparación local | El usuario ve causa y estrategia aplicada. |
| REQ-WFC-006 | Precolapsar celdas y completar mapas parciales | Las celdas bloqueadas nunca cambian. |
| REQ-WFC-007 | Visualizar entropía, dominios y cadena causal | El depurador explica por qué se eliminó una opción. |

### Importación, exportación y plugins

| ID | Requisito | Criterio mínimo de aceptación |
|---|---|---|
| REQ-IO-001 | Definir un formato nativo versionado y legible | El esquema dispone de documentación y migraciones. |
| REQ-IO-002 | Importar y exportar TMX/JSON de Tiled dentro del subconjunto declarado | Las diferencias no soportadas se reportan, no se descartan silenciosamente. |
| REQ-IO-003 | Exportar CSV e imágenes de previsualización | La orientación y el recorte son configurables. |
| REQ-IO-004 | Proveer adaptadores para Unity, Godot y motores propios | Los adaptadores no contaminan el dominio central. |
| REQ-IO-005 | Cargar plugins con manifiesto, permisos y compatibilidad de API | Un plugin incompatible se rechaza con diagnóstico. |
| REQ-IO-006 | Permitir plugins de herramientas, generadores, validadores, paneles e importadores | Cada extensión usa servicios públicos documentados. |

### Calidad, rendimiento y seguridad

| ID | Requisito | Criterio mínimo de aceptación |
|---|---|---|
| REQ-NFR-001 | Mantener interacción fluida a 60 FPS en operaciones comunes | El presupuesto se mide con proyectos de referencia. |
| REQ-NFR-002 | Abrir mapas grandes sin reservar matrices densas vacías | Los chunks y cachés limitan el uso de memoria. |
| REQ-NFR-003 | No bloquear la interfaz en generación, importación o validación larga | Las tareas son cancelables y reportan progreso. |
| REQ-NFR-004 | Ser resistente a archivos corruptos o maliciosos | Se aplican límites de tamaño, profundidad y recursos. |
| REQ-NFR-005 | Proteger recuperación, backups y escritura atómica | Un fallo durante guardado no destruye el archivo anterior. |
| REQ-NFR-006 | Ser accesible por teclado y compatible con escalado HiDPI | Los flujos esenciales no requieren mouse. |
| REQ-NFR-007 | Mantener telemetría opcional, mínima y transparente | El producto funciona sin telemetría y documenta cada dato. |

# Reglas transversales de aceptación

## Integridad

Ningún requisito se considera cumplido si la operación puede corromper el documento, perder identificadores, modificar contenido bloqueado o romper undo/redo. Las pruebas deben comparar el estado semántico completo, no únicamente una captura.

## Determinismo

Toda función que declare reproducibilidad debe registrar semilla, versión del algoritmo, parámetros normalizados y dependencias. El determinismo se limita a la misma plataforma y versión cuando existan diferencias justificadas de coma flotante; esas diferencias deben documentarse.

## Cancelación

Una tarea cancelable debe terminar en un punto consistente. No se acepta dejar la mitad de un resultado procedural aplicada ni un archivo parcialmente reemplazado.

## Diagnóstico

Cuando un formato, regla o plugin no pueda procesarse, el sistema debe indicar el recurso, la ubicación, la causa probable y una acción. Los errores silenciosos están prohibidos.

# Matriz de trazabilidad inicial

| Objetivo de producto | Grupos de requisitos |
|---|---|
| Edición universal 2D | REQ-MAP, REQ-EDIT, REQ-ASSET |
| Intención separada del arte | REQ-MAP-005, REQ-RULE, REQ-PCG |
| Procedural editable | REQ-PCG-003 a 006, REQ-WFC-005 a 007 |
| Interoperabilidad | REQ-IO |
| Herramienta profesional | REQ-PROJ, REQ-NFR |

# Casos de error obligatorios

Las pruebas de aceptación deben incluir archivos truncados, referencias rotas, tilesets enormes, coordenadas negativas, reglas sin solución, plugins incompatibles, falta de espacio en disco, cancelación durante guardado, cierre inesperado y pérdida temporal de un recurso externo.

# Criterios de no regresión

Cada bug de integridad, serialización, undo, geometría o compatibilidad debe producir una prueba automatizada. Cada bug visual reproducible debe añadir una escena dorada o una interacción automatizada.

# Gestión de requisitos

Un cambio de requisito debe especificar compatibilidad, migración, telemetría o evidencia de usuario que lo motiva y pruebas afectadas. Los requisitos P0 no pueden degradarse para acelerar una función P2 sin una decisión explícita.


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

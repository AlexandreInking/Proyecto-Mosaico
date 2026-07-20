---
title: "Proyecto Mosaico - UX del editor y flujos de trabajo"
subtitle: "Modelo mental, disposición, herramientas, modos progresivos y accesibilidad"
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

> **Documento:** PM-06  
> **Versión:** 0.2.0 - Shell dual y pipeline propuestos
> **Estado:** Borrador
> **Cambio:** flujos de mapas conservados; expansión pendiente de aprobación.

> **Expansión UX:** mismo shell React en Web/Desktop; navegación principal `Assets`, `Pipelines`, `Maps`, `World`, `Jobs` y `Export`. Toda transformación usa selección -> receta -> preview/diff -> validación -> commit. Cada job muestra ejecución local/navegador/cloud, progreso, cancelación, coste estimado cuando aplique y errores agrupados.
> **Nombre del producto:** Proyecto Mosaico es un nombre provisional.


# Objetivo de experiencia

La herramienta debe sentirse como un editor directo, no como un formulario para configurar algoritmos. El usuario ve el resultado inmediatamente y puede profundizar en semántica, reglas o procedural cuando lo necesita.

# Modelo mental

El documento contiene capas. El usuario elige qué representa la capa activa, selecciona una herramienta y realiza una acción reversible. Las automatizaciones aparecen como asistentes que producen previews o como reglas vinculadas a capas; no como procesos ocultos.

# Disposición base

```text
+--------------------------------------------------------------+
| Menú | comando | herramienta | modo | zoom | ejecutar         |
+---------------+-------------------------------+--------------+
| Proyecto      |                               | Capas        |
| Assets        |           Viewport            | Propiedades  |
| Tilesets      |                               | Reglas       |
| Presets       |                               | Validación   |
+---------------+-------------------------------+--------------+
| Estado: celda, mundo, selección, job, warnings               |
+--------------------------------------------------------------+
```

Todos los paneles son acoplables y restablecibles. Se ofrecen workspaces: Edición, Tileset, Reglas, Procedural, WFC y Depuración.

# Modos de complejidad

## Básico

Tiles, capas, objetos, pincel, selección, guardar y exportar. La semántica es opcional.

## Reglas

Expone terreno, tags, patrones, fases, procedencia y depuración.

## Procedural

Expone generadores, semillas, máscaras, restricciones, métricas y comparación de variantes.

El cambio de modo reorganiza herramientas; no cambia el documento ni oculta contenido de forma irreversible.

# Herramientas esenciales

## Pincel

Soporta un tile, stamp multi-celda, patrón aleatorio y pintura semántica. La vista previa muestra exactamente las celdas afectadas y el resultado de reglas cuando sea barato.

## Borrador

Distingue borrar contenido manual, borrar salida generada y limpiar valor semántico. Las diferencias deben ser visibles para evitar resultados inesperados.

## Relleno

Ofrece conectividad según topología, límite por capa, tolerancia y preview para áreas grandes. Puede cancelar antes de aplicar.

## Selección

Selecciona celdas y objetos, con filtros por capa o tipo. Mover una selección multi-capa crea una transacción. El pegado permite mapear tilesets faltantes.

## Formas

Rectángulo, elipse, línea, polígono y formas topológicas como anillo hexagonal. En mapas laterales puede incluir plataforma y pendiente.

## Objetos

Inserción, transformación, edición de vértices, conexiones y edición numérica. Los handles mantienen tamaño visual independiente del zoom.

# Flujo de tileset

1. Importar imagen o colección.
2. Configurar regiones y anclas.
3. Nombrar, etiquetar y agrupar tiles.
4. Definir colisiones y animaciones.
5. Configurar Wang, conectores o reglas.
6. Ejecutar diagnósticos de tiles faltantes y casos no cubiertos.
7. Publicar como paquete reutilizable.

# Flujo semántico

El usuario crea un vocabulario: GROUND, WATER, WALL, ROAD. Puede asignar iconos o colores de depuración. Una capa semántica alimenta reglas que escriben en capas visuales, colisión y navegación.

El inspector de una celda muestra:

- Valor semántico.
- Tiles visuales resultantes por capa.
- Regla ganadora y alternativas rechazadas.
- Dependencias vecinales.
- Procedencia y semilla.
- Quick fix para congelar el resultado como manual.

# Flujo procedural

1. Seleccionar mapa o región.
2. Elegir generador y preset.
3. Definir máscaras: editable, bloqueada, requerida, prohibida.
4. Ejecutar preview en snapshot.
5. Comparar variantes y métricas.
6. Aceptar como una sola transacción o cancelar.
7. Inspeccionar y corregir.

El preview debe permitir antes/después, overlay semántico y navegación. Las variantes no aceptadas no ensucian el historial.

# Flujo WFC

El usuario escoge modelo, conjunto de patrones, región y restricciones. Durante la ejecución ve progreso y puede pausar para inspección en modo de desarrollo. En uso normal solo ve variantes y diagnósticos claros.

Una contradicción se presenta como:

```text
No existe una pieza compatible en (42, -7).
Causa mínima conocida: borde ROAD_EAST exigido por la celda vecina,
pero la región bloqueada obliga WATER_WEST.
Acciones: retroceder, desbloquear, relajar regla o cancelar.
```

# Validación integrada

Los resultados aparecen en un panel agrupado por severidad y ubicación. Al activar un problema, el viewport enfoca la zona y resalta evidencia. Los quick fixes son comandos reversibles.

# Prevención de errores

- Capas bloqueadas rechazan edición con feedback visual.
- Acciones que reemplazan mucho contenido muestran alcance.
- Exportación con pérdida exige confirmación informada.
- Regenerar una región muestra qué contenido manual sería afectado.
- El sistema no cambia automáticamente el tileset activo por un click accidental en el mapa.

# Accesibilidad

- Navegación completa por teclado.
- Paleta de comandos con búsqueda tolerante.
- Foco visible y orden lógico.
- Escalado HiDPI y tamaños configurables.
- Iconos acompañados de texto o tooltip.
- Overlays con patrones, no solo color.
- Personalización de contraste y velocidad de animación.
- Lectura accesible de propiedades y errores.

# Atajos y comandos

Los comandos tienen ID estable, etiqueta, categoría, contexto y atajo configurable. Los conflictos se detectan. Un comando puede ejecutarse desde menú, toolbar, paleta, macro o plugin sin duplicar lógica.

# Onboarding

El primer inicio ofrece proyectos de ejemplo, no un recorrido modal interminable. Tutoriales activos:

- Crear un mapa ortogonal y exportarlo.
- Convertir una capa semántica en costas automáticas.
- Generar una cueva y reparar conectividad.
- Completar una región con WFC.

# Pruebas de UX

Las tareas de referencia se observan con usuarios y se miden por tiempo, errores, deshacer, preguntas y capacidad de explicar el resultado. La regresión visual no sustituye pruebas de uso.

# Criterio de calidad

Una capacidad avanzada no está terminada si solo puede operarla quien leyó el código. Debe tener vocabulario comprensible, preview, cancelación, diagnóstico y una ruta de aprendizaje.


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

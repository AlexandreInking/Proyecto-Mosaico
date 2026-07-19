---
title: "Proyecto Mosaico - Roadmap, backlog, ADR y plantillas"
subtitle: "Fases, entregables, riesgos, definition of done y artefactos de gestión"
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

> **Documento:** PM-14  
> **Versión:** 0.1.1 - Auditoría incorporada
> **Estado:** Auditado; no aprobado para implementación, con correcciones previas a Fase 0.
> **Nombre del producto:** Proyecto Mosaico es un nombre provisional.


# Estrategia de entrega

El proyecto avanza por slices verticales ejecutables. Cada fase produce una aplicación que abre, edita, guarda y prueba algo real. No se construyen veinte subsistemas incompletos en paralelo.

# Fase 0 - Descubrimiento y spikes

Objetivos:

- Elegir stack mediante prototipos de viewport, input y packaging.
- Validar coordenadas ortogonales, isométricas y hexagonales.
- Probar guardado atómico y chunks.
- Probar automatización visual.

Salida: ADR de stack, repositorio, CI, proyecto ejemplo y presupuestos iniciales.

# Fase 1 - Editor ortogonal mínimo

Epics:

- Proyecto y formato v0.
- Tileset de sprite sheet.
- Tile layer y viewport.
- Pincel, borrador y fill.
- Capas, undo/redo, save/load.
- Exportación CSV/PNG.

Criterio: un usuario crea un nivel lateral o cenital ortogonal y lo reabre sin pérdida.

# Fase 2 - Objetos y producción

- Object layers y shapes.
- Propiedades tipadas.
- Colisiones y animaciones de tiles.
- Mapas infinitos por chunks.
- Autosave, recuperación y validación.
- CLI inicial.

Criterio: proyecto real pequeño puede integrarse con motor propio.

# Fase 3 - Semántica y autotiling

- Semantic layers.
- Bitmask 4/8.
- Wang edges/corners.
- Motor de patrones v1.
- Procedencia y actualización incremental.
- Editor y diagnósticos de reglas.

Criterio: paquete de costas/caminos produce output estable y editable.

# Fase 4 - Topologías adicionales

- Isométrico de diamante.
- Staggered.
- Hex pointy y flat.
- Selección, reglas y overlays por topología.
- Orden de render y objetos altos.

Criterio: proyectos de referencia completos por topología.

# Fase 5 - Procedural

- Framework de generadores.
- BSP, random walk, cellular, maze, noise y grafos.
- Máscaras, presets, previews y variantes.
- Validadores y reparaciones.
- Batch CLI.

Criterio: generación localizada aceptable y reproducible.

# Fase 6 - WFC

- Simple Tiled.
- Entropía y propagación optimizadas.
- Backtracking.
- Completion localizada.
- Overlapping.
- Depurador.

Criterio: catálogos de referencia sin adyacencias inválidas y con diagnósticos de contradicción.

# Fase 7 - Integraciones y Plugin API

- Import/export Tiled documentado.
- Companion de Unity y addon de Godot.
- Plugin API estable 1.0.
- Paquetes y lockfile.
- Seguridad y firma según modelo de distribución.

# Backlog de epics

| Epic | Dependencias | Riesgo |
|---|---|---|
| Modelo de documento | Ninguna | Alto |
| Transformaciones espaciales | Documento | Alto |
| Renderer ortogonal | Espacial | Medio |
| Comandos y undo | Documento | Alto |
| Persistencia y migraciones | Documento | Alto |
| Assets y tilesets | Persistencia | Medio |
| Reglas incrementales | Semántica, comandos | Alto |
| Generadores | Snapshots, comandos | Medio |
| WFC | Topología, bitsets, jobs | Alto |
| Plugin host | Contratos estabilizados | Alto |
| Integración Unity/Godot | Exportadores | Medio |

# Definition of Ready

Una tarea está lista cuando tiene:

- Objetivo y usuario.
- Requisitos enlazados.
- Límites y paths.
- Diseño o ADR si afecta arquitectura.
- Criterios de aceptación automatizables.
- Fixtures o proyecto ejemplo.
- Riesgos y dependencias.

# Definition of Done

- Código revisado.
- Pruebas apropiadas.
- Ejecución real o captura cuando es UI.
- Diagnóstico de errores.
- Accesibilidad considerada.
- Benchmark cuando afecta hot path.
- Documentación y changelog.
- Sin warnings nuevos ni pruebas desactivadas.

# Plantilla ADR

```markdown
# ADR-NNN: Título

Estado: Propuesto | Aceptado | Sustituido
Fecha:
Responsables:

## Contexto
¿Qué problema y restricciones existen?

## Fuerzas
Rendimiento, compatibilidad, tiempo, seguridad, UX.

## Opciones
1. Opción A
2. Opción B
3. Opción C

## Decisión
¿Qué se elige y por qué?

## Consecuencias
Positivas, negativas y deuda.

## Migración y reversión
¿Cómo se adopta o revierte?

## Evidencia
Prototipos, benchmarks, pruebas o usuarios.
```

# Plantilla de especificación de módulo

```markdown
# Módulo
Propósito:
Propietario:
Dependencias permitidas:
Datos que posee:
API pública:
Invariantes:
Errores:
Threading:
Persistencia:
Pruebas de contrato:
Métricas:
Decisiones abiertas:
```

# Plantilla de generador

```markdown
Nombre y versión:
Topologías:
Inputs:
Outputs:
Parámetros:
Semillas/streams:
Máscaras:
Restricciones:
Validadores:
Reparaciones:
Coste esperado:
Cancelación:
Pruebas:
```

# Plantilla de regla

```markdown
Rule ID:
Fase:
Prioridad:
Topología:
Patrón de entrada:
Ancla:
Salidas:
Transformaciones:
Política de conflicto:
Aleatoriedad:
Casos positivos:
Casos negativos:
```

# Plantilla de plan de prueba

```markdown
Riesgo:
Requisitos:
Entorno:
Fixtures:
Pruebas unitarias:
Property tests:
Integración:
Visual/UI:
Rendimiento:
Fault injection:
Criterio de salida:
```

# Riesgos de programa

## Alcance

Mitigación: MVP estricto, fases y no objetivos publicados.

## Stack inmaduro

Mitigación: spikes con viewport, automatización, packaging y HiDPI antes del compromiso.

## Formato prematuro

Mitigación: versionar como experimental hasta corpus real y migraciones.

## Complejidad de reglas

Mitigación: niveles progresivos, diagnósticos y paquetes de ejemplo.

## WFC consume el proyecto

Mitigación: tratarlo como plugin/subsistema posterior, no como fundamento del editor.

## Agentes generan deuda

Mitigación: contratos de tarea, paths permitidos, revisor independiente y pruebas de arquitectura.

# Primeras 12 historias sugeridas

1. Crear proyecto ortogonal vacío.
2. Importar sprite sheet y mostrar tiles.
3. Pintar una celda con preview.
4. Agrupar una pincelada en undo.
5. Guardar y cargar con round-trip.
6. Añadir segunda capa y ordenar.
7. Seleccionar y mover región.
8. Crear mapa infinito con chunk negativo.
9. Exportar CSV y PNG.
10. Crear capa semántica GROUND/AIR.
11. Aplicar regla de superficie lateral.
12. Ejecutar prueba automatizada end-to-end.

# Hitos de decisión

- D0: stack y licencia.
- D1: formato v0 y modelo de identidad.
- D2: MVP ortogonal usable.
- D3: motor de reglas estable.
- D4: contrato topológico validado con hex.
- D5: procedural aceptable.
- D6: WFC listo para beta.
- D7: Plugin API 1.0.

# Próximo artefacto recomendado

Tras aprobar este dossier se debe crear un repositorio de bootstrap con ADR-001, estructura de módulos, CI y un prototipo de viewport. El primer sprint no debe comenzar por WFC, aunque sea la parte más llamativa.


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

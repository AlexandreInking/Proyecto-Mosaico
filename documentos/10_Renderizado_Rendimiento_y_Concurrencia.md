---
title: "Proyecto Mosaico - Renderizado, rendimiento y concurrencia"
subtitle: "Viewport, batching, chunks, cachés, presupuestos, jobs y perfilado"
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

> **Documento:** PM-10  
> **Versión:** 0.2.0 - Renderer web compartido propuesto
> **Estado:** Borrador
> **Cambio:** presupuestos históricos conservados; PixiJS pendiente de spike T0.

> **Cambio:** PixiJS 8 será renderer compartido de mapas, previews y grafos sobre WebGL/WebGPU; React DOM conservará controles accesibles. Jobs de assets/IA ejecutan fuera del thread UI mediante worker, backend o sidecar.
> **Nombre del producto:** Proyecto Mosaico es un nombre provisional.


# Objetivos

El editor debe sentirse inmediato durante paneo, zoom, pintura y selección. Las tareas largas no deben congelar la interfaz. El rendimiento se gobierna con presupuestos y escenas de referencia, no con intuición.

# Pipeline de viewport

```text
Documento o snapshot
 -> capas visibles
 -> culling por cámara
 -> chunks visibles
 -> caché de geometría
 -> batches por textura/material
 -> pass principal
 -> overlays y selección
 -> UI
```

# Cámara

La cámara utiliza coordenadas de mundo en doble precisión y transforma a pantalla cerca del origen de viewport para evitar pérdida de precisión en mapas enormes. El zoom tiene límites, snapping opcional y animaciones cancelables.

# Culling

Se calcula el polígono visible en mundo y se consulta un índice de chunks. Para isométrico o capas con objetos altos se amplía el margen según bounds visuales. Objetos usan quadtree, R-tree o BVH medido con corpus.

# Batching

Tiles con la misma textura, material, blend y pass se agrupan. Las transformaciones de flip y rotación se codifican por instancia. Las capas preservan orden; no se reordena cruzando límites semánticos solo para ahorrar draw calls.

# Atlas y bleeding

- Extrusión de bordes o padding en atlas derivados.
- UV inset apropiado.
- Filtrado configurable entre pixel art y suavizado.
- Mipmaps opcionales y conscientes de tiles.
- Pruebas en zoom fraccionario y HiDPI.

# Caché por chunk

Cada chunk mantiene revisión visual. Una edición invalida solo chunks afectados y, si un sprite sobresale, vecinos necesarios. La caché puede ser lista de instancias, malla o textura renderizada según perfil.

# Overlays

Cuadrícula, semántica, colisión, navegación, selección, entropía y procedencia se renderizan en passes independientes. Deben poder limitarse a viewport y reducir detalle a zoom bajo.

# Animaciones

El tile animado referencia una secuencia. El renderer calcula frame por reloj y offset estable. Se evita duplicar lógica por celda. Un modo de edición puede pausar, avanzar frame o sincronizar.

# Orden isométrico

Se prioriza baseline y bandas de profundidad. Para objetos que se solapan de forma no total puede requerirse grafo de orden parcial, pero el MVP debe usar una regla estable con overrides, evitando un algoritmo costoso e impredecible.

# Presupuestos iniciales

Objetivos de ingeniería, sujetos a benchmark de plataforma objetivo:

- Paneo y zoom: frame p95 menor a 16,7 ms en escena de referencia.
- Pincelada común: feedback visual en el mismo frame y commit menor a 50 ms.
- Undo de 10 000 celdas: menor a 100 ms en máquina de referencia.
- Apertura de proyecto medio: menor a 2 s sin contar importación inicial de assets.
- Memoria: proporcional a chunks con contenido y cachés visibles, no al área infinita.

Se publicará la especificación exacta de la máquina de benchmark.

# Jobs y snapshots

Los workers reciben snapshots inmutables. Un job devuelve un delta. Para previews continuos, se cancelan ejecuciones obsoletas. El documento no se bloquea durante segundos; al aplicar se valida revisión base.

# Scheduler

Prioridades:

1. Input y viewport.
2. Commits de comandos cortos.
3. Caché visible.
4. Preview solicitado.
5. Validación de fondo.
6. Miniaturas y mantenimiento.

Los jobs cooperan con cancelación. No se inicia trabajo pesado ilimitado por cada movimiento del mouse; se usa debounce y coalescing.

# Memoria

- Pools para buffers temporales grandes.
- Copy-on-write para snapshots.
- Bitsets para dominios y tags.
- LRU para thumbnails y chunks renderizados.
- Límites por plugin y por importación.
- Métricas de memoria por subsistema.

La caché se puede purgar sin perder datos.

# Rendimiento de reglas

El motor incremental indexa reglas y limita la región sucia. Se mantiene benchmark que compara incremental contra recálculo completo. El resultado debe ser idéntico.

# Rendimiento de WFC

Se mide por celdas, patrones, densidad de compatibilidad, backtracks y memoria. Se reportan percentiles sobre conjuntos de semillas. Un caso sin solución debe terminar por límite y diagnóstico, no consumir recursos indefinidamente.

# Persistencia y carga

Carga lazy de mapas y chunks cuando el formato lo permita. Las imágenes se decodifican bajo demanda y se limitan dimensiones. El guardado serializa cambios, pero una primera versión puede reescribir archivos pequeños si preserva atomicidad.

# Perfilado integrado

Modo diagnóstico muestra:

- Tiempo de frame y passes.
- Chunks visibles y reconstruidos.
- Draw calls e instancias.
- Jobs activos y cola.
- Tiempo de reglas, generación y WFC.
- Memoria de cachés.

Se puede exportar un trace sin incluir contenido privado del mapa salvo consentimiento.

# Escenas de referencia

- Ortogonal grande con capas densas y animaciones.
- Isométrico con objetos altos y paralaje.
- Hexagonal con overlays de navegación.
- Mapa infinito disperso con coordenadas negativas.
- Paquete de reglas con patrones grandes.
- WFC con catálogo pequeño denso y catálogo grande esparso.

# Degradación controlada

A zoom muy bajo se omiten detalles, animaciones y labels. Durante un job pesado se reduce frecuencia de preview antes de afectar input. El editor comunica que una capa se está reconstruyendo sin bloquear el trabajo.

# Pruebas

- Benchmarks reproducibles en CI dedicada.
- Presupuesto de memoria y detección de fugas.
- Stress de pintura continua y undo.
- Apertura/cierre repetido de proyectos.
- Cambio rápido de zoom y pantallas HiDPI.
- Cancelación masiva de previews.
- Datos corruptos que intentan asignaciones enormes.


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

# Mosaico — branding y diseño de producto

## Dirección de marca

### Nombre público

Usar:

> **Mosaico — 2D Asset Workspace**

El descriptor debe acompañar al nombre en itch.io, GitHub, landing y publicaciones porque “Mosaico” es una palabra común y tiene usos técnicos ajenos al producto. No afirmar que el nombre está legalmente disponible sin una comprobación marcaria.

### Idea central

**Ordena el material creativo sin quitarle carácter artesanal.**

La marca debe sentirse como una mesa de trabajo para creadores: precisa, local, modular y cálida. Evitar estética de “AI magic”, dashboards corporativos y gradientes genéricos.

### Personalidad

- Clara.
- Técnica sin arrogancia.
- Artesanal.
- Confiable.
- Experimental, pero honesta.

### Voz

- Decir primero qué resultado obtiene la persona.
- Usar verbos concretos: `import`, `edit`, `transform`, `map`, `export`.
- Mostrar límites junto al beneficio.
- Preferir “alpha”, “local”, “currently supported” y “known limitation” a superlativos.
- No usar “revolutionary”, “AI-powered” o “all-in-one” en la alpha.

## Sistema visual inicial

Estos son tokens de dirección de diseño; no constituyen todavía un cambio de UI.

| Token | Valor | Uso |
|---|---|---|
| `ink-950` | `#0B1114` | Fondo profundo, canvas y shell. |
| `ink-900` | `#121B20` | Panels y navegación. |
| `paper-100` | `#E8EEF0` | Texto principal. |
| `paper-400` | `#AAB8BD` | Texto secundario. |
| `tile-cyan` | `#58D6D1` | Acción primaria y selección. |
| `tile-amber` | `#F0B35B` | Destacado, progreso y procedencia. |
| `tile-coral` | `#E97868` | Error y advertencia fuerte. |
| `ok-green` | `#7CCB8A` | Confirmación. |

### Tipografía

- Inter o sistema sans para UI y marketing.
- IBM Plex Mono o JetBrains Mono para extensiones, hashes, formatos y valores técnicos.
- Escala compacta; la herramienta debe reservar espacio al canvas.
- Contraste mínimo WCAG AA: 4.5:1 para texto normal.

### Logo

Concepto: cuatro piezas de tile formando una “M” modular, con una unión abierta que sugiere pipeline y no rompecabezas infantil. Debe funcionar en 16, 32, 64 y 512 px.

Entregables mínimos:

- Isotipo monocromo.
- Isotipo oscuro sobre fondo claro.
- Isotipo claro sobre fondo `ink-950`.
- Lockup horizontal `Mosaico / 2D Asset Workspace`.
- Favicon y avatar cuadrado.
- Área de seguridad y tamaño mínimo documentados.

No convertir el logo en una pila de triángulos, un cerebro ni un brillo de IA.

## Diseño de producto

### Arquitectura de navegación

Mantener cuatro entradas visibles y comprensibles:

1. **Assets** — encontrar, inspeccionar y abrir material.
2. **Pixel Art** — editar sprites y animaciones.
3. **Pipelines** — transformar con nodos y ver resultado.
4. **Maps** — convertir tilesets en escenas ortogonales.

Jobs y Exportar no deben aparecer como módulos completos hasta tener una superficie real. Las capacidades de exportación deben vivir dentro del flujo que las produce.

### Primeros cinco minutos

1. Abrir Mosaico y ver un proyecto fixture listo.
2. Importar un tilesheet con tamaño de tile sugerido.
3. Verlo en el mapa y pintar tres celdas.
4. Ejecutar una transformación o exportar una imagen.
5. Guardar un `.mws` y abrir el resultado exportado.

El momento de valor es **“mi asset entró y produjo algo utilizable”**, no la exploración de cien nodos.

### Estados de interfaz

- Empty state: explicar qué resultado se puede crear y ofrecer fixture.
- Loading: mostrar progreso de importación/pipeline.
- Error: indicar archivo, causa probable y siguiente acción.
- Orphan asset: explicar que la referencia se conserva y cómo repararla.
- Offline: decir que Desktop funciona localmente; Web no debe fingir persistencia cloud.
- Unsaved: mostrar estado y ruta de guardado.

### Accesibilidad mínima

- Navegación por teclado en menús, tabs, diálogos y herramientas.
- Focus visible y orden lógico.
- Labels para inputs de tile size, margin, spacing, frame y export.
- No comunicar estados solo por color.
- Targets interactivos de al menos 44×44 px cuando aplique.
- Mensajes de error legibles y asociados al control.
- Zoom y contraste suficientes para canvas y timeline.

## Kit de lanzamiento

Crear antes de publicar:

- Cover itch.io preferentemente 630×500.
- Cinco screenshots: Assets, Pixel Art, Pipeline, Map y flujo completo.
- GIF/video de 30–60 s: `tilesheet → map → export`.
- Diagrama simple de “source → recipe → result” para documentación.
- Icono, splash e instalador con la misma paleta.
- Una imagen comparativa que muestre el resultado, no solo la UI.

## Copy base

**One-liner:** `A local workspace for sprites, tilesets, maps, and visual asset pipelines.`

**Short pitch:** `Import an asset, edit or transform it, use it in a map, and save the whole workspace without losing track of the source.`

**Proof disclaimer:** `Windows alpha. Local-first. Read what works, what is experimental, and what is not supported before downloading.`


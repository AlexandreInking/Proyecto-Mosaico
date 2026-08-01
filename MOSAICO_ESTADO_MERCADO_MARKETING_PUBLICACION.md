# Mosaico — estado actual, mercado, buyer persona y plan de publicación

**Corte técnico:** 31 de julio de 2026  
**Commit observado:** `6dedcf6` (`feat(desktop): add branded repair installer`)  
**Alcance:** auditoría del repositorio local + investigación web actualizada  
**Confianza:** alta para lo respaldado por código/tests; media para inferencias de mercado; baja para métricas de negocio no instrumentadas.

**Actualización de verificación:** `pnpm typecheck`, `pnpm test` y `pnpm build` ejecutados el 31 de julio de 2026; los tres pasan. El worktree sigue teniendo cambios sin commit, por lo que esto no equivale a un release reproducible desde `HEAD`.

> Regla de lectura: “implementado” significa visible en código y/o cubierto por una prueba. “Planificado” significa documentado, pero no debe venderse como capacidad disponible.

## 1. Resumen ejecutivo

Mosaico es hoy un workspace 2D para desarrollo de videojuegos: catálogo local de assets, editor de Pixel Art, editor ortogonal de mapas/tilemaps y compositor de pipelines de imagen por nodos. La misma UI React/TypeScript se consume desde un cliente web y desde un shell Desktop Tauri; el WPF F1 queda preservado como baseline histórico.

La propuesta comercial más defendible en este corte es:

> **“Un solo workspace para preparar assets, editarlos y convertirlos en sprites, tilesets y mapas reutilizables, sin perder el vínculo entre archivo, fuente y resultado.”**

El hueco no es “otro editor de pixel art”: Aseprite domina creación/animación; Tiled y LDtk dominan level design; Godot y Unity cubren parte del flujo dentro del motor. La oportunidad es reducir el cambio de contexto y la pérdida de trazabilidad entre asset → transformación → sprite/tilemap → exportación.

Tres decisiones recomendadas:

1. Lanzar primero una **alpha Windows gratuita o pay-what-you-want** en itch.io, con demo reproducible y feedback visible.
2. Posicionar Mosaico como **workspace de integración 2D**, no como reemplazo total de Aseprite/Tiled ni como producto de IA ya terminado.
3. No publicar como producto de pago hasta cerrar licencia, matriz de plataformas, flujo de soporte y sesión manual de aceptación.

## 2. Qué existe actualmente

### 2.1 Superficies de producto confirmadas

| Superficie | Estado observado | Evidencia | Qué permite hoy |
|---|---|---|---|
| Catálogo de Assets | Implementado, con entrada UI limitada | `Shared/ui/src/AppShell.tsx`; `Shared/pipeline/src/web-image-pipeline.ts` | El shell de catálogo ofrece selector PNG/GIF, drag/drop y búsqueda por nombre/tipo/hash; la función de pipeline valida PNG/JPEG/WebP/GIF, pero JPEG/WebP no están expuestos por el selector principal del catálogo. |
| Editor Pixel Art | Implementado | `Shared/ui/src/PixelArtEditor.tsx`; `Shared/domain/src/sprite-document.ts`; tests UI/domain | Lienzo RGBA, lápiz, borrador, relleno, línea, rectángulo, elipse, selección, picker, capas, carpetas, visibilidad, bloqueo, paleta, undo/redo, frames, onion skin, timeline, animación, exportación PNG/sprite sheet. |
| Editor de Mapas | Implementado, con alcance ortogonal | `Shared/ui/src/MapEditor.tsx`; `Shared/domain/src/map-document.ts`; `Shared/canvas/src/map/*` | Tilesets con ancho/alto/margen/spacing/offset, capas y carpetas, zoom/pan, pincel, borrador, fill, línea, rectángulo, elipse, selección, copiar/cortar/pegar, resize, undo/redo, animación/diagnósticos y exportación neutral JSON/PNG/ZIP. Terrains/autotile avanzado, iso/hex, objetos y colisiones siguen fuera del alcance probado. |
| Pipeline por nodos | Implementado en alpha | `Shared/ui/src/PipelineEditor.tsx`; `Shared/ui/src/pipeline-node-registry.ts`; `Shared/ui/src/pipeline-evaluator.ts` | Grafo visual, conexiones tipadas, preview y evaluación CPU local de nodos publicados de asset, transform, filtro, generator, math, vector, array, lógica y noise. Hay nodos backlog para 3D y transformaciones/filtros avanzados; scripting, marketplace y nodos custom productivos no están listos. |
| Procesamiento de imagen | Implementado | `Shared/pipeline/src/web-image-pipeline.ts`; `pixel-resize.ts`; `recipe-graph.ts` | Resize nearest/smooth, conversión, calidad, recetas con dependencias y detección de ciclos, jobs con progreso/cancelación, límites de entrada y manifiesto derivado con hashes. |
| Workspace compartido | Implementado | `Shared/ui/src/workspace-store.ts`; `workspace-media.ts`; contratos | Catálogo, pestañas de editor/mapa/pipeline y nodos custom en archivo portable `.mws`; referencias estables por ID; persistencia local/autosave best-effort. |
| Canvas | Implementado | `Shared/canvas/src/*` | Viewport Pixel/Pixi y viewport ortogonal Pixi; picking, zoom, pan, culling de mapa y presupuestos de rendimiento probados en tests. |
| Shell web | T0 implementado | `WebApp/client/src/main.tsx`; `WebApp/server/start/routes.ts` | Cliente Vite que consume la misma UI. API AdonisJS mínima: `/`, `/health`, `/api/v1/capabilities`. No hay autenticación, cuentas, pagos, persistencia cloud ni suscripciones. |
| Shell Desktop | T0/Tauri implementado | `DesktopApp/app`; `DesktopApp/src-tauri` | Tauri 2, updater configurado, splash/branded startup, bundle NSIS Windows, ventana 1280×800 redimensionable, CSP explícita. Artifact observado: `DesktopApp/src-tauri/target/release/bundle/nsis/Mosaico_0.2.0_x64-setup.exe` (~3.6 MB). |
| WPF baseline | Preservado | `DesktopApp/LegacyWpf` | Editor F1 anterior con tilesets, mapas, capas, herramientas básicas, `.mosaico` y `.mosaicpack`. No debe confundirse con la UI Tauri actual. |

### 2.2 Contratos de datos y límites observados

- Pipeline: PNG, JPEG, WebP y GIF; GIF hasta 1024 frames si el runtime dispone de `ImageDecoder`. El selector del catálogo sigue limitado a PNG/GIF y debe alinearse antes del lanzamiento.
- Imágenes: límite de fuente de 50 MB y presupuesto de 67.108.864 píxeles en pipeline web.
- Mapas: formato actual `mosaico-map` versión 3, orientación ortogonal, hasta 4096×4096 por dimensión, 64 tilesets, 128 capas y hasta 1.000.000 celdas ocupadas.
- Sprites: `mosaico-sprite` versión 1, RGBA, hasta 1024 frames y 128 capas.
- Pipeline: tipos de puerto `surface`, `color`, `gradient`, `value`, `int`, `float`, `vector2/3/4`; timeline hasta 86.400.000 ms y 4.096 keyframes.
- El esquema usa Zod y rechaza IDs faltantes, duplicados, geometría inválida, tiles fuera de rango, celdas fuera de bounds, ciclos de receta y paquetes ZIP con entradas inseguras según los tests de media.
- Archivos observados: `.mpe` para proyecto Pixel Art, `.mtm` para mapa actual, `.mws` para workspace; el baseline WPF usa `.mosaico` y `.mosaicpack`.
- El soporte de plataformas observado y verificable es **Windows para Desktop** y **navegador para Web**. Linux/macOS no deben marcarse como soportados sin builds y pruebas manuales.

### 2.3 Arquitectura y stack

| Capa | Tecnología |
|---|---|
| UI | React 19, TypeScript, Vite |
| Gráficos | PixiJS 8 |
| Graph editor | `@xyflow/react` |
| Validación | Zod |
| Persistencia local | IndexedDB/localStorage, ZIP con `fflate` |
| Desktop | Tauri 2, Rust, updater/process plugins, NSIS |
| Web API | AdonisJS 7 |
| Tests | Vitest, Node test runner, Japa/Adonis |
| Organización | pnpm workspace; paquetes `@mosaico/contracts`, `domain`, `persistence`, `pipeline`, `canvas`, `ui` |

### 2.4 Documentación y materiales existentes

El repo tiene 15 capítulos normativos en `documentos/00…14`, ADRs, manuales, fixtures, diagramas DOT/PNG, dossier PDF/Markdown, auditorías documentales y avisos de terceros. Hay scripts de desarrollo, gates y builds. Esto es una ventaja para credibilidad técnica, pero también genera riesgo de sobreprometer: el dossier documenta visión futura además de implementaciones actuales.

### 2.5 Qué no está implementado o no está listo para vender

- IA generativa de mapas, ciudades, quests, diálogos, economía o habilidades: **visión/roadmap**, no capacidad comercial probada en este corte.
- WFC, generación procedural 2D completa, 3D, audio, plugins externos, importadores Unity/Godot robustos, pagos, DRM, cuentas, colaboración online y suscripciones: **no deben aparecer como features disponibles**.
- Los módulos `Jobs` y `Exportar` aparecen en navegación, pero están marcados como planificados/deshabilitados.
- El backend web solo expone capacidades/health; no es una SaaS operativa.

## 3. Verificación del estado actual

### 3.1 Resultados reproducibles

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | **PASS** en 9/10 proyectos con scripts ejecutables. |
| `pnpm build` | **PASS** para cliente web, cliente desktop y servidor Adonis. Vite advierte un chunk `AuthoringCanvas` de ~503.6 kB; no bloquea build. |
| `pnpm test` | **PASS**: 15 pruebas estructurales, 18 contratos, 1 API, 15 pipeline, 64 dominio, 5 persistencia, 13 canvas y 81 UI; 212 tests reportados por las suites ejecutadas. |
| `dotnet build DesktopApp/LegacyWpf/ProyectoMosaico.slnx -c Release` | **NO VERIFICABLE en este entorno**: SDK 10.0.300 recibió `Access denied` al inspeccionar `C:\Users\Intel\AppData\Local\Microsoft SDKs`. No es evidencia de fallo de código, pero sí de gate no ejecutado. |

Además, el gate de release documentado exige worktree limpio, pero el corte observado contiene cambios sin commit; los artefactos `output/gate/*` también corresponden a commits/estados anteriores y no prueban el estado actual.

### 3.2 Lectura de release

**Estado recomendado:** alpha técnica / preview de validación, no release comercial estable.

**Bloqueadores P0 antes de anunciar “estable”:**

1. Ejecutar tests WPF en una máquina con SDK Windows accesible si se seguirá distribuyendo el baseline.
2. Hacer prueba manual completa en Windows: instalar, abrir, importar, editar, guardar, cerrar, reabrir, exportar, cancelar operación y reparar/actualizar.
3. Publicar licencia del producto, política de terceros y condiciones de uso; `THIRD_PARTY_NOTICES.md` existe, pero no equivale a una licencia de distribución completa.
4. Definir versión, changelog, soporte, canal de bugs, política de datos y compatibilidad.
5. Crear screenshots y video real del flujo; no usar solo diagramas de arquitectura.
6. Alinear `UI_CONTRACT_VERSION` actual con el contrato anunciado por `WebApp/server/start/routes.ts`.
7. Completar `WebApp/client/index.html` con description, canonical, Open Graph, manifest y social image.
8. Unificar idioma/copy de Pipeline y definir onboarding/ejemplos reales; el manual promete proyectos/tutoriales que la UI no muestra todavía.
9. Auditar licencia raíz, autoría, versión de `THIRD_PARTY_NOTICES.md`, changelog, privacidad, soporte, SBOM y checksums.

### 3.3 Riesgos de producto

- **Amplitud:** cuatro productos en uno pueden confundir al comprador.
- **Competencia gratuita:** Tiled, LDtk, Pixelorama y herramientas integradas en motores reducen disposición a pagar.
- **Diferenciación todavía abstracta:** “Asset Pipeline AI” promete más de lo que el alpha demuestra.
- **Formato/interoperabilidad:** sin importadores/exportadores de motor maduros, el valor termina en el editor y no en el juego.
- **Brand search:** “Mosaico” ya se usa en robótica/data (`mosaico.dev`) y existen apps de pixel art con nombres cercanos; revisar marca, dominio y SEO antes de invertir en identidad.
- **Identidad visual:** SVG/favicon, icono Desktop, splash e instalador no forman todavía un kit de lanzamiento coherente.

## 4. Investigación de mercado

### 4.1 Categoría real

Mosaico cruza tres categorías:

1. **Pixel-art/sprite authoring:** crear y animar sprites.
2. **Tilemap/level design:** colocar tiles, capas, terrenos y mapas.
3. **Asset pipeline:** validar, transformar, versionar, catalogar y entregar assets al engine.

La primera y segunda ya tienen líderes claros. La tercera es el espacio defendible, pero solo si Mosaico demuestra que elimina pasos repetidos y conserva procedencia/exportación.

### 4.2 Competidores y sustitutos

| Producto/alternativa | Fortalezas confirmadas | Debilidad/oportunidad para Mosaico | Amenaza |
|---|---|---|---|
| **Aseprite** | Pixel art y animación; timeline, layers, onion skin, sprite sheets y exportación de atlas. Precio mínimo oficial de referencia: USD 19.99; incluye Windows/macOS/Ubuntu y Steam key. [Features](https://www.aseprite.org/features/) · [FAQ/precio](https://www.aseprite.org/faq/) | No es el workspace central de catálogo + pipeline + mapa; cambiar de herramienta sigue siendo necesario para level design complejo. | Alta en Pixel Art. |
| **Tiled** | Gratuito/open source; level editor flexible, capas de objetos, tile placement, automapping, animación, colisiones y plugins; soporta ortogonal, isométrico y hexagonal. [Sitio oficial](https://www.mapeditor.org/) · [Docs](https://doc.mapeditor.org/en/stable/manual/introduction/) | Puede cubrir mejor mapas y extensibilidad; Mosaico debe ganar en continuidad asset→pipeline→editor y simplicidad de primer uso. | Alta en mapas. |
| **LDtk** | Gratuito/open source, orientado a 2D, auto-layers, mundos, entidades e integración con engines. [Sitio oficial](https://ldtk.io/) | Mosaico necesita explicar por qué el catálogo y procesamiento de assets importan antes/después del mapa. | Alta en level design 2D. |
| **Pixelorama** | Gratuito/open source; animación, onion skin, tags, exportación a spritesheet/GIF/video, efectos no destructivos e importación de formatos. [Sitio oficial](https://pixelorama.org/) | Compite por el usuario que solo necesita crear pixel art sin pipeline. | Media-alta en creación gratuita. |
| **Godot TileMap/TileSet** | El engine ya ofrece capas, terrenos/autotiling, pintura, selección, colisiones, navegación y escenas. [Mejoras 2D](https://godotengine.org/article/godot-4-0-sets-sail/) | La propuesta debe ser engine-agnostic y mejorar authoring previo al motor, no duplicar una función que el usuario ya tiene. | Alta como sustituto incluido. |
| **Unity 2D** | Editor, Sprite Editor y Tilemap dentro del engine; integración directa para equipos ya instalados. | Mosaico puede ser más ligero y trabajar antes del engine, pero necesita exportación/importador real. | Alta como sustituto incluido. |
| **Photoshop/Krita/GIMP/paint.net** | Ya instalados, flexibles y familiares; algunos usuarios resuelven pixel art con ellos. | Menor foco en tiles, animación y procedencia; Mosaico puede vender flujo especializado y menor fricción. | Alta por inercia. |
| **Scripts/CLI internos** | Automatización barata y adaptada al estudio. | Mosaico puede empaquetar UX, validación, preview y reproducibilidad sin mantener herramientas caseras. | Media. |

### 4.3 Señales de demanda y lenguaje de usuarios

La investigación comunitaria no sustituye entrevistas propias, pero muestra patrones repetidos:

- Usuarios describen Aseprite como creación de gráficos y Tiled como colocación de esos gráficos; los usan de forma complementaria, no como sustitutos. [Reddit: Tiled vs Aseprite](https://www.reddit.com/r/gamedev/comments/ulx0kl/tiled_vs_aseprite/)
- En workflows Godot aparece la tensión entre usar TileMap interno o separar authoring en Tiled/LDtk; la UX, la complejidad y la calidad de los addons influyen. [Reddit: Tiled/Godot](https://www.reddit.com/r/godot/comments/1q4fh4s/tiled_or_godot_builtin_tilemap/)
- Usuarios piden herramientas de tileset que permitan ver y preparar assets para entornos procedurales, señal de problema antes del mapa final. [Reddit: free tiling software](https://www.reddit.com/r/gamedev/comments/psxolv/free_tiling_software/)
- La exportación y recarga entre Aseprite y Godot se percibe como lenta o poco integrada; incluso cuando la solución existe, el cambio de contexto es una molestia. [Reddit: pixel-art workflow](https://www.reddit.com/r/gamedev/comments/1jv61vr/pixel_art_workflow/)
- La elección de herramienta depende de la tarea: Aseprite destaca en animación; Pro Motion/Pyxel Edit en tiles; Tiled/LDtk en mapas. [Reddit: software de pixel art](https://www.reddit.com/r/GameDevelopment/comments/1tgyjly/what_is_the_best_pixelart_software/)
- Señal reciente: usuarios aún preguntan por una herramienta gratuita que cubra pixel art y tilesets, mientras recomiendan combinar herramientas o pagar Aseprite; esto valida interés, no demanda pagadora. [Reddit, mayo de 2026](https://www.reddit.com/r/GameDevelopment/comments/1tgyjly/what_is_the_best_pixelart_software/)
- Señal reciente de onboarding: principiantes necesitan ayuda para distinguir tilesheets de objetos, identificar tamaño de tile y completar el primer mapa/exportación. [Reddit, julio de 2026](https://www.reddit.com/r/gamemaker/comments/1v59fl7/tiled_map_editor/)
- Señal de interoperabilidad: usuarios valoran LDtk por autotiling y entidades, pero mencionan fricción de importadores y mantenimiento de integración con Godot. [Reddit, mayo de 2026](https://www.reddit.com/r/godot/comments/1t20ngg/working_on_an_ldtk_interpreter_inspired_by_func/)
- Un hilo reciente sobre gestores de assets muestra interés por previews de frames y por no tratar el pixel art como imágenes planas; la metadata de animación se percibe como útil, pero no siempre se necesita inspeccionar layers. [Reddit: asset manager](https://www.reddit.com/r/gamedev/comments/1ukwmve/what_tools_are_you_using_to_make_2dpixel_art_for/)

**Lectura:** la oportunidad es un problema de workflow, no un vacío de categoría. La entrada debe ser un flujo concreto (“importa tilesheet → ajusta → usa en mapa → exporta”) y no una lista de 100 capacidades.

**Calidad de evidencia:** 3 señales recientes de comunidad = confianza media para lenguaje y fricciones de onboarding; confianza baja para tamaño de mercado, disposición a pagar y representatividad. Reddit sobre-representa usuarios técnicos y personas con opiniones fuertes; validar con 10–15 conversaciones propias.

### 4.4 Posicionamiento recomendado

**Categoría:** 2D game asset workspace / pipeline editor para equipos indie.

**Claim:** “Prepara, transforma y conecta tus assets 2D sin saltar entre cuatro herramientas.”

**Prueba disponible hoy:** catálogo local con hash, editores Pixel Art/mapa, pipeline nodal local, workspace `.mws`, builds web/desktop y validaciones de esquema.

**No claim todavía:** IA que genera juegos, compatibilidad universal con engines, colaboración cloud, pipeline de audio/3D o reemplazo de Aseprite/Tiled.

## 5. Buyer persona

### 5.1 Persona primaria: creador indie 2D con workflow fragmentado

**Base de evidencia:** señales comunitarias anteriores + capacidades observadas del producto. Es una hipótesis de mercado, no una entrevista con clientes Mosaico.

**Perfil**

- Rol: solo developer, technical artist o diseñador de niveles en equipo de 1–5 personas.
- Proyecto: videojuego 2D/pixel art, prototipo, game jam o vertical slice.
- Motor: Godot o Unity; puede combinar Aseprite/Pixelorama/Photoshop con Tiled/LDtk.
- Plataforma inicial: Windows; valora offline y archivos locales.
- Compra: sensible al precio, tolera alpha si el roadmap y el soporte son honestos.

**Job funcional**

> “Quiero convertir mis imágenes y tilesets en assets organizados, editables y listos para probar en mi juego, sin perder tiempo buscando archivos ni repitiendo exportaciones.”

**Job emocional**

Sentirse competente y en control del proyecto; evitar la sensación de que el juego se volvió una colección de archivos, scripts y decisiones irreversibles.

**Job social**

Mostrar progreso real a colaboradores, testers y comunidad: una demo jugable y un pipeline entendible, no solo carpetas desordenadas.

**Disparadores**

- El primer tileset crece y ya no se encuentra nada.
- El mismo asset necesita versiones para sprite, mapa, preview y engine.
- Se repiten resize, convert, atlas o exportaciones manuales.
- El cambio entre editor, map editor y engine produce errores o assets desactualizados.
- Un game jam o vertical slice impone velocidad.

**Pains**

1. “Tengo herramientas, pero no tengo un flujo único.”
2. “No sé qué versión del asset terminó dentro del juego.”
3. “El mapa, el tileset y el sprite se editan en sitios distintos.”
4. “Aprender otra herramienta puede costar más que seguir con scripts.”

**Resultados deseados**

- Primer asset importado y reutilizado en menos de cinco minutos.
- Fuente y derivados identificables por nombre/hash.
- Preview del resultado sin abrir el engine.
- Exportación reproducible y reversible.
- Documentos locales que abren sin cuenta ni conexión.

**Objeciones**

| Objeción | Respuesta de marketing honesta |
|---|---|
| “Ya tengo Aseprite/Tiled/Godot.” | Mosaico no pide reemplazarlos al inicio; resuelve el tramo entre assets, transformaciones y mapas. |
| “No quiero otro formato cerrado.” | Explicar formatos, exportaciones, hashes y límites; publicar fixtures y ejemplos. |
| “Es alpha.” | Mostrar estado exacto, changelog y canal de bugs; no cobrar por estabilidad que aún no existe. |
| “¿Dónde está la IA?” | Presentarla como dirección futura, no como promesa de la build actual. |
| “¿Funcionará en Linux/macOS?” | Responder solo con plataformas probadas; inicialmente Windows + navegador. |

**Alternativas:** seguir con Aseprite + Tiled/LDtk, usar Godot/Unity internamente, scripts propios, Pixelorama, o no cambiar nada.

**Anti-persona:** estudio grande que necesita colaboración, permisos, asset management cloud, soporte enterprise y pipelines de audio/3D; artista que solo necesita un editor de pixel art profundo; usuario que no usa Windows ni navegador y requiere soporte nativo no probado.

### 5.2 Perfil psicográfico

**Señales observadas:** busca velocidad, usa varias herramientas, compara gratis vs. pago, se preocupa por integración y evita migraciones costosas. **Inferencias:** competencia, autonomía y reducción de riesgo son necesidades dominantes.

| Necesidad/modelo | PLFS | Aplicación |
|---|---:|---|
| Autonomía y control | +13 | Offline, archivos portables, hashes, undo/redo, exportación visible y recuperación. |
| Competencia/progreso visible | +12 | Demo guiada: importar → transformar → mapear → exportar; mostrar antes/después y tiempo ahorrado sin inventar cifras. |
| Aversión a migración | +11 | Comparativas “Mosaico junto a Aseprite/Tiled”, fixtures descargables, exportación abierta y adopción gradual. |

**Guardas éticas:** no usar escasez falsa, no esconder límites, no llamar “IA” a funciones deterministas, no afirmar compatibilidad de engine sin pruebas y no recolectar telemetría sin consentimiento.

## 6. Plan de marketing con presupuesto cero

### 6.1 Marco estratégico

**Objetivo de 90 días:** comprobar que el flujo integrado es valioso para usuarios 2D, no maximizar seguidores.

**North-star metric propuesta:** número de usuarios que completan una sesión activada: importar un asset, realizar una transformación o edición, usarlo en mapa/pipeline y exportar/guardar un artefacto verificable.

**Embudo AARRR**

| Etapa | Evento de Mosaico | Acción gratuita |
|---|---|---|
| Acquisition | Persona ve un resultado o tutorial | Devlogs, clips de workflow, posts en comunidades permitidas, SEO de problemas concretos. |
| Activation | Descarga/abre y completa el flujo de 5 minutos | Fixture incluido, plantilla, checklist, onboarding sin cuenta. |
| Retention | Repite el flujo en su proyecto | Changelog semanal, recetas reutilizables, ejemplos, soporte público. |
| Referral | Comparte un mapa, pipeline o resultado | Créditos visibles, plantillas compartibles, showcase de usuarios, issues públicas bien respondidas. |
| Revenue | Paga por estabilidad/soporte/funciones | Solo después de validar activación; primero PWYW/alpha. |

### 6.2 Cinco ideas priorizadas con MFS

Fórmula usada: `MFS = (Impacto + Fit + Velocidad) − (Esfuerzo + Coste)`, 1–5 por dimensión. Coste monetario es 1 en todas por ser plan de presupuesto cero; esfuerzo sigue penalizado.

#### Idea 1: Build in public con clips de workflow

**MFS:** `+10` — hacer ahora.

- Impacto 4 · Fit 5 · Velocidad 5 · Esfuerzo 3 · Coste 1.
- Publicar un clip de 30–90 segundos por resultado: “tilesheet a mapa”, “nodo resize/convert”, “workspace `.mws`”, “autotile básico”.
- CTA único: descargar alpha/fixture y probar un flujo.
- Canales: Bluesky/X, Reddit solo en zonas de showcase, Discords donde el proyecto sea pertinente, YouTube Shorts y GitHub Discussions.
- Riesgo: mostrar demasiada arquitectura y poco resultado.
- Métrica: clics a descarga, activaciones y feedback cualitativo por clip.

#### Idea 2: Tutoriales buscables de problemas concretos

**MFS:** `+9` — priorizar.

- Impacto 4 · Fit 5 · Velocidad 3 · Esfuerzo 3 · Coste 0/1.
- Crear 6 guías: preparar tilesheet para Godot, organizar sprites animados, resize pixel-perfect, mapa con capas, autotile básico, pipeline reproducible.
- Cada guía debe incluir fixture, GIF/video corto, límites y enlace a la build.
- No hacer SEO genérico de “mejor editor”; resolver búsquedas con intención.
- Métrica: búsquedas/lecturas que llegan a descarga y activación.

#### Idea 3: Comunidad de feedback con evidencia

**MFS:** `+8` — priorizar.

- Impacto 4 · Fit 5 · Velocidad 4 · Esfuerzo 4 · Coste 1.
- Abrir GitHub Discussions/Issues etiquetadas `workflow`, `bug`, `format`, `engine`, `ux` y una encuesta de 5 preguntas.
- Pedir un archivo/flujo reproducible, no opiniones abstractas.
- Responder cada issue con estado y release objetivo.
- Métrica: 10–15 pruebas cualitativas de usuarios en 90 días; no convertir esto en promesa de usuarios de pago.

#### Idea 4: Plantillas de integración y archivos de muestra

**MFS:** `+8` — priorizar después de P0.

- Impacto 4 · Fit 5 · Velocidad 3 · Esfuerzo 3 · Coste 1.
- Publicar un fixture de Godot, uno de Unity y uno engine-agnostic cuando los exportadores estén probados; antes, publicar ejemplos de PNG/JSON/ZIP reales.
- Hacer visible la procedencia: fuente, receta, resultado y límites.
- Métrica: descargas de plantilla, errores de importación y tiempo hasta primer resultado.

#### Idea 5: Comparativas honestas “junto a tus herramientas”

**MFS:** `+7` — test selectivo.

- Impacto 4 · Fit 4 · Velocidad 4 · Esfuerzo 4 · Coste 1.
- Contenido: “Aseprite para dibujar + Mosaico para conectar”, “Tiled/LDtk para level design + Mosaico para preparar assets”, “Mosaico vs. script casero”.
- Nunca desacreditar competidores ni afirmar superioridad total.
- Métrica: comentarios de usuarios que describen su workflow y conversiones a demo.

### 6.3 Calendario orgánico de 12 semanas

| Semana | Entrega | Distribución | Señal buscada |
|---:|---|---|---|
| 1 | Landing/readme de alpha + video 60 s | GitHub + itch draft | ¿Se entiende qué hace? |
| 2 | Fixture “tilesheet → mapa” | itch + comunidades | Descargas y primeros errores. |
| 3 | Devlog del catálogo/hash | Bluesky/X + GitHub | Interés en procedencia. |
| 4 | Tutorial resize/convert | Web/GitHub Pages | Búsquedas y comentarios. |
| 5 | Build Windows privada/restringida | itch restricted | Instalación manual. |
| 6 | Public alpha si P0 cerrado | itch public | Activaciones. |
| 7 | Video Pixel Art → spritesheet | Shorts/Reddit showcase | Retención de atención. |
| 8 | Video Mapas/autotile | comunidades Godot/indie | Fit con level designers. |
| 9 | Post “qué no hace Mosaico aún” | blog + itch devlog | Confianza y feedback. |
| 10 | Issue/encuesta de formatos | GitHub | Prioridad de interoperabilidad. |
| 11 | Release notes + correcciones | itch/GitHub | Retención de testers. |
| 12 | Informe público de aprendizajes | todos | Decidir precio/segmento. |

### 6.3a Horizonte de 12 meses sin presupuesto

| Trimestre | Objetivo | Entregables orgánicos | Decisión que habilita |
|---|---|---|---|
| Q1 | Validar activación | Alpha Windows, fixture principal, 6 tutoriales, 12 clips, 10–15 conversaciones | ¿Qué flujo único merece ser el producto? |
| Q2 | Mejorar retención | Changelog mensual, recetas/plantillas, documentación de formatos, respuestas públicas a issues | ¿Los usuarios repiten el flujo sin acompañamiento? |
| Q3 | Construir distribución compuesta | Integración/exportador probado para un engine, presencia WinGet, colaboración con 2 comunidades, showcase de usuarios | ¿Qué ecosistema trae usuarios con mejor fit? |
| Q4 | Preparar monetización sostenible | Página comercial, pricing test, release estable si los gates pasan, Product Hunt con producto disponible | ¿Compra única, PWYW o seguir validando gratis? |

**Guardrail:** si Q1 no demuestra activación repetible, no añadir nuevos canales ni features de IA; reducir alcance y corregir el flujo de entrada.

### 6.4 Contenido mínimo reutilizable

Un flujo produce 1 video, 1 GIF, 1 imagen antes/después, 1 tutorial, 1 issue de feedback y 1 entrada de changelog. Esto es más sostenible que crear contenido nuevo para cada red.

**Pilares:**

- Workflow: menos saltos entre herramientas.
- Craft: pixel-perfect, tilesets, capas, autotile.
- Reliability: hashes, validación, formatos, cancelación y recuperación.
- Transparency: qué está hecho, qué está roto, qué viene después.

### 6.5 Herramientas sin presupuesto

GitHub Issues/Discussions/Pages, itch.io, OBS o grabación nativa, editor de video local, Markdown, fixtures, capturas, un formulario gratuito y una hoja de cálculo. No añadir CRM, automatización ni paid ads antes de tener señal de activación.

### 6.6 Psicología aplicada, con guardas éticas

Objetivo conductual: que una persona que llega por primera vez entienda el valor, descargue la alpha y complete `importar → transformar/editar → guardar/exportar`.

#### Modelo: Jobs to Be Done

**PLFS:** `+13` — aplicar ahora.

- **Leverage 5 · Fit 5 · Velocidad 4 · Ética 5 · Coste de implementación 2.**
- Usar copy centrado en el trabajo concreto —“preparar tileset para un mapa”—, no en una lista de módulos.
- Probar: CTA “Probar flujo de 5 minutos” frente a “Descargar Mosaico”.
- **Guardia:** no atribuir al usuario necesidades que no haya expresado; revisar con entrevistas.

#### Modelo: Risk Reversal

**PLFS:** `+13` — priorizar.

- **Leverage 5 · Fit 5 · Velocidad 4 · Ética 5 · Coste de implementación 2.**
- Mostrar offline, formatos, límites, changelog, licencia, checksums y canal de bugs antes de pedir descarga.
- Probar: página con “qué funciona/qué no” contra página solo promocional.
- **Guardia:** transparencia y reversibilidad; no ocultar que es alpha ni prometer compatibilidad no probada.

#### Modelo: Progress / Competence

**PLFS:** `+11` — test selectivo.

- **Leverage 4 · Fit 5 · Velocidad 4 · Ética 5 · Coste de implementación 2.**
- Onboarding con una fixture y progreso visible hasta un artefacto guardado/exportado.
- Medir tiempo hasta primer asset importado, primer mapa y primera exportación.
- **Guardia:** celebrar resultados reales, no inflar métricas ni usar urgencia falsa.

### 6.7 Precios y monetización a validar

- **Alpha:** gratis o PWYW; incluye demo y archivos de muestra.
- **Early supporter:** precio único orientativo a validar contra Aseprite USD 19.99, con actualizaciones y soporte comunitario, no una promesa de SaaS.
- **Team/Studio:** solo cuando existan colaboración, licencias y soporte reales.
- **Suscripción:** posponer hasta que haya servicio cloud que justifique recurrencia.

La decisión correcta depende de activación, retención, costes de soporte y valor del exportador; no fijar precio por intuición antes de 10–15 conversaciones.

## 7. Plan de publicación en itch.io

### 7.1 Por qué itch.io es el primer canal

Itch.io permite páginas para juegos, assets y otros contenidos; admite descargas, demo gratuita, etiquetas, actualizaciones, seguidores, ventas y pay-what-you-want. Su documentación recomienda cover 315:250 (mejor 630:500), 3–5 screenshots, archivos por plataforma y solo plataformas realmente probadas. [Guía oficial](https://itch.io/docs/creators/getting-started) · [Quality guidelines](https://itch.io/docs/creators/quality-guidelines)

También permite elegir el porcentaje de revenue share de la plataforma y usar PayPal/Stripe; hay comisiones de procesador y requisitos fiscales. [Payments](https://itch.io/docs/creators/payments)

### 7.2 Checklist antes de hacer pública la página

- [x] Resolver fallo `custom-node-evaluator` y publicar test verde en la verificación local del 31/07/2026.
- [ ] Confirmar build Windows limpia en otra máquina/VM.
- [ ] Crear ZIP instalable/portable con nombre `Mosaico-0.2.0-alpha-windows-x64.zip` y hash SHA-256.
- [ ] Decidir si el instalador NSIS y portable son ambos necesarios; probar desinstalación/reparación.
- [ ] Incluir `README`, changelog, licencia, `THIRD_PARTY_NOTICES.md`, requisitos Windows y canal de bugs.
- [ ] Añadir 1 cover 630×500, 5 screenshots reales y video/GIF del flujo.
- [ ] Marcar **Windows solamente** para el Desktop; no marcar Linux/macOS sin pruebas.
- [ ] Elegir clasificación `Other`/software o assets según formulario; usar tags relevantes: `Game Development`, `Pixel Art`, `Tilemap`, `Level Editor`, `Tools`, `Windows`, `Indie`, `Asset Pipeline`.
- [ ] Crear página draft/restricted y probar descarga, instalación, apertura, guardado y actualización.
- [ ] Preparar demo gratuita aunque la build completa tenga precio; itch permite adjuntar demo en la misma página.

### 7.3 Copy sugerido para la página

**Título:** `Mosaico — 2D Asset Workspace`

**Descripción corta:** `Importa, edita, transforma y conecta sprites, tilesets y mapas en un workspace local para juegos 2D.`

**Primer párrafo:**

> Mosaico reúne catálogo de assets, Pixel Art, mapas ortogonales y pipelines visuales en un flujo local. Importa una imagen, edítala o transfórmala, úsala en un tileset/mapa y guarda el workspace con referencias estables.

**Secciones:** `What works now`, `5-minute workflow`, `Formats and limits`, `What is experimental`, `Known issues`, `Roadmap`, `Credits and licenses`, `Support`.

### 7.4 Secuencia de lanzamiento

1. Crear página privada y subir build/fixtures.
2. Probar como usuario nuevo en Windows limpio.
3. Invitar 5–10 testers de comunidades pertinentes con preguntas concretas.
4. Corregir blockers de instalación/primer valor.
5. Publicar una sola vez cuando cover, metadata, screenshots y download estén listos; itch indica que la primera publicación entra a “Most Recent” y no debe desperdiciarse con una página incompleta.
6. Publicar devlog semanal y changelog por versión.
7. Pedir follow y bug reports, no reseñas positivas artificiales.

## 8. Otras plataformas de publicación

| Plataforma | Encaje | Estado recomendado | Requisitos/nota |
|---|---|---|---|
| **GitHub Releases** | Distribución técnica, builds, hashes, changelog y feedback | **Ahora**, junto a itch | GitHub permite empaquetar notas, binarios y releases para descarga. [Docs](https://docs.github.com/en/repositories/releasing-projects-on-github) Ideal para alpha/open-source o build de confianza; no sustituye una página comercial. |
| **itch.io** | Descubrimiento indie, demo, PWYW y comunidad | **Primera tienda** | Soporta otros contenidos además de juegos y descargas; requiere metadata exacta y página cuidada. |
| **WinGet** | Instalación y descubrimiento desde Windows | **Después de estabilizar el instalador** | Se publica un manifiesto YAML en `microsoft/winget-pkgs`; hay validación automática, revisión y pruebas de instalación/desinstalación. [Submission](https://learn.microsoft.com/en-us/windows/package-manager/package/repository) · [Manifest](https://learn.microsoft.com/en-us/windows/package-manager/package/manifest) |
| **Microsoft Store** | Descubrimiento e instalación Windows | **Después del alpha** | Puede recibir MSIX o listar EXE/MSI existente; Microsoft describe ambas rutas para Win32. [Docs](https://learn.microsoft.com/en-us/windows/apps/distribute-through-store/how-to-distribute-your-win32-app-through-microsoft-store) Requiere Partner Center, certificación, privacidad y soporte de updates. |
| **Gumroad** | Venta directa de software digital, versiones y license keys | **Solo si se cobra** | Permite productos digitales, versiones y license keys para software. [Adding a product](https://gumroad.com/help/article/149-adding-a-product) · [License keys](https://gumroad.com/help/article/76-license-keys) Menor descubrimiento técnico que itch; útil como checkout propio. |
| **Steam** | Alcance enorme, updates y precedentes de software creativo | **Q3+ / experimental** | Es viable como precedente —Aseprite se distribuye allí—, pero exige Steam Direct de USD 100 por app y sus reglas/proceso. [Steam Direct](https://partner.steamgames.com/doc/gettingstarted/appfee) · [Aseprite FAQ](https://www.aseprite.org/faq/) No debe ser primer canal para una alpha de herramienta. |
| **Flathub** | Linux desktop | **Después de build Linux estable** | Requiere manifest Flatpak, build offline, lint y PR de GitHub; la rama estable no es para snapshots/nightlies y exige mantenimiento real. [Submission](https://docs.flathub.org/docs/for-app-authors/submission) · [Requirements](https://docs.flathub.org/docs/for-app-authors/requirements) |
| **Sitio propio + CDN** | Control de marca, SEO, documentación y descargas | **Ahora como landing**, no como infraestructura compleja | Enlazar a GitHub/itch al principio; añadir checkout, analytics y updater propio solo cuando exista necesidad. |
| **Product Hunt** | Lanzamiento/awareness | **Canal, no distribución** | Es gratuito y sirve para distribución/feedback de early adopters, pero no aloja el binario. Lanzar solo con producto disponible y página destino funcional. [Launch Guide](https://www.producthunt.com/launch) · [How it works](https://www.producthunt.com/launch/how-product-hunt-works) |
| **Reddit/Discord/Bluesky/YouTube** | Adquisición y feedback | **Canales, no tiendas** | Respetar normas de cada comunidad; publicar resultado/ayuda, no spam de enlaces. |

### Orden sugerido

`GitHub Releases + itch.io` → `WinGet` → `Microsoft Store` → `Gumroad si hay precio` → `Flathub cuando Linux esté mantenido` → `Steam solo con producto estable y caso de uso claro`.

**No confundir publicación con distribución:** Product Hunt, Reddit, Discord, Bluesky y YouTube sirven para descubrimiento y feedback. Godot Asset Library/Unity Asset Store serían canales para un futuro plugin/importador, no para distribuir Mosaico como aplicación.

## 9. Plan operativo de 90 días

| Fase | Prioridad | Responsable mínimo | Criterio de salida |
|---|---|---|---|
| Días 1–14 | P0 técnico, licencia, README de alpha, screenshots, fixture principal | Desarrollo/producto | Test UI verde; build Windows instalada en limpio; copy no sobrepromete. |
| Días 15–30 | Página itch restringida, GitHub Release, 5 testers y flujo documentado | Producto + comunidad | 5 sesiones observadas; lista de blockers priorizada. |
| Días 31–60 | Public alpha, 2 tutoriales, 4 clips, primera ronda de correcciones | Producto/contenido | Activaciones y feedback registrados; al menos un flujo repetible. |
| Días 61–90 | Validar integración/exportación, comparar alternativas, decidir precio y plataforma 2 | Producto/engineering | Decisión Go/No-Go: seguir alpha, pivotar beachhead o cerrar superficie sobrante. |

### Métricas mínimas

- Visitas a página, descargas por plataforma, instalación exitosa.
- Tiempo hasta primer asset importado.
- Tiempo hasta primer resultado exportado/guardado.
- Porcentaje de testers que repiten sesión en 7 días.
- Errores por etapa: importación, edición, pipeline, mapa, workspace, exportación.
- Fuente de adquisición y feedback cualitativo.

No inventar CAC, LTV, ARR o mercado total mientras no exista precio, ventas y retención. Esos campos quedan abiertos.

## 10. Decisiones abiertas

1. ¿El primer producto es un workspace de assets o una suite completa? Elegir una promesa primaria para itch.
2. ¿Se mantiene “AI” en el nombre público mientras la IA no esté implementada? Recomendación: retirarlo del claim de alpha.
3. ¿Qué formatos de exportación de engine se garantizan en V1? Publicar solo los probados.
4. ¿Licencia del código, licencia del binario y uso comercial de assets de muestra?
5. ¿Precio alpha: gratis, PWYW o compra única? Validar después de 10–15 conversaciones.
6. ¿Canal oficial de soporte y tiempo de respuesta?
7. ¿Se soportará Linux/macOS desde el inicio o se fija Windows + Web?
8. ¿Qué significa “resultado real” del pipeline y cómo se valida visualmente en CI?
9. ¿Se arregla el chunk >500 kB ahora o se acepta como warning de alpha?
10. ¿Se renombra la marca? Verificar disponibilidad legal/SEO de “Mosaico” antes de campaña sostenida.

## 11. Fuentes y trazabilidad

### Evidencia local

- `README.md`
- `package.json`, `pnpm-workspace.yaml` y manifests de paquetes
- `Shared/ui/src/AppShell.tsx`, `PixelArtEditor.tsx`, `MapEditor.tsx`, `PipelineEditor.tsx`
- `Shared/contracts/src/asset.ts`, `authoring.ts`, `pipeline.ts`, `workspace.ts`
- `Shared/domain/src/*`, `Shared/pipeline/src/*`, `Shared/canvas/src/*`
- `WebApp/server/start/routes.ts`, `WebApp/server/app/capabilities.ts`
- `DesktopApp/src-tauri/tauri.conf.json`, `Cargo.toml`
- `Shared/**/tests`, `tests/t0`, `tests/t1`, `tests/t2`
- `analisis_documental/03_hallazgos.md`, `analisis_documental/10_dictamen.md`

### Fuentes web consultadas

- Itch.io: [first project page](https://itch.io/docs/creators/getting-started), [quality guidelines](https://itch.io/docs/creators/quality-guidelines), [payments](https://itch.io/docs/creators/payments).
- Microsoft: [Win32 distribution](https://learn.microsoft.com/en-us/windows/apps/distribute-through-store/how-to-distribute-your-win32-app-through-microsoft-store), [WinGet submission](https://learn.microsoft.com/en-us/windows/package-manager/package/repository), [WinGet manifest](https://learn.microsoft.com/en-us/windows/package-manager/package/manifest).
- GitHub: [releasing projects](https://docs.github.com/en/repositories/releasing-projects-on-github).
- Steam: [Steam Direct fee and rules](https://partner.steamgames.com/doc/gettingstarted/appfee).
- Product Hunt: [launch guide](https://www.producthunt.com/launch), [how it works](https://www.producthunt.com/launch/how-product-hunt-works).
- Flathub: [submission](https://docs.flathub.org/docs/for-app-authors/submission), [requirements](https://docs.flathub.org/docs/for-app-authors/requirements); la propia política advierte que herramientas de desarrollo pueden ser difíciles de encajar por el sandbox y que las apps estables deben estar listas para uso real.
- Aseprite: [features](https://www.aseprite.org/features/), [FAQ/pricing](https://www.aseprite.org/faq/).
- Tiled: [official site](https://www.mapeditor.org/), [introduction](https://doc.mapeditor.org/en/stable/manual/introduction/), [automapping](https://doc.mapeditor.org/en/latest/manual/automapping/).
- LDtk: [official site](https://ldtk.io/).
- Pixelorama: [official site](https://pixelorama.org/), [FAQ](https://pixelorama.org/faq/).
- Unity: [2D workflows](https://unity.com/features/2d).
- Community signal: Reddit threads linked in §4.3; used as directional language, not as statistically representative market data.

## 12. Dictamen

**Mosaico tiene una alpha técnica real y publicable para validación, no todavía un producto comercial estable.** La publicación más eficiente es una página itch.io bien preparada, apoyada por GitHub Releases y contenido de workflow. El mensaje debe vender continuidad y trazabilidad del flujo 2D, no una suite de IA ni compatibilidad universal.

**Siguiente acción mínima:** cerrar licencia/README/screenshots, probar instalador en Windows limpio y publicar una alpha restringida para cinco testers.

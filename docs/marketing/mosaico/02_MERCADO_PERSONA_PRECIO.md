# Mosaico — mercado, competencia, buyer persona y precio

**Corte de investigación:** 1 de agosto de 2026
**Confianza:** alta en producto local; media en lenguaje comunitario; baja en demanda pagadora hasta obtener ventas reales.

## Categoría y oportunidad

Mosaico cruza tres categorías:

1. **Pixel-art/sprite authoring:** crear y animar sprites.
2. **Tilemap/level design:** convertir tilesets en mapas y layouts.
3. **2D asset workflow:** importar, transformar, organizar, validar y entregar assets.

Las dos primeras tienen alternativas fuertes y gratuitas. La oportunidad defendible está en la continuidad del flujo `asset → transformación → sprite/tileset → mapa → exportación`, no en prometer que Mosaico reemplaza cada herramienta especializada.

## Competencia

| Alternativa | Tipo | Fortaleza | Fricción/oportunidad para Mosaico | Precio/licencia de referencia |
|---|---|---|---|---|
| [Aseprite](https://www.aseprite.org/faq/) | Adyacente/directa en sprites | Pixel art, animación, layers, tilemap, CLI y exportación; producto maduro | No es el workspace central de catálogo, pipeline visual y mapa completo | US$19.99 mínimo oficial para la serie 1.x; EULA propietaria. |
| [Tiled](https://www.mapeditor.org/) | Directa en mapas | Editor de niveles flexible, open source, objetos, capas y Automapping | Puede ser mejor en mapas, formatos y extensibilidad; Mosaico debe ganar en primer flujo y continuidad asset→mapa | Gratis/open source. |
| [LDtk](https://ldtk.io/) | Directa en level design | Mundos, entidades, auto-layers, exportación JSON/Tiled, backups y live reload | Tiene una propuesta de mapas muy clara; Mosaico debe justificar el procesamiento previo de assets | Gratis/PWYW; el sitio declara que siempre será gratuito. |
| [Pixelorama](https://pixelorama.org/faq/) | Adyacente en Pixel Art | Gratis, open source, animación, onion skin, spritesheets, múltiples plataformas | Compite por quien solo necesita dibujar; Mosaico debe demostrar valor de workflow, no solo pinceles | Gratis/open source MIT; Steam es una vía de apoyo. |
| [Godot 2D](https://godotengine.org/features/2d/) | Sustituto incluido | TileSets, terrenos, escenas, colisiones y edición dentro del engine | El usuario puede evitar otra herramienta; Mosaico necesita exportación/importación probada y agnosticismo | Engine gratuito/open source. |
| [Unity 2D](https://unity.com/features/2d) | Sustituto incluido | Sprite Editor, Tilemap y flujo integrado para equipos ya instalados | Duplicar el engine no sirve; valor debe aparecer antes del motor | Depende de licencia y plan de Unity; no fijar cifra sin contrato/uso. |
| [Krita](https://krita.org/en/features/) | Indirecta | Pintura, raster y herramientas artísticas amplias | Más flexible, menos enfocada en metadata, tiles, pipelines y resultados reproducibles | Gratis/open source. |
| [GIMP](https://www.gimp.org/) | Indirecta | Gratis, conocido, extensible y suficiente para transformaciones | Requiere más configuración manual para un flujo de juego 2D | Gratis/open source. |
| Photoshop | Indirecta | Ecosistema profesional y familiar | Coste recurrente y menor foco en mapas/procedencia | Suscripción; precio cambia por región/plan, verificar antes de comparar numéricamente. |
| Scripts/CLI propios | Indirecta | Baratos, adaptados al estudio y automatizables | Sin preview, UX, validación integrada ni onboarding | Coste monetario bajo; coste de mantenimiento alto. |

### Lectura competitiva

- Tiled y LDtk enseñan que el usuario puede obtener level design sólido sin pagar.
- Pixelorama reduce a cero el precio de entrada para Pixel Art.
- Aseprite demuestra que existe disposición a pagar por una herramienta 2D madura, portable y con soporte.
- Godot y Unity son sustitutos porque ya viven dentro del entorno de producción.
- Mosaico no debe competir por “más herramientas”; debe competir por **menos saltos, más trazabilidad y un primer resultado reproducible**.

## Señales de lenguaje y fricción

Estas señales son cualitativas; no representan todo el mercado.

| Señal | Implicación para Mosaico |
|---|---|
| Usuarios suelen usar Aseprite para crear gráficos y Tiled para colocarlos, no como sustitutos perfectos. [Hilo](https://www.reddit.com/r/gamedev/comments/ulx0kl/tiled_vs_aseprite/) | Copy: “trabaja junto a tus herramientas” antes que “reemplázalas”. |
| En Godot se debate entre TileMap interno, Tiled y LDtk según UX, integración y mantenimiento. [Hilo](https://www.reddit.com/r/godot/comments/1q4fh4s/tiled_or_godot_builtin_tilemap/) | Mostrar qué problema resuelve Mosaico antes del engine. |
| Usuarios buscan software gratuito para tiles y tilemaps, pero también recomiendan pagar Aseprite. [Hilo](https://www.reddit.com/r/GameDevelopment/comments/1tgyjly/what_is_the_best_pixelart_software/) | Precio bajo solo compra curiosidad; el valor debe aparecer en cinco minutos. |
| El onboarding de tilesheets confunde por tamaño de tile, sprites versus objetos y exportación. [Hilo](https://www.reddit.com/r/gamemaker/comments/1v59fl7/tiled_map_editor/) | El primer proyecto debe incluir fixture y valores preconfigurados. |
| Usuarios valoran autotiling y entidades, pero mencionan fricción en importers/integraciones. [Hilo](https://www.reddit.com/r/godot/comments/1t20ngg/working_on_an_ldtk_interpreter_inspired_by_func/) | No prometer integración hasta probarla con un engine concreto. |
| La metadata de frames y previews importa cuando los assets crecen. [Hilo](https://www.reddit.com/r/gamedev/comments/1ukwmve/what_tools_are_you_using_to_make_2dpixel_art_for/) | El catálogo/hash es parte del mensaje, no un detalle técnico escondido. |
| En comunidades se valora feedback técnico más que un enlace promocional aislado. [Hilo](https://www.reddit.com/r/gamedev/comments/se704e) | Cada publicación debe enseñar una técnica, una decisión o un resultado. |
| r/godot limita promoción plana y exige adaptar el post al tema del engine. [Reglas discutidas](https://www.reddit.com/r/godot/comments/1bemlw5/first-batch-of-changes-rules-and-flairs/) | No cruzar-postear el mismo anuncio; publicar integración o aprendizaje específico. |
| r/PixelArt pide que la imagen principal sea realmente pixel art y limita ciertos proyectos promocionales. [Guía comunitaria](https://www.reddit.com/r/PixelArt/comments/1agfbsd/promotional-guidelines/) | Solo usar ese canal con un asset pixel art real, no con una captura de UI. |
| Reddit exige participación auténtica y prohíbe spam/manipulación. [Reglas oficiales](https://redditinc.com/policies/reddit-rules) | Mantener ratio de conversación/ayuda alto y una promoción ocasional. |

## Buyer persona primaria

### Creador indie 2D con workflow fragmentado

**Base:** hipótesis respaldada por capacidades del producto y señales comunitarias; validar con los diez testers.

- **Rol:** solo developer, technical artist, artista-programador o level designer.
- **Equipo:** una a cinco personas.
- **Proyecto:** prototipo, game jam, vertical slice o juego 2D/pixel art.
- **Motor:** Godot, Unity u otro engine 2D.
- **Herramientas actuales:** combinación de Aseprite/Pixelorama/Krita/Photoshop con Tiled/LDtk y scripts propios.
- **Contexto:** Windows, archivos locales, poco tiempo y tolerancia limitada a configuraciones complejas.

**Trabajo funcional:** preparar un asset, transformarlo, reutilizarlo en un sprite/tileset/mapa y exportar un resultado sin perder la relación con la fuente.

**Trabajo emocional:** sentir control y competencia; dejar de dudar si está editando el archivo correcto o si el mapa usa una versión antigua.

**Trabajo social:** demostrar avance visible a un equipo pequeño, cliente, comunidad o colaboradores.

**Disparadores:** primer tileset que crece, game jam próxima, múltiples formatos, errores de importación, repetición de resize/convert/export o cambio constante entre editor y engine.

**Dolores principales:**

1. Cambio de contexto entre editor de sprites, tiles y engine.
2. Assets duplicados o desactualizados.
3. Configuración manual de tilesheet y exportación.
4. Herramientas gratuitas potentes pero fragmentadas.
5. Riesgo de pagar por una alpha que no tiene integración real.

**Resultado deseado:** importar un asset, ver el resultado, guardar un workspace reproducible y exportar sin abrir cuatro herramientas.

**Objeciones:** “ya tengo Aseprite/Tiled”, “esto parece otro engine”, “¿funciona con mi motor?”, “¿qué pasa con mis archivos?”, “¿por qué pagar por una alpha?”.

**Lenguaje útil:** “menos saltos”, “workspace local”, “procedencia”, “reproducible”, “tilesheet a mapa”, “trabaja junto a Aseprite/Tiled”, “qué funciona ahora”.

## Perfil psicográfico

- **Necesidad dominante:** competencia + autonomía; quiere resolver el trabajo sin depender de una cadena invisible de scripts.
- **Identidad:** creador práctico que quiere construir juegos, no administrar herramientas.
- **Miedo racional:** pérdida de archivos, formatos cerrados, exportación incorrecta o compatibilidad prometida que falla.
- **Miedo emocional:** comprar una herramienta inmadura y quedar solo frente a bugs.
- **Motivador:** ver un resultado real rápido y poder inspeccionar qué ocurrió.
- **Barrera de confianza:** claim amplio de IA, roadmap inflado, screenshots de arquitectura sin resultado y falta de changelog.
- **Guardia ética:** usar evidencia y límites claros; no inventar escasez, testimonios o compatibilidad.

## Anti-persona

Mosaico no es todavía para estudios que necesitan colaboración multiusuario, control de versiones cloud, importadores oficiales maduros, Linux/macOS garantizados, audio/3D o soporte empresarial.

## Posicionamiento

**Categoría:** 2D Asset Workspace.
**Claim:** `Prepare, transform, and connect 2D assets without losing the thread.`
**Versión corta:** `A local workspace for sprites, tilesets, maps, and visual asset pipelines.`

**Prueba disponible:** catálogo local, hashes, editores, pipeline nodal, mapa ortogonal, autotile básico, formatos portables y UI compartida Desktop/Web.

**No decir:** AI game generator, universal engine pipeline, cloud collaboration, Aseprite replacement, Tiled replacement, production-ready importer.

## Precio recomendado

| Momento | Precio | Condición |
|---|---:|---|
| Alpha pública | **US$14.99** compra única | Incluye la build publicada y actualizaciones anunciadas durante la etapa alpha; explicar riesgos. |
| Release estable | **US$19.99** compra única | Solo subir si el flujo principal es repetible, el instalador está probado y hay soporte/changelog. |
| Tester | **US$0** mediante download key | Diez accesos limitados; no son licencia técnica dentro de la app. |
| Web futura | Sin precio todavía | Requiere cuentas, persistencia, costes cloud y propuesta recurrente real. |

La referencia de US$19.99 viene de Aseprite, mientras Tiled, LDtk y Pixelorama son gratuitos o PWYW. Por eso US$14.99 reduce riesgo percibido sin posicionar Mosaico como producto desechable. Validar con diez testers y primeras ventas; no usar descuentos falsos ni urgencia inventada.

## Gaps de investigación

- Número real de usuarios que completarían el flujo completo.
- Disposición a pagar por un workspace sin importer de engine.
- Engine prioritario para una integración futura.
- Qué parte del producto causa retención después del primer uso.
- Si el nombre “Mosaico” es suficientemente diferenciable en búsqueda y marca.

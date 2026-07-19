# Auditoría de fuentes externas y licencias

**Fecha de verificación:** 2026-07-19  
**Alcance:** referencias externas repetidas de PM-00 a PM-12 y PM-14; referencias OpenAI de PM-13  
**Método:** comprobación HTTP, lectura de documentación, repositorios, archivos de licencia y metadatos oficiales. Solo fuentes primarias.  
**Limitación:** revisión documental técnica, no asesoría jurídica. Toda incorporación de código o assets exige revisión legal del artefacto y versión exactos.

## 1. Dictamen

Las referencias principales existen y respaldan inspiración conceptual general, pero el bloque se copió sin curación en 14 documentos. No crea trazabilidad entre afirmación y fuente. Tampoco distingue documentación, formato, código, paquete, binario comercial y assets de muestra.

Estado:

- **Tiled:** vigente; documentación estable 1.12.2 y release `v1.12.2`. Licencia mixta por componente. Riesgo alto si se copia código GPL al producto.
- **TileKit:** página y demo disponibles; versión visible 1.07 de 2020. No hay licencia de código o contenido visible. Solo usar como referencia observable; no copiar ni redistribuir.
- **Unity Tilemap:** manual 6000.4 vigente y Rule Tile Extras 8.0 resuelve actualmente a 8.0.3. Código del paquete bajo Unity Companion License para proyectos dependientes de Unity; no incorporarlo al núcleo independiente.
- **WaveFunctionCollapse:** repositorio vigente; código MIT. Los samples de imágenes/tiles quedan explícitamente fuera de esa licencia.
- **OpenAI PM-13:** ficha `gpt-5.6-sol` vigente. URL antigua del quickstart devuelve 404. URL de casos Codex redirige permanentemente. Anuncio `openai.com` responde 403 a cliente automatizado: no se declara roto, pero no pudo verificarse su contenido en esta auditoría.

**Resultado:** **apto como lista de inspiración tras corrección; no apto como inventario de dependencias/licencias.** Antes de Fase 0 debe existir un registro separado de dependencias/NOTICE y una bibliografía canónica única.

## 2. Repetición y calidad de citación

Los mismos siete enlaces aparecen en PM-00 a PM-12 y PM-14: **14 bloques idénticos**. PM-13 sustituye el bloque por cuatro referencias OpenAI. El dossier completo vuelve a concatenar esos bloques.

Problemas:

1. Una referencia al final de cada documento no identifica qué afirmación respalda.
2. Se cita el mismo material aunque el subsistema no lo use.
3. Repetir URLs multiplica deriva y correcciones.
4. “Inspiración” no concede permiso para copiar código, UI, ejemplos o assets.
5. No se registra versión, commit, fecha de consulta ni licencia en fuentes.

Recomendación: mantener `FUENTES.md` canónico, referenciar IDs (`SRC-TILED-FORMAT`, etc.) desde cada afirmación y generar bibliografía de cada capítulo. Para dependencias reales, crear `THIRD_PARTY_NOTICES.md` y lockfile/SBOM con versión o commit exacto.

## 3. Registro verificado

### SRC-TILED-DOCS — Documentación de Tiled

- **URL citada:** https://doc.mapeditor.org/
- **URL canónica observada:** https://doc.mapeditor.org/en/stable/
- **Estado:** HTTP 200 después de redirección.
- **Versión/fecha observable:** documentación **Tiled 1.12.2**; verificada 2026-07-19.
- **Afirmación respaldada:** Tiled es referencia válida para edición de mapas, capas, tilesets, objetos, propiedades, formatos TMX/JSON y flujos de herramienta.
- **Licencia/uso:** página muestra copyright del proyecto, pero esta auditoría no encontró licencia de reutilización del texto/documentación en la página consultada. Enlazar y resumir conceptos es uso de referencia; no copiar texto, capturas o estructura extensamente sin verificar licencia específica.
- **Riesgo:** **Medio**. `/en/stable/` cambia con releases; una especificación de compatibilidad debe fijar versión.
- **Acción:** citar `stable` para lectura general y URL versionada/tag para requisitos de interoperabilidad.

### SRC-TILED-JSON — Formato JSON

- **URL canónica:** https://doc.mapeditor.org/en/stable/reference/json-map-format/
- **Estado:** HTTP 200.
- **Versión/fecha observable:** documentación Tiled 1.12.2; verificada 2026-07-19.
- **Afirmación respaldada:** existe una especificación de objetos y campos JSON de Tiled, incluidos mapa, capas, chunks, objetos, tilesets, Wang sets, propiedades y changelog.
- **Licencia/uso:** la especificación informa interoperabilidad; no equivale a licencia para copiar implementación o recursos.
- **Riesgo:** **Alto para compatibilidad**, bajo para consulta. `stable` puede cambiar y el proyecto todavía no declara subconjunto/versiones objetivo.
- **Acción:** fijar corpus y matriz por versión; no afirmar “compatible con Tiled” sin niveles soportado/aproximado/preservado/no soportado.

### SRC-TILED-REPO — Repositorio y licencias

- **Repositorio:** https://github.com/mapeditor/tiled
- **Licencias canónicas:**  
  https://github.com/mapeditor/tiled/blob/master/COPYING  
  https://github.com/mapeditor/tiled/blob/master/LICENSE.GPL  
  https://github.com/mapeditor/tiled/blob/master/LICENSE.BSD
- **Estado:** HTTP 200; repositorio no archivado.
- **Versión/fecha observable:** release `v1.12.2`, publicada 2026-05-27; rama principal con actividad observada hasta 2026-07-17.
- **Afirmación respaldada:** implementación oficial y corpus real útiles para estudiar comportamiento y validar interoperabilidad.
- **Licencia/uso:** `COPYING` asigna **GPL v2 o posterior** a Tiled y sus plugins; **BSD 2-clause** a `libtiled`, `libtiled-java`, `tmxrasterizer`, `tmxviewer` y `tmxviewer-java`; **BSD 3-clause** a `qtpropertybrowser`. El repositorio también contiene artefactos con otras licencias por archivo.
- **Riesgo:** **Alto**. Copiar o derivar código GPL puede imponer obligaciones incompatibles con licencia comercial/privada futura. La etiqueta global de GitHub es `NOASSERTION`, coherente con licencia mixta.
- **Acción:** implementación limpia desde contratos propios; si se integra un componente, revisar su directorio/archivo exacto, conservar avisos y cumplir licencia. No tratar todo el repositorio como BSD.

### SRC-TILEKIT — Producto TileKit

- **URL canónica:** https://rxi.itch.io/tilekit
- **Devlog de versión:** https://rxi.itch.io/tilekit/devlog/172607/tilekit-107
- **Estado:** HTTP 200; producto marcado “Released”; descarga demo visible.
- **Versión/fecha observable:** **TileKit 1.07**, publicada/modificada 2020-08-23; precio visible USD 20 o más; Windows y Linux.
- **Afirmación respaldada:** la descripción oficial dice que TileKit es un editor de tilemaps centrado en autotiling basado en patrones. Esto respalda la frase de PM-01 de que inspira transformación por patrones.
- **Licencia/uso:** no se encontró licencia de código, assets, documentación o redistribución visible, ni enlace a código fuente, en página/devlog inspeccionados. Compra o acceso a demo no presume derechos de copia.
- **Riesgo:** **Alto** para reutilización; **Medio** como referencia de producto por antigüedad y ausencia de especificación técnica formal.
- **Acción:** limitar a análisis funcional de caja negra permitido por términos aplicables. No copiar UI, binarios, reglas, assets, formatos o código; pedir permiso escrito si se requiere material.

### SRC-UNITY-TILEMAP — Manual Unity Tilemaps

- **URL canónica:** https://docs.unity3d.com/6000.4/Documentation/Manual/tilemaps/tilemaps-landing.html
- **Estado:** HTTP 200.
- **Versión/fecha observable:** **Unity 6.4 (6000.4)**; verificada 2026-07-19.
- **Afirmación respaldada:** Unity ofrece Tilemaps para construir mundos/niveles 2D pintando tiles en escenas. Sirve para estudiar conceptos de integración y expectativa del usuario Unity.
- **Licencia/uso:** documentación y marcas se rigen por términos de Unity; citar conceptos no autoriza copiar código, capturas ni UI. Esta página no licencia un adaptador Mosaico.
- **Riesgo:** **Medio**. URL fija versión y puede pasar a legado; APIs concretas deben verificarse contra versión de Unity objetivo.
- **Acción:** separar referencia conceptual de contrato de exportación; versionar companion por Unity soportado.

### SRC-UNITY-RULETILE — 2D Tilemap Extras / Rule Tile

- **URL citada:** https://docs.unity3d.com/Packages/com.unity.2d.tilemap.extras@8.0/manual/RuleTile-introduction.html
- **Estado:** HTTP 200.
- **Versión/fecha observable:** rango `@8.0` muestra **2D Tilemap Extras 8.0.3** el 2026-07-19.
- **Repositorio histórico/oficial:** https://github.com/Unity-Technologies/2d-extras
- **Licencia de paquete:** https://docs.unity3d.com/Packages/com.unity.2d.tilemap.extras@8.0/license/LICENSE.html
- **Licencia canónica:** https://unity.com/legal/licenses/unity-companion-license
- **Afirmación respaldada:** Rule Tile selecciona sprite según reglas sobre tiles vecinos; Auto Tile selecciona según layouts. Respalda inspiración en reglas vecinales, no la arquitectura propuesta completa.
- **Licencia/uso:** **Unity Companion License v1.4**; archivo del paquete especifica uso para proyectos dependientes de Unity. Concede licencia sin regalías bajo condiciones, pero no es licencia permisiva general para núcleo independiente.
- **Riesgo:** **Alto** si se copia código de RuleTile a Mosaico; **Bajo** si solo se implementa concepto propio sin copiar expresión/código.
- **Acción:** no depender ni copiar paquete en el core. Si se crea companion Unity separado, revisar si califica como Unity-dependent y conservar licencia/avisos.

### SRC-WFC — WaveFunctionCollapse de Maxim Gumin

- **Repositorio:** https://github.com/mxgmn/WaveFunctionCollapse
- **Licencia:** https://github.com/mxgmn/WaveFunctionCollapse/blob/master/LICENSE
- **Estado:** HTTP 200; repositorio no archivado.
- **Versión/fecha observable:** último release `v1.00`, publicado 2022-07-21; actividad de rama observada hasta 2026-03-22.
- **Afirmación respaldada:** el README describe modelos **Overlapping** y **Simple Tiled**, propagación de restricciones de adyacencia, entropía y generación de tilemaps. Respalda WFC como referencia algorítmica.
- **Licencia/uso:** código bajo **MIT**, con obligación de conservar copyright y permiso. El archivo añade: las imágenes de muestra y tiles proporcionados **no forman parte del software WaveFunctionCollapse**; por tanto no quedan cubiertos por esa concesión MIT.
- **Riesgo:** **Medio**. Código reutilizable bajo MIT si se cumplen avisos, pero implementación propia reduce acoplamiento. Assets de ejemplos son **alto riesgo** sin licencia individual.
- **Acción:** mantener NOTICE si se copia código sustancial; crear fixtures/assets propios o verificar licencia por archivo. No publicar samples del repo bajo supuesto MIT.

### SRC-OAI-MODEL — GPT-5.6 Sol

- **URL canónica:** https://developers.openai.com/api/docs/models/gpt-5.6-sol
- **Estado:** HTTP 200; recuperada mediante documentación oficial OpenAI.
- **Versión/fecha observable:** modelo ID y snapshot actual `gpt-5.6-sol`; verificado 2026-07-19. La ficha declara modelo de razonamiento y endpoints/herramientas soportados.
- **Afirmación respaldada:** existe GPT-5.6 Sol y es modelo frontier para trabajo profesional complejo. Puede sostener selección como candidato de coordinación/revisión.
- **Afirmación no respaldada:** la ficha no garantiza que “GPT-5.6 Sol actúa como coordinador y revisor” del proyecto ni que la organización propuesta sea óptima. Eso es decisión interna y necesita evals.
- **Licencia/uso:** servicio sujeto a términos, disponibilidad, acceso, precios y límites de OpenAI; no es dependencia redistribuible. Evitar hardcodear disponibilidad no comprobada en runtime.
- **Riesgo:** **Medio** por dependencia externa/coste/deriva. PM-13 mitiga parcialmente mediante abstracción del proveedor.

### SRC-OAI-ANNOUNCEMENT — Anuncio GPT-5.6

- **URL citada:** https://openai.com/index/gpt-5-6/
- **Estado:** HTTP **403** para verificador automatizado el 2026-07-19. No se pudo validar contenido; un 403 no prueba enlace roto.
- **Versión/fecha observable:** no verificada.
- **Afirmación respaldada:** ninguna aceptada en esta auditoría por falta de lectura.
- **Licencia/uso:** solo referencia editorial; no concede licencia técnica.
- **Riesgo:** **Medio**. Fuente redundante frente a ficha de modelo verificable.
- **Acción:** mantener solo si un humano confirma acceso y fecha; para contratos técnicos usar ficha de modelo.

### SRC-OAI-QUICKSTART — API quickstart y agentes

- **URL citada:** https://platform.openai.com/docs/quickstart/make-your-first-api-request
- **Estado:** HTTP **404** el 2026-07-19. **Enlace roto/obsoleto.**
- **Reemplazo canónico verificado:** https://developers.openai.com/api/docs/quickstart
- **Referencia específica de agentes:** https://developers.openai.com/api/docs/guides/agents
- **Estado reemplazos:** HTTP 200 y recuperables mediante documentación oficial.
- **Afirmación respaldada:** OpenAI ofrece API, SDK y guía para construir agentes. No respalda por sí misma reparto de roles, gates o revisión independiente de PM-13.
- **Licencia/uso:** servicio/API bajo términos OpenAI; ejemplos deben revisarse bajo términos aplicables antes de copiarse.
- **Riesgo:** **Alto documental** por 404; **Medio técnico** por API/versiones cambiantes.
- **Acción:** reemplazar URL y separar quickstart de Agents SDK/Responses según implementación elegida.

### SRC-OAI-CODEX — Casos de uso Codex

- **URL citada:** https://developers.openai.com/codex/use-cases
- **Estado:** HTTP **308 Permanent Redirect**.
- **Destino canónico observado:** https://learn.chatgpt.com/use-cases
- **Estado destino:** HTTP 200; índice de casos de uso.
- **Versión/fecha observable:** contenido vivo sin versión visible; verificado 2026-07-19.
- **Afirmación respaldada:** existen casos de uso publicados para Codex y flujos de ingeniería. La URL genérica no prueba eficacia específica del sistema agéntico de PM-13.
- **Licencia/uso:** referencia de producto; no dependencia redistribuible.
- **Riesgo:** **Bajo funcional / Medio de trazabilidad**: redirección funciona, pero destino es más amplio y puede cambiar.
- **Acción:** reemplazar por destino canónico o, mejor, enlaces directos a casos que respalden cada práctica.

## 4. Afirmaciones y nivel de respaldo

| Afirmación documental | Estado | Evidencia | Observación |
|---|---|---|---|
| Tiled ofrece formato JSON documentado | Respaldada | SRC-TILED-JSON | Fijar versión/subconjunto antes de prometer compatibilidad. |
| TileKit inspira transformación basada en patrones | Respaldada a nivel conceptual | SRC-TILEKIT | No hay permiso visible para copiar implementación/UI. |
| Rule Tile ilustra reglas vecinales | Respaldada | SRC-UNITY-RULETILE | Companion License impide asumir reutilización libre en core independiente. |
| WFC aporta resolución de restricciones con Simple Tiled/Overlapping | Respaldada | SRC-WFC | No confundir ejemplo de referencia con garantía de calidad global. |
| GPT-5.6 Sol existe y sirve para trabajo complejo | Respaldada | SRC-OAI-MODEL | Capacidades concretas son mutables. |
| GPT-5.6 Sol debe ser coordinador/revisor de Mosaico | Sin respaldo externo directo | PM-13:31,41-48 | Hipótesis organizativa; validar con piloto/evals. |
| Agentes especializados reducen deuda o mejoran calidad | Sin respaldo directo en referencias citadas | PM-13 completo | Requiere métricas comparativas del piloto. |
| Herramientas deterministas deciden cumplimiento | Parcial | Diseño interno PM-13 | Tests prueban criterios codificados, no corrección total ni aceptación humana. |
| Compatibilidad con Unity/Godot puede lograrse mediante adaptadores | Plausible, no demostrada | manuales + diseño PM-11 | Requiere spike y contratos/versiones del motor. |

## 5. Enlaces rotos, movidos o frágiles

| Severidad | URL | Resultado 2026-07-19 | Corrección |
|---|---|---|---|
| Alta | `https://platform.openai.com/docs/quickstart/make-your-first-api-request` | 404 | Usar `https://developers.openai.com/api/docs/quickstart` y guía Agents separada. |
| Media | `https://developers.openai.com/codex/use-cases` | 308 | Usar `https://learn.chatgpt.com/use-cases` o caso directo. |
| Media | `https://openai.com/index/gpt-5-6/` | 403 al bot | Confirmación humana; no usar como contrato técnico. |
| Media | `https://doc.mapeditor.org/` | Redirige a `en/stable` | Usar canónica; fijar versión para compatibilidad. |
| Media | URL Unity con `@8.0` | Hoy muestra 8.0.3 | Fijar `8.0.3` o lockfile al implementar; `@8.0` puede moverse. |
| Baja | Repositorios apuntan a rama `master` | Contenido mutable | Citar tag/commit en decisiones e implementación. |

## 6. Riesgos de licencia y controles

| Riesgo | Severidad | Control requerido |
|---|---|---|
| Copiar código Tiled GPL al producto | Alta | Clean-room, revisión por archivo, aprobación legal y NOTICE/SBOM. |
| Tratar todo Tiled como BSD | Alta | Aplicar `COPYING` por directorio/archivo. |
| Copiar RuleTile a core no dependiente de Unity | Alta | Implementación propia; paquete solo en companion elegible tras revisión. |
| Usar samples WFC como MIT | Alta | Assets propios o licencia individual comprobada. |
| Copiar TileKit/UI/assets sin licencia | Alta | Prohibir incorporación; permiso escrito si fuese necesario. |
| Copiar texto/capturas de documentación | Media | Parafrasear, citar y verificar licencia editorial. |
| Dependencia de modelo/servicio mutable | Media | Provider abstraction, evals, presupuesto y fallback. |
| Ausencia de inventario de terceros | Alta antes de distribución | `THIRD_PARTY_NOTICES.md`, SBOM, lockfile y revisión de release. |

## 7. Correcciones documentales propuestas

Sin aplicarlas todavía a fuentes:

1. Quitar los 14 bloques repetidos y crear bibliografía canónica con IDs, fecha y versión.
2. En cada capítulo, citar solo fuentes que respalden una afirmación concreta.
3. Sustituir quickstart OpenAI roto y actualizar URL Codex movida.
4. Añadir URLs de `COPYING` de Tiled, licencia del paquete Unity y LICENSE de WFC.
5. Marcar TileKit “producto comercial observado; licencia de reutilización no publicada”.
6. Añadir nota explícita: samples WFC no cubiertos por MIT.
7. Separar “inspiración” de “dependencia incorporada”. Ninguna fuente auditada se considera dependencia aprobada por aparecer en bibliografía.
8. Cuando Fase 0 elija stack/licencia del producto, ejecutar análisis de compatibilidad real y crear NOTICE/SBOM.
9. Para PM-13, convertir selección de modelo y estructura de agentes en hipótesis evaluable; no afirmación respaldada por anuncio comercial.

## 8. Gate para Fase 0

Puede usarse conocimiento conceptual de estas fuentes durante spikes si:

- no se copia código/assets sin ticket de licencia;
- cada dependencia experimental registra nombre, versión/commit, licencia, propósito y alternativa;
- fixtures visuales son propios o tienen licencia documentada;
- adaptadores Tiled/Unity fijan versión objetivo;
- uso OpenAI registra modelo, coste, disponibilidad y datos enviados;
- cualquier código de tercero incorporado pasa revisión antes de merge.

**Dictamen de fuentes/licencias para Fase 0:** **Go condicionado** a crear bibliografía canónica y política de incorporación de terceros. **No-go** para distribuir binarios o assets de terceros hasta completar NOTICE/SBOM y revisión de compatibilidad con licencia del producto.

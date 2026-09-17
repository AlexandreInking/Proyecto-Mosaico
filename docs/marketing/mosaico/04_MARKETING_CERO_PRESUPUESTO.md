# Mosaico — plan de marketing con presupuesto cero

## Objetivo

Conseguir diez testers adecuados, validar un flujo repetible y convertir la evidencia en ventas de una alpha Windows de compra única. No optimizar seguidores vacíos ni tráfico sin activación.

## Mensaje estratégico

**Problema:** assets, sprites, tilesets y mapas viven en herramientas separadas.
**Promesa:** Mosaico conecta esos pasos en un workspace local.
**Prueba:** catálogo/hash, Pixel Art, pipeline visual, mapas ortogonales, autotile básico, formatos portables y exportación.
**Límite:** no es IA generativa, engine ni SaaS cloud.

## Ideas priorizadas con MFS

Fórmula: `(Impacto + Fit + Velocidad) − (Esfuerzo + Coste)`. Coste y esfuerzo bajos mejoran la puntuación.

### 1. Clips de workflow de 30–60 segundos

**MFS:** `+10` — hacer ahora. Impacto 4 · Fit 5 · Velocidad 5 · Esfuerzo 3 · Coste 1.

Mostrar un resultado real: tilesheet a mapa, resize pixel-perfect, pipeline con preview, catálogo con hash. Un clip = un trabajo concreto = una CTA.

Canales: YouTube Shorts, Bluesky/X, itch devlog, GitHub README, Reddit cuando el subreddit lo permita.

**Métrica:** visitas con intención, descarga, primer asset importado.

### 2. Tutoriales de problemas concretos

**MFS:** `+8` — priorizar. Impacto 4 · Fit 5 · Velocidad 3 · Esfuerzo 3 · Coste 1.

Publicar seis guías: preparar tilesheet, resize nearest, organizar sprites, crear mapa ortogonal, configurar autotile básico y exportar un workspace reproducible.

**Métrica:** lecturas que llegan a descarga y preguntas repetidas.

### 3. Build in public con evidencia

**MFS:** `+9` — priorizar. Impacto 4 · Fit 5 · Velocidad 4 · Esfuerzo 3 · Coste 1.

Cada release muestra: problema, cambio, captura, límite conocido y siguiente hipótesis. Nunca convertir roadmap en promesa.

**Métrica:** comentarios útiles, testers referidos y repetición de sesión.

### 4. Comunidad de feedback reproducible

**MFS:** `+8` — priorizar. Impacto 4 · Fit 5 · Velocidad 4 · Esfuerzo 4 · Coste 1.

GitHub Discussions/Issues con etiquetas `install`, `workflow`, `bug`, `format`, `engine`, `ux`. Pedir archivo, pasos y resultado esperado; no “¿qué opinas?” sin contexto.

**Métrica:** diez sesiones completas, blockers clasificados y tiempo de respuesta.

### 5. Comparativas honestas junto a herramientas existentes

**MFS:** `+7` — test selectivo. Impacto 4 · Fit 4 · Velocidad 4 · Esfuerzo 4 · Coste 1.

Publicar “Aseprite para dibujar + Mosaico para conectar” y “Tiled/LDtk para mapas + Mosaico para preparar assets”. Nunca afirmar superioridad total.

**Métrica:** comentarios que describen el workflow actual y conversiones a prueba.

## AARRR operativo

| Etapa | Acción 0 presupuesto | Señal mínima |
|---|---|---|
| Acquisition | Clips, tutoriales, GitHub, itch devlogs, posts útiles | La persona puede explicar qué hace Mosaico en una frase. |
| Activation | Fixture descargable, primer flujo guiado, README de cinco minutos | Importa un asset y obtiene un resultado guardado/exportado. |
| Retention | Changelog, correcciones visibles, nuevas fixtures y respuesta a issues | Repite el flujo dentro de siete días. |
| Referral | Pedir compartir resultado, showcase de usuario y mención voluntaria | Un tester trae otro tester o comparte un resultado. |
| Revenue | Página itch clara, precio único, límites visibles y CTA de compra | Compra sin soporte manual extraordinario. |

## Calendario de 90 días

| Periodo | Entrega | Criterio de salida |
|---|---|---|
| Días 1–14 | Landing/README alpha, cover, video, fixture y checklist de instalación | Usuario nuevo entiende el producto y abre la build. |
| Días 15–30 | Página itch pública, precio US$14.99, diez keys, GitHub Issues | Diez testers seleccionados y claves registradas. |
| Días 31–60 | Seis clips, dos tutoriales, correcciones P0/P1, changelog | Cinco personas completan el flujo principal. |
| Días 61–90 | Comparativa, showcase de tester con permiso, decisión de precio | Go/no-go: seguir alpha, reducir alcance o preparar estable. |

## Horizonte de doce meses

- **Q1:** validar activación y onboarding.
- **Q2:** mejorar retención, formatos, errores y documentación.
- **Q3:** probar un único destino de engine y WinGet si el instalador es apto.
- **Q4:** decidir release estable, precio US$19.99 y si merece Steam/Microsoft Store.

Si Q1 no produce activación repetible, no añadir IA ni más canales: reducir la promesa y corregir el flujo.

## Psicología aplicada éticamente

| Modelo | PLFS | Aplicación |
|---|---:|---|
| Jobs to Be Done | +15, capado | CTA “See a 5-minute asset workflow” en lugar de “Download a huge tool”. |
| Risk reversal | +15, capado | Mostrar qué funciona, qué no, formatos, límites, changelog y política de alpha antes de cobrar. |
| Progress/competence | +13 | Fixture, progreso visible y primer resultado real; celebrar el trabajo terminado, no el número de features. |

No usar FOMO falso, countdowns, reseñas inventadas, defaults ocultos ni presión por “solo diez lugares” fuera de las diez keys reales.

## Herramientas gratuitas

GitHub Issues/Discussions/Pages, itch.io, OBS, editor local de video, Markdown, formularios gratuitos, hoja de cálculo y fixtures del repositorio. No añadir CRM, automatización compleja ni publicidad pagada antes de validar activación.

## Métricas

- Visitas a itch y fuente.
- Descargas y claves usadas.
- Instalaciones exitosas.
- Tiempo hasta primer asset importado.
- Tiempo hasta primer mapa o exportación.
- Repetición en siete días.
- Bugs por etapa.
- Conversión de visita a compra después de la alpha.
- Tiempo de soporte por tester.

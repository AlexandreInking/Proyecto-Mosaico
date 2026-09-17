# Mosaico — publicaciones Reddit listas para adaptar

## Reglas comunes

- Publicar desde una cuenta que participe en la comunidad, no desde una cuenta usada solo para enlaces.
- Adaptar cada post al subreddit; no cruzar-postear el mismo copy el mismo día.
- Mostrar resultado o aprendizaje antes de pedir descarga.
- Declarar: `I’m the developer of Mosaico.`
- Pedir feedback concreto, no upvotes.
- Responder comentarios y aceptar críticas.
- Revisar reglas y flair del subreddit justo antes de publicar; las reglas cambian.
- No prometer IA, integración universal ni soporte de plataformas no probadas.

Reddit exige participación auténtica y no spam. [Reddit Rules](https://redditinc.com/policies/reddit-rules). r/godot exige adaptar promoción al tema del engine y permanecer activo en comentarios. [Reglas/comunicado](https://www.reddit.com/r/godot/comments/1bemlw5/first-batch-of-changes-rules-and-flairs/). r/PixelArt suele exigir que la imagen sea principalmente pixel art, por lo que no usarlo como canal principal para screenshots de UI. [Guía comunitaria](https://www.reddit.com/r/PixelArt/comments/1agfbsd/promotional-guidelines/)

Sustituir placeholders: `[ITCH_URL]`, `[GITHUB_URL]`, `[VIDEO_URL]`, `[KEY_FORM_URL]`.

## 1. r/gamedev — workflow técnico

**Título:** `I kept switching between asset editor, pipeline, and tilemap tools, so I built a small local workspace — looking for workflow feedback`

**Cuerpo:**

> I’m the developer of Mosaico, a Windows-first 2D asset workspace.
>
> The current alpha connects four concrete steps:
> - import and catalog local assets;
> - edit pixel art and animation frames;
> - transform assets through a visual CPU pipeline;
> - use tilesets in an orthogonal map and export the result.
>
> The goal is not to replace Aseprite, Tiled, Godot, or Unity. I’m testing whether keeping the source, transformation, and map workflow together removes enough context switching to be useful.
>
> Short workflow video: [VIDEO_URL]
>
> What is the most annoying handoff in your current 2D asset workflow? I’m especially interested in the step between tilesheet preparation and the first usable map.

**CTA:** discussion first; link only if subreddit rules permit.

## 2. r/godot — integration question

**Título:** `Godot users: where does your asset workflow break before a TileMap/TileSet reaches the engine?`

**Cuerpo:**

> I’m building Mosaico, a local 2D asset workspace, and I’m trying to understand the boundary between asset preparation and Godot authoring.
>
> Current alpha supports local assets, Pixel Art, visual image pipelines, orthogonal maps, basic autotile rules, and neutral exports. It does **not** have a production-ready Godot importer yet.
>
> I’d like to learn which handoff causes the most friction: tile size, terrain rules, atlas layout, naming, reimporting, or something else.
>
> If useful, I can share the current workflow video: [VIDEO_URL].

## 3. r/Unity2D — concrete pipeline problem

**Título:** `What do you automate between a spritesheet and Unity’s first usable Tilemap?`

**Cuerpo:**

> I’m researching workflows for a small Windows tool that imports, transforms, previews, and maps 2D assets before they reach an engine.
>
> Mosaico currently stops at neutral PNG/JSON/ZIP-style outputs; Unity import is not being advertised as complete.
>
> For your projects, which manual step costs the most time: slicing, naming, pivots, palette conversion, terrain/autotile setup, atlas export, or reimport after an art change?
>
> I’m looking for real workflow examples, not votes for another tool.

## 4. r/indiedev — tester call

**Título:** `I have 10 free itch.io keys for a Windows alpha of a 2D asset workspace — looking for hands-on testers`

**Cuerpo:**

> I’m the developer of Mosaico, a local-first workspace for sprites, tilesets, maps, and visual asset pipelines.
>
> I’m looking for 10 testers who can spend 30–45 minutes on one task:
> `import fixture → adjust tilesheet → create a small map → edit an asset → export → reopen the workspace`.
>
> This is an early Windows build. No cloud accounts, no AI generation, no universal engine importers, and no promise that every edge is stable.
>
> Testers receive an individual itch.io download key and a short feedback form. Request: [KEY_FORM_URL]
>
> Please apply only if you have a current 2D workflow to compare against.

## 5. r/GameDevelopment — tutorial post

**Título:** `A practical tilesheet → map workflow: what should be visible before opening the engine?`

**Cuerpo:**

> I wrote a short guide around a recurring 2D workflow: identifying tile size, importing a tilesheet, keeping layers understandable, painting a small orthogonal map, and exporting a neutral result.
>
> The guide includes the fixture and the failure cases I found. Mosaico is the small tool I used while testing the flow, but the checklist should also be useful if you use Tiled, LDtk, or an engine editor.
>
> Guide: [GITHUB_URL]
>
> Which step would you add before calling a tileset “ready”?

## 6. r/gamedev — release transparency

**Título:** `Mosaico alpha update: fixed [specific bug], still not supported: [specific limitation]`

**Cuerpo:**

> I’m the developer of Mosaico. This week’s update fixes:
> - [bug and user-visible result]
> - [bug and user-visible result]
>
> Still not supported:
> - [limitation]
> - [limitation]
>
> The build and full changelog are here: [ITCH_URL]
>
> If you hit the fixed issue, can you confirm whether the new flow is clearer? If not, please include steps and the sample file.

## 7. r/PixelArt — only with real pixel-art output

**Título:** `Pixel-art tileset cleanup and map test — feedback on the asset, not the app UI`

**Cuerpo:**

> I’m testing a pixel-art tileset workflow in Mosaico. The image is the actual pixel-art result; the tool is only the context.
>
> I’m looking for critique on seams, readability, palette consistency, and whether the tiles repeat naturally in a small map.
>
> Asset/GIF: [VIDEO_URL]
>
> I’ll put the tool link in a comment only if the rules allow it.

Do not use this post if the main visual is an application screenshot or generated art.

## 8. Monthly follow-up

**Título:** `What I learned from 10 testers of a 2D asset workspace`

**Cuerpo:**

> Ten people tested the same workflow. The most common friction was [finding / setup / export / terminology].
>
> I changed [specific behavior] and intentionally did not build [requested feature] because [reason].
>
> The useful lesson for me: [lesson].
>
> If you maintain a 2D pipeline, does this match your experience?

Never turn tester feedback into fake testimonials. Ask permission before quoting a person or showing their asset.


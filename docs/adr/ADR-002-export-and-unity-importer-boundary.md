# ADR-002: export neutral e importador Unity comercial

## Estado

Aceptado para F1; contrato v1 validado por smoke Unity real. Estabilización pública pendiente del gate humano.

## Decisión

Mosaico guarda proyectos como `.mosaico` y exporta `.mosaicpack`, ambos ZIP con JSON y PNG. El editor gratuito no contiene código Unity ni genera assets nativos. Un package UPM privado separado registra `.mosaicpack` con `ScriptedImporter` y construye el prefab.

No habrá cifrado, DRM, telemetría ni licencia online. Precio objetivo del importador: USD 5. Valor comercial: instalación, compatibilidad probada, soporte y mantenimiento. Terceros técnicamente pueden crear importadores alternativos.

## Razones

- Mantiene núcleo agnóstico de motor.
- Permite trabajar offline y auditar bundles.
- Evita mezclar licencia/código comercial con editor gratuito.
- Prueba contrato real con Unity instalado antes de estabilizarlo.

## Alternativas rechazadas

- Prefab directo desde Mosaico: elimina frontera comercial y acopla app a Unity.
- DRM/cifrado: falsa exclusividad, complejidad y peor experiencia offline.
- Godot primero: no instalado; impediría smoke real inmediato.

## Fuentes

- https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AssetImporters.ScriptedImporter.html
- https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Tilemaps.Tilemap.SetTile.html
- https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Sprite.Create.html

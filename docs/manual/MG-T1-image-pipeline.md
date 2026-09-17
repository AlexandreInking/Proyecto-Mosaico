# MG-T1 — Pipeline real de imágenes

## Objetivo

Validar mismo corte T1 en WebApp y DesktopApp antes de avanzar a editor de mapas o Pixel Core.

## Preparación

1. Web: doble clic en `Mosaico-Web.cmd`.
2. Desktop: ejecuta `pnpm dev:desktop` o binario Tauri generado por gate.
3. Usa una PNG, JPEG o WebP propia que puedas reconocer visualmente.

## Qué revisar en cada versión

1. Pulsa **Importar** y elige imagen. Debe aparecer thumbnail, nombre, dimensiones, peso y hash.
2. Recarga/cierra y abre aplicación. Asset debe continuar en catálogo.
3. Cambia ancho, alto y formato. Ejecuta receta. Original y salida deben verse juntos; original no cambia.
4. Prueba escala pixel-art. Bordes deben conservar nearest-neighbor, sin suavizado inesperado.
5. Pulsa **Exportar imagen** y **Exportar manifiesto**. Ambos archivos deben descargarse; JSON debe incluir hash fuente, hash salida, receta y dimensiones.
6. Importa dos archivos no compatibles. Consola debe mostrar un solo grupo `IMAGE_IMPORT` con conteo `×2`, no dos filas.
7. Importa archivo renombrado falsamente a `.png`. Debe rechazarse por firma binaria.
8. Durante job grande pulsa **Cancelar**. No debe aparecer salida nueva confirmada.
9. Pulsa **Eliminar asset**. Debe desaparecer y seguir ausente después de reabrir.
10. Reduce ventana. Nada debe superponerse ni salir del viewport; consola e inspector deben seguir utilizables.

## Resultado requerido

- `PASS T1 Web` y `PASS T1 Desktop`: habilita cierre de T1.
- `FAIL T1 <Web|Desktop> paso N`: adjunta captura y resultado esperado.
- `BLOCKED T1 <Web|Desktop> paso N`: pega mensaje exacto.

Tras revisar ambas superficies, registra el veredicto ligado al paquete evaluado:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/record-t1-manual.ps1 `
  -WebStatus PASS -DesktopStatus PASS -Operator "nombre" -Notes "MG-T1 completo"
```

No validar todavía herramientas Pixel Art, mapas, IA, atlas ni audio: aparecen planificadas y pertenecen a fases posteriores.

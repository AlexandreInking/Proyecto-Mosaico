# MG-T0 — Shell compartido Desktop/Web

## Objetivo

Validar que T0 entrega dos aplicaciones ejecutables con misma UI y limites honestos antes de implementar procesamiento real en T1.

## Preparacion

1. Ejecuta `scripts\t0-gate.ps1` desde PowerShell.
2. Espera mensaje `Gate T0 automatico PASS`.
3. Cierra cualquier instancia previa de Mosaico.

## DesktopApp

1. Haz doble clic en `Mosaico.cmd`.
2. Confirma titulo `Mosaico — Asset Pipeline AI`.
3. Confirma navegacion: Assets, Pipelines, Mapas, Mundo, Jobs y Exportar.
4. Reduce ventana hasta 760 × 520. Confirma que contenido sigue legible, sin superposiciones ni elementos fuera de ventana.
5. Confirma que acciones futuras indican T1 y no simulan procesamiento inexistente.

## WebApp

1. Haz doble clic en `Mosaico-Web.cmd`.
2. Confirma apertura de `http://127.0.0.1:5173`.
3. Compara estructura, textos, colores, estados y orden con DesktopApp: deben coincidir.
4. Reduce navegador a ancho aproximado de movil. Confirma navegacion y paneles legibles, sin scroll horizontal global.
5. Abre `http://127.0.0.1:3333/health`. Debe mostrar `{"status":"ok"}`.

## Resultado

Reporta uno:

- `PASS T0`: todo coincide y puede avanzarse a T1.
- `FAIL T0`: incluye paso, version Desktop/Web, captura y resultado esperado.
- `BLOCKED T0`: incluye mensaje exacto y paso que no pudo ejecutarse.

T0 no procesa sprites, modelos ni sonidos. Es cimiento ejecutable: contratos, shell compartido, limites de plataforma y servidor base.

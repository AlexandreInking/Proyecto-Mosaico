# ADR-001: stack y renderer del spike F0

**Estado:** condicionado
**Fecha:** 19 de julio de 2026

## Contexto

El repositorio dispone localmente de .NET SDK 10.0.300 y runtimes Windows Desktop. No hay paquetes Avalonia/Skia confirmados offline. F0 necesita un programa manual pronto sin convertir conveniencia local en compromiso multiplataforma.

## Decisión

Usar C#/.NET 10 para dominio, aplicación y persistencia. Usar WPF como host Windows descartable del primer spike, separado por puertos del núcleo. El viewport usa `DrawingContext` y render inmediato. `global.json` fija SDK 10.0.300 con roll-forward de parche.

La decisión final de UI/renderer queda pendiente de comparar, con mismo fixture:

1. Avalonia + Skia, candidata preferida para producto multiplataforma.
2. Rust + winit/wgpu, comparador de rendimiento y packaging.
3. WPF, baseline Windows; no candidata final mientras Linux/macOS sean requisito.
4. TypeScript/Electron, solo si demuestra ventaja suficiente en accesibilidad, tooling y packaging.

## Criterios de comparación

Viewport, picking, pan/zoom, HiDPI 100/150/200 %, teclado/IME, accesibilidad, automatización, frame p95, memoria, arranque, tamaño distribuido, soporte Windows/Linux/macOS y riesgo de licencias/supply chain.

## Consecuencias

- Se obtiene ejecutable sin descargar dependencias.
- Núcleo queda portable y testeable fuera de WPF.
- Resultado gráfico no demuestra aún rendimiento GPU final.
- Packaging inicial es framework-dependent.
- WPF debe poder eliminarse sin migrar dominio ni formato.

## Condiciones para aceptar ADR

- Spike WPF y al menos un comparador multiplataforma medidos con fixture común.
- Licencias, NOTICE, lockfiles y SBOM revisados.
- CI de núcleo en Windows/Linux/macOS; smoke UI en plataformas prometidas.
- Matriz humana GO/NO-GO sobre accesibilidad, packaging y rendimiento.

## Referencias internas

PM-03 estrategia tecnológica; PM-10 presupuestos; PM-12 matriz de plataformas; PM-14 Fase 0; `docs/phase0/SPEC.md`.

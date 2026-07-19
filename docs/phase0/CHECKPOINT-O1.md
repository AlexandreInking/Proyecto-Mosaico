# Checkpoint O1: autorización de spikes F0

**Resultado:** GO condicionado para Fase 0; Fase 1 permanece NO-GO
**Fecha:** 19 de julio de 2026

## Evidencia

- H-003: usuario primario, antiusuario, reclutamiento y TR-01/TR-02/TR-03 incorporados en PM-01.
- H-004: métricas USER/FUNC/PERF/SEC con baseline, método, muestra, objetivo y acción.
- H-005: gate `hipótesis → spike → evidencia → decisión` coincide en PM-01 y PM-14.
- H-006: 56/56 REQ tienen prioridad aprobada, contrato, prueba, fase y aprobación o excepción justificada; validador automático verde.
- H-007: PM-12 y PM-14 exigen ejecutable, fixture, suite, benchmark, walkthrough y revisión humana por fase.
- H-017 contenido: límites v0 y prohibición de ejecución de scripts/plugins en F0/F1.

## Revisiones

- Producto/UX: usuario, tareas, métricas y gate manual revisados por agente especializado.
- Arquitectura: .NET 10 + WPF descartable, puertos de UI y ADR condicionado revisados por agente especializado.
- QA/Seguridad: trazabilidad, límites, amenazas y gate revisados por agente especializado.
- Propietario: autorización explícita para proceder con Ola 1 y continuar hasta programa manual.

## Condiciones

F0 solo ejecuta spikes descartables. No congela formato, renderer, compatibilidad ni UI final. No hay host de plugins, scripts ni telemetría. Un S0/S1 detiene avance. ADR-001 no pasa de condicionado hasta comparador multiplataforma y revisión de licencias.

## Decisión

Autorizar S0 ortogonal reducido: dominio, coordenadas negativas, comandos, undo/redo, JSON experimental de archivo único, guardado atómico y host WPF manual.

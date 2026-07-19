# Dictamen de preparación documental

**Fecha:** 19 de julio de 2026  
**Corpus:** PM-00…PM-14 versión 0.1.0  
**Evidencia:** E-01…E-09

## Decisión

| Actividad/fase | Estado | Condición |
|---|---|---|
| Auditoría documental | **GO / ejecutada** | Entregables E-01…E-10 creados; fuentes preservadas. |
| Corrección documental | **GO condicionado** | Aprobar backlog E-09; cambios normativos con revisión humana. |
| Fase 0 — descubrimiento/spikes | **NO-GO actual** | Cerrar H-003…H-007 y Checkpoint O1. |
| Fase 1 — editor ortogonal mínimo | **NO-GO** | Completar F0, aceptar ADR/contratos y superar Checkpoint O2. |
| Fases 2–7 | **NO-GO secuencial** | Cada fase requiere ejecutable anterior aceptado y su gate propio. |
| Release público | **NO-GO** | Licencia, matriz de plataformas, firma, privacidad y gates release no cerrados. |

## Motivo del NO-GO para Fase 0

Arquitectura y QA permiten spikes descartables, pero Producto/UX detecta que aún no existe contrato común para decidir si esos spikes validan algo. Iniciar ahora produciría demos técnicamente interesantes sin usuario primario, métricas, trazabilidad ni salida compartida.

Bloqueos previos:

1. Usuario/problema primario.
2. Métricas medibles.
3. Unificación de tres prototipos de descubrimiento.
4. Trazabilidad bidireccional aprobada.
5. Gate ejecutable/manual por fase.

## Condición de salida de Fase 0

Fase 0 será aceptable únicamente si produce:

- ADR-001 de stack/renderer basado en spikes comparables.
- Contrato de hilo de documento/jobs y evidencia de cancelación segura.
- Contrato espacial con fixtures ortho, iso, hex y coordenadas negativas.
- Formato v0 experimental con round-trip canónico.
- Protocolo de guardado multifichero con state machine de recuperación.
- Harness/escenas y baseline de benchmark reproducible.
- CI build/test para Windows 11 x64, Ubuntu 24.04 x64 y macOS Apple Silicon.
- Ejecución manual de spikes y decisión humana registrada.

## Política obligatoria desde Fase 1

Cada fase entrega programa ejecutable y manualmente probado antes de avanzar:

```text
Build reproducible
  → iniciar binario
  → abrir fixture versionado
  → ejecutar flujo vertical de fase
  → provocar error/recuperación relevante
  → verificar guardado/reapertura
  → ejecutar suite + benchmark
  → registrar evidencia
  → revisión humana GO/NO-GO
```

Reglas:

- S0/S1 abierto: NO-GO automático.
- S2: solo waiver humano escrito con riesgo y fecha.
- Fallo manual: corregir fase actual y repetir flujo completo.
- Pruebas unitarias no sustituyen ejecución real.
- Captura visual no sustituye integridad de estado.
- No comenzar fase siguiente “por calendario”.

## Riesgo residual principal

| Riesgo | Nivel | Contención antes de implementación |
|---|---|---|
| Pérdida/corrupción multifichero | Crítico | ADR atomicidad + fault injection. |
| Reescritura por stack incorrecto | Crítico | Spikes y ADR-001. |
| UX no validable | Alto | Usuario, métricas y guiones manuales. |
| Contratos espaciales divergentes | Crítico | Fixtures y property tests. |
| Parser/plugin hostil | Crítico | Límites numéricos, scripts desactivados y threat model. |
| Dossier/documentos divergen | Alto | Generación automática y check CI. |
| Compatibilidad prometida sin corpus | Alto | Matriz por versión y reportes de pérdida. |

## Decisiones ya fijadas

- Repositorio GitHub privado nuevo; sin historia previa.
- Capítulos independientes canónicos; dossier generado.
- Auditoría antes de corrección; corrección antes de Fase 0.
- Subagentes especializados para revisión; aprobación irreversible humana.
- Matriz inicial Windows/Ubuntu/macOS; Windows referencia primaria.
- Programa ejecutable y prueba manual obligatorios desde Fase 1.

## Recomendación

**Aprobar E-09 y comenzar Ola 0, no Fase 0.** Tras O0/O1, repetir auditoría focal de bloqueos. Solo entonces emitir GO para spikes F0.

Este dictamen no invalida visión del producto. Reduce riesgo antes de convertir intención en contratos y código.

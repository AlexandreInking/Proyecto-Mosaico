---
title: "Proyecto Mosaico - Sistema agéntico de desarrollo"
subtitle: "Organización con GPT-5.6 Sol, agentes especializados, herramientas, evals y control humano"
author: "Proyecto Mosaico - documentación de diseño"
date: "18 de julio de 2026"
lang: es-ES
documentclass: article
papersize: a4
fontsize: 10pt
mainfont: "Lato"
sansfont: "Lato"
monofont: "DejaVu Sans Mono"
geometry: margin=1.8cm
toc: true
toc-depth: 3
numbersections: true
colorlinks: true
header-includes:
  - |-
    \input{/mnt/data/proyecto_mosaico_documentacion/src/header.tex}
---

> **Documento:** PM-13  
> **Versión:** 0.1.0 - Base de diseño  
> **Estado:** Base aprobable para iniciar implementación; sujeto a ADR y control de cambios.  
> **Nombre del producto:** Proyecto Mosaico es un nombre provisional.


# Objetivo

Usar un sistema agéntico para acelerar diseño, implementación, pruebas y mantenimiento sin delegar ciegamente decisiones irreversibles. GPT-5.6 Sol actúa como coordinador y revisor de trabajos complejos; agentes especializados implementan módulos acotados; herramientas deterministas deciden si el resultado compila y cumple pruebas.

![Organización agéntica propuesta](/mnt/data/proyecto_mosaico_documentacion/assets/agentic_org.png)

# Principio de operación

El agente no recibe "construye todo el editor". Recibe una unidad vertical con contrato, archivos permitidos, pruebas, presupuesto y criterios de aceptación. Debe inspeccionar, planificar, modificar, ejecutar evidencia y resumir riesgos.

# Roles

## Coordinador Sol 5.6

- Mantiene contexto de producto y arquitectura.
- Descompone epics.
- Selecciona agente y herramientas.
- Revisa diffs transversales.
- Decide cuándo solicitar aprobación humana.
- Sintetiza resultados y actualiza trazabilidad.

## Arquitectura

Mantiene ADR, límites, APIs y dependencias. Revisa cualquier cambio en formato, threading, identidad o plugins.

## Núcleo y persistencia

Implementa dominio, comandos, chunks, properties, guardado y migraciones.

## UX y editor

Implementa flujos, paneles, herramientas, input y accesibilidad. Debe operar la aplicación y adjuntar capturas o recordings.

## Algoritmos

Implementa reglas, generadores, validadores y WFC con pruebas de propiedades y benchmarks.

## Renderizado

Implementa cámara, culling, batching, overlays y perfilado.

## QA adversarial

No comparte el objetivo de "hacer que pase". Busca contraejemplos, archivos corruptos, secuencias de undo y fallos visuales.

## Revisor de seguridad

Revisa parsers, plugins, updates, path handling y recursos no confiables.

# Herramientas requeridas

- Repositorio Git con ramas y PR.
- Terminal, compilador, test runner y linter.
- Lanzador de aplicación y automatización de UI.
- Capturas de pantalla y comparación visual.
- Perfilador y benchmarks.
- Acceso a documentación oficial.
- Issue tracker y registro de ADR.
- Sandbox para muestras y plugins.

Sin observación de la aplicación, un agente puede entregar código que compila pero no una herramienta usable.

# Contrato de tarea

```yaml
id: TASK-RULE-042
objective: Actualización incremental de patrones
allowed_paths:
  - src/Mosaico.Rules/**
  - tests/Mosaico.Rules.Tests/**
requirements:
  - REQ-RULE-006
acceptance:
  - incremental_equals_full_recompute
  - benchmark_100k_cells_under_budget
forbidden:
  - changing native file schema
  - adding new runtime dependency
artifacts:
  - code
  - tests
  - benchmark report
  - risk summary
```

# Ciclo de trabajo

1. Leer tarea, requisitos y ADR relacionados.
2. Inspeccionar código y pruebas existentes.
3. Proponer plan corto y riesgos.
4. Implementar en cambios pequeños.
5. Ejecutar pruebas específicas y luego relevantes.
6. Ejecutar aplicación o benchmark si corresponde.
7. Revisar diff propio.
8. Entregar evidencia y asuntos pendientes.
9. Revisor independiente intenta romperlo.
10. Coordinador integra o devuelve.

# Handoffs

Un handoff incluye estado, decisiones, archivos, comandos ejecutados, fallos conocidos y siguiente acción. No debe limitarse a "terminado".

# Memoria del proyecto

Fuentes autoritativas:

- Dossier y ADR versionados.
- Código y pruebas.
- Esquemas y fixtures.
- Issues y decisiones aprobadas.

Resúmenes del agente son auxiliares y pueden quedar obsoletos. El coordinador debe volver a fuentes cuando una decisión es crítica.

# Evaluaciones de agentes

## Evals de código

- Compila.
- Pruebas pasan.
- No viola dependencias.
- No modifica paths prohibidos.
- No degrada benchmark.

## Evals de comportamiento

- Sigue contrato de tarea.
- Reporta incertidumbre.
- No afirma haber probado lo que no ejecutó.
- Produce cambios mínimos y coherentes.
- Conserva compatibilidad.

## Evals de revisión

Se usan bugs sembrados y PR históricas para medir si el agente encuentra problemas de integridad, concurrencia y geometría.

# Selección de modelos

Sol 5.6 para arquitectura, depuración difícil, integración y revisión. Modelos de menor coste para boilerplate, documentación, tests repetitivos o tareas acotadas. La elección se basa en riesgo, no en prestigio.

El provider se encapsula:

```csharp
public interface IReasoningAgentProvider
{
    Task<AgentResult> RunAsync(AgentTask task, AgentPolicy policy);
}
```

El producto no debe depender de que un nombre de modelo exista para siempre.

# Paralelismo

Trabajos paralelos solo cuando los límites son claros. Ejemplo: renderer, documentación de formato y generador BSP pueden avanzar en ramas separadas. Dos agentes no deben editar simultáneamente el modelo de capas sin coordinación.

El coordinador mantiene un mapa de ownership temporal y detecta conflictos antes de lanzar tareas.

# Aprobación humana

Obligatoria para:

- Cambio de alcance o UX principal.
- Elección de framework y licencia.
- Cambio incompatible de formato o Plugin API.
- Eliminación de soporte.
- Excepción a seguridad o integridad.
- Release estable.

# Políticas de seguridad del agente

- No introducir dependencias sin revisión.
- No descargar o ejecutar binarios no confiables.
- No acceder a secretos fuera del sandbox.
- No publicar código ni releases sin autorización.
- No modificar fixtures dorados para ocultar un fallo.
- No desactivar pruebas sin issue y aprobación.

# Plantillas de prompts internos

## Implementación

```text
Implementa únicamente TASK-X. Lee requisitos y ADR enlazados.
No cambies el esquema ni dependencias. Añade pruebas que fallen antes del cambio.
Ejecuta la suite indicada y resume comandos, resultados, riesgos y archivos.
```

## Revisión adversarial

```text
Revisa el PR como responsable de integridad. Busca pérdida de datos,
undo incorrecto, coordenadas negativas, concurrencia y errores silenciosos.
No propongas reescrituras estéticas salvo que oculten un riesgo.
```

# Métricas del sistema agéntico

- Porcentaje de tareas aceptadas sin rework.
- Bugs encontrados por revisor antes de merge.
- Tasa de afirmaciones de prueba verificables.
- Tiempo y coste por epic.
- Regresiones por módulo.
- Deuda introducida y ADR faltantes.

# Fallos esperables

- Implementación local que rompe una invariante global.
- Sobreproducción de archivos y abstracciones.
- Tests que replican el código y no validan intención.
- Cambios visuales sin inspección.
- Confianza excesiva en documentación desactualizada.

La mitigación es reducir el tamaño de tarea, usar revisores independientes y exigir herramientas deterministas.

# Piloto recomendado

El piloto agéntico implementa un slice vertical ortogonal: documento, tileset, viewport, pincel, undo, guardado, carga y prueba automatizada. Después añade una regla semántica simple. Esto evalúa arquitectura, UI, persistencia y coordinación antes de WFC.


## Referencias para el sistema agéntico

- GPT-5.6 Sol, ficha del modelo: https://developers.openai.com/api/docs/models/gpt-5.6-sol
- GPT-5.6, anuncio oficial: https://openai.com/index/gpt-5-6/
- OpenAI API, quickstart y agentes: https://platform.openai.com/docs/quickstart/make-your-first-api-request
- Casos de uso de Codex para ingeniería: https://developers.openai.com/codex/use-cases

La disponibilidad, precios, límites y nombres de modelos son configurables y pueden cambiar. La arquitectura propuesta encapsula el proveedor de modelos para evitar que el proceso dependa de una única versión.

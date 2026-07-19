# Backlog de correcciones documentales

**Fecha:** 19 de julio de 2026  
**Entrada:** E-01…E-08 y H-001…H-020  
**Estado:** Ola 0 aprobada y en ejecución desde el 19 de julio de 2026
**Alcance autorizado:** ejecutar Ola 0; Olas posteriores conservan sus checkpoints y aprobaciones

## Regla de ejecución

Cada tarea se implementa en rama corta, modifica fuentes canónicas bajo `documentos/`, valida enlaces/trazabilidad y regenera dossier en commit separado o paso reproducible. Revisión humana obligatoria si cambia alcance, requisito, formato, seguridad o gate.

La aprobación permite corregir gobernanza, portabilidad y estados documentales. No autoriza iniciar Fase 0, copiar código externo ni cambiar requisitos funcionales.

## Ola 0 — Recuperabilidad y corpus

### DOC-001: Formalizar canonicidad y generación del dossier

**Descripción:** PM-00 y README declaran capítulos canónicos; dossier pasa a artefacto generado con verificación anti-deriva.

**Aceptación:**

- [ ] Política explícita prohíbe editar dossier directamente.
- [ ] Script/CI reconstruye dossier determinísticamente.
- [ ] Check falla si dossier no coincide con capítulos.

**Verificación:** regenerar dos veces; hashes iguales; diff vacío.  
**Dependencias:** ninguna. **Hallazgos:** H-002. **Tamaño:** M.

### DOC-002: Reparar portabilidad Markdown/PDF

**Descripción:** Sustituir rutas `/mnt/data`, incluir/configurar header portable o eliminar dependencia, y enlazar `diagramas/` relativamente.

**Aceptación:**

- [ ] Cero referencias locales rotas.
- [ ] Markdown renderiza 8 imágenes desde raíz y desde `documentos/`.
- [ ] Pipeline PDF no depende de filesystem del autor.

**Verificación:** link checker; render Markdown/PDF; inspección visual.  
**Dependencias:** DOC-001. **Hallazgos:** H-002. **Tamaño:** M.

### DOC-003: Corregir estados documentales

**Descripción:** Introducir estados Borrador, Auditado, Aprobado y Estable; marcar corpus según evidencia real.

**Aceptación:**

- [ ] PM-00 define transición y autoridad por estado.
- [ ] Ningún documento se declara aprobable con bloqueantes abiertos.
- [ ] E-04 enlaza decisiones límite.

**Verificación:** búsqueda de estados; revisión PM-00/PM-14.  
**Dependencias:** DOC-001. **Hallazgos:** H-001. **Tamaño:** S.

### Checkpoint O0

- [ ] Git limpio y dossier reproducible.
- [ ] Cero enlaces locales rotos.
- [ ] Estados no sobreprometen preparación.

## Ola 1 — Cierre previo a Fase 0

### DOC-004: Fijar usuario y problema primarios

**Descripción:** Priorizar creador independiente/diseñador 2D, definir antiusuario, contexto y tres tareas de referencia; conservar perfiles secundarios.

**Aceptación:**

- [ ] Usuario primario y problema verificable en PM-01.
- [ ] Criterio de reclutamiento y antiusuario explícitos.
- [ ] Escenarios F0/F1 enlazan tareas de referencia.

**Verificación:** revisión Producto/UX; ninguna promesa nueva sin REQ.  
**Dependencias:** DOC-003. **Hallazgos:** H-003. **Tamaño:** S.

### DOC-005: Convertir métricas en contratos

**Descripción:** Dar baseline, unidad, objetivo, muestra, entorno y método a métricas de producto/UX/rendimiento.

**Aceptación:**

- [ ] Cada métrica F0/F1 tiene ficha completa.
- [ ] Distingue evidencia de usuario, funcional y benchmark.
- [ ] Define resultado fallido y acción posterior.

**Verificación:** tabla sin campos vacíos; ensayo con fixture ficticio.  
**Dependencias:** DOC-004. **Hallazgos:** H-004, H-012. **Tamaño:** M.

### DOC-006: Unificar gate de Fase 0

**Descripción:** PM-01 y PM-14 comparten salida F0: tres spikes verticales, ADR de stack, formato/atomicidad y automatización visual.

**Aceptación:**

- [ ] Mismo criterio en visión y roadmap.
- [ ] Cada spike declara hipótesis, timebox, artefacto descartable y evidencia.
- [ ] F0 no promete compatibilidad ni formato estable.

**Verificación:** matriz criterio→spike→evidencia→decisión.  
**Dependencias:** DOC-005. **Hallazgos:** H-005. **Tamaño:** M.

### DOC-007: Adoptar trazabilidad bidireccional

**Descripción:** Integrar E-02 en gobernanza y resolver coberturas parciales/huecos; aprobar prioridades reales.

**Aceptación:**

- [ ] 56/56 REQ con prioridad aprobada.
- [ ] 56/56 enlazan contrato, prueba y fase o excepción justificada.
- [ ] Historias F1 cumplen Definition of Ready.

**Verificación:** validador CSV; cero IDs huérfanos/duplicados.  
**Dependencias:** DOC-004 y DOC-006. **Hallazgos:** H-006. **Tamaño:** M.

### DOC-008: Incorporar gate ejecutable por fase

**Descripción:** Desde Fase 1 exigir binario, fixture, guion manual, suite, benchmark, evidencia y revisión humana antes de avanzar.

**Aceptación:**

- [ ] PM-12/PM-14 contienen gate común.
- [ ] Cada fase 1–7 tiene escenario manual mínimo propio.
- [ ] Fallo S0/S1 mantiene fase abierta; S2 requiere waiver.

**Verificación:** walkthrough MG-01 y plantilla reutilizable.  
**Dependencias:** DOC-005 y DOC-007. **Hallazgos:** H-007, H-018, H-019. **Tamaño:** M.

### DOC-009: Numerar límites hostiles y política de scripts

**Descripción:** Definir límites configurables seguros, manejo de `Scripts[]`, plugins in-process, firma, updates y supply chain para spikes/MVP.

**Aceptación:**

- [ ] Tabla de límites por recurso con default, máximo y error.
- [ ] Abrir proyecto nunca ejecuta scripts/plugins embebidos.
- [ ] F0/F1 declaran funciones prohibidas hasta ADR de aislamiento.

**Verificación:** threat model; casos bomba/path traversal/plugin hostil.  
**Dependencias:** DOC-003. **Hallazgos:** H-016, H-017. **Tamaño:** M.

### Checkpoint O1 — Autorización de Fase 0

- [ ] H-003…H-007 cerrados.
- [ ] Trazabilidad 56/56 aprobada.
- [ ] Riesgos F0 limitados; no se congelan contratos.
- [ ] Revisión humana Producto + Arquitectura + QA/Seguridad.

## Ola 2 — Contratos que Fase 0 debe decidir

### DOC-010: Preparar ADR-001 stack/renderer

**Descripción:** Plantilla comparativa para C#/.NET, Rust y shell TypeScript con viewport, input, HiDPI, accesibilidad, packaging, automatización y perfilado.

**Aceptación:** opciones comparables, corpus común, criterios ponderados.  
**Verificación:** cada spike produce misma tabla.  
**Dependencias:** DOC-006. **Hallazgos:** H-013. **Tamaño:** S.

### DOC-011: Especificar threading y jobs

**Descripción:** Dispatcher de documento, orden total, reentrancia, snapshots, conflictos, eventos y cancelación.

**Aceptación:** una política por job; secuencias pintar/generar/guardar explicables.  
**Verificación:** diagramas de secuencia + spike.  
**Dependencias:** DOC-010. **Hallazgos:** H-008. **Tamaño:** M.

### DOC-012: Especificar contrato espacial

**Descripción:** Ejes, origen, unidades, rangos, direcciones, tolerancias, bordes, elevación y fixtures.

**Aceptación:** casos ortho/iso/staggered/hex/negativos sin ambigüedad.  
**Verificación:** fixtures directos/inversos y property tests planificados.  
**Dependencias:** DOC-010. **Hallazgos:** H-009. **Tamaño:** M.

### DOC-013: Definir formato experimental v0

**Descripción:** Esquema, identidad, canonicalización, encoding, extensiones desconocidas, chunks y compatibilidad.

**Aceptación:** round-trip canónico y corpus de válidos/inválidos.  
**Verificación:** schema validator + golden files.  
**Dependencias:** DOC-011 y DOC-012. **Hallazgos:** H-010. **Tamaño:** M.

### DOC-014: Elegir atomicidad multifichero

**Descripción:** ADR journal versus generaciones de manifiesto; definir state machine y recuperación.

**Aceptación:** anterior válido o nuevo completo tras cada punto de fallo.  
**Verificación:** plan de fault injection.  
**Dependencias:** DOC-013. **Hallazgos:** H-011. **Tamaño:** S.

### DOC-015: Fijar harness y máquina de benchmark

**Descripción:** Registrar hardware real, SO/API GPU, escenas, caché, muestreo y presupuestos p50/p95/p99/memoria.

**Aceptación:** ejecución repetible y baseline versionado.  
**Verificación:** 20+ muestras y reporte automático.  
**Dependencias:** DOC-010 y DOC-012. **Hallazgos:** H-012. **Tamaño:** M.

### Checkpoint O2 — Salida Fase 0

- [ ] ADR-001 aceptado.
- [ ] Threading, espacio, formato, atomicidad y benchmark tienen contratos probados.
- [ ] CI build/test en Windows, Ubuntu y macOS.
- [ ] Spikes manualmente ejecutados; evidencia revisada.
- [ ] Decisión humana GO/NO-GO Fase 1.

## Ola 3 — Antes del subsistema correspondiente

### DOC-016: Formalizar semántica de reglas

**Límite:** Fase 3. **Hallazgos:** H-014. **Dependencias:** formato y topología estables.  
**Verificación:** especificación ejecutable; incremental = full.

### DOC-017: Formalizar terminación PCG/WFC

**Límite:** Fases 5/6. **Hallazgos:** H-015. **Dependencias:** jobs, reglas y validadores.  
**Verificación:** corpus imposible, límites y reproducibilidad.

### DOC-018: Congelar matrices externas y Plugin API

**Límite:** Fase 7. **Hallazgos:** H-016. **Dependencias:** formato y threat model.  
**Verificación:** corpus Tiled, SemVer, permisos y aislamiento decidido.

## Orden crítico

```text
DOC-001 → DOC-002/DOC-003
DOC-003 → DOC-004/DOC-009
DOC-004 → DOC-005 → DOC-006 → DOC-007 → DOC-008
Checkpoint O1
DOC-010 → DOC-011/DOC-012/DOC-015
DOC-011 + DOC-012 → DOC-013 → DOC-014
Checkpoint O2
DOC-016 → DOC-017 → DOC-018 según roadmap
```

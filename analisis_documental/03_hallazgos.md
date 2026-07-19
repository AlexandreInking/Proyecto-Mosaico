# Registro consolidado de hallazgos documentales

**Fecha:** 19 de julio de 2026  
**Estado:** auditoría; documentos PM-00…PM-14 sin corregir  
**Fuentes:** inventario mecánico, matriz de trazabilidad y auditorías E-05, E-06 y E-07

## Dictamen ejecutivo

- **Auditoría y preparación de correcciones:** GO.
- **Spikes descartables de Fase 0:** GO condicionado según Arquitectura y QA; Producto/UX exige cerrar primero cinco bloqueos de definición. Se adopta criterio conservador: **NO-GO para iniciar Fase 0 hasta cerrar H-003, H-004, H-005, H-006 y H-007 en documentación**.
- **Fase 1:** NO-GO. Contratos de stack, threading, espacio, formato, atomicidad, benchmark y gate manual no están cerrados.
- **Fases posteriores:** no evaluables como implementables; sí auditables.

La documentación tiene buena visión sistémica y principios correctos. Problema principal: declara “base aprobable” mientras varios contratos solo ofrecen alternativas o intenciones no medibles.

## Método de consolidación

Hallazgos equivalentes de distintos revisores se agrupan por causa raíz. IDs originales permanecen como evidencia. Severidad aplicada:

- **Bloqueante:** impide fase indicada o crea riesgo alto de pérdida/retrabajo.
- **Alta:** debe cerrarse antes del subsistema afectado.
- **Media:** ambigüedad importante con contención posible.
- **Baja/editorial:** no cambia contrato ni seguridad.

## Hallazgos consolidados

| ID | Severidad | Fase límite | Causa raíz | Evidencia principal | IDs relacionados | Resultado exigido |
|---|---|---:|---|---|---|---|
| H-001 | Bloqueante | F0 | Estado documental “base aprobable” contradice decisiones estructurales abiertas. | PM-00:25,129-131; PM-03:195-211; todos los PM:25 | B-08 | Cambiar estado tras auditoría; definir niveles Borrador/Auditado/Aprobado/Estable. |
| H-002 | Alta | Corrección | Paquete no portable: 30 rutas a `header.tex` ausente y 16 rutas `/mnt/data/.../assets`; dossier manual duplica fuentes. | 15 frontmatters; imágenes PM-00/01/03/04/09/11/12/13 | Inventario mecánico | Capítulos canónicos, rutas relativas y generación verificada del dossier. |
| H-003 | Bloqueante | F0 | No existe usuario primario, antiusuario ni hipótesis priorizada para evaluar spikes. | PM-01:52-72; PM-14:33-42 | PUX-01 | Segmento inicial, tareas de referencia y criterios de reclutamiento. |
| H-004 | Bloqueante | F0 | Métricas carecen de baseline, unidad, umbral, muestra y método. | PM-01:125-148; PM-06:180-182; PM-10:83-94 | PUX-02, B-06 | Fichas de métricas y corpus/entorno reproducible. |
| H-005 | Bloqueante | F0 | Criterio de descubrimiento de PM-01 exige tres prototipos; Fase 0 de PM-14 no los incorpora. | PM-01:166-168; PM-14:33-42 | PUX-03 | Un único gate F0 con tres spikes, ADR y evidencia. |
| H-006 | Bloqueante | F0 | Trazabilidad inicial no une escenario→flujo→REQ→contrato→prueba→fase. | PM-02:161-169; PM-14:134-155 | PUX-04 | Adoptar E-02, resolver 22 coberturas parciales y 3 huecos. |
| H-007 | Bloqueante | F0/F1 | Roadmap no exige ejecutable, fixture, guion manual y evidencia en cada fase. | PM-14:29-117; petición del propietario | PUX-05, MG-01 | Incorporar gate ejecutable: build/run, prueba manual, suite, benchmark y decisión humana. |
| H-008 | Bloqueante | F0 | “Hilo de documento” carece de dispatcher, orden, afinidad, reentrancia y política de conflicto por job. | PM-03:149,187-189 | B-01, A-02, A-03 | ADR de threading + spike input/job/commit/cancelación. |
| H-009 | Bloqueante | F0 | Convenciones espaciales y `SpatialConfiguration` no son esquema verificable. | PM-04:35-74; PM-05:64-74 | B-02, A-04..A-06 | Ejes, unidades, origen, rangos, dirección canónica, tolerancias y fixtures ortho/iso/hex/negativos. |
| H-010 | Bloqueante | F0 | Formato v0 sin esquema, canonicalización byte a byte ni política precisa de compatibilidad. | PM-05:158-188,207-233; REQ-IO-001 | B-03, A-07..A-09 | Esquema experimental, identidad fija, codificación, corpus y round-trip canónico. |
| H-011 | Bloqueante | F0 | Atomicidad multifichero ofrece journal o generaciones sin elegir protocolo/state machine. | PM-05:190-205; PM-12:78-82 | B-04 | ADR, estados de recuperación y fault injection. |
| H-012 | Bloqueante | F0 | Presupuestos de 60 FPS/p95 no fijan máquina, API GPU, escena, caché ni muestreo. | PM-02:135; PM-10:83-94,148-155 | B-06, A-21..A-23 | Matriz inicial, máquina exacta, corpus y harness p50/p95/p99. |
| H-013 | Bloqueante | F0 | Stack, renderer, packaging, accesibilidad y automatización visual siguen abiertos. | PM-00:118-126; PM-03:195-211; PM-14:33-42 | B-07 | Spikes comparables y ADR-001 antes de bootstrap definitivo. |
| H-014 | Bloqueante F3 | F3 | Semántica de reglas no formaliza vacío/fuera/null/ciclos, especificidad, convergencia e invalidación. | PM-07:83-157,206-214 | B-05, A-11..A-13 | Especificación ejecutable, orden total y equivalencia incremental/full. |
| H-015 | Alta | F5/F6 | PCG/WFC no fijan agotamiento de presupuesto, límites, resultados parciales, pesos inválidos o relajación de garantías. | PM-08:48-168; PM-09:73-151 | A-14..A-20 | Contratos deterministas de terminación, restricciones duras/blandas y diagnóstico. |
| H-016 | Alta | F1/F7 | Compatibilidad externa y Plugin API carecen de matrices/versiones concretas; permisos declarados no aíslan plugins in-process. | PM-11:65-157; PM-12:97-108 | QA/SEC E-07 | Matriz Tiled, preflight/staging, threat model y decisión de confianza/aislamiento. |
| H-017 | Bloqueante | F0/F1 | Límites de entrada hostil son cualitativos; `Scripts[]`, firma, updates y supply chain no tienen protocolo suficiente. | PM-05:224-233; PM-11:131-153; PM-12:84-121 | E-07 críticos | Límites numéricos, política de scripts, firma/verificación y pruebas de abuso. |
| H-018 | Alta | F1 | Accesibilidad es aspiración sin estándar, tecnología asistiva, plataforma ni aceptación manual. | PM-06:156-165; REQ-NFR-006; PM-14:146-155 | PUX-08 | Contrato por fase, teclado completo, HiDPI y evidencia manual. |
| H-019 | Alta | F1/F2 | UX no define cambios externos, recuperación, conflictos, fallo parcial o degradación segura. | REQ-PROJ-003/005; PM-06 ausencia; PM-05:203-205 | PUX-11 | State flows, mensajes, opciones seguras y pruebas manuales. |
| H-020 | Media | F0 | PM-13 mezcla proceso durable con nombres/versiones temporales de modelos. | PM-13:29-35,164-177,247-254 | E-07 | Roles y capacidades independientes del proveedor; modelo concreto en configuración fechada. |

## Cobertura de requisitos

E-02 registra 56 requisitos únicos:

- 31 con cobertura documental suficiente.
- 22 con cobertura parcial.
- 3 con hueco.
- 10 P0, 25 P1, 20 P2 y 1 P3, todos inferidos porque PM-02 no asigna prioridad por fila.

La prioridad inferida sirve para auditoría, no se vuelve normativa hasta aprobación humana.

## Conflictos de dictamen entre roles

| Área | Dictamen F0 | Interpretación consolidada |
|---|---|---|
| Producto/UX | No-go condicionado | Exige cerrar definición de usuario, métricas, trazabilidad y gate antes de probar producto. |
| Arquitectura | Go condicionado | Permite spikes descartables para producir evidencia; prohíbe Fase 1. |
| QA/Seguridad | Go condicionado | Permite repo/CI/spikes; prohíbe congelar formato, plugins, telemetría o publicar. |

**Resolución:** primero corregir contratos documentales H-003…H-007. Después Fase 0 puede ejecutar únicamente spikes descartables con límites QA. Esto satisface criterio más conservador sin convertir Fase 0 en implementación prematura.

## Fortalezas preservables

- Separación topología/proyección y semántica/arte/gameplay.
- Estado autoritativo separado de derivados reconstruibles.
- Comandos, transacciones, snapshots y resultados como deltas.
- Reproducibilidad como capacidad de producto.
- Contenido procedural editable, bloqueable y reversible.
- Integridad, fault injection, fuzzing y archivos dorados como evidencia.
- Plugins detrás de API menor y versionada.
- Roadmap vertical; WFC pospuesto hasta núcleo estable.

Estas fortalezas no eliminan bloqueos: ofrecen dirección para cerrarlos sin rediseñar visión completa.

## Próximo paso autorizado

1. Completar E-01, E-04 y E-08.
2. Revisar E-02 y aprobar prioridades reales.
3. Crear E-09 ordenando correcciones H-001…H-020.
4. Emitir E-10 `No-go/Go condicionado` por fase.
5. Pedir aprobación humana antes de modificar PM-00…PM-14.

No iniciar correcciones ni Fase 0 dentro de esta auditoría.

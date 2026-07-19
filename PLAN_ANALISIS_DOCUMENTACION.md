# Plan de análisis integral de la documentación — Proyecto Mosaico

## 1. Objetivo

Auditar de extremo a extremo la documentación de Proyecto Mosaico para determinar si es coherente, trazable, verificable, portable y suficientemente precisa para iniciar implementación. El análisis cubre producto, requisitos, arquitectura, modelo espacial, persistencia, UX, algoritmos, rendimiento, integraciones, seguridad, QA, sistema agéntico, roadmap, dossier consolidado y diagramas.

Este plan produce evidencia y propuestas. No aprueba decisiones abiertas ni cambia contratos por sí mismo.

## 2. Línea base recuperada el 19 de julio de 2026

- 15 documentos normativos: `documentos/00_...md` a `documentos/14_...md`.
- 1 dossier consolidado: `Proyecto_Mosaico_Dossier_Completo.md`.
- 1 guía de entrada: `README.md`.
- 8 diagramas Graphviz y 8 PNG correspondientes.
- 56 requisitos únicos en PM-02: PROJ 5, MAP 7, EDIT 6, ASSET 5, RULE 7, PCG 6, WFC 7, IO 6 y NFR 7.
- Todos los capítulos aparecen exactamente una vez dentro del dossier actual.
- Todos los documentos declaran versión `0.1.0`, fecha `18 de julio de 2026` y estado «Base aprobable».
- No existía repositorio Git antes de esta auditoría. El 19 de julio de 2026 se decidió crear uno nuevo; no existe historia anterior recuperable.
- Existen 30 referencias de frontmatter a `/mnt/data/.../src/header.tex`; el archivo no está incluido.
- Existen 16 referencias a imágenes bajo `/mnt/data/.../assets/`; los PNG reales están en `diagramas/`. Los enlaces no son portables.
- El dossier duplica frontmatter de los 15 capítulos; necesita una regla explícita de generación para impedir deriva.
- PM-00 define autoridad documental. PM-14 ya contiene roadmap, backlog, plantillas y primeras historias; ambos son entradas obligatorias, no material para reinventar.

## 3. Autoridad y reglas de análisis

Ante conflicto se aplicará el orden recuperado de PM-00:

1. ADR aceptado más reciente.
2. Requisito aprobado en PM-02.
3. Contrato de PM-03, PM-04 o PM-05.
4. Diseño especializado PM-06 a PM-13.
5. Roadmap, ejemplos y pseudocódigo.

Reglas operativas:

- Distinguir hecho, inferencia, decisión abierta y recomendación.
- No tratar pseudocódigo como API estable.
- Registrar cada hallazgo con ID, severidad, documentos, ubicación, impacto, evidencia, propuesta y responsable sugerido.
- No corregir texto durante auditoría: primero registrar; después priorizar y aprobar.
- Usar fuentes primarias para validar afirmaciones externas, versiones, formatos, APIs y licencias.
- Separar defecto documental de riesgo de producto o implementación.
- Mantener los capítulos independientes como fuente canónica; tratar dossier como artefacto derivado hasta decisión contraria.

### Decisiones del propietario — 19 de julio de 2026

- **Repositorio:** Git privado nuevo. No existe historial anterior.
- **Fuente canónica:** los 15 capítulos bajo `documentos/` son fuentes canónicas. `Proyecto_Mosaico_Dossier_Completo.md` será generado, nunca editado directamente. Motivo: cambios pequeños revisables, ownership por dominio, menos conflictos y dossier reproducible.
- **Roles:** subagentes especializados pueden auditar producto/UX, arquitectura/formato/rendimiento y QA/seguridad/release. Decisiones irreversibles siguen requiriendo aprobación humana.
- **Objetivo inmediato:** solo auditoría. Correcciones documentales empiezan después de dictamen y aprobación del backlog.
- **Ejecución incremental:** desde Fase 1, ninguna fase avanza sin programa ejecutable, prueba manual registrada y corrección de fallos bloqueantes. Fase 0 produce spikes ejecutables, aunque no producto integrado.

### Matriz inicial de plataformas y benchmark

| Nivel | Plataforma | Uso |
|---|---|---|
| Primaria | Windows 11 x64, 16 GB RAM, CPU 4 núcleos/8 hilos, GPU integrada compatible, pantalla 1920×1080 a 100 % y 150 % | Desarrollo diario, benchmark de referencia y prueba manual completa. |
| Obligatoria | Ubuntu 24.04 LTS x64, 16 GB RAM, GPU integrada o software compatible | Build, pruebas automáticas, packaging y smoke manual por release. |
| Obligatoria | macOS vigente y anterior, Apple Silicon, 16 GB RAM | Build, pruebas automáticas, packaging, HiDPI y smoke manual por release. |
| Compatibilidad | Windows 11 ARM64 y Linux Wayland/X11 | Build/smoke cuando stack lo soporte; no bloquea MVP hasta ADR de stack. |

Reglas:

- Fase 0 medirá hardware real disponible y publicará especificación exacta de máquina primaria.
- CI ejecutará build y pruebas en Windows, Linux y macOS desde bootstrap.
- Benchmarks usarán corpus versionado, warm-up, al menos 20 muestras y p50/p95; comparar solo misma máquina/configuración.
- Presupuesto funcional manda sobre potencia: proyecto debe seguir utilizable con 16 GB y GPU integrada.

### Gate ejecutable entre fases

Desde Fase 1, salida de cada fase exige:

1. Binario instalable o ejecutable reproducible en plataforma primaria.
2. Proyecto de ejemplo versionado que demuestre slice vertical de fase.
3. Guion manual con pasos, resultado esperado y evidencia.
4. Pruebas automáticas relevantes verdes.
5. Benchmark del hot path afectado y comparación con baseline.
6. Cero bugs S0/S1 abiertos; S2 requieren waiver humano y plan.
7. Revisión humana manual antes de comenzar fase siguiente.

Si prueba manual revela fallo bloqueante, fase permanece abierta: corregir, repetir suite y repetir guion manual. No se compensa con documentación ni tests unitarios aislados.

## 4. Entregables previstos

| ID | Entregable | Propósito |
|---|---|---|
| E-01 | `analisis_documental/01_inventario.md` | Catálogo, autoridad, estado, propietario y relaciones. |
| E-02 | `analisis_documental/02_matriz_trazabilidad.csv` | Objetivo → requisito → contrato → UX → prueba → fase. |
| E-03 | `analisis_documental/03_hallazgos.md` | Contradicciones, ambigüedades, huecos y duplicaciones. |
| E-04 | `analisis_documental/04_decisiones_abiertas.md` | Decisiones, opciones, evidencia necesaria y ADR propuesto. |
| E-05 | `analisis_documental/05_auditoria_tecnica.md` | Arquitectura, datos, algoritmos, concurrencia y rendimiento. |
| E-06 | `analisis_documental/06_auditoria_producto_ux.md` | Alcance, usuarios, flujos, accesibilidad y métricas. |
| E-07 | `analisis_documental/07_auditoria_qa_seguridad.md` | Integridad, amenazas, pruebas y release gates. |
| E-08 | `analisis_documental/08_fuentes_licencias.md` | Vigencia, respaldo primario, licencia y fecha de consulta. |
| E-09 | `analisis_documental/09_backlog_correcciones.md` | Correcciones ordenadas por dependencia y riesgo. |
| E-10 | `analisis_documental/10_dictamen.md` | Estado final, bloqueos y criterio go/no-go por fase. |

## 5. Grafo de dependencias del análisis

```text
Inventario y autoridad
  ├─> Integridad mecánica y portabilidad
  ├─> Glosario y modelo conceptual
  └─> Matriz de trazabilidad
         ├─> Auditoría producto/UX
         ├─> Auditoría arquitectura/datos
         │      ├─> Espacio/render/concurrencia
         │      └─> Reglas/PCG/WFC
         ├─> Auditoría IO/plugins/seguridad
         └─> Auditoría QA/release/agentes
                  └─> Verificación de fuentes
                         └─> Síntesis de hallazgos
                                └─> Backlog y dictamen
```

## 6. Plan de trabajo detallado

### Fase A — Control del corpus

#### Tarea 1: Congelar inventario y autoridad

**Descripción:** Catalogar cada archivo, hash, versión, fecha, estado, propósito, audiencia, autoridad, dependencias y condición canónica/derivada.

**Criterios de aceptación:**

- [ ] E-01 contiene los 33 archivos actuales: 17 Markdown, 8 DOT y 8 PNG.
- [ ] Cada PM-00…PM-14 tiene propietario sugerido y documentos ascendentes/descendentes.
- [ ] Queda documentada la ausencia de Git y qué evidencia histórica no puede recuperarse.

**Verificación:** conteos reproducibles; hashes SHA-256; revisión contra PM-00 y README.

**Dependencias:** ninguna. **Alcance:** M.

#### Tarea 2: Auditar integridad mecánica y portabilidad

**Descripción:** Validar Markdown, YAML frontmatter, enlaces, anclas, bloques de código, tablas, encoding, rutas, fuentes Graphviz, PNG, dossier y eventual generación PDF.

**Criterios de aceptación:**

- [ ] Cada enlace se clasifica como válido, roto, externo o no verificable.
- [ ] Se registran las 30 rutas a `header.tex` y 16 rutas de imagen no portables sin duplicar hallazgos equivalentes.
- [ ] Se verifica correspondencia DOT↔PNG y se propone una prueba reproducible de render.
- [ ] Se demuestra si el dossier coincide con sus 15 fuentes y se define política anti-deriva.

**Verificación:** link checker local; parser de frontmatter; render Markdown/PDF; regeneración Graphviz y comparación visual/hash cuando proceda.

**Dependencias:** Tarea 1. **Alcance:** M.

#### Checkpoint A

- [ ] Corpus congelado y reproducible.
- [ ] Ningún archivo omitido.
- [ ] Defectos mecánicos separados de defectos semánticos.

### Fase B — Lenguaje, alcance y trazabilidad

#### Tarea 3: Construir glosario y modelo conceptual

**Descripción:** Extraer términos normativos —proyecto, documento, mapa, capa, celda, tile, terreno, topología, proyección, chunk, regla, procedencia, snapshot, delta, job, preset, plugin— y comparar definición/uso entre capítulos.

**Criterios de aceptación:**

- [ ] Cada término tiene definición canónica, fuente y sinónimos prohibidos o tolerados.
- [ ] Homónimos y usos incompatibles aparecen en E-03.
- [ ] Relaciones entre estado autoritativo, derivado, efímero y externo quedan explícitas.

**Verificación:** búsqueda exhaustiva por término; revisión cruzada PM-01, PM-03, PM-04, PM-05 y PM-07.

**Dependencias:** Tarea 1. **Alcance:** M.

#### Tarea 4: Auditar visión, alcance y usuarios

**Descripción:** Contrastar PM-01 con PM-02, PM-06 y PM-14. Revisar problemas, personas, escenarios, propuesta de valor, no objetivos, métricas y criterio de descubrimiento.

**Criterios de aceptación:**

- [ ] Cada promesa de PM-01 enlaza requisito o queda marcada como aspiracional.
- [ ] Cada escenario principal tiene flujo, datos, validación y salida identificables.
- [ ] Métricas tienen unidad, baseline, objetivo, método y momento de medición, o quedan como hueco.

**Verificación:** tabla escenario→capacidad→REQ→fase; revisión de no objetivos contra backlog.

**Dependencias:** Tareas 1 y 3. **Alcance:** M.

#### Tarea 5: Construir matriz completa de trazabilidad

**Descripción:** Expandir la matriz inicial de PM-02. Cada uno de los 56 requisitos debe enlazar objetivo, contrato, flujo UX, prueba, riesgo, fase, historia y decisión abierta.

**Criterios de aceptación:**

- [ ] E-02 contiene exactamente 56 filas primarias, IDs únicos y columnas acordadas.
- [ ] Todo requisito P0/P1 tiene al menos contrato y verificación prevista.
- [ ] Todo epic y primeras 12 historias de PM-14 enlazan uno o más REQ.
- [ ] Requisitos sin cobertura y contenido sin requisito quedan listados.

**Verificación:** validación automática de unicidad y referencias; cobertura 100 % de IDs; muestreo humano por grupo.

**Dependencias:** Tareas 3 y 4. **Alcance:** M.

#### Checkpoint B

- [ ] Vocabulario común aprobado.
- [ ] 56/56 requisitos trazados.
- [ ] Promesas fuera de alcance o sin aceptación identificadas.

### Fase C — Coherencia técnica del núcleo

#### Tarea 6: Auditar arquitectura y límites

**Descripción:** Revisar PM-03 contra PM-05, PM-10, PM-11 y PM-13: capas, regla de dependencias, módulos, comandos, eventos, jobs, DI, autoridad, concurrencia y errores.

**Criterios de aceptación:**

- [ ] Cada módulo tiene responsabilidad, dueño de datos, dependencias permitidas y API prevista.
- [ ] Flujos de escritura y lectura muestran hilo, snapshot, revisión, delta, transacción y fallo.
- [ ] Decisiones abiertas se convierten en candidatos ADR con evidencia requerida.

**Verificación:** diagramas de dependencias y secuencia; prueba mental de tres slices: pintar, guardar y aceptar preview procedural.

**Dependencias:** Tareas 3 y 5. **Alcance:** M.

#### Tarea 7: Auditar modelo espacial y renderizado

**Descripción:** Contrastar PM-04 y PM-10 con requisitos MAP/EDIT/NFR, UX y exportación. Revisar transformaciones, topologías, picking, chunks negativos, orden visual, elevación, cámara y presupuestos.

**Criterios de aceptación:**

- [ ] Invariantes cubren ortogonal, isométrico, staggered, hex pointy/flat y coordenadas negativas.
- [ ] Ambigüedades de `GridCoordinate.C`, elevación, niveles, offsets y baseline quedan resueltas o registradas.
- [ ] Presupuestos declaran corpus, máquina, percentil y método de medición faltantes.

**Verificación:** casos numéricos directos/inversos; matriz topología×herramienta×exportación; escenarios de referencia.

**Dependencias:** Tareas 5 y 6. **Alcance:** M.

#### Tarea 8: Auditar datos, formato y recuperación

**Descripción:** Revisar PM-05 con PM-02, PM-03, PM-11 y PM-12: agregados, identidad, propiedades, chunks, procedencia, esquema, atomicidad, autosave, migraciones, diff y validación hostil.

**Criterios de aceptación:**

- [ ] Cada dato persistente tiene identidad, cardinalidad, ownership y regla de evolución.
- [ ] Guardado multifichero, journal, backup, recuperación y dirty state tienen estados y garantías claros.
- [ ] Compatibilidad hacia delante/atrás y preservación de campos desconocidos tienen límites explícitos.

**Verificación:** tabla de entidades; state machine de guardado; fault tree; cadena de migración; casos de archivo truncado.

**Dependencias:** Tareas 5 y 6. **Alcance:** M.

#### Checkpoint C

- [ ] Contratos centrales no se contradicen.
- [ ] Bloqueos para ADR-001 y formato v0 identificados.
- [ ] Invariantes técnicas convertibles en pruebas.

### Fase D — Coherencia de experiencia y algoritmos

#### Tarea 9: Auditar UX, accesibilidad y reversibilidad

**Descripción:** Revisar PM-06 contra requisitos EDIT/MAP/PCG/WFC/NFR, modelo de comandos y seguridad. Evaluar flujos básico, reglas, procedural, WFC, onboarding y diagnóstico.

**Criterios de aceptación:**

- [ ] Cada flujo tiene precondición, acción, preview, commit/cancelación, undo, error y recuperación.
- [ ] Flujos esenciales son realizables por teclado y HiDPI.
- [ ] Contenido manual, generado, congelado e importado tiene comportamiento visible y consistente.

**Verificación:** walkthrough cognitivo; mapa comando→entrada→feedback; checklist WCAG aplicable a desktop.

**Dependencias:** Tareas 4, 5, 6 y 8. **Alcance:** M.

#### Tarea 10: Auditar motor de reglas

**Descripción:** Revisar PM-07 contra PM-04, PM-05, PM-06, PM-10 y REQ-RULE. Analizar semántica de condiciones, fases, conflictos, transformaciones, incrementalidad, procedencia y aleatoriedad estable.

**Criterios de aceptación:**

- [ ] Orden total de resolución está definido para empates reales.
- [ ] Footprint de lectura/escritura e invalidación incremental son demostrables por topología.
- [ ] Full recompute e incremental comparten semántica observable.

**Verificación:** ejemplos mínimos, tablas de verdad, contraejemplos en bordes/negativos y plan property-based.

**Dependencias:** Tareas 5, 7, 8 y 9. **Alcance:** M.

#### Tarea 11: Auditar procedural y WFC

**Descripción:** Revisar PM-08 y PM-09 como subsistemas distintos pero composables. Contrastar semillas/streams, máscaras, validadores, reparación, preview, constraints, backtracking, completion y límites declarados.

**Criterios de aceptación:**

- [ ] Responsabilidad de generador estructural, reglas visuales, WFC y validadores no se solapa sin contrato.
- [ ] Reproducibilidad incluye versión, plataforma, parámetros, catálogo y condiciones de borde.
- [ ] Cancelación, límites de recursos, contradicción y reparación preservan estado autoritativo.

**Verificación:** secuencia PCG→validación→reglas→WFC→aceptación; corpus de semillas/modelos imposibles; matriz REQ-PCG/WFC.

**Dependencias:** Tareas 5, 7, 8, 9 y 10. **Alcance:** M.

#### Checkpoint D

- [ ] Flujos avanzados siguen siendo editables y reversibles.
- [ ] Determinismo y límites algorítmicos son verificables.
- [ ] Ningún algoritmo gobierna directamente UI o persistencia.

### Fase E — Fronteras externas y evidencia

#### Tarea 12: Auditar importación, exportación, CLI y plugins

**Descripción:** Revisar PM-11 contra PM-02, PM-03, PM-05 y PM-12. Construir matriz Tiled, contratos de pérdida, staging, API pública, permisos, paquetes, lockfile e integraciones Unity/Godot/runtime.

**Criterios de aceptación:**

- [ ] Cada formato distingue soportado, aproximado, preservado y no soportado.
- [ ] Escrituras externas tienen preflight, staging, cancelación y reporte.
- [ ] Modelo MVP de plugins declara confianza, permisos reales y límites; evolución a aislamiento queda condicionada.

**Verificación:** corpus planificado por versión; threat model STRIDE o equivalente; compatibilidad API/SemVer; escenarios path traversal.

**Dependencias:** Tareas 5, 6 y 8. **Alcance:** M.

#### Tarea 13: Auditar QA, seguridad, release y operación agéntica

**Descripción:** Revisar PM-12 y PM-13 contra todos los riesgos anteriores. Evaluar pirámide, fault injection, fuzzing, puertas PR/release, privacidad, observabilidad, contratos de tarea y aprobación humana.

**Criterios de aceptación:**

- [ ] Cada riesgo S0/S1 tiene prevención, detección, recuperación y prueba.
- [ ] Cada gate indica herramienta, entorno, frecuencia, evidencia y dueño.
- [ ] Contratos agénticos enlazan REQ/ADR, paths, pruebas, límites y revisión independiente.
- [ ] Referencias a modelos concretos se clasifican como configuración temporal, no contrato estable.

**Verificación:** matriz riesgo→control→test→gate; simulación de tarea agéntica; checklist de secretos/publicación/dependencias.

**Dependencias:** Tareas 5 a 12. **Alcance:** M.

#### Tarea 14: Verificar fuentes, actualidad y licencias

**Descripción:** Validar cada referencia externa mediante fuente primaria vigente. Registrar título, URL canónica, versión/fecha consultada, afirmación respaldada, licencia y restricciones de reutilización.

**Criterios de aceptación:**

- [ ] Todo enlace externo responde o tiene reemplazo documentado.
- [ ] Toda afirmación dependiente de versión —Tiled, Unity, Godot, OpenAI, formatos y APIs— tiene fecha y fuente primaria.
- [ ] Inspiración conceptual queda separada de dependencia, código, assets y obligación de atribución.

**Verificación:** revisión web con fuentes oficiales; comprobación de licencias en repositorios/documentación primaria; E-08 sin filas huérfanas.

**Dependencias:** Tareas 1 y 12; puede avanzar en paralelo con Tareas 9–13 después de fijar inventario. **Alcance:** M.

#### Checkpoint E

- [ ] Amenazas y evidencia cubren fronteras externas.
- [ ] Fuentes actuales y licencias trazadas.
- [ ] Gates pueden ejecutarse, no son declaraciones vagas.

### Fase F — Síntesis, corrección y decisión

#### Tarea 15: Consolidar hallazgos y decisiones abiertas

**Descripción:** Deduplicar hallazgos de todas las auditorías, resolver falsos positivos y agrupar por causa raíz. Convertir decisiones estructurales en propuestas ADR.

**Criterios de aceptación:**

- [ ] Cada hallazgo posee severidad: bloqueante, alta, media, baja o editorial.
- [ ] Contradicciones citan ambos lados y aplican autoridad PM-00.
- [ ] E-04 incluye dueño, fecha objetivo, opciones, reversibilidad y evidencia necesaria.

**Verificación:** segunda revisión independiente; búsqueda inversa desde cada documento; cero hallazgos sin ubicación/evidencia.

**Dependencias:** Tareas 2 a 14. **Alcance:** M.

#### Tarea 16: Crear backlog vertical de correcciones

**Descripción:** Ordenar cambios documentales en unidades pequeñas. Priorizar portabilidad, autoridad, P0/P1, ADR bloqueantes, trazabilidad y después claridad editorial.

**Criterios de aceptación:**

- [ ] Cada tarea tiene descripción, máximo 3 criterios, verificación, dependencias y archivos previstos.
- [ ] Ninguna tarea es XL; cambios transversales se dividen por contrato o capítulo.
- [ ] Dossier se regenera solo después de corregir fuentes canónicas.
- [ ] Checkpoint cada 2–3 tareas y revisión humana antes de cambios normativos.

**Verificación:** validación del grafo; revisión de tamaños; cobertura de todos los hallazgos aceptados.

**Dependencias:** Tarea 15. **Alcance:** M.

#### Tarea 17: Emitir dictamen de preparación

**Descripción:** Evaluar preparación documental por fase del roadmap, no con un único porcentaje. Declarar `Go`, `Go condicionado` o `No-go` para descubrimiento, bootstrap, MVP ortogonal y fases posteriores.

**Criterios de aceptación:**

- [ ] E-10 resume evidencia, bloqueos, riesgo residual y condiciones de salida.
- [ ] Cada decisión go/no-go enlaza requisitos, hallazgos y tareas de corrección.
- [ ] Incluye baseline de métricas para repetir auditoría después de cambios.

**Verificación:** checklist documental PM-00; revisión humana de producto, arquitectura, QA y seguridad.

**Dependencias:** Tareas 15 y 16. **Alcance:** S.

#### Checkpoint final

- [ ] 33/33 archivos inventariados.
- [ ] 56/56 requisitos trazados.
- [ ] 15/15 capítulos revisados semánticamente.
- [ ] 8/8 pares DOT/PNG verificados.
- [ ] Enlaces y fuentes externos verificados con fecha.
- [ ] Toda contradicción, decisión abierta y riesgo tiene dueño o escalamiento.
- [ ] Backlog aprobado antes de modificar contratos.
- [ ] Dictamen go/no-go revisado por humanos responsables.

## 7. Paralelización segura

Después de Tareas 1–5:

- Puede paralelizarse Tarea 7 con Tarea 8.
- Puede paralelizarse Tarea 9 con Tareas 10–11 si glosario y trazabilidad ya están congelados.
- Tareas 12, 13 y 14 pueden avanzar en paralelo con coordinación sobre Plugin API, seguridad y fuentes.
- Tareas 15–17 son secuenciales: síntesis → backlog → dictamen.

No paralelizar cambios sobre PM-02, PM-03 o PM-05 sin ownership explícito: son contratos compartidos.

## 8. Escala de severidad

| Severidad | Criterio |
|---|---|
| Bloqueante | Impide interpretar contrato, amenaza datos/seguridad o bloquea Fase 0/1. |
| Alta | Contradicción entre requisito y arquitectura, flujo imposible o aceptación no verificable. |
| Media | Ambigüedad con workaround, cobertura incompleta o riesgo futuro importante. |
| Baja | Precisión, consistencia o mantenibilidad mejorable sin cambiar conducta. |
| Editorial | Ortografía, formato, navegación o estilo sin efecto normativo. |

## 9. Riesgos del análisis y mitigación

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Dossier y capítulos divergen durante correcciones | Alto | Fuente canónica única y generación automatizada. |
| Sin historial Git | Alto | Declarar límite; solicitar origen si existe; iniciar control de versiones antes de corregir. |
| Verificar solo prosa, no comportamiento | Alto | Convertir afirmaciones en invariantes, pruebas, fixtures y benchmarks. |
| Referencias externas cambian | Medio | Fuentes primarias, versión y fecha de consulta. |
| Auditoría demasiado horizontal | Medio | Revisiones por slices: pintar, guardar, generar, exportar, recuperar. |
| Severidad inflada o inconsistente | Medio | Rubrica común y segunda revisión independiente. |
| Decisiones abiertas tratadas como defectos | Medio | Registro separado E-04; no resolver sin evidencia/aprobación. |
| Corrección editorial altera contrato | Alto | Diff normativo explícito y aprobación según PM-00. |

## 10. Decisiones pendientes después de auditoría

1. Stack de escritorio, renderer y estrategia de automatización visual: resolver mediante spikes de Fase 0.
2. Licencia y monetización: requieren decisión humana antes de distribuir binarios.
3. Sistemas operativos mínimos exactos: congelar tras validar stack y telemetría de beta.
4. Modelo MVP de plugins: confianza local versus aislamiento temprano.
5. Alcance público de compatibilidad Tiled.

Estas decisiones no bloquean auditoría. Se convertirán en ADR o decisión de producto antes de afectar implementación.

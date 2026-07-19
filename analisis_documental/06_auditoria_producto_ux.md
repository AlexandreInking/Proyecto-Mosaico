# Auditoría documental de Producto y UX

**Rol auditor:** Producto y UX (responsable humano simulado)  
**Fecha:** 19 de julio de 2026  
**Documentos auditados:** PM-01, PM-02, PM-06 y PM-14  
**Autoridad aplicada:** PM-00 y su jerarquía documental  
**Tipo de revisión:** solo auditoría; no modifica documentos fuente  
**Escala:** Bloqueante, Alta, Media, Baja

## 1. Alcance y método

La revisión comprueba si la documentación permite decidir qué producto validar, para quién, mediante qué escenarios, con qué métricas y evidencia, y si los flujos clave son reversibles, accesibles y trazables hasta requisitos y fases.

PM-00 manda en gobierno y principios. Ante contradicción, se aplica requisito aprobado de PM-02 antes que diseño especializado de PM-06 y roadmap orientativo de PM-14 (`PM-00:68-78`). No se validan aquí arquitectura, persistencia, algoritmos o seguridad salvo cuando afectan experiencia, alcance o aceptación de producto.

## 2. Resumen ejecutivo

La propuesta posee dirección valiosa: editor ortogonal primero, separación entre intención y arte, automatización editable, explicabilidad y UX progresiva. Los flujos procedural y WFC describen bien preview, cancelación, variantes, diagnóstico y aceptación transaccional.

Sin embargo, el dossier todavía no constituye contrato verificable de Producto/UX para iniciar Fase 0 sin preparación adicional. Sus cinco perfiles tienen igual peso; no existe usuario primario ni segmento de entrada. Los escenarios son narrativos, no tareas observables con precondiciones y éxito. Las métricas carecen de fórmula, línea base, objetivo, muestra, instrumento y fase. La trazabilidad de PM-02 agrupa familias de requisitos, pero no conecta escenario, flujo, requisito, fase y prueba manual. PM-01 exige tres prototipos para cerrar descubrimiento mientras PM-14 no los incorpora explícitamente en sus salidas. La primera versión promete demostrar el mapa semántico, pero el roadmap lo posterga hasta Fase 3.

**Dictamen:** **No-go condicionado para ejecutar Fase 0; go para preparar/corregir la documentación previa a Fase 0.** Deben cerrarse los bloqueantes PUX-01 a PUX-05. No se requiere resolver todavía detalles de Fases 3-7.

## 3. Usuarios y escenarios

### 3.1 Cobertura existente

PM-01 identifica cinco perfiles:

| Perfil | Necesidad documentada | Evidencia |
|---|---|---|
| Diseñador de niveles 2D | Edición predecible, capas, navegación e integración | `PM-01:52-56` |
| Artista técnico de tiles | Tilesets, tags, reglas y depuración visual | `PM-01:58-60` |
| Diseñador procedural | Semillas, métricas, validadores y lotes | `PM-01:62-64` |
| Programador de herramientas/motor | Formatos, plugins, builds y CI | `PM-01:66-68` |
| Equipo pequeño/independiente | Instalación simple y progresión manual→automatizada | `PM-01:70-72` |

También presenta escenarios lateral, cenital, hexagonal, isométrico y completado WFC (`PM-01:74-94`). PM-06 añade tutoriales para cuatro recorridos (`PM-06:171-178`).

### 3.2 Evaluación

- No hay usuario primario, orden de prioridad, tamaño/atractivo de segmento ni antiusuario. Esto impide resolver conflictos de UX y decidir qué probar primero.
- Los perfiles mezclan rol profesional, disciplina técnica y tamaño de organización; pueden superponerse en una misma persona. No son personas operativas.
- Faltan contexto, experiencia previa, sistema operativo, dispositivo de entrada, restricciones de accesibilidad, frecuencia de uso y herramienta desde la cual migra.
- Los escenarios explican capacidad, pero no contienen punto de partida, artefacto de entrada, pasos críticos, salida, tiempo objetivo ni criterio observable de éxito.
- No aparece escenario completo de Fase 1 que incluya instalar/abrir, crear proyecto, importar tileset, editar, deshacer, guardar, cerrar, reabrir y exportar.
- No aparece recuperación ante error dentro de escenario: cambio externo, recurso faltante, fallo durante guardado, importación parcial o exportación con pérdida.

### 3.3 Decisión recomendada

Adoptar para Fases 0-1 un usuario primario: **creador independiente o diseñador de niveles 2D con experiencia básica en tilemaps, que construye un nivel ortogonal para un motor propio o generalista, usando teclado y mouse en escritorio**. Artista técnico y programador de herramientas quedan como usuarios secundarios. Procedural avanzado, isométrico, hexagonal y WFC siguen como validadores de extensibilidad, no como centro del MVP.

Crear cinco tareas de referencia:

1. Arranque: crear proyecto ortogonal, importar sprite sheet y pintar un área.
2. Edición segura: modificar varias capas, deshacer/rehacer y comprobar estado.
3. Continuidad: guardar, cerrar y reabrir sin pérdida.
4. Entrega: exportar CSV/PNG y localizar pérdidas o incompatibilidades.
5. Recuperación: restaurar sesión tras fallo simulado sin reemplazar guardado confirmado.

Cada tarea debe indicar fixture, precondición, límite temporal, errores permitidos, estado esperado y protocolo de observación.

## 4. Métricas y evidencia

### 4.1 Métricas existentes

PM-01 propone tiempo de tarea, correcciones manuales, porcentaje deshacible, éxito de import/export y aprendizaje (`PM-01:125-133`); además integridad, validez, rendimiento, migración y teclado (`PM-01:135-141`), y señales de adopción (`PM-01:143-148`). PM-06 propone observar tiempo, errores, deshacer, preguntas y explicación del resultado (`PM-06:180-182`).

### 4.2 Huecos

- Ninguna métrica define numerador, denominador, unidad o ventana de medición.
- No hay baseline contra edición manual ni herramienta comparable.
- No hay umbral de éxito o fracaso por fase.
- No se fija tamaño ni composición de muestra; tampoco moderación, consentimiento o registro.
- “Presupuesto sostenido” carece de hardware, mapa, tamaño y percentil (`PM-01:139`).
- “Flujos esenciales” no están enumerados para cobertura de teclado (`PM-01:141`; `PM-06:158`).
- “Cero pérdida” y “cero adyacencias inválidas” son objetivos adecuados, pero falta corpus y duración de ejecución (`PM-01:137-138`).
- Las métricas de adopción son prematuras para Fase 0 y no tienen instrumentación compatible con telemetría opcional (`PM-02:140-141`).

### 4.3 Contrato mínimo recomendado

| Métrica | Definición inicial | Gate sugerido |
|---|---|---|
| Éxito de tarea F1 | Participante alcanza estado final sin ayuda bloqueante | ≥ 4/5 participantes |
| Tiempo de primer nivel | Desde proyecto nuevo hasta reapertura y exportación válidas | Medir baseline en F0; fijar umbral antes de F1 |
| Integridad round-trip | Comparación semántica completa tras save/load | 100% en corpus de referencia |
| Reversibilidad | Acciones esenciales que retornan exactamente al estado previo | 100% de matriz esencial |
| Cobertura de teclado | Tareas esenciales completables sin mouse / total | 100% en F1, salvo manipulación espacial explícitamente exceptuada y documentada |
| Recuperación | Escenarios de fallo que recuperan sin pisar guardado confirmado | 100% del corpus de fallos F2; spike probado en F0 |
| Claridad | Participante explica qué cambió, por qué y cómo revertir | ≥ 4/5 en funciones automatizadas |
| Rendimiento percibido | Latencia p95 de input→feedback en fixture/hardware fijados | Presupuesto decidido mediante spike F0 |

Los números de usabilidad son hipótesis para planificación, no decisión aprobada. Deben ser aceptados por humano conforme a `PM-00:106`.

## 5. Trazabilidad de requisitos

### 5.1 Estado actual

PM-02 conserva IDs permanentes y criterios mínimos (`PM-02:29-38`). Su matriz inicial enlaza promesas con familias de requisitos (`PM-02:161-169`), pero no alcanza trazabilidad bidireccional. PM-14 exige “requisitos enlazados” en Definition of Ready (`PM-14:134-144`), sin proporcionar matriz fase/flujo/prueba.

### 5.2 Matriz mínima Producto/UX propuesta

| Flujo/tarea | REQ principal | Evidencia requerida | Fase prevista |
|---|---|---|---|
| Crear/abrir/guardar/cerrar/reabrir | REQ-PROJ-001, REQ-NFR-005 | Round-trip automatizado + prueba manual | F1 |
| Detectar cambio externo | REQ-PROJ-003 | Escenario de conflicto sin sobrescritura silenciosa | F2 |
| Autosave y recuperación | REQ-PROJ-005, REQ-NFR-005 | Fault injection + recuperación manual | Spike F0 / entrega F2 |
| Pintar/borrar/rellenar | REQ-EDIT-001 | Una transacción por gesto + tarea manual | F1 |
| Seleccionar/transformar | REQ-EDIT-002 | Preservación multicapa/referencias | F1 o decisión explícita |
| Undo/redo | REQ-EDIT-004 | Secuencia aleatoria + matriz manual | F1 |
| Comandos/teclado | REQ-EDIT-005, REQ-NFR-006 | Auditoría de comandos + tareas sin mouse | F1 transversal |
| Overlays | REQ-EDIT-006 | Combinación sin mutación de datos | Fases 1-4 según overlay |
| Preview procedural | REQ-PCG-004 | Cancelar deja documento idéntico | F5 |
| Regiones bloqueadas | REQ-PCG-005, REQ-WFC-006 | Regeneración nunca toca bloqueo | F5-F6 |
| Diagnóstico procedural/WFC | REQ-PCG-006, REQ-WFC-005, REQ-WFC-007 | Ubicación, causa y acción comprensibles | F5-F6 |
| Import/export con pérdida | REQ-IO-002, REQ-IO-003 | Reporte explícito y confirmación informada | F1/F7 según formato |
| Trabajo largo | REQ-NFR-003 | Progreso y cancelación sin bloqueo UI | Desde primer job largo |
| Accesibilidad esencial | REQ-NFR-006 | Matriz teclado, foco, escala, contraste y lector | Gate de cada fase ejecutable |

### 5.3 Requisitos UX ausentes o incompletos

- No hay REQ explícito para foco visible, orden de foco, lector de pantalla, no dependencia del color, reducción de movimiento o persistencia de preferencias, aunque PM-06 los menciona (`PM-06:156-165`).
- No existe REQ para preview antes/después ni para comparación de variantes, pese a ser parte de propuesta y flujo (`PM-06:119-129`).
- No existe REQ de onboarding/documentación local, prometidos al usuario independiente (`PM-01:70-72`; `PM-06:171-178`).
- No se asigna ID a confirmación informada de exportación con pérdida (`PM-06:148-154`).
- Falta requisito de consistencia y persistencia de layouts/workspaces acoplables (`PM-06:37-52`).

## 6. Flujos reversibles y prevención de error

### 6.1 Fortalezas

- PM-00 establece que toda operación destructiva debe ser reversible (`PM-00:42-44`).
- PM-02 exige undo/redo transaccional exacto y cancelación no mutante (`PM-02:68-72`, `PM-02:101-106`, `PM-02:143-159`).
- PM-06 modela automatizaciones como previews y acciones reversibles (`PM-06:33-35`), preview procedural en snapshot y aceptación como una transacción (`PM-06:119-129`), quick fixes reversibles (`PM-06:144-146`) y prevención contextual (`PM-06:148-154`).

### 6.2 Huecos críticos

- No hay taxonomía de comandos: reversible, compensable o irreversible.
- No se define límite de undo, consumo de memoria, persistencia, invalidación tras guardar/cerrar ni comportamiento ante acciones asincrónicas.
- REQ-EDIT-004 limita persistencia del historial “durante la sesión” (`PM-02:71`); debe aclararse al usuario que cerrar termina undo aunque exista recuperación.
- No se define qué ocurre si falla parcialmente aceptar preview, importar, relocalizar assets o exportar varios artefactos.
- Confirmar exportación con pérdida no especifica resumen de diferencias, opción de copia, volver a configurar o recordar decisión.
- “Alcance” de reemplazo masivo no define umbral, visualización ni bloqueo accidental (`PM-06:150-153`).
- Falta modelo UX para conflicto entre modificación externa y cambios locales, aunque REQ-PROJ-003 lo exige (`PM-02:48`).

## 7. Accesibilidad

PM-06 ofrece buena base: teclado, paleta, foco, HiDPI, texto/tooltips, patrones además de color, contraste/movimiento y lectura accesible (`PM-06:156-169`). PM-02 exige teclado y HiDPI (`PM-02:140`). Definition of Done solo dice “accesibilidad considerada” (`PM-14:146-155`), frase no verificable.

Para hacerla comprobable antes de F1 se necesita:

- Elegir estándar objetivo (recomendado: WCAG 2.2 AA como guía adaptada a escritorio) y plataformas/tecnologías asistivas soportadas.
- Inventariar flujos esenciales y orden esperado del foco.
- Definir semántica/nombre/estado de controles, canvas y paneles para lector de pantalla.
- Establecer ratios de contraste, escalas 100/150/200%, zoom de UI y tamaño mínimo de objetivo.
- Documentar alternativa de teclado a drag, resize, selección espacial y panel docking.
- Exigir que progreso, errores, selección, bloqueo y procedencia no dependan solo de color/animación.
- Convertir accesibilidad en gate por fase con evidencia manual registrada, no checklist subjetivo.

## 8. Contradicciones y huecos priorizados

| ID | Severidad | Hallazgo | Evidencia | Acción requerida |
|---|---|---|---|---|
| PUX-01 | **Bloqueante** | Fase 0 no tiene usuario primario ni hipótesis de problema priorizada. | `PM-01:52-72`; `PM-14:33-42` | Elegir segmento inicial, antiusuario y tareas de referencia. |
| PUX-02 | **Bloqueante** | Métricas sin definición ni umbral impiden aceptar/rechazar spikes y pruebas de uso. | `PM-01:125-148`; `PM-06:180-182` | Crear ficha por métrica y gates F0/F1. |
| PUX-03 | **Bloqueante** | PM-01 exige tres prototipos para salir de descubrimiento, pero PM-14 no los incluye explícitamente en objetivo/salida F0. | `PM-01:166-168`; `PM-14:33-42` | Unificar exit criteria de F0 y nombrar los tres prototipos/evidencia. |
| PUX-04 | **Bloqueante** | No existe matriz bidireccional escenario→flujo→REQ→fase→prueba manual/automática. | `PM-02:161-169`; `PM-14:134-155` | Crear matriz y exigirla en DoR/DoD. |
| PUX-05 | **Bloqueante** | Petición de ejecutable/probable manualmente por fase no está expresada como gate completo; F1 solo menciona crear/reabrir. | `PM-14:29-31`, `PM-14:44-55` | Añadir receta reproducible de build/run, fixture y guion manual a cada fase 1+. |
| PUX-06 | **Alta** | “Primera versión” debe demostrar mapa semántico, pero F1 no lo contiene y semántica llega en F3. | `PM-01:150-154`; `PM-14:44-77` | Definir “primera versión”: F1 editor base o F3 propuesta diferencial; ajustar lenguaje/hito. |
| PUX-07 | **Alta** | Alcance funcional completo no está separado por MVP/pos-MVP, aumentando expectativa. | `PM-01:105-119`; `PM-14:44-117` | Etiquetar Now/Next/Later y REQ por fase. |
| PUX-08 | **Alta** | Accesibilidad declarativa, sin estándar, plataforma, tecnología asistiva ni prueba. | `PM-06:156-165`; `PM-14:146-155` | Crear contrato y matriz de evidencia por fase. |
| PUX-09 | **Alta** | Historias iniciales no incluyen usuario, REQ, aceptación, errores ni accesibilidad pese a Definition of Ready. | `PM-14:134-144`, `PM-14:285-298` | Convertir lista en historias listas o marcarla explícitamente como ideas no-ready. |
| PUX-10 | **Alta** | Fase 1 promete fill y selección/mover figura entre historias, pero criterio solo valida crear y reabrir; no prueba undo/export. | `PM-14:44-55`, `PM-14:287-298` | Expandir criterio manual para toda capacidad incluida. |
| PUX-11 | **Alta** | No se define UX de cambios externos, recuperación ni fallos parciales. | `PM-02:48-50`, `PM-02:137-159`; ausencia en PM-06 | Diseñar estados, mensajes, opciones seguras y pruebas. |
| PUX-12 | **Media** | Perfiles se solapan y carecen de contexto de uso/experiencia/dispositivo. | `PM-01:52-72` | Crear proto-personas verificables y reclutamiento. |
| PUX-13 | **Media** | Layout propone seis workspaces antes de probar arquitectura de información. | `PM-06:37-68` | Tratar layout como hipótesis; prototipar básico primero. |
| PUX-14 | **Media** | “Exactamente” en preview de pincel está condicionado por “cuando sea barato”, dejando feedback indeterminado. | `PM-06:72-74` | Definir fallback, latencia y señal de cálculo pendiente. |
| PUX-15 | **Media** | Onboarding cubre funciones futuras, no recuperación, accesibilidad ni tarea F1 extremo a extremo. | `PM-06:171-178` | Priorizar tutorial F1 y ayuda contextual; diferir tutoriales futuros. |
| PUX-16 | **Media** | No hay definición común de “error”, “ayuda bloqueante”, “corrección” o “pregunta” para sesiones UX. | `PM-06:180-182` | Crear rúbrica y formulario de observación. |
| PUX-17 | **Media** | No existe criterio de satisfacción/valor percibido o preferencia frente a método actual. | `PM-01:125-148` | Añadir entrevista posterior y comparación cualitativa. |
| PUX-18 | **Baja** | “Completion de una región” mezcla idioma en encabezado español. | `PM-01:92` | Cambiar a “Completar una región”. |

## 9. Decisiones abiertas

Estas decisiones requieren dueño y fecha. Las irreversibles o de aceptación final necesitan aprobación humana según `PM-00:106`.

1. Usuario primario y secundario para Fases 0-1.
2. Definición de “primera versión” y punto donde se prueba propuesta semántica diferencial.
3. Lista cerrada de tareas esenciales para F1.
4. Umbrales de usabilidad, integridad, reversibilidad y rendimiento.
5. Sistemas operativos, resoluciones, escalas, teclado/mouse y tecnologías asistivas de matriz inicial.
6. Estándar y nivel objetivo de accesibilidad.
7. Persistencia y límites de undo; distinción respecto a autosave/recuperación.
8. Diseño de conflicto por modificación externa y de exportación con pérdida.
9. Alcance de selección/mover en F1, presente en historias pero no en epics.
10. Instrumentación local/opt-in necesaria para métricas sin contradecir telemetría opcional.

## 10. Gate documental para Fase 0

Fase 0 puede comenzar cuando exista evidencia documental de:

- Usuario primario, hipótesis de problema y cinco tareas de referencia aprobadas.
- Matriz trazable de requisitos P0/P1 de Fases 0-1.
- Tres spikes exigidos por PM-01 incorporados al plan: editor ortogonal manual, transformación semántica incremental y regeneración localizada reproducible con bloqueos.
- Matriz inicial de entorno: Windows 11 como plataforma primaria de desarrollo; pantalla 1920×1080 a 100% y 2560×1440 a 150%; teclado y mouse; equipo de referencia medio; lector de pantalla y navegación solo teclado. Hardware exacto se registra, no se supone.
- Fichas de métricas con fórmula, baseline a obtener, fixture, instrumento, muestra y gate.
- Protocolo de sesión de usuario y plantilla de evidencia.
- Contrato mínimo de accesibilidad y reversibilidad.
- Definición “ejecutable por fase”: comando documentado, build limpio, proyecto ejemplo versionado, guion manual, resultado esperado, captura/log y defectos registrados.

## 11. Gate obligatorio desde Fase 1

Cada fase debe terminar con aplicación ejecutable y prueba manual antes de avanzar:

1. Construir desde checkout limpio con comando documentado.
2. Ejecutar aplicación sin pasos implícitos.
3. Abrir fixture versionado de esa fase.
4. Completar guion feliz y al menos un flujo de error/recuperación.
5. Probar undo/cancelación y save/reopen cuando apliquen.
6. Ejecutar tarea esencial solo por teclado y revisar escala/foco.
7. Registrar versión, plataforma, hardware, resultado, captura/log y defectos.
8. Comparar contra gates; si falla un bloqueante, corregir la fase actual y repetir. No avanzar por calendario.

## 12. Dictamen final

**Estado documental Producto/UX:** incompleto, corregible y con dirección coherente.  
**Inicio inmediato de implementación Fase 0:** **No-go condicionado.**  
**Trabajo autorizado ahora:** completar auditoría global, corregir documentación y cerrar PUX-01 a PUX-05.  
**Tras correcciones:** revisión corta de trazabilidad y gates; luego **Go para Fase 0**.  
**Desde Fase 1:** ninguna fase se acepta sin ejecutable, fixture y prueba manual registrada, además de evidencia automatizada proporcional al riesgo.

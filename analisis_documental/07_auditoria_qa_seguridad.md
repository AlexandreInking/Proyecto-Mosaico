# Auditoría adversarial de QA, seguridad y release

**Alcance:** PM-05, PM-10, PM-11, PM-12 y PM-13.  
**Autoridad aplicada:** PM-00 → PM-02 → contratos PM-05 → diseños especializados → PM-14.  
**Fecha:** 19 de julio de 2026.  
**Modo:** auditoría documental; no valida implementación ni corrige fuentes.

## 1. Dictamen ejecutivo

**Dictamen para iniciar Fase 0: GO condicionado.** La documentación permite ejecutar spikes descartables, crear repositorio/CI y obtener evidencia. No permite todavía congelar formato, abrir plugins de terceros, activar telemetría ni publicar artefactos.

Condiciones de entrada a Fase 0:

1. Registrar ADR propuestos para stack/plataformas, formato/protocolo de guardado y modelo de confianza de plugins.
2. Adoptar un threat model mínimo con fronteras de confianza: proyecto, assets, importadores, plugins, red, actualizador, CI y agente.
3. Convertir límites cualitativos de carga en presupuestos medibles.
4. Definir una prueba destructiva de guardado que abarque proceso, disco lleno y proyecto multifichero.
5. Añadir un gate ejecutable y manual a cada fase desde Fase 1.

**Bloqueos posteriores:** Fase 1 no debe declararse terminada sin gate manual reproducible; Fase 7 no debe comenzar con plugins de terceros mientras el modelo de aislamiento/firma siga abierto.

## 2. Escala y reglas de decisión

| Severidad | Interpretación | Efecto |
|---|---|---|
| S0 | Riesgo probado de pérdida/corrupción | Bloquea cualquier release |
| S1 | Riesgo alto de ejecución no confiable, escape, exportación errónea, crash frecuente o gate no verificable | Bloquea fase que expone capacidad |
| S2 | Control incompleto con workaround o alcance limitado | Requiere tarea y dueño antes de estabilizar |
| S3 | Precisión, operabilidad o evidencia mejorable | No bloquea spike |

Esta escala conserva PM-12:149-154. Un gate se considera aprobado solo con comando, entorno, versión, resultado y artefacto guardado; una afirmación narrativa no cuenta como evidencia, conforme a PM-13:144-162.

## 3. Matriz riesgo → control → prueba → gate

| ID | Riesgo / severidad | Control documentado | Prueba adversarial exigida | Gate y fase | Evidencia |
|---|---|---|---|---|---|
| R-01 | Guardado parcial o mezcla de generaciones, S0 | Temporal mismo volumen, validación, sync, rename, backup, journal/manifiesto | Matar proceso en cada transición; disco lleno; acceso denegado; archivo destino abierto; caída entre archivos; validar anterior o nuevo, nunca mezcla | **F0:** spike demuestra protocolo. **F1:** suite automática + escenario manual | PM-05:190-205; PM-12:78-82; PM-02:139,155 |
| R-02 | Round-trip pierde IDs, campos desconocidos u orden semántico, S0 | IDs estables, conservación de propiedades desconocidas, serialización canónica | Generar documentos con reorder/rename/move; comparar hash estructural; versión futura con campos desconocidos; repetir N ciclos | **F1:** 100% invariantes y corpus dorado | PM-05:48-60,141,220-223; PM-02:46,147 |
| R-03 | Autosave reemplaza o contamina guardado manual, S0 | Ubicación separada, comparación de revisión, recuperación con diff | Crash durante autosave, autosave corrupto/antiguo, reloj alterado, dos instancias; verificar guardado confirmado intacto | **F2:** gate recuperación | PM-05:203-205; PM-02:50 |
| R-04 | Migración irreversible o cadena defectuosa, S0 | Copia previa, informe, versiones, cadenas completas | Migrar cada versión→actual; repetir migración; fallo intermedio; downgrade/restore; espacio insuficiente | **F2:** matriz completa verde antes de cambiar versión de esquema | PM-05:207-218,239-248; PM-12:110-117 |
| R-05 | JSON/imagen/chunk bomba agota memoria/CPU, S1 | Límites de profundidad, strings, conteos, dimensiones, descompresión | Corpus: nesting, huge declared lengths, ratio bomba, imagen con dimensiones extremas, números límite; medir memoria/tiempo y terminar por límite | **F1:** parsers básicos; **release:** fuzz y presupuestos | PM-05:224-233; PM-12:75-76,84-95,97-104; PM-10:169 |
| R-06 | Path traversal por `..`, ruta absoluta, URI, symlink/junction o TOCTOU, S1 | Root de proyecto y servicio de resolución/normalización | Variantes Unicode/case, UNC, device names, ADS, symlink/junction, swap tras validación; comprobar que handle final queda dentro del root | **F1:** carga/assets/export; **F7:** plugins | PM-05:145,232; PM-11:159-161,187-195; PM-12:99-104 |
| R-07 | `Scripts[]` ejecuta contenido al abrir, S1 | PM-12 prohíbe ejecutar contenido al abrir | Proyecto con scripts/hooks/manifiestos; abrir en modo seguro; comprobar cero procesos/red/escritura | **F0:** decidir eliminar, datos inertes o runtime aislado. Bloquea scripts | PM-05:35-44 frente a PM-12:97-104 |
| R-08 | Plugin in-process ignora permisos y compromete usuario, S1 | Manifiesto/permisos; niveles de confianza; modo seguro | Plugin simulado lee fuera, escribe fuera, abre red/proceso, consume CPU/RAM, bloquea UI, intenta cargar dependencia | **F7:** aislamiento y denegación verificable antes de terceros | PM-02:128-129; PM-11:131-153; PM-12:106-108 |
| R-09 | Firma válida pero editor no verifica identidad, revocación o downgrade, S1 | Paquetes firmados, origen visible, integridad, rollback | Firma inválida/caducada/revocada, clave rotada, replay y downgrade; actualización interrumpida | **Release:** verificador, trust store y política aprobados | PM-12:104,110-117,136-145 |
| R-10 | Dependencia/paquete malicioso o no reproducible, S1 | Lockfile y revisión de dependencia/licencia | Build limpio desde lock; hash de artefactos; SBOM; escaneo de secretos/vulnerabilidades/licencias; dependencia sustituida | **F0:** CI base. **Release:** provenance + SBOM | PM-00:82-92,146; PM-11:175-177,195; PM-13:196-203 |
| R-11 | Exportación silenciosamente destructiva, S1 | Plan previo y reporte de pérdida | Fixture por feature: soportada/aproximada/preservada/no soportada; cancelar/fallo disco; no tocar destino previo | **F1:** CSV/PNG. **F7:** corpus Tiled/engines | PM-02:125-129,159; PM-05:235-237; PM-11:50-79,159-161 |
| R-12 | Cancelación deja delta o archivo parcial, S0 | Snapshots inmutables, delta, revisión base, staging | Cancelar en cada yield de job/import/export/generación; editar base durante job; resultado debe ser cero o transacción completa | **Por fase:** toda tarea cancelable | PM-10:95-110; PM-02:153-155; PM-11:161,194 |
| R-13 | Race entre UI, watcher, jobs y guardado, S0 | Workers sobre snapshots y validación de revisión | Scheduler determinista: cambio externo durante save, job obsoleto, cierre con cola, dos comandos concurrentes | **F1:** documento/save; **F2:** watcher/jobs | PM-02:48,137; PM-10:95-110 |
| R-14 | Rendimiento medido en máquina indefinida, S2 | Presupuestos y escenas de referencia | Fixture versionado, warmup, p50/p95, varianza, build Release, energía estable; registrar CPU/GPU/RAM/OS/driver | **F0:** baseline. **Cada fase:** no regresión relevante | PM-10:83-93,148-169; PM-12:141,156-158 |
| R-15 | Caché purgable altera documento o privacidad, S0/S2 | Caché derivada y purgable; trace sin contenido salvo consentimiento | Borrar `.cache`; comparar hash del proyecto; inspeccionar trace por nombres, paths, mapa y thumbnails | **F1:** caché reconstruible. **Release:** prueba DLP | PM-05:158-173; PM-10:121,135-146; PM-02:83 |
| R-16 | Telemetría/crash bundle filtra proyecto, paths o secretos, S1 | Mínima/desactivable; redacción; sin contenido | Capturar tráfico y bundle con datos señuelo/secretos; offline; opt-out persistente; comprobar cero contenido/paths | **Antes de habilitar telemetría:** privacidad aprobada | PM-02:141; PM-11:183-185; PM-12:119-125 |
| R-17 | CI acepta código sin prueba manual/visual, S2 | Gates PR/release, regresión visual, automatización UI | Ejecutar binario empaquetado, flujo canónico, captura; comprobar build correcto y no artefacto stale | **Desde F1:** gate manual obligatorio | PM-12:53-63,127-145; PM-14:29-55,146-155 |
| R-18 | Agente modifica fuera de scope, falsifica evidencia o filtra secretos, S1 | Paths permitidos/prohibidos, revisor, evals y política | Diff de paths; comandos/logs firmados por CI; prompt injection en fixture; secret canary; intento de alterar golden/tests | **Toda PR agéntica:** política + revisor independiente | PM-13:35-37,91-125,142-162,196-203 |
| R-19 | Agentes paralelos pisan modelo/fixtures, S1 | Ownership temporal y ramas separadas | Dos cambios incompatibles simulados; merge debe detectar conflicto semántico; golden solo cambia con aprobación | **Toda integración paralela:** mapa ownership + CI post-merge | PM-13:179-183,202; PM-14:281-283 |
| R-20 | Release no instalable/reversible en plataforma soportada, S1 | Install/update/rollback, firma y matriz real | Instalación limpia, upgrade N-1, rollback app y restauración de proyecto; usuario sin admin; ruta Unicode | **Release:** matriz completa, no solo CI | PM-12:110-117,136-162 |

## 4. Contradicciones y huecos

| ID | Severidad | Hallazgo | Evidencia y efecto | Resolución requerida |
|---|---|---|---|---|
| H-01 | S1 | `Project` incluye `Scripts[]`, pero no existe semántica, runtime ni sandbox; abrir contenido no debe ejecutar nada | PM-05:35-44; PM-12:97-104 | ADR: retirar de v0 o declarar contenido inerte. Ninguna ejecución automática |
| H-02 | S1 | REQ-IO-005 exige permisos, mientras PM-11 permite MVP in-process donde permisos no son frontera efectiva | PM-02:128; PM-11:144-153; PM-12:106-108 | Etiquetar nivel 1 como “confianza total”, no “permisos”; terceros solo aislados |
| H-03 | S1 | Política de plugins sigue abierta pese a que formato/manifiesto ya presupone plugins | PM-00:118-127; PM-05:35-43; PM-11:117-153 | ADR antes de congelar esquema o permitir paquetes |
| H-04 | S1 | Guardado multifichero propone journal **o** manifiesto, sin state machine, orden de fsync, recuperación ni semántica Windows | PM-05:190-201 | Spike + ADR con estados, invariantes y matriz de fallos |
| H-05 | S1 | Límites de archivos son cualitativos: “configurable”, “limitar”, sin valores ni presupuesto acumulado | PM-05:224-233; PM-12:97-104 | Tabla v0 por recurso/proyecto: bytes, nodos, profundidad, tiempo, memoria y ratio |
| H-06 | S1 | Path traversal se menciona, no contempla symlinks/junctions, TOCTOU, rutas de dispositivo/UNC ni salida exportada | PM-05:232; PM-11:159-161 | Especificar canonicalización + validación sobre handle final y tests OS |
| H-07 | S1 | Firma sin trust store, rotación/revocación, timestamp, downgrade ni respuesta a clave comprometida | PM-12:104,110-117,143 | Diseño de firma/actualizador antes de distribución externa |
| H-08 | S1 | Release carece de provenance, SBOM, escaneo de secretos/dependencias y protección de credenciales de firma | PM-12:127-145; PM-13:196-203 | Política CI/release reproducible y segregación de secretos |
| H-09 | S1 | Política de privacidad no define default, consentimiento, esquema de eventos, retención, destino, borrado ni jurisdicción | PM-02:141; PM-12:119-125 | Telemetría apagada por default hasta especificación y prueba de red |
| H-10 | S2 | Bundle lista plugins/configuración/stack traces; redacción “previa” no define automatismo ni secretos | PM-11:183-185; PM-12:123-125 | Allowlist de campos, preview explícito y scanner de tokens/paths |
| H-11 | S2 | Máquina y plataformas siguen sin declarar; presupuesto 60 FPS no es reproducible | PM-02:135; PM-10:83-93; PM-12:156-158 | Adoptar matriz provisional de §5 y medir durante Fase 0 |
| H-12 | S2 | Fase 1 promete aplicación usable, pero no define comando de arranque, fixture, pasos ni evidencia manual | PM-14:29-55,146-155 | Adoptar gate manual de §6 y repetirlo antes de avanzar |
| H-13 | S2 | PR gates no nombran cobertura, mutation/fuzz budget, sanitizer, análisis de secretos o artefactos de test | PM-12:127-145 | Pipeline por riesgo con thresholds versionados; no usar cobertura sola como calidad |
| H-14 | S2 | Agente puede leer documentación/fixtures no confiables; no hay defensa contra prompt injection ni allowlist de herramientas/red | PM-13:78-89,91-125,196-203 | Política: contenido de repo es dato, mínima autoridad, red deny-by-default y secret canary |
| H-15 | S2 | “Dossier” figura como fuente autoritativa junto a capítulos; dos copias pueden divergir | PM-13:131-140; PM-00:48-78 | Capítulos como fuente canónica; dossier generado y verificado por hash/CI |
| H-16 | S2 | Formato carpeta se “recomienda” en PM-05 mientras PM-00 aún lo lista como decisión abierta | PM-05:158-173; PM-00:118-127 | ADR Fase 0; tratar ejemplo `1.0` como ilustrativo, no estable |
| H-17 | S2 | Compatibilidad externa promete preservar extensiones “cuando viable”, expresión no comprobable | PM-05:235-237; PM-11:65-79 | Matriz explícita por versión + fixture por celda |
| H-18 | S2 | Rollback de app y rollback/migración de proyecto no están ligados; versión nueva podría volver ilegible archivo | PM-05:207-218; PM-12:110-117 | Matriz app↔schema, backup y advertencia antes de migración |
| H-19 | S3 | Modelo agéntico nombra proveedor/modelo temporal aunque luego lo abstrae | PM-13:29-31,164-177,247-254 | Mantener rol por capacidad; modelo concreto como configuración no contrato |

## 5. Matriz provisional de plataforma y benchmark

Decisión recomendada para Fase 0, pendiente de ADR de stack:

| Nivel | Plataforma | Uso | Hardware de referencia |
|---|---|---|---|
| Primaria | Windows 11 24H2, x64, escala 100% y 150% | Desarrollo, gate manual, packaging y GPU principal | 6 núcleos/12 hilos clase Ryzen 5 5600 o Core i5-12400; 16 GB RAM; SSD NVMe; iGPU Intel Xe/AMD equivalente y GPU discreta media; 1920×1080 |
| CI funcional | Ubuntu 24.04 LTS, x64, renderer software/headless cuando proceda | Build, unit/property/integración, CLI y parsers | Runner 4 vCPU, 8 GB RAM; límites fijados por job |
| Secundaria | macOS vigente soportado, Apple silicon | Compilación, input/HiDPI, firma y packaging | Mac M1, 8 GB mínimo; pantalla Retina |
| Compatibilidad Windows | Windows 11, x64, iGPU modesta | Piso de rendimiento y memoria | 4 núcleos/8 hilos; 8 GB RAM; SSD; 1366×768/100% |

Política: Windows es plataforma inicial de producto. Linux y macOS entran como evidencia de portabilidad durante Fase 0, no como promesa pública hasta producir instalador firmado y gate manual real, tal como exige PM-12:156-158. Benchmarks guardan commit, build, fixture/hash, OS, CPU, GPU/driver, RAM, resolución/escala, p50/p95, pico de memoria y cinco repeticiones. Hardware exacto disponible debe sustituir clases anteriores en ADR; no falsear disponibilidad.

## 6. Gate manual ejecutable desde Fase 1

Cada fase debe dejar aplicación ejecutable. Antes de iniciar fase siguiente, una persona distinta del implementador corre `scripts/manual-gate.ps1 -Phase N` (o equivalente decidido por stack). Script debe: compilar Release, ejecutar smoke tests, abrir aplicación con proyecto fixture versionado y guardar log/manifest de build. Automatización prepara; humano valida comportamiento.

### Fase 1 — `MG-01 editor ortogonal mínimo`

Precondiciones: checkout limpio, dependencias bloqueadas, build Release, fixture `samples/phase1-orthogonal`, telemetría/red desactivadas, plugins desactivados.

1. Ejecutar comando documentado de build/test y luego `scripts/manual-gate.ps1 -Phase 1`.
2. Crear proyecto ortogonal vacío y mapa con nombre Unicode.
3. Importar sprite sheet fixture; pintar con pincel, borrar y rellenar cruzando borde de chunk.
4. Crear segunda capa, reordenar, ocultar/bloquear; comprobar que capa bloqueada no cambia.
5. Ejecutar undo hasta estado inicial y redo hasta estado final; comparar vista y hash semántico mostrado/registrado.
6. Guardar; cerrar proceso normalmente; reabrir; comprobar mapa, IDs, capas y tiles.
7. Exportar CSV y PNG a staging; abrir ambos y revisar orientación/recorte; conservar reporte.
8. Modificar proyecto externamente mientras está abierto; confirmar que no sobrescribe silenciosamente.
9. Repetir guardado con inyección controlada de fallo disponible en build de prueba; confirmar archivo anterior válido y recuperación clara.
10. Cerrar aplicación. Confirmar cero crash, warning de integridad, red inesperada o escritura fuera del proyecto/cache permitida.

Evidencia obligatoria:

- `gate-result.json`: commit, versión, plataforma/hardware, comandos y códigos de salida.
- Log con IDs de correlación, sin paths completos ni contenido privado.
- Capturas: proyecto final, reapertura y exportes.
- Hash semántico antes de cerrar y después de reabrir.
- Reporte de exportación y lista de archivos escritos.
- Checklist firmado por operador con `PASS`, `FAIL` o `BLOCKED`; nunca “parece funcionar”.

**Aprobación:** todos pasos PASS, suite automática verde, cero S0/S1 abierto aplicable y artefactos ligados al mismo commit. Cualquier fallo mantiene fase abierta; se corrige y repite gate completo. La misma plantilla se extiende en cada fase con su slice nuevo sin retirar pasos previos críticos.

## 7. Gates CI y release mínimos

### Pull request

1. Build limpio en matriz declarada.
2. Formato/lint/análisis estático; warnings nuevos = fallo.
3. Unit + property + integración del riesgo afectado.
4. Tests de arquitectura y paths permitidos para agente.
5. Secret scan, dependency/license review y SBOM preliminar.
6. Fixtures/golden modificados requieren aprobación explícita independiente.
7. Cambio de formato/threading/identidad/plugins exige ADR y migración.
8. UI/hot path exige captura o benchmark comparable.

### Release

Además de PM-12:136-145: build reproducible o explicación de diferencias; provenance; SBOM; firma verificada fuera de CI productor; instalación/upgrade/rollback en máquina limpia; corpus hostil; telemetry-off network test; gate manual completo; cero S0/S1; waivers fechados, con dueño y caducidad.

## 8. Backlog de cierre recomendado

| Prioridad | Tarea | Dueño recomendado | Salida verificable |
|---|---|---|---|
| P0 | Threat model y trust boundaries | Seguridad + arquitectura | Diagrama, activos, actores, abusos, controles y tests |
| P0 | ADR protocolo de guardado multifichero | Persistencia + QA | State machine + fault-injection verde |
| P0 | Decidir `Scripts[]` | Producto + seguridad | Eliminación de v0 o sandbox probado |
| P0 | Modelo plugin MVP | Arquitectura + seguridad | Trust tiers y prohibición de terceros in-process |
| P0 | Límites v0 de parsers/recursos | Persistencia + rendimiento | Tabla numérica + corpus hostile |
| P0 | Bootstrap CI/release privado | Release | Gates PR, provenance, SBOM y secret handling |
| P0 | Gate manual Fase 1 | QA + UX | Script, fixture, checklist y evidencia sample |
| P1 | ADR plataformas/benchmark | Producto + render | Hardware real medido y presupuestos revisados |
| P1 | Política de privacidad | Producto + seguridad | Telemetría default-off, esquema/retención/destino |
| P1 | Política de firma/actualización | Release + seguridad | Trust store, revocación, rollback y simulación |
| P1 | Hardening sistema agéntico | Coordinación + seguridad | Tool allowlist, sandbox, prompt-injection evals |
| P1 | Fuente documental única | Documentación + release | Capítulos canónicos; dossier reproducible en CI |

## 9. Veredicto por área

| Área | Estado | Motivo |
|---|---|---|
| Integridad/persistencia | Condicionado | Buenas invariantes; protocolo multifichero y fault model incompletos |
| Archivos hostiles | Condicionado | Targets correctos; límites y path model sin especificación ejecutable |
| Plugins | No listo para terceros | Permisos no aislables en nivel 1; firma/trust incompletos |
| Privacidad | No lista para activarse | Minimización declarada; default, retención y destino ausentes |
| CI/release | Condicionado | Gates listados; supply chain, provenance y secretos ausentes |
| Sistema agéntico | Condicionado | Roles/contratos fuertes; prompt injection y evidencia confiable ausentes |
| Fase 0 | **GO condicionado** | Puede producir ADR/spikes/CI sin promesa pública ni formato estable |
| Fase 1 | **NO-GO todavía** | Debe cerrar P0, implementar slice y superar `MG-01` antes de Fase 2 |


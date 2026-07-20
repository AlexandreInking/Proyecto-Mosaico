---
title: "Proyecto Mosaico - Índice maestro y gobernanza documental"
subtitle: "Mapa de documentos, principios rectores, control de cambios y orden de lectura"
author: "Proyecto Mosaico - documentación de diseño"
date: "19 de julio de 2026"
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
---

> **Documento:** PM-00  
> **Versión:** 0.3.0 - Transformación Asset Pipeline AI
> **Estado:** Borrador
> **Bloqueo:** implementación requiere aprobación de ADR-003/ADR-004.
> **Nombre del producto:** Proyecto Mosaico es un nombre provisional.

> **Cambio de dirección (19-07-2026):** Mosaico pasa a ser una plataforma dual Web/Desktop para preparación de imágenes, modelos y audio, edición/generación de mapas y contenido RPG estructurado. `docs/transformation/SPEC.md` y los ADR-003/ADR-004 gobiernan la transición. El editor 2D anterior permanece como módulo y baseline de migración, no como producto completo.


# Propósito del dossier

Este paquete convierte la idea de un editor universal 2D en una base de ingeniería ejecutable. No es una promesa de que cada decisión sea definitiva. Es un conjunto coordinado de especificaciones que permite iniciar prototipos, repartir trabajo, evaluar resultados y registrar cambios sin perder coherencia.

El producto objetivo permite editar y generar niveles o mapas 2D en múltiples topologías: ortogonal, lateral sobre cuadrícula ortogonal, isométrica, escalonada, oblicua y hexagonal. Su rasgo diferencial es la separación entre intención semántica, representación visual y datos de juego, combinando edición manual, reglas de patrones, autotiling, generación procedural y Wave Function Collapse.

![Contexto general del producto](../diagramas/context.png)

# Principios rectores

1. **Una cuadrícula no es una perspectiva.** La topología lógica y la proyección visual son contratos distintos.
2. **Un tile no es un terreno.** La celda semántica representa intención; el tile visual es una decisión derivada.
3. **El mapa visual no es el mapa jugable.** Colisiones, navegación y objetos deben sobrevivir a un cambio de arte.
4. **Todo resultado procedural debe ser editable.** El usuario puede bloquear, modificar, regenerar o convertir a contenido manual.
5. **Toda operación destructiva debe ser reversible.** Comandos, transacciones, undo/redo, backups y escritura atómica son capacidades del núcleo.
6. **La reproducibilidad es una función de producto.** Semillas, versiones de algoritmos y parámetros forman parte del documento.
7. **Los plugins amplían; no gobiernan el núcleo.** La API pública es menor que la implementación interna y se versiona explícitamente.
8. **La calidad se demuestra.** Compilación, pruebas, archivos dorados, benchmarks, regresión visual y sesiones de uso forman parte de la definición de terminado.

# Registro de documentos

| Código | Documento | Pregunta principal que responde |
|---|---|---|
| PM-00 | Índice maestro y gobernanza | ¿Qué documentos existen, cuál manda y cómo se cambian? |
| PM-01 | Visión de producto y alcance | ¿Qué producto se construye y para quién? |
| PM-02 | Especificación de requisitos | ¿Qué debe hacer y cómo sabremos que funciona? |
| PM-03 | Arquitectura de software | ¿Cómo se divide el sistema y qué dependencias se permiten? |
| PM-04 | Modelo espacial | ¿Cómo se representan topologías, proyecciones y coordenadas? |
| PM-05 | Modelo de datos y persistencia | ¿Qué se guarda, con qué identidad y cómo evoluciona? |
| PM-06 | UX del editor | ¿Cómo trabaja una persona con el producto? |
| PM-07 | Autotiling y motor de patrones | ¿Cómo se transforma intención local en presentación coherente? |
| PM-08 | Generación procedural | ¿Cómo se generan estructuras controlables y validables? |
| PM-09 | Motor WFC | ¿Cómo se resuelven posibilidades y restricciones locales? |
| PM-10 | Renderizado y rendimiento | ¿Cómo se mantiene el editor fluido en proyectos grandes? |
| PM-11 | Integraciones y plugins | ¿Cómo intercambia datos y cómo se amplía? |
| PM-12 | QA, seguridad y release | ¿Cómo se evita entregar datos corruptos o una herramienta frágil? |
| PM-13 | Desarrollo agéntico | ¿Cómo coordinar Sol 5.6 y agentes especializados con control humano? |
| PM-14 | Roadmap, backlog y plantillas | ¿En qué orden se construye y cómo se documentan decisiones? |

Artefactos normativos de transformación:

| Código | Documento | Autoridad |
|---|---|---|
| TR-SPEC | `docs/transformation/SPEC.md` | Alcance propuesto de la nueva plataforma; requiere aprobación humana |
| TR-PLAN | `docs/transformation/PLAN.md` | Secuencia y gates T0-T9; reemplaza el orden F2-F7 al aprobarse |
| TR-BACKLOG | `docs/transformation/BACKLOG.md` | Tareas implementables de transformación |
| ADR-003 | Plataforma dual React/Tauri/AdonisJS | Reemplaza elección provisional WPF como destino final |
| ADR-004 | Pipeline no destructivo e IA estructurada | Gobierna assets, jobs y contenido generado |

# Jerarquía y autoridad

En caso de contradicción se aplica el siguiente orden:

1. ADR aceptado con fecha posterior.
2. Requisito aprobado en PM-02.
3. Contrato de arquitectura en PM-03, PM-04 o PM-05.
4. Diseño especializado del subsistema correspondiente.
5. Roadmap y ejemplos, que son orientativos y pueden replanificarse.

Los ejemplos de pseudocódigo expresan intención y no constituyen una API congelada. Una API se considera estable solo cuando aparece en el registro de compatibilidad de plugins o en un ADR de estabilización.

# Control de cambios

Todo cambio relevante debe incluir:

- Problema o necesidad que lo origina.
- Documentos y requisitos afectados.
- Alternativas consideradas.
- Compatibilidad de archivos, plugins y proyectos existentes.
- Plan de migración y reversión.
- Evidencia: pruebas, benchmark, prototipo o sesión de usuario.
- Decisión y responsables.

Cambios locales y reversibles pueden entrar por pull request ordinario. Cambios que afecten el formato nativo, topologías, modelo de identidad, threading, sistema de plugins o semántica de reglas requieren un ADR.

## Estados documentales

| Estado | Significado | Autoridad necesaria para avanzar |
|---|---|---|
| Borrador | Hipótesis incompleta; puede contener alternativas y huecos conocidos. | Propietario temporal del documento. |
| Auditado | Revisado contra corpus y riesgos; los hallazgos están registrados, pero pueden quedar bloqueos. | Revisor independiente del dominio. |
| Aprobado | Suficiente para ejecutar la fase indicada; contratos, aceptación y decisiones límite están cerrados. | Responsables humanos definidos por gobernanza. |
| Estable | Validado por implementación, pruebas, migraciones y uso; cambios incompatibles exigen ADR. | Aprobación humana y evidencia de release. |
| Sustituido | Reemplazado por versión, ADR o documento posterior identificado. | Responsable del documento y enlace al reemplazo. |

`Auditado` no significa listo para implementar. Cada documento debe declarar fase objetivo, bloqueos y evidencia pendiente antes de pasar a `Aprobado`.

## Fuentes canónicas y artefactos generados

- Los quince capítulos `documentos/00_...md` a `documentos/14_...md` son fuentes canónicas y se editan por separado.
- `Proyecto_Mosaico_Dossier_Completo.md` es generado; no se edita directamente.
- Los archivos `diagramas/*.dot` son fuente de los PNG con el mismo nombre base. Los PNG se versionan para lectura sin Graphviz.
- `README.md` orienta navegación y comandos, pero no reemplaza contratos PM ni ADR.
- La auditoría bajo `analisis_documental/` registra evidencia y backlog; no cambia requisitos por sí sola.

El dossier se regenera con `python tools/docs/build_dossier.py`. `python tools/docs/build_dossier.py --check` debe fallar cuando el artefacto difiera de sus fuentes.

# Roles de gobernanza

| Rol | Responsabilidad |
|---|---|
| Director de producto | Prioriza necesidades, define usuarios y acepta experiencia de uso. |
| Arquitecto principal | Mantiene límites, contratos, ADR y deuda técnica. |
| Responsable de formato | Custodia esquema, migraciones y compatibilidad. |
| Responsable de algoritmos | Custodia reglas, generación procedural y WFC. |
| Responsable de UX | Mantiene flujos, accesibilidad y consistencia del editor. |
| QA principal | Define evidencia, prueba adversarial y puertas de release. |
| Seguridad | Revisa plugins, archivos no confiables, actualizaciones y distribución. |

Un agente puede desempeñar temporalmente un rol, pero la aceptación de producto y las decisiones irreversibles requieren aprobación humana explícita.

# Orden de lectura recomendado

Para dirección de producto: PM-01, PM-02, PM-06 y PM-14.

Para ingeniería del núcleo: PM-03, PM-04, PM-05 y PM-12.

Para algoritmos: PM-07, PM-08, PM-09 y PM-10.

Para construir el sistema agéntico: PM-13, seguido por los contratos de cada módulo.

# Decisiones de plataforma

- Propuesta cerrada pendiente de aprobación: React/TypeScript/Vite, PixiJS, Tauri 2 y AdonisJS.
- WPF queda como baseline temporal hasta paridad T2.
- MVP transformado inicia con imagen y shell dual; isométrico/hexagonal siguen después de paridad ortogonal.
- Licencia del producto y estrategia de monetización.
- Formato de proyecto: contenedor único o carpeta con manifiesto.
- Soporte inicial: web moderna y Desktop Windows; macOS/Linux después de evidencia.
- Nivel de compatibilidad con Tiled que se promete públicamente.
- Política de plugins: firmados, aislados, con permisos o solo locales de confianza.

# Definición documental de terminado

Un documento se considera listo para implementación cuando contiene propósito, límites, términos, contratos, errores esperables, criterios de aceptación, riesgos y decisiones abiertas. Se considera estable cuando los prototipos han validado sus supuestos principales y cualquier cambio incompatible exige migración documentada.


## Referencias técnicas de inspiración

Estas referencias se emplean para estudiar conceptos y formatos, no para copiar código, recursos gráficos ni interfaces:

- Tiled, documentación oficial: https://doc.mapeditor.org/
- Tiled, formato JSON: https://doc.mapeditor.org/en/stable/reference/json-map-format/
- Tiled, repositorio oficial: https://github.com/mapeditor/tiled
- TileKit, descripción oficial: https://rxi.itch.io/tilekit
- Unity 2D Tilemap y Rule Tile: https://docs.unity3d.com/6000.4/Documentation/Manual/tilemaps/tilemaps-landing.html
- Unity 2D Tilemap Extras: https://docs.unity3d.com/Packages/com.unity.2d.tilemap.extras@8.0/manual/RuleTile-introduction.html
- Wave Function Collapse, repositorio de referencia: https://github.com/mxgmn/WaveFunctionCollapse

Toda dependencia o reutilización de código deberá pasar por una revisión específica de licencia, atribución y compatibilidad con el modelo de distribución del producto.

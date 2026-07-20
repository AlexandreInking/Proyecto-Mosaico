# Especificación de transformación: Mosaico Asset Pipeline AI

**Versión:** 0.1.0  
**Estado:** Propuesto; requiere aprobación humana antes de implementar  
**Fecha:** 19 de julio de 2026  
**Autoridad:** complementa PM-01/PM-02 y se aplica mediante ADR-003 y ADR-004

## 1. Propósito

Mosaico evoluciona de editor de tilemaps a entorno integrado de preparación de assets y diseño procedural para desarrollo de videojuegos. Conserva edición de mapas, topologías ortogonal/isométrica/hexagonal, patrones y WFC; añade pipelines reproducibles para imágenes, modelos 3D y audio, más generación asistida de contenido estructurado.

La promesa corta es: **un Photoshop de pipeline para desarrolladores**, no un sustituto de pintura raster. El usuario importa recursos, encadena transformaciones no destructivas, inspecciona diferencias, valida calidad y exporta artefactos listos para motor.

## 2. Productos

### 2.1 DesktopApp

- Aplicación instalable y capaz de operar sin conexión después de instalar modelos y herramientas.
- Acceso explícito al sistema de archivos, GPU y procesos auxiliares mediante adaptadores Tauri.
- Procesamiento local de datos privados y lotes grandes.
- Licencia comercial perpetua o equivalente se decidirá después; pagos y DRM no forman parte del desarrollo inmediato.

### 2.2 WebApp

- Aplicación online con la misma composición visual, comandos y modelo de interacción.
- Persistencia de cuenta, almacenamiento de proyectos y jobs remotos.
- Futuro acceso por suscripción; facturación queda fuera hasta validar producto y costes.
- Procesamiento ligero en navegador cuando sea seguro y compatible; procesamiento pesado en workers del servidor.

### 2.3 Paridad

“Misma UI” significa un único árbol React, design tokens, componentes, editor y contratos de estado. Solo cambian adaptadores de plataforma, disponibilidad de capacidades y textos que explican dónde se ejecuta un job. No se mantendrán dos implementaciones visuales.

## 3. Usuarios y trabajos principales

1. Desarrollador indie: normaliza assets heterogéneos y los exporta a Godot/Unity.
2. Artista técnico: crea recetas repetibles de atlas, compresión, LOD y validación.
3. Diseñador RPG: genera mundo, ciudades, quests, diálogos, economía y habilidades coherentes.
4. Diseñador de niveles: combina edición manual, reglas, proceduralidad y WFC.
5. Equipo pequeño: comparte presets y resultados sin construir tooling propio.

## 4. Alcance funcional

### 4.1 Workspace y catálogo

- Importar sprites/imágenes, modelos 3D y audio mediante staging.
- Detectar tipo, dimensiones, duración, canales, metadatos, dependencias y hash.
- Mantener asset original inmutable; cada salida deriva de receta, versión y parámetros.
- Buscar, etiquetar, previsualizar, comparar y agrupar assets.
- Mostrar errores agrupados por causa con conteo, assets afectados y acción recomendada.

### 4.2 Pipeline de imágenes y sprites

- Eliminación de fondo con máscara editable y comparación antes/después.
- Upscale mediante proveedor intercambiable, con escala y modelo registrados.
- Recorte, padding, resize, conversión de espacio de color y formato.
- Generación de atlas determinista con padding, extrusión y manifiesto.
- Compresión de texturas por perfil de plataforma; preservar fuente.
- Validaciones: transparencia, bleeding, dimensiones máximas, potencia de dos opcional y presupuesto de memoria.

### 4.3 Pipeline de modelos 3D

- Importar al menos glTF/GLB en primera entrega; otros formatos mediante conversor aislado.
- Inspeccionar mallas, materiales, texturas, animaciones y tamaño estimado.
- Generar LOD mediante simplificación geométrica con umbrales visibles.
- Optimizar/deduplicar, comprimir geometría y texturas, y exportar glTF/GLB.
- Validaciones: referencias rotas, normales, materiales incompatibles, presupuesto de triángulos/VRAM y pérdida por LOD.

### 4.4 Pipeline de audio

- Importar WAV/FLAC/OGG/MP3 según soporte confirmado por plataforma.
- Normalizar loudness/pico, recortar silencio, convertir sample rate/canales/formato y crear loops.
- Generar variantes comprimidas por perfil de destino.
- Validaciones: clipping, duración, loop discontinuo y presupuesto de tamaño.

### 4.5 Editor de mapas y generación clásica

- Conservar capas, tilesets, objetos, topologías 2D ortogonal, isométrica y hexagonal.
- Conservar reglas por patrones, autotiling, generadores deterministas y WFC.
- Todo resultado generado es editable, reversible, reproducible por semilla y explicable.
- Exportar datos y assets para Godot y Unity mediante formatos versionados.

### 4.6 Generador procedural con IA

La IA no genera píxeles, texturas, audio ni mallas. Genera y modifica estructuras tipadas:

- mapas y regiones;
- ciudades, distritos, edificios y rutas;
- quests, objetivos, prerequisitos y recompensas;
- diálogos ramificados y condiciones;
- economías, recursos, sinks/sources y curvas;
- árboles de habilidades, costes y dependencias.

Flujo normativo:

1. Usuario define intención, género, tono, restricciones y semilla.
2. IA propone un `GenerationPlan` JSON conforme a esquema.
3. Validadores rechazan referencias inválidas, ciclos prohibidos, contenido inconsistente y presupuestos excedidos.
4. Motores deterministas materializan mapas y grafos.
5. Simuladores evalúan conectividad, economía, progresión y alcanzabilidad.
6. Usuario compara variantes, bloquea elementos y acepta o descarta.
7. Resultado aceptado entra como una transacción deshacible con procedencia completa.

La consistencia se apoya en una `WorldBible` versionada: entidades, hechos, cronología, facciones, reglas, vocabulario y restricciones. Ninguna respuesta libre del modelo pasa a estado autoritativo sin parseo, validación y confirmación.

## 5. Modelo conceptual mínimo

- `Workspace`: raíz, miembros/cuenta opcional, configuración y destinos.
- `SourceAsset`: bytes originales, hash, tipo, metadata y licencia/procedencia.
- `Recipe`: grafo dirigido acíclico de pasos y parámetros versionados.
- `PipelineRun`: receta, entradas, entorno, estado, logs, métricas y outputs.
- `DerivedAsset`: salida direccionada por contenido y enlazada a su procedencia.
- `ProjectDocument`: mapas, capas, objetos, catálogos y referencias a assets.
- `WorldBible`: hechos y restricciones narrativas autoritativas.
- `GenerationPlan`: propuesta estructurada, semilla, proveedor y esquema.
- `ContentGraph`: nodos y aristas de ciudades, quests, diálogo, economía o skills.
- `ValidationFinding`: severidad, código estable, grupo, evidencia y remedio.

## 6. Requisitos de arquitectura

- Dominio y contratos no importan React, Tauri, AdonisJS, proveedores IA ni SDKs de motor.
- UI compartida consume puertos: `FileSystemPort`, `ObjectStorePort`, `JobRunnerPort`, `AiProviderPort`, `ProjectStorePort`, `ExportPort`.
- Jobs son idempotentes cuando sea posible, cancelables y observables.
- Cada transformación registra herramienta/modelo, versión, parámetros, hashes y tiempos.
- Desktop y web interpretan el mismo esquema de proyecto y receta.
- Datos locales no se suben sin acción explícita; cada job muestra lugar de ejecución.
- Proveedores IA son sustituibles y usan salidas estructuradas validadas.
- Formatos nativos usan migraciones explícitas y preservan originales.

## 7. Arquitectura objetivo

```text
Shared/
  contracts/       esquemas, comandos, eventos y puertos
  domain/          workspace, assets, mapas, world bible y validadores
  ui/              React, tokens, paneles y shell común
  canvas/          PixiJS: mapas, grafos, previews y selección
  pipeline/        recetas, scheduler neutral y procedencia
DesktopApp/
  app/             entrada React/Vite compartida
  src-tauri/       capacidades nativas, almacenamiento y sidecars
  LegacyWpf/       baseline temporal hasta paridad aceptada
WebApp/
  client/          entrada React/Vite compartida
  server/          AdonisJS API, auth futura, proyectos y orquestación
  workers/         ejecución aislada de jobs pesados
```

La ubicación `LegacyWpf` es transitoria. No se elimina hasta que un gate de paridad demuestre abrir/editar/guardar/exportar el fixture F1 con DesktopApp nueva.

## 8. Requisitos no funcionales

- Recuperación: caída durante job nunca altera original ni proyecto confirmado.
- Determinismo: pasos deterministas producen mismo hash con mismas entradas, versión y plataforma declarada.
- Rendimiento: interacción del canvas mantiene objetivo de 60 FPS y p95 menor a 16,7 ms en fixture de referencia; jobs pesados no bloquean UI.
- Accesibilidad: navegación por teclado, foco visible, contraste WCAG AA y zoom UI.
- Seguridad: límites de tamaño, MIME real, sandbox/staging, nombres no confiables, prevención de path traversal y secretos solo en backend/keychain.
- Privacidad: local por defecto en Desktop; consentimiento explícito y retención visible en Web.
- Portabilidad inicial: Web moderna; Desktop Windows primero, seguido de macOS/Linux tras gates.
- Observabilidad: logs estructurados sin contenido sensible, progreso, duración, uso estimado y código de error estable.

## 9. Criterios de aceptación del primer slice dual

1. `DesktopApp` y `WebApp` arrancan con mismo shell visual desde componentes compartidos.
2. Ambas importan PNG por su adaptador, calculan metadata/hash y muestran preview.
3. Ambas ejecutan una receta local segura: resize + conversión + exportación.
4. Receta y resultado producen manifiesto idéntico, salvo campos de entorno declarados.
5. Error de archivo inválido aparece una vez agrupado, con conteo y detalle expandible.
6. Desktop funciona sin red; Web funciona sin acceso directo al filesystem del servidor.
7. Pruebas unitarias, integración y walkthrough manual pasan en ambas superficies.

## 10. Fuera de alcance inmediato

- Pagos, suscripciones, DRM, marketplace y reparto de ingresos.
- Entrenar modelos propios o generar imágenes/audio/mallas desde texto.
- Colaboración multijugador en tiempo real.
- Compatibilidad universal de formatos desde primera fase.
- Plugins de terceros sin aislamiento y permisos definidos.
- Prometer equivalencia bit a bit entre codecs o GPUs diferentes.

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Dos apps divergen | UI/comandos compartidos; adapters contract-tested |
| Alcance excesivo | slices verticales ejecutables; un tipo de asset antes de ampliar |
| Coste cloud impredecible | cuotas técnicas, estimación previa, cancelación y procesamiento local |
| IA produce incoherencia | esquemas, WorldBible, validadores, simulación y aprobación humana |
| Toolchain nativo frágil | workers/sidecars versionados; recetas reproducibles; fallback explícito |
| Migración rompe F1 | strangler; WPF congelado como oracle hasta gate de paridad |
| Licencias de modelos/codecs | registro SBOM/licencias antes de integrar cada herramienta/modelo |

## 12. Puerta de aprobación

Implementación comienza solo después de aprobar:

- alcance de este documento;
- ADR-003 (plataforma dual);
- ADR-004 (pipeline e IA estructurada);
- orden y gates de `PLAN.md`.


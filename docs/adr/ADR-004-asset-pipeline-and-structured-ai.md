# ADR-004: pipeline no destructivo e IA estructurada

**Estado:** Aceptado
**Fecha:** 19 de julio de 2026  
**Decisores:** propietario del proyecto; aprobado antes de T0

## Contexto

Producto procesará archivos potencialmente grandes/no confiables y usará IA para generar contenido RPG consistente. Salidas deben ser editables, reproducibles y seguras. Respuestas libres o transformaciones in-place impedirían validar, deshacer y explicar resultados.

## Decisión

### Assets

- Originales son inmutables y direccionados por hash.
- Transformaciones forman recetas DAG versionadas.
- Ejecución crea staging, valida salida y solo después publica `DerivedAsset`.
- Cada resultado conserva procedencia completa.
- Herramientas se integran tras revisión de licencia y mediante adapter/worker.
- Primera familia: imágenes; luego glTF/GLB; luego audio.

### IA

- IA genera `GenerationPlan` y `ContentGraph` JSON contra schemas, nunca assets visuales/sonoros/3D.
- Todo proveedor implementa `AiProviderPort` y puede sustituirse por fake/local/remoto.
- WorldBible y restricciones son contexto autoritativo versionado.
- Validadores y simuladores deterministas deciden validez; modelo no se autocertifica.
- Mutación requiere preview/diff y confirmación humana; commit es transacción deshacible.
- Prompt, modelo, versión, seed cuando exista y hashes de contexto quedan en procedencia, sujetos a política de privacidad.

## Ejecución por plataforma

- Desktop: jobs locales mediante commands/sidecars; ONNX local cuando modelo/licencia/hardware lo permitan.
- Web: inferencia ligera opcional en navegador; jobs pesados en workers aislados.
- Un job declara `executionTarget`, coste estimado, datos enviados y capacidad de cancelación.

## Opciones rechazadas

- Modificar originales: riesgo de pérdida irreversible.
- Lógica IA incrustada en UI: imposible probar/reemplazar.
- Texto libre como formato de proyecto: referencias y migraciones no verificables.
- Un microservicio por transformación desde inicio: coste operacional prematuro.
- Generación de imágenes: contradice alcance; pipeline transforma assets aportados.

## Seguridad

- MIME detectado por contenido; tamaño/dimensiones/duración/polígonos limitados.
- Archivos se procesan fuera de rutas autoritativas y con nombres internos.
- Timeouts, memoria/CPU/cuota y cancelación por job.
- Secretos de proveedor nunca se guardan en proyecto ni frontend Web.
- Logs no incluyen prompts/assets completos por defecto.
- Outputs se escanean y validan antes de descargar/publicar.

## Consecuencias

- Más almacenamiento temporal, compensado por deduplicación y limpieza.
- Reproducibilidad de IA es semántica y auditada, no promesa bit a bit.
- Consistencia mejora por schemas/simulación, pero siempre requiere revisión humana.
- Adapters permiten cambiar modelos/codecs sin migrar UI o documentos.

## Evidencia y fuentes

- [ONNX Runtime JavaScript](https://onnxruntime.ai/docs/get-started/with-javascript/) ofrece API unificada para Web y Node; su [matriz Web](https://onnxruntime.ai/docs/get-started/with-javascript/web.html) diferencia WASM/WebGPU y navegadores soportados.
- [glTF Transform](https://gltf-transform.dev/) soporta deduplicación, resize, compresión Draco/Meshopt y texturas WebP/KTX2.
- Herramientas concretas de audio, remoción de fondo, upscale y codecs quedan pendientes de spike/licencia; ADR no las congela.

## Condición de aceptación

T1 debe demostrar receta de imagen no destructiva, cancelación, manifiesto y paridad de contratos Web/Desktop. T5 debe pasar fake-provider con JSON inválido, referencias rotas y simulación fallida sin mutar proyecto.

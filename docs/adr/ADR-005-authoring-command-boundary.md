# ADR-005: comandos tipados como frontera de autoría y automatización

**Estado:** Aceptado
**Fecha:** 21 de julio de 2026
**Decisores:** propietario del proyecto; aprobado el 21 de julio de 2026

## Contexto

Mosaico debe unir edición manual de pixel art y tilemaps con nodos, proceduralidad, WFC, scripting y control por chat. Si cada superficie muta documentos directamente, historial, validación, determinismo y permisos divergirán. También sería imposible explicar o deshacer una acción iniciada por IA.

## Decisión

Toda mutación autoritativa de mapa o sprite atraviesa un registro de comandos tipados:

- cada comando declara ID estable, versión, schema de parámetros y capacidades necesarias;
- valida antes de mutar y aplica una transacción atómica;
- produce inversa o delta suficiente para undo/redo;
- registra procedencia: usuario, nodo, script, generador o IA;
- opera sobre snapshots de dominio, nunca sobre componentes React/PixiJS;
- nodos, macros, scripts y chat solo pueden solicitar comandos registrados.

En T2 solo usuario/UI invoca comandos. Runtime de nodos, scripting y chat permanece deshabilitado hasta threat model, permisos, cuotas y gates propios.

## Alternativas consideradas

### Mutación directa desde cada herramienta

- Menos código inicial.
- Rechazada: duplica validación, rompe undo uniforme y hace difícil auditar IA/scripts.

### Event sourcing completo desde T2

- Historial y sincronización potentes.
- Rechazada ahora: complejidad prematura para producto local; comandos serializables permiten migrar después.

### Plugins con acceso al documento

- Máxima flexibilidad.
- Rechazada: plugins podrían saltarse invariantes, exfiltrar datos o crear estados irreparables.

### Comandos tipados con adapters futuros

- Algo más de disciplina inicial.
- Elegida: una sola frontera sirve a UI, nodos, WFC, scripts e IA sin acoplar dominio a ninguno.

## Consecuencias

Positivas:

- Undo/redo y validación consistentes.
- Automatización reproducible y explicable.
- Menor superficie de permisos para extensiones.
- Chat IA propone acciones estructuradas; no toca estado libremente.

Costes:

- Cada capacidad necesita schema, handler e inversa/delta.
- Operaciones grandes requieren compresión de historial y límites.
- Cambios de schema necesitan migraciones/versiones de comando.

## Invariantes

1. Comando inválido no cambia revisión.
2. Cancelación antes de commit no produce mutación parcial.
3. `apply → undo` restaura hash semántico salvo comando explícitamente irreversible, prohibido en T2.
4. Renderer nunca escribe dominio.
5. Proveedores IA, scripts y plugins no obtienen referencia mutable al documento.

## Gate

T2 debe probar comandos de stroke, fill, layers y tilesets; undo/redo; procedencia; rechazo por schema; y estado intacto tras fallo/cancelación. Aprobación de ADR-005 forma parte de aprobación SPEC/PLAN T2.

# Contratos F0 del spike ortogonal

**Estado:** experimental; evidencia para O2, no contrato público

## Hilo de documento y jobs — DOC-011

El host WPF modifica `MapDocument` solo desde hilo UI mediante comandos. Renderer lee estado y nunca muta documento. Este spike no ejecuta jobs. Cuando aparezcan, recibirán snapshot inmutable + revisión base y devolverán delta; dispatcher aplicará delta en orden total si revisión sigue válida. Cancelación antes de aplicar no produce cambios. Reentrancia y conflictos requieren spike posterior antes de Fase 1.

## Espacio ortogonal — DOC-012

- Celda: enteros `(x,y)`, X crece a derecha, Y crece hacia abajo.
- Mundo: `double`, origen de celda `(x*32,y*32)` en spike.
- Pantalla: origen superior izquierdo del viewport.
- Cámara: posición mundo en centro del viewport; no persistente.
- Picking: `floor(world/cellSize)`, por ello `-0,01` pertenece a celda `-1`.
- Chunk futuro: `floorDiv`/`floorMod`; local siempre `0 <= local < chunkSize`.
- Zoom: 0,25×…4×, centrado en cursor.

Pruebas ejecutables cubren inversión pantalla/mundo y negativos. Iso/hex siguen abiertos.

## Formato experimental — DOC-013

Archivo UTF-8 JSON con `format=mosaico-map`, `formatVersion=0`, GUID, nombre, ancho/alto de referencia y celdas dispersas ordenadas `(x,y,tileId)`. Límites activos: 64 MiB, profundidad 64, 1.000.000 celdas, dimensiones 1…16.384 y tile ID positivo. Duplicados se rechazan. Campos desconocidos quedan inertes/ignorados; no existe promesa de preservación forward ni migración.

## Atomicidad — DOC-014

Decisión del spike: archivo único. Serializa a temporal oculto en mismo directorio, reabre/valida, hace flush a disco y reemplaza destino con `File.Replace`, conservando `.bak`. Si destino no existe, mueve temporal. Fallo limpia temporal. El protocolo multifichero sigue abierto entre journal y manifest generations; este spike no lo prueba ni lo promete.

## Benchmark — DOC-015

Runner Release: `tests/Mosaico.Benchmarks`. Treinta muestras después de cinco warmups. Registra commit, SDK/runtime, OS, arquitectura, procesadores lógicos, memoria disponible, tamaño fixture y p50/p95/p99/máximo para pincel+undo y carga JSON. GPU y escala quedan `unavailable/manual` si el sistema no permite consultarlas; un baseline incompleto no aprueba presupuesto gráfico.

## Estado O2

DOC-010 tiene ADR-001 condicionado. DOC-011…015 poseen contratos mínimos y prueba ortogonal, pero faltan comparador multiplataforma, jobs, iso/hex, fault injection multifichero, GPU/escala y CI multi-OS. O2 y Fase 1 permanecen abiertos.

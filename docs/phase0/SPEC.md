# Especificación ejecutable: spike manual F0

**Estado:** aprobado para implementación por instrucción del 19 de julio de 2026
**Alcance:** Ola 1, contratos mínimos de Ola 2 y primer slice manual comprobable
**No implica:** aprobación de UI final, formato estable, compatibilidad externa ni Fase 1 completa

## Objetivo

Entregar un programa Windows que permita validar el camino crítico de Mosaico: crear un mapa ortogonal, pintar y borrar celdas —incluidas coordenadas negativas—, deshacer/rehacer, guardar de forma atómica y reabrir sin pérdida.

Usuario primario provisional: creador independiente o diseñador de niveles 2D con experiencia básica/intermedia en tilemaps, escritorio Windows 11, teclado y mouse, que trabaja solo o en equipo pequeño. El spike valida ingeniería y flujo; no sustituye una ronda con cinco usuarios externos.

## Criterios de éxito

- La aplicación abre sin IDE y muestra un viewport ortogonal interactivo.
- Pincel y borrador generan comandos reversibles; una pincelada es una transacción.
- Undo/redo restaura exactamente el estado estructural.
- Pan, zoom centrado en cursor y picking funcionan también en coordenadas negativas.
- Guardar usa archivo temporal en mismo directorio, validación, flush y reemplazo; reabrir conserva ID, dimensiones y celdas.
- Abrir rechaza JSON fuera de límites con diagnóstico; nunca ejecuta scripts o plugins.
- Suite automática, build Release y guion manual MG-01 quedan versionados.
- Primer benchmark registra entorno, fixture, muestras y p50/p95/p99 sin afirmar soporte multiplataforma.

## Stack

- SDK: .NET `10.0.300`, fijado mediante `global.json`.
- Dominio/aplicación/persistencia: C# `net10.0`, sin referencias de UI.
- Host de spike: WPF `net10.0-windows`, solo Windows, reemplazable.
- Renderer del spike: `DrawingContext`; no se considera renderer final.
- Dependencias externas: ninguna para el primer slice.

## Comandos

```powershell
dotnet build DesktopApp/LegacyWpf/ProyectoMosaico.slnx -c Release
dotnet run --project DesktopApp/LegacyWpf/tests/Mosaico.Core.Tests/Mosaico.Core.Tests.csproj -c Release
dotnet run --project DesktopApp/LegacyWpf/src/Mosaico.App/Mosaico.App.csproj -c Release
powershell -ExecutionPolicy Bypass -File scripts/manual-gate.ps1
```

## Estructura

```text
DesktopApp/LegacyWpf/src/Mosaico.Core/  dominio, comandos y persistencia
DesktopApp/LegacyWpf/src/Mosaico.App/   shell WPF descartable del spike
DesktopApp/LegacyWpf/tests/Mosaico.Core.Tests/  runner de pruebas sin paquetes externos
fixtures/phase0/                  proyectos y entradas versionadas
docs/adr/                         decisiones y alternativas
docs/phase0/                      spec, plan y evidencia
docs/manual/                      walkthroughs humanos
scripts/                          build y gates reproducibles
```

## Estilo

- Tipos persistentes inmutables o con mutación encapsulada.
- `GridCoordinate` usa enteros; pantalla/mundo usa `double`.
- Resultados esperables devuelven diagnóstico; excepciones quedan para invariantes o I/O inesperado.
- UI llama casos de uso; renderer no modifica documento.
- Nombres de código en inglés; texto visible y documentación en español.

```csharp
public readonly record struct GridCoordinate(int X, int Y);

public interface IEditorCommand
{
    void Execute(MapDocument document);
    void Undo(MapDocument document);
}
```

## Estrategia de pruebas

- Unitarias: coordenadas, comandos, hash estructural y límites.
- Integración: round-trip JSON y reemplazo atómico.
- Smoke: build del host WPF y arranque manual.
- Gate humano: MG-01 con evidencia del mismo commit.
- Benchmark: 30 muestras en Release, warm-up separado, p50/p95/p99 y entorno registrado.

## Límites

Siempre: pruebas antes de commit, rutas confinadas, archivos temporales en mismo volumen y telemetría inexistente.
Preguntar antes: dependencias externas, formato público, cambio de stack final, CI externo o distribución.
Nunca: clonar/copy-pastear Tiled, WFC o Aseprite; ejecutar scripts/plugins desde proyectos; guardar fuera de ruta elegida; llamar al spike “multiplataforma”.

## Fuera de alcance del primer ejecutable

Tilesets reales, fill, capas múltiples, exportación CSV/PNG, semántica, reglas, PCG, WFC, plugins, autosave, colaboración y packaging instalable. Permanecen en fases posteriores; MG-01 reducido solo prueba capacidad implementada.

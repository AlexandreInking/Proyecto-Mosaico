# Política de referencias upstream

**Estado:** Activa desde T2 Ola C
**Objetivo:** acelerar Mosaico sin contaminar producto comercial ni ocultar procedencia.

## Reglas

- Usar Aseprite y Tiled como referencia de comportamiento, flujos, atajos y cobertura funcional.
- Implementar código Mosaico en TypeScript/Rust, con convención única del repositorio y pruebas propias.
- No copiar, traducir mecánicamente, ofuscar ni renombrar código para disimular similitud.
- Toda dependencia o fragmento reutilizado exige licencia compatible, archivo `NOTICE`, origen y versión/commit.
- Formatos públicos se implementan desde su especificación: Aseprite file format cuando corresponda y TMX/TSX/JSON de Tiled.
- Algoritmos generales se implementan desde bibliografía o especificaciones; nunca desde código incompatible.

## Decisión por upstream

### Aseprite

Repositorio principal bajo EULA. Se permite estudiar producto y documentación para paridad funcional. No se incorpora código EULA. Un submódulo declarado MIT solo podrá evaluarse mediante revisión de licencia y límites antes de importarlo.

### Tiled

Aplicación principal GPL-2.0 o posterior. No se integra su código dentro de WebApp/DesktopApp comerciales. Se admite interoperabilidad mediante TMX/TSX/JSON, documentación oficial y extensiones MIT verificadas.

## Convención Mosaico

- Tipos/componentes/clases: `PascalCase`.
- Variables, funciones y atributos: `camelCase`.
- Constantes globales: `UPPER_SNAKE_CASE` solo para valores realmente constantes.
- IDs serializados y nombres de contrato: inglés estable.
- Texto de interfaz: español mediante capa de mensajes; no incrustar terminología interna upstream.

## Cadencia de entrega

Checkpoint solo después de una vertical ejecutable en Web y Desktop. Trabajo interno puede abarcar varios tickets sin pedir aprobación intermedia. Cada entrega humana debe mostrar función integrada, instrucciones exactas y límites pendientes.

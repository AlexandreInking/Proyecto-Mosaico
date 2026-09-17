# Navegación, arranque, instalador y documentación

## Objetivo

Entregar Mosaico Desktop con navegación limpia, apertura directa, instalador visual propio y un manual exhaustivo limitado a funciones verificadas en código.

## Tareas

- [x] Quitar `Exportar` de la navegación y ocultar `Jobs` cuando `platform === 'Desktop'`. Verificar con tests de `AppShell`.
- [x] Sustituir el launcher que recompila por apertura directa del ejecutable y añadir launcher sin consola. Verificar que ningún launcher invoque `tauri build`.
- [x] Crear wrapper NSIS personalizado que encapsule silenciosamente el instalador Tauri y produzca un único setup visible. Verificar compilación con `makensis`.
- [x] Añadir comando reproducible para construir el instalador personalizado. Verificar salida `.exe` y códigos de error.
- [x] Inventariar Assets, Editor, Pipelines, Maps, workspace, formatos y localización desde implementación/tests. Verificar cada capacidad contra código activo.
- [x] Escribir manual detallado sin Jobs, Export ni nodos backlog. Verificar búsquedas de términos inactivos y enlaces locales.
- [x] Actualizar pruebas de navegación, launcher e instalador. Verificar `pnpm test` y `pnpm typecheck`.
- [x] Ejecutar `pnpm build`, build del instalador y `git diff --check`.

## Terminado cuando

- [x] Desktop muestra `Assets`, `Editor`, `Pipelines` y `Maps`; Web no muestra `Exportar`.
- [x] Abrir el binario no ejecuta compilaciones ni muestra consola auxiliar.
- [x] Existe un único instalador personalizado compilado.
- [x] El manual solo describe funciones activas y verificadas.

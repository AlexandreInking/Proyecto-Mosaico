# Auditoría documental y técnica — Hito 1.1

**Corte:** 3 de agosto de 2026  
**Repositorio:** `C:\Users\Intel\Desktop\Proyecto_Mosaico`  
**Referencia de código:** `80131ed`  
**Objetivo auditado:** release descargable Desktop Windows

## Veredicto

El código Desktop ya contiene un vertical slice funcional con Tauri 2, UI local, workspace `.mws`, assets, editor, pipelines, mapas e instalador NSIS. El principal riesgo encontrado era de alcance: README, ADR y documentos de transformación describían una plataforma dual mientras la decisión actual exige Desktop-only.

La autoridad de release queda fijada en:

1. `docs/alpha-0.1/HITO_1_1.md`.
2. `docs/MANUAL_FUNCIONAL_ACTUAL.md`.
3. `DesktopApp/src-tauri/tauri.conf.json` y pruebas `tests/t2/desktop-*.test.mjs`.

Los documentos de `docs/transformation/`, `docs/adr/` y `docs/phase1/` se conservan como historial de decisiones o baseline; no amplían el alcance del instalador.

## Hallazgos

| ID | Prioridad | Hallazgo | Acción | Estado |
|---|---|---|---|---|
| AUD-01 | P0 | La documentación mezclaba producto Desktop con WebApp. | README, manual y contrato del hito declaran Desktop-only. | Resuelto |
| AUD-02 | P1 | No existía ficha única para Alpha 0.1/Hito 1.1. | Se añadió `HITO_1_1.md` con entrega, límites y salida. | Resuelto |
| AUD-03 | P1 | El instalador exige prueba humana en Windows limpio. | Mantener como `PENDING_HUMAN`; no presentar alpha como estable. | Pendiente |
| AUD-04 | P1 | Documentos de marketing no versionados referencian cortes anteriores. | Usarlos como material de lanzamiento, no como autoridad técnica; actualizar su snapshot antes de publicar. | Pendiente |
| AUD-05 | P2 | WPF y transformación aparecen junto al producto actual. | Etiquetarlos como baseline/histórico; no eliminarlos porque conservan trazabilidad. | Resuelto |
| AUD-06 | P2 | El monorepo conserva WebApp y sus pruebas. | No incluirlo en build, instalador ni soporte del Hito 1.1. | Resuelto |

## Coherencia verificada

- `package.json`, `DesktopApp/app/package.json` y `DesktopApp/src-tauri/tauri.conf.json`: `0.2.20`.
- `tauri.conf.json`: target `nsis`, `installMode=currentUser`, iconos y branding de Mosaico.
- `scripts/build-custom-installer.ps1`: produce `DesktopApp/dist/mosaico-setup-$version.exe`.
- `scripts/start-desktop.ps1`, `Mosaico.cmd` y `Mosaico.vbs`: abren `mosaico-desktop.exe` compilado.
- Pruebas existentes cubren branding, wrapper NSIS, launcher y drag/drop Desktop.

## Riesgos restantes

- El instalador puede compilar correctamente y aun así requerir validación en un Windows limpio.
- El updater está configurado, pero no demuestra que exista publicación externa activa.
- `0.2.20` es la versión técnica observada; “Alpha 0.1” es nombre de hito, no una segunda versión del instalador.

## Próximo gate

Ejecutar el build Desktop, calcular SHA-256 y completar el checklist humano: instalar, abrir, importar, editar, guardar `.mws`, cerrar, reabrir, exportar y desinstalar.

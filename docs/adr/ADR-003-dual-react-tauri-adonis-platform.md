# ADR-003: plataforma dual React, Tauri y AdonisJS

**Estado:** Propuesto  
**Fecha:** 19 de julio de 2026  
**Decisores:** aprobación humana pendiente

## Contexto

Producto debe existir como WebApp online y DesktopApp local con misma UI. Baseline actual usa WPF/.NET y solo Windows. Nueva dirección necesita canvas acelerado, acceso nativo local, API web, jobs pesados y máximo código compartido.

## Fuerzas

- Una sola implementación visual.
- App local ligera, segura y offline.
- Web escalable sin acoplar dominio a HTTP.
- Capacidad de ejecutar conversores/IA local o remota.
- Menor coste inicial sin cerrar evolución.
- Migración reversible desde baseline WPF funcional.

## Opciones evaluadas

1. **React/Vite + Tauri 2 + AdonisJS API.** UI común, shell nativo pequeño, sidecars y backend TypeScript.
2. React/Vite + Electron + AdonisJS. UI común y Node integrado, pero Chromium/Node embebidos aumentan tamaño, memoria y superficie de seguridad.
3. Avalonia/.NET + frontend web separado. Reutiliza dominio C#, pero obliga a dos UIs.
4. PWA solamente. Menor esfuerzo, pero acceso local, codecs, modelos grandes y distribución offline quedan limitados.

## Decisión

Adoptar:

- React + TypeScript estricto para UI y composición.
- Vite para builds SPA de WebApp y frontend Tauri.
- PixiJS 8 para viewports 2D, previews espaciales y grafos; DOM React para controles accesibles.
- Tauri 2 para DesktopApp.
- AdonisJS API-only para backend WebApp.
- Workspaces compartidos para contratos, dominio, pipeline, canvas y UI.
- PostgreSQL, object storage y workers solo cuando T8 los necesite; no en bootstrap.

No usar SSR para editor. Marketing/documentación pública puede ser app separada futura.

## Límites

- React nunca llama APIs Tauri directamente; usa puertos.
- Backend no importa componentes UI.
- Tauri commands validan inputs y exponen capabilities mínimas.
- Procesamiento pesado vive en worker/sidecar aislado; no en thread UI ni request HTTP largo.
- Web y Desktop declaran capabilities; UI no finge paridad donde plataforma no la permite.

## Consecuencias

Positivas:

- UI realmente compartida.
- Tauri permite binario más ligero que Electron y sidecars para herramientas no Rust.
- Un lenguaje principal reduce duplicación de contratos.
- PixiJS ofrece renderer WebGL/WebGPU compatible con navegador y shells web.

Costes:

- Toolchain Rust + Node para Desktop.
- Algunas librerías de procesamiento necesitarán binarios por plataforma.
- Dominio C# actual debe portarse o encapsularse durante transición.
- AdonisJS y workers requieren operación separada al madurar WebApp.

## Migración y reversión

Crear nueva estructura junto a baseline. Mover WPF a `DesktopApp/LegacyWpf` conservando historial. No eliminarlo hasta gate T2. Si Tauri bloquea requisito crítico demostrado, UI React sigue reutilizable en Electron; cambio de shell no afecta dominio/UI.

## Evidencia y fuentes

- [Tauri: frontend configuration](https://v2.tauri.app/start/frontend/) documenta frontend agnóstico, Vite para SPA y ausencia de SSR nativo.
- [Tauri: sidecars](https://v2.tauri.app/develop/sidecar/) permite empaquetar binarios auxiliares escritos en otros lenguajes.
- [PixiJS v8](https://pixijs.com/8.x/guides/getting-started/intro) soporta WebGL/WebGPU y ejecución en navegador/Tauri/Electron.
- [AdonisJS](https://docs.adonisjs.com/introduction) es backend TypeScript para APIs/SaaS; su [instalación](https://docs.adonisjs.com/installation) incluye starter API.
- [Electron: seguridad](https://www.electronjs.org/docs/latest/tutorial/security) documenta aislamiento y riesgo de contenido remoto; [Why Electron](https://www.electronjs.org/docs/latest/why-electron) confirma Chromium, V8 y Node embebidos.
- [React: retirada de Create React App](https://react.dev/blog/2025/02/14/sunsetting-create-react-app) admite setup personalizado con Vite.

## Condición de aceptación

Spike T0 debe arrancar mismo shell en navegador y Tauri, medir tamaño/arranque y probar filesystem adapter. Fallo bloqueante reabre solo elección de shell, no React ni contratos.

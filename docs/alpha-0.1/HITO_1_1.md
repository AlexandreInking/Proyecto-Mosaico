# Alpha 0.1 — Hito 1.1: Desktop Windows descargable

**Corte:** 3 de agosto de 2026  
**Producto:** Mosaico Desktop para Windows  
**Versión técnica:** 0.2.20  
**Estado:** build disponible; gate manual de Windows pendiente

## Decisión de alcance

El producto de este hito es un programa descargable para Desktop Windows. La aplicación usa React/TypeScript dentro de Tauri 2, opera localmente y no necesita WebApp, API, Node.js, pnpm ni Rust en el equipo final.

`WebApp/client` y `WebApp/server` permanecen en el monorepo como superficie técnica histórica. No forman parte del instalador, del flujo de usuario, del soporte ni de los criterios de salida de este hito.

## Entrega

| Artefacto | Ubicación | Estado |
|---|---|---|
| Instalador branded NSIS | `DesktopApp/dist/mosaico-setup-0.2.20.exe` | Disponible |
| Configuración Desktop | `DesktopApp/src-tauri/tauri.conf.json` | Verificada |
| Wrapper de instalación | `DesktopApp/installer/MosaicoInstaller.nsi` | Verificado por pruebas |
| Lanzador Windows | `Mosaico.cmd` → `Mosaico.vbs` → binario Tauri | Verificado por pruebas |
| Manual funcional | `docs/MANUAL_FUNCIONAL_ACTUAL.md` | Actualizado |

## Flujo alpha cubierto

1. Instalar para el usuario actual sin permisos de administrador.
2. Abrir Mosaico desde el acceso directo o `Mosaico.cmd`.
3. Importar y catalogar PNG/GIF.
4. Editar Pixel Art y frames.
5. Crear y evaluar pipelines locales.
6. Crear mapas ortogonales con tilesets.
7. Guardar y reabrir un workspace `.mws`.
8. Exportar resultados neutrales.

## Criterios de salida

- [x] Versiones raíz, Desktop y Tauri alineadas en `0.2.20`.
- [x] Bundle configurado para Windows/NSIS con branding de Mosaico.
- [x] El lanzador abre el binario compilado y no ejecuta builds.
- [x] El producto funciona con almacenamiento y procesamiento local.
- [x] La documentación declara Desktop como única superficie de producto.
- [ ] Ejecutar instalación, apertura, guardado, cierre, reapertura y desinstalación en Windows limpio.
- [ ] Registrar operador, sistema, capturas y SHA-256 del instalador final.

## No incluido

WebApp/SaaS, cuentas, nube, colaboración, pagos, DRM, IA generativa, audio, 3D, WFC completo, importadores maduros de engines y soporte oficial para Linux/macOS.

## Comandos de release

```powershell
pnpm installer:build
Get-FileHash DesktopApp/dist/mosaico-setup-0.2.20.exe -Algorithm SHA256
```

El gate automático del hito valida estructura, branding, launcher y compilación. La instalación real en Windows limpio sigue siendo una verificación humana.

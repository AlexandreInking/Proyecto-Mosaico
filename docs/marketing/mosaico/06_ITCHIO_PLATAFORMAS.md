# Mosaico — publicación en itch.io y otras plataformas

## Decisión inicial

Publicar una página **pública, de pago y sin demo separada**:

- Nombre: `Mosaico — 2D Asset Workspace`.
- Precio mínimo: **US$14.99**.
- Plataforma incluida: **Windows Desktop**.
- Estado: `Alpha / Early Access` solo si la página explica riesgos y límites.
- Archivo: instalador Windows probado y, si se valida, ZIP portable.
- Testers: diez download keys individuales; ver [`08_CODIGOS_ITCHIO.md`](08_CODIGOS_ITCHIO.md).

itch.io permite fijar precio mínimo y usar download keys para conceder acceso sin pago. Las claves pueden etiquetarse, seguir usos y revocarse; no son DRM ni eliminan copias locales. [Pricing](https://itch.io/docs/creators/pricing) · [Download keys](https://itch.io/docs/creators/download-keys) · [FAQ](https://itch.io/docs/creators/faq)

## Checklist antes de publicar

- [ ] Build Windows hecha desde un estado versionado.
- [ ] Instalación, apertura, guardado, cierre, reapertura, exportación, reparación y actualización probados en Windows limpio.
- [ ] SHA-256 del instalador registrado.
- [ ] `README`, changelog, licencia, terceros, requisitos y canal de bugs incluidos.
- [ ] Cover 630×500 o equivalente, cinco screenshots y video/GIF real.
- [ ] Página dice `Windows only`.
- [ ] Lista “Works now”, “Experimental”, “Known issues” y “Not supported”.
- [ ] Precio US$14.99 y política de alpha visibles antes del checkout.
- [ ] Diez claves etiquetadas y entregadas sin publicarlas en repositorio o post público.
- [ ] Página probada como comprador y como tester con una clave.

## Copy de página itch.io

### Short description

`Import, edit, transform, and connect sprites, tilesets, and maps in a local 2D asset workspace.`

### Descripción principal

> Mosaico is a local-first workspace for 2D game assets. Import an image, edit or transform it, use it in a tileset or orthogonal map, and save the workspace with the source and result kept together.

### Secciones obligatorias

1. **What works now** — Assets, Pixel Art, Pipelines, Maps, local workspace.
2. **Five-minute workflow** — fixture → tilesheet → map → export.
3. **Formats and limits** — `.mws`, `.mpe`, `.mpl`, `.mtm`, image limits.
4. **Experimental** — alpha status and incomplete edges.
5. **Known issues** — exact blockers.
6. **Not supported** — no cloud, accounts, AI generation, audio/3D or universal engine importers.
7. **Requirements** — Windows version, disk, display and input assumptions.
8. **Support** — GitHub Issues with reproduction steps.
9. **Roadmap** — hypotheses, not promises.
10. **Credits and licenses** — product and third-party notices.

## Otras plataformas

| Canal | Uso | Orden | Condición |
|---|---|---:|---|
| **itch.io** | Checkout, download y comunidad indie | 1 | Página pública, build real y soporte. |
| **GitHub Releases** | Changelog, hashes, mirrors técnicos y updater | 1b | No usar como único acceso pagado: los assets públicos no tienen entitlement. [Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases) |
| **Sitio propio** | Landing, docs, SEO y soporte | 2 | Enlazar a itch primero; no construir checkout propio todavía. |
| **Product Hunt** | Descubrimiento y feedback | 3 | Solo con página itch funcional; no aloja binario ni sustituye venta. [Launch](https://www.producthunt.com/launch) |
| **WinGet** | Instalación y descubrimiento Windows | 4 | Instalador versionado, URL HTTPS, SHA-256, silencioso, desinstalación correcta y PR/validación. [Manifest](https://learn.microsoft.com/en-us/windows/package-manager/package/manifest) · [Submission](https://learn.microsoft.com/en-us/windows/package-manager/package/repository) |
| **Microsoft Store** | Distribución/comercio Windows | 5 | Firma CA-trusted para EXE/MSI y certificación. [First app](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/publish-first-app) |
| **Gumroad** | Checkout y license keys futuros | 6 | Solo si itch no cubre ventas/licencias; 10% + US$0.50 directo y 30% Discover. [Pricing](https://gumroad.com/pricing) · [License keys](https://gumroad.com/help/article/76-license-keys) |
| **Steam** | Descubrimiento y actualizaciones | 7 | Esperar producto más estable; Steam Direct cobra US$100 por app, recuperable tras US$1.000 de ingresos ajustados. [Fee](https://partner.steamgames.com/doc/gettingstarted/appfee) |
| **Flathub** | Linux nativo | No ahora | No existe build Linux mantenida; beta Windows no encaja. [Requirements](https://docs.flathub.org/docs/for-app-authors/requirements) |

Godot Asset Library y Unity Asset Store son canales futuros para plugins/importadores, no para el binario Mosaico.

## Secuencia de lanzamiento

1. Crear proyecto itch en modo borrador.
2. Subir build y probar acceso como comprador.
3. Generar diez keys, asignarlas y registrar estado.
4. Invitar testers con una tarea reproducible.
5. Corregir P0/P1 de instalación y primer flujo.
6. Mantener página pública y precio US$14.99.
7. Publicar changelog semanal durante el primer mes.
8. Hacer Product Hunt solo cuando la página y descarga no requieran ayuda manual.
9. Evaluar WinGet/Store/Steam con criterios de estabilidad, no por vanidad de canales.

## Fuentes y cautelas

- itch usa revenue sharing configurable y también cobra procesadores; verificar configuración antes de anunciar neto. [Payments](https://itch.io/docs/creators/payments)
- GitHub Releases publica archivos; no administra compra, reembolso ni licencia de Mosaico.
- WinGet es instalación, no paywall.
- Steam y Microsoft Store son lanzamientos independientes; las claves itch no se transfieren automáticamente.


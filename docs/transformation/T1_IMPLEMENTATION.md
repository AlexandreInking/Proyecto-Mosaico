# T1 — Estado de implementación

## Entregado

- Importación real PNG/JPEG/WebP con selección múltiple y drag/drop.
- Validación por MIME declarado, firma binaria, límite 50 MB y presupuesto 67 megapíxeles.
- SHA-256, metadata, thumbnails pixel-perfect y deduplicación por contenido.
- Catálogo y blobs originales persistidos en IndexedDB; receta persistida localmente.
- Receta tipada no destructiva `resize -> convert`, PNG/JPEG/WebP y manifiesto de procedencia.
- Job con progreso, estado, cancelación cooperativa y salida no confirmada al cancelar.
- Consola de diagnósticos agrupada por código/causa/mensaje.
- Exportación separada de imagen y manifiesto; eliminación durable de asset.
- UI React única compartida por WebApp y DesktopApp.

## Evidencia automática

- Contratos Zod para asset, receta, job, diagnóstico y manifiesto.
- Pruebas de receta, formatos, magic bytes y agrupación.
- Pruebas SSR de contrato UI dual.
- Gate reproducible `pnpm gate:t1`.

## Evidencia de navegador del 20-07-2026

- Fixture `fixtures/phase1/atlas-16.png` importado: 32×32, 246 B, SHA-256 visible.
- Resize/conversión produjo preview y hash de salida distinto.
- Recarga restauró asset desde IndexedDB.
- Dos Markdown produjeron un grupo `IMAGE_IMPORT ×2`.
- Cero warnings/errores de consola del navegador.

## Pendiente humano

Completar `docs/manual/MG-T1-image-pipeline.md` en Web y Desktop. T1 no se declara cerrado hasta ambos PASS.

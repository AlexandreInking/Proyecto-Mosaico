# T1 — Estado de implementación

## Entregado

- Importación real PNG/JPEG/WebP con selección múltiple y drag/drop.
- Validación por MIME declarado, firma binaria, límite 50 MB y presupuesto 67 megapíxeles.
- SHA-256, metadata, thumbnails pixel-perfect y deduplicación por contenido.
- Catálogo y blobs originales persistidos en IndexedDB; receta persistida localmente.
- Receta DAG tipada y validada; rechaza dependencias ausentes, IDs duplicados y ciclos.
- Resize pixel-perfect determinista por vecino más cercano, conversión PNG/JPEG/WebP y manifiesto de procedencia.
- Cola FIFO observable con progreso, cancelación cooperativa y salida no confirmada al cancelar.
- Consola de diagnósticos agrupada por código/causa/mensaje.
- Exportación separada de imagen y manifiesto; eliminación durable de asset.
- UI React única compartida por WebApp y DesktopApp.

## Evidencia automática

- Contratos Zod para asset, receta, job, diagnóstico y manifiesto.
- Pruebas de DAG, resize exacto, formatos, magic bytes, agrupación, FIFO y cancelación.
- Pruebas SSR y estructurales del contrato UI/pipeline dual.
- Benchmark versionado: 512×512 a 2048×2048, siete muestras, commit y entorno registrados.
- Gate reproducible `pnpm gate:t1`; construye Web/API y binario Tauri ligado al commit.

## Evidencia automática y de ejecución del 21-07-2026

- Fixture `fixtures/phase1/atlas-16.png` importado: 32×32, 246 B, SHA-256 visible.
- Resize/conversión 32×32 a 128×128 produjo preview y hash de salida distinto.
- Recarga restauró asset desde IndexedDB.
- Dos Markdown produjeron un grupo `IMAGE_IMPORT ×2`.
- Cero warnings/errores de consola del navegador.
- WebApp y API respondieron HTTP 200; manifiesto incluyó `interpolation=nearest`, DAG, hashes y dimensiones.
- Binario Tauri empaquetado abrió con UI compartida, modo `Local`, tema correcto y sin superposiciones visibles.
- Gate completo: 8 pruebas estructurales, 4 contratos, 15 pipeline, 2 UI, 1 API y 1 Rust; builds y auditoría sin vulnerabilidades conocidas.
- Benchmark Windows x64/Node 24: p50 18.713 ms, p95 21.302 ms.

## Pendiente humano

Completar `docs/manual/MG-T1-image-pipeline.md` en Web y Desktop. T1 no se declara cerrado hasta ambos PASS.

import type { AssetRecord, DerivedAssetManifest, Recipe } from '@mosaico/contracts'
import { assetSchema, derivedAssetManifestSchema, recipeSchema } from '@mosaico/contracts'
import { isSupportedImageType, type SupportedImageType } from './formats.js'
import { resizeNearestRgba } from './pixel-resize.js'
import { orderRecipeSteps } from './recipe-graph.js'

export interface ImportedImage {
  record: AssetRecord
  original: Blob
  thumbnail: Blob
}

export interface ProcessedImage {
  blob: Blob
  manifest: DerivedAssetManifest
}

export interface ProcessOptions {
  signal?: AbortSignal
  onProgress?: (progress: number) => void
}

const MAX_SOURCE_BYTES = 50 * 1024 * 1024
const MAX_PIXELS = 67_108_864

export function detectImageType(bytes: Uint8Array): SupportedImageType | undefined {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp'
  return undefined
}

function assertNotCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Operación cancelada', 'AbortError')
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

export async function sha256(blob: Blob): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))
}

function canvasToBlob(canvas: HTMLCanvasElement, mediaType: SupportedImageType, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== mediaType) reject(new Error(`El navegador no pudo codificar ${mediaType}.`))
      else resolve(blob)
    }, mediaType, quality)
  })
}

async function renderToBlob(source: ImageBitmap, width: number, height: number, mediaType: SupportedImageType, quality: number, smoothing: boolean): Promise<Blob> {
  const resizedCanvas = document.createElement('canvas')
  resizedCanvas.width = width
  resizedCanvas.height = height
  const resizedContext = resizedCanvas.getContext('2d')
  if (!resizedContext) throw new Error('Canvas 2D no está disponible.')

  if (smoothing) {
    resizedContext.imageSmoothingEnabled = true
    resizedContext.drawImage(source, 0, 0, width, height)
  } else {
    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = source.width
    sourceCanvas.height = source.height
    const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true })
    if (!sourceContext) throw new Error('Canvas 2D no está disponible.')
    sourceContext.drawImage(source, 0, 0)
    const sourcePixels = sourceContext.getImageData(0, 0, source.width, source.height)
    const resizedPixels = resizeNearestRgba(sourcePixels.data, source.width, source.height, width, height)
    resizedContext.putImageData(new ImageData(resizedPixels, width, height), 0, 0)
  }

  if (mediaType !== 'image/jpeg') return canvasToBlob(resizedCanvas, mediaType, quality)

  const jpegCanvas = document.createElement('canvas')
  jpegCanvas.width = width
  jpegCanvas.height = height
  const jpegContext = jpegCanvas.getContext('2d', { alpha: false })
  if (!jpegContext) throw new Error('Canvas 2D no está disponible.')
  jpegContext.fillStyle = '#ffffff'
  jpegContext.fillRect(0, 0, width, height)
  jpegContext.drawImage(resizedCanvas, 0, 0)
  return canvasToBlob(jpegCanvas, mediaType, quality)
}

export async function importImage(file: File, now = new Date()): Promise<ImportedImage> {
  if (!isSupportedImageType(file.type)) throw new Error(`Formato no soportado: ${file.type || 'desconocido'}. Usa PNG, JPEG o WebP.`)
  if (file.size > MAX_SOURCE_BYTES) throw new Error('La imagen supera el límite T1 de 50 MB.')
  const detectedType = detectImageType(new Uint8Array(await file.slice(0, 16).arrayBuffer()))
  if (!detectedType || detectedType !== file.type) throw new Error('La firma binaria no coincide con un PNG, JPEG o WebP válido.')
  const hash = await sha256(file)
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(`No se pudo decodificar ${file.name}. El archivo puede estar corrupto.`)
  })
  try {
    if (bitmap.width * bitmap.height > MAX_PIXELS) throw new Error('La imagen supera el presupuesto T1 de 67 megapíxeles.')
    const scale = Math.min(1, 160 / Math.max(bitmap.width, bitmap.height))
    const thumbnail = await renderToBlob(bitmap, Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)), 'image/png', 1, false)
    const record = assetSchema.parse({
      id: `asset-${hash.slice(0, 20)}`,
      name: file.name,
      mediaType: file.type,
      sha256: hash,
      byteSize: file.size,
      width: bitmap.width,
      height: bitmap.height,
      importedAt: now.toISOString(),
    })
    return { record, original: file, thumbnail }
  } finally {
    bitmap.close()
  }
}

export async function processImage(source: ImportedImage, recipeInput: Recipe, options: ProcessOptions = {}): Promise<ProcessedImage> {
  const recipe = recipeSchema.parse(recipeInput)
  const orderedSteps = orderRecipeSteps(recipe)
  const resize = orderedSteps.find((step) => step.operation === 'resize')
  const convert = orderedSteps.find((step) => step.operation === 'convert')
  if (!resize || resize.operation !== 'resize' || !convert || convert.operation !== 'convert') throw new Error('La receta necesita resize y convert.')
  if (resize.parameters.width * resize.parameters.height > MAX_PIXELS) throw new Error('La salida supera el presupuesto T1 de 67 megapíxeles.')

  assertNotCancelled(options.signal)
  options.onProgress?.(0.1)
  const bitmap = await createImageBitmap(source.original)
  try {
    assertNotCancelled(options.signal)
    options.onProgress?.(0.35)
    const blob = await renderToBlob(bitmap, resize.parameters.width, resize.parameters.height, convert.parameters.mediaType, convert.parameters.quality, resize.parameters.interpolation === 'smooth')
    assertNotCancelled(options.signal)
    options.onProgress?.(0.8)
    const outputSha256 = await sha256(blob)
    assertNotCancelled(options.signal)
    const manifest = derivedAssetManifestSchema.parse({
      schemaVersion: 1,
      sourceAssetId: source.record.id,
      sourceSha256: source.record.sha256,
      outputSha256,
      recipe,
      output: {
        mediaType: convert.parameters.mediaType,
        byteSize: blob.size,
        width: resize.parameters.width,
        height: resize.parameters.height,
      },
    })
    options.onProgress?.(1)
    return { blob, manifest }
  } finally {
    bitmap.close()
  }
}

export function extensionFor(mediaType: SupportedImageType): string {
  if (mediaType === 'image/jpeg') return 'jpg'
  if (mediaType === 'image/webp') return 'webp'
  return 'png'
}

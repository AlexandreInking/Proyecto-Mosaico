import { PixelBuffer, createSpriteDocument, type SpriteDocument } from '@mosaico/domain'
import { composeSpriteFrame } from '@mosaico/canvas'
// @ts-expect-error gifenc ships no TypeScript declarations.
import { GIFEncoder, applyPalette, quantize } from 'gifenc'

export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'gif'
export const EDITOR_PROJECT_EXTENSION = '.mpe'
export const EDITOR_PROJECT_MEDIA_TYPE = 'application/vnd.mosaico.editor+json'
type ProjectFormat = 'mpe' | 'mosaico'
export interface ExportOptions { readonly format: ExportFormat; readonly scale: number; readonly transparent: boolean; readonly quality: number; readonly name: string }

const safeName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-') || 'sprite'
const mime = (format: ExportFormat | ProjectFormat) => format === 'jpeg' ? 'image/jpeg' : format === 'mpe' ? EDITOR_PROJECT_MEDIA_TYPE : format === 'mosaico' ? 'application/json' : `image/${format}`
const extension = (format: ExportFormat | ProjectFormat) => format === 'jpeg' ? 'jpg' : format === 'mpe' ? EDITOR_PROJECT_EXTENSION.slice(1) : format
const maximumExportPixels = 67_108_864

export function scaleRgba(source: Uint8ClampedArray, width: number, height: number, scale: number): Uint8ClampedArray {
  if (!Number.isInteger(scale) || scale < 1 || scale > 32) throw new RangeError('IMAGE_SCALE_INVALID')
  if (width * scale > 16_384 || height * scale > 16_384 || width * height * scale * scale > maximumExportPixels) throw new RangeError('IMAGE_EXPORT_TOO_LARGE')
  const output = new Uint8ClampedArray(width * height * scale * scale * 4)
  for (let y = 0; y < height * scale; y += 1) for (let x = 0; x < width * scale; x += 1) {
    const from = (Math.floor(y / scale) * width + Math.floor(x / scale)) * 4; const to = (y * width * scale + x) * 4
    output.set(source.subarray(from, from + 4), to)
  }
  return output
}

function frameBytes(document: SpriteDocument, frameId: string, scale: number, transparent: boolean): Uint8ClampedArray {
  const pixels = composeSpriteFrame(document, frameId)
  if (!transparent) for (let offset = 0; offset < pixels.length; offset += 4) {
    const alpha = pixels[offset + 3]! / 255
    for (let channel = 0; channel < 3; channel += 1) pixels[offset + channel] = Math.round(pixels[offset + channel]! * alpha + 255 * (1 - alpha))
    pixels[offset + 3] = 255
  }
  return scaleRgba(pixels, document.width, document.height, scale)
}

export function encodeSpriteGif(document: SpriteDocument, scale = 1, transparent = true): Blob {
  const gif = GIFEncoder(); const width = document.width * scale; const height = document.height * scale
  for (const frame of document.frames) {
    const rgba = frameBytes(document, frame.id, scale, transparent); const palette = quantize(rgba, 256, { format: 'rgba4444' }); const index = applyPalette(rgba, palette, 'rgba4444')
    gif.writeFrame(index, width, height, { palette, delay: frame.durationMs, repeat: 0, transparent, transparentIndex: 0, dispose: 2 })
  }
  gif.finish(); return new Blob([new Uint8Array(gif.bytes())], { type: 'image/gif' })
}

export async function saveBlob(blob: Blob, name: string, format: ExportFormat | ProjectFormat = 'png'): Promise<void> {
  const picker = (window as unknown as { showSaveFilePicker?: (options: unknown) => Promise<{ createWritable(): Promise<{ write(value: Blob): Promise<void>; close(): Promise<void> }> }> }).showSaveFilePicker
  if (picker) {
    const type = mime(format)
    const handle = await picker({ suggestedName: name, types: [{ description: format.toUpperCase(), accept: { [type]: [`.${format === 'mosaico' ? 'mosaico' : extension(format)}`] } }] })
    const writable = await handle.createWritable(); await writable.write(blob); await writable.close(); return
  }
  const url = URL.createObjectURL(blob); const link = window.document.createElement('a'); link.href = url; link.download = name; link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function saveProject(document: SpriteDocument, serialized: string): Promise<void> {
  await saveBlob(new Blob([serialized], { type: EDITOR_PROJECT_MEDIA_TYPE }), `${safeName(document.name)}${EDITOR_PROJECT_EXTENSION}`, 'mpe')
}

export async function exportDocument(document: SpriteDocument, options: ExportOptions): Promise<void> {
  if (!options.name.trim() || !Number.isInteger(options.quality) || options.quality < 1 || options.quality > 100) throw new RangeError('IMAGE_EXPORT_OPTIONS_INVALID')
  const name = `${safeName(options.name)}.${extension(options.format)}`
  if (options.format === 'gif') {
    await saveBlob(encodeSpriteGif(document, options.scale, options.transparent), name, 'gif'); return
  }
  const width = document.width * options.scale; const height = document.height * options.scale
  const canvas = window.document.createElement('canvas'); canvas.width = width; canvas.height = height
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(frameBytes(document, document.activeFrameId, options.scale, options.transparent && options.format !== 'jpeg')), width, height), 0, 0)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime(options.format), options.quality / 100))
  if (!blob) throw new Error('IMAGE_EXPORT_FAILED')
  await saveBlob(blob, name, options.format)
}

export function createSpriteDocumentFromFrames(name: string, width: number, height: number, frames: readonly { pixels: Uint8ClampedArray; durationMs: number }[]): SpriteDocument {
  if (!frames.length || frames.length > 1024 || width < 1 || height < 1 || width > 4096 || height > 4096) throw new RangeError('SPRITE_FRAME_LIMIT')
  let document = createSpriteDocument({ id: crypto.randomUUID(), name: safeName(name), width, height, layerId: crypto.randomUUID(), frameId: crypto.randomUUID() })
  const frameIds = frames.map(() => crypto.randomUUID()); const layer = document.layers[0]!
  document = { ...document, activeFrameId: frameIds[0]!, frames: frames.map((frame, index) => ({ id: frameIds[index]!, durationMs: frame.durationMs })), layers: [{ ...layer, cels: new Map(frames.map((frame, index) => [frameIds[index]!, { frameId: frameIds[index]!, pixels: new PixelBuffer(frame.pixels) }])) }] }
  return document
}

async function staticImage(file: File): Promise<SpriteDocument> {
  const bitmap = await createImageBitmap(file); const canvas = window.document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height
  if (bitmap.width > 4096 || bitmap.height > 4096) { bitmap.close(); throw new RangeError('SPRITE_DIMENSION_OUT_OF_BOUNDS') }
  const context = canvas.getContext('2d')!; context.drawImage(bitmap, 0, 0); bitmap.close()
  return createSpriteDocumentFromFrames(file.name, canvas.width, canvas.height, [{ pixels: context.getImageData(0, 0, canvas.width, canvas.height).data, durationMs: 100 }])
}

export async function chooseImageFile(): Promise<File | undefined> {
  const picker = (window as unknown as { showOpenFilePicker?: (options: unknown) => Promise<{ getFile(): Promise<File> }[]> }).showOpenFilePicker
  if (!picker) return undefined
  const [handle] = await picker({ multiple: false, types: [{ description: 'Mosaico e imágenes', accept: { [EDITOR_PROJECT_MEDIA_TYPE]: [EDITOR_PROJECT_EXTENSION, '.mosaico', '.json'], 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'] } }] })
  return handle?.getFile()
}

export async function importImage(file: File): Promise<SpriteDocument> {
  if (file.type !== 'image/gif') return staticImage(file)
  const Decoder = (globalThis as unknown as { ImageDecoder?: new (input: { data: ArrayBuffer; type: string }) => any }).ImageDecoder
  if (!Decoder) throw new Error('GIF_DECODER_UNAVAILABLE')
  const decoder = new Decoder({ data: await file.arrayBuffer(), type: file.type }); await decoder.tracks.ready
  const count = decoder.tracks.selectedTrack.frameCount; if (count > 1024) { decoder.close(); throw new RangeError('SPRITE_FRAME_LIMIT') }
  const frames: { pixels: Uint8ClampedArray; durationMs: number }[] = []; let width = 0; let height = 0
  for (let index = 0; index < count; index += 1) {
    const { image } = await decoder.decode({ frameIndex: index, completeFramesOnly: true }); width = image.displayWidth; height = image.displayHeight
    if (width > 4096 || height > 4096) { image.close(); decoder.close(); throw new RangeError('SPRITE_DIMENSION_OUT_OF_BOUNDS') }
    const durationMs = Math.max(10, Math.round((image.duration ?? 100_000) / 1000)); const canvas = new OffscreenCanvas(width, height); const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0); image.close(); frames.push({ pixels: context.getImageData(0, 0, width, height).data, durationMs })
  }
  decoder.close(); return createSpriteDocumentFromFrames(file.name, width, height, frames)
}

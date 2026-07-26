import { PixelBuffer, createSpriteDocument, type SpriteDocument } from '@mosaico/domain'
import { composeSpriteFrame } from '@mosaico/canvas'
// @ts-expect-error gifenc ships no TypeScript declarations.
import { GIFEncoder, applyPalette, quantize } from 'gifenc'

const safeName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-') || 'sprite'

function frameCanvas(document: SpriteDocument, frameId: string, opaque = false): HTMLCanvasElement {
  const canvas = window.document.createElement('canvas'); canvas.width = document.width; canvas.height = document.height
  const context = canvas.getContext('2d')!
  if (opaque) { context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height) }
  const pixels = composeSpriteFrame(document, frameId)
  if (opaque) for (let offset = 0; offset < pixels.length; offset += 4) {
    const alpha = pixels[offset + 3]! / 255
    pixels[offset] = Math.round(pixels[offset]! * alpha + 255 * (1 - alpha)); pixels[offset + 1] = Math.round(pixels[offset + 1]! * alpha + 255 * (1 - alpha)); pixels[offset + 2] = Math.round(pixels[offset + 2]! * alpha + 255 * (1 - alpha)); pixels[offset + 3] = 255
  }
  context.putImageData(new ImageData(new Uint8ClampedArray(pixels), document.width, document.height), 0, 0)
  return canvas
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob); const link = window.document.createElement('a'); link.href = url; link.download = name; link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function exportFrame(document: SpriteDocument, type: 'image/png' | 'image/jpeg' | 'image/webp', opaque = false): Promise<void> {
  const extension = type === 'image/jpeg' ? 'jpg' : type.split('/')[1]!
  const blob = await new Promise<Blob | null>((resolve) => frameCanvas(document, document.activeFrameId, opaque || type === 'image/jpeg').toBlob(resolve, type, 0.92))
  if (!blob) throw new Error('IMAGE_EXPORT_FAILED')
  downloadBlob(blob, `${safeName(document.name)}.${extension}`)
}

export function exportGif(document: SpriteDocument): void {
  const gif = GIFEncoder()
  for (const frame of document.frames) {
    const rgba = composeSpriteFrame(document, frame.id); const palette = quantize(rgba, 256, { format: 'rgba4444' }); const index = applyPalette(rgba, palette, 'rgba4444')
    gif.writeFrame(index, document.width, document.height, { palette, delay: frame.durationMs, repeat: 0, transparent: true, transparentIndex: 0, dispose: 2 })
  }
  gif.finish(); downloadBlob(new Blob([new Uint8Array(gif.bytes())], { type: 'image/gif' }), `${safeName(document.name)}.gif`)
}

function fromFrames(name: string, width: number, height: number, frames: readonly { pixels: Uint8ClampedArray; durationMs: number }[]): SpriteDocument {
  let document = createSpriteDocument({ id: crypto.randomUUID(), name: safeName(name), width, height, layerId: crypto.randomUUID(), frameId: crypto.randomUUID() })
  const frameIds = frames.map(() => crypto.randomUUID())
  const layer = document.layers[0]!
  document = {
    ...document, activeFrameId: frameIds[0]!, frames: frames.map((frame, index) => ({ id: frameIds[index]!, durationMs: frame.durationMs })),
    layers: [{ ...layer, cels: new Map(frames.map((frame, index) => [frameIds[index]!, { frameId: frameIds[index]!, pixels: new PixelBuffer(frame.pixels) }])) }],
  }
  return document
}

async function staticImage(file: File): Promise<SpriteDocument> {
  const bitmap = await createImageBitmap(file); const canvas = window.document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height
  const context = canvas.getContext('2d')!; context.drawImage(bitmap, 0, 0); bitmap.close()
  return fromFrames(file.name, canvas.width, canvas.height, [{ pixels: context.getImageData(0, 0, canvas.width, canvas.height).data, durationMs: 100 }])
}

export async function importImage(file: File): Promise<SpriteDocument> {
  if (file.type !== 'image/gif') return staticImage(file)
  const Decoder = (globalThis as unknown as { ImageDecoder?: new (input: { data: ArrayBuffer; type: string }) => any }).ImageDecoder
  if (!Decoder) throw new Error('GIF_DECODER_UNAVAILABLE')
  const decoder = new Decoder({ data: await file.arrayBuffer(), type: file.type }); await decoder.tracks.ready
  const count = decoder.tracks.selectedTrack.frameCount; const frames: { pixels: Uint8ClampedArray; durationMs: number }[] = []
  let width = 0; let height = 0
  for (let index = 0; index < count; index += 1) {
    const result = await decoder.decode({ frameIndex: index, completeFramesOnly: true }); const image = result.image
    width = image.displayWidth; height = image.displayHeight
    const durationMs = Math.max(10, Math.round((image.duration ?? 100_000) / 1000))
    const canvas = new OffscreenCanvas(width, height); const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0); image.close()
    frames.push({ pixels: context.getImageData(0, 0, width, height).data, durationMs })
  }
  decoder.close(); return fromFrames(file.name, width, height, frames)
}

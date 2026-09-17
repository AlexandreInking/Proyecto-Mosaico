import { saveBlob } from './pixel-media.js'
import type { GeneratedPipelineFrame } from './pipeline-frames.js'
// @ts-expect-error gifenc ships no TypeScript declarations.
import { GIFEncoder, applyPalette, quantize } from 'gifenc'

export type PipelineExportFormat = 'png-single' | 'png-spritesheet' | 'gif'

const safeName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-') || 'pipeline'

function canvasFor(width: number, height: number): HTMLCanvasElement {
  if (width < 1 || height < 1 || width > 16_384 || height > 16_384 || width * height > 67_108_864) throw new RangeError('PIPELINE_EXPORT_TOO_LARGE')
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas
}

function drawFrame(context: CanvasRenderingContext2D, frame: GeneratedPipelineFrame, x = 0, y = 0): void {
  context.putImageData(new ImageData(new Uint8ClampedArray(frame.surface.pixels), frame.surface.width, frame.surface.height), x, y)
}

async function canvasPng(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('PIPELINE_EXPORT_FAILED')
  return blob
}

export function encodePipelineGif(frames: readonly GeneratedPipelineFrame[]): Blob {
  if (!frames.length) throw new Error('PIPELINE_EXPORT_NO_FRAMES')
  const first = frames[0]!.surface
  const gif = GIFEncoder()
  for (const frame of frames) {
    if (frame.surface.width !== first.width || frame.surface.height !== first.height) throw new Error('PIPELINE_EXPORT_DIMENSIONS_MISMATCH')
    const rgba = new Uint8Array(frame.surface.pixels)
    const palette = quantize(rgba, 256, { format: 'rgba4444' }); const index = applyPalette(rgba, palette, 'rgba4444')
    gif.writeFrame(index, first.width, first.height, { palette, delay: frame.durationMs, repeat: 0, transparent: true, transparentIndex: 0, dispose: 2 })
  }
  gif.finish(); return new Blob([new Uint8Array(gif.bytes())], { type: 'image/gif' })
}

export async function exportPipelineFrames(frames: readonly GeneratedPipelineFrame[], format: PipelineExportFormat, name: string, activeFrame?: GeneratedPipelineFrame): Promise<void> {
  const selected = frames.filter((frame) => frame.selected)
  if (format !== 'png-single' && !selected.length) throw new Error('PIPELINE_EXPORT_NO_FRAMES_SELECTED')
  const source = format === 'png-single' ? [activeFrame ?? selected[0] ?? frames[0]].filter((frame): frame is GeneratedPipelineFrame => !!frame) : selected
  if (!source.length) throw new Error('PIPELINE_EXPORT_NO_FRAMES')
  const base = safeName(name)
  if (format === 'gif') { await saveBlob(encodePipelineGif(source), `${base}.gif`, 'gif'); return }
  if (format === 'png-single') {
    const frame = activeFrame ?? source[0]!; const canvas = canvasFor(frame.surface.width, frame.surface.height); const context = canvas.getContext('2d'); if (!context) throw new Error('PIPELINE_EXPORT_CANVAS_UNAVAILABLE'); drawFrame(context, frame); await saveBlob(await canvasPng(canvas), `${base}.png`, 'png'); return
  }
  const first = source[0]!.surface; const canvas = canvasFor(first.width * source.length, first.height); const context = canvas.getContext('2d'); if (!context) throw new Error('PIPELINE_EXPORT_CANVAS_UNAVAILABLE')
  source.forEach((frame, index) => { if (frame.surface.width !== first.width || frame.surface.height !== first.height) throw new Error('PIPELINE_EXPORT_DIMENSIONS_MISMATCH'); drawFrame(context, frame, index * first.width) })
  await saveBlob(await canvasPng(canvas), `${base}-spritesheet.png`, 'png')
}

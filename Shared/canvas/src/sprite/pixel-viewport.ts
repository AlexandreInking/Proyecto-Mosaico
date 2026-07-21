import type { SpriteDocument } from '@mosaico/domain'
import { isPointInsideViewport, screenToWorld, type Point, type ViewportState } from '../viewport.js'
import { visibleCellRange, type VisibleCellRange } from '../map/map-viewport.js'

export interface SpriteBounds { readonly width: number; readonly height: number }

export function pickSpritePixel(viewport: ViewportState, point: Point, sprite: SpriteBounds): Point | undefined {
  if (!isPointInsideViewport(viewport, point)) return undefined
  const world = screenToWorld(viewport, point)
  const x = Math.floor(world.x)
  const y = Math.floor(world.y)
  if (x < 0 || y < 0 || x >= sprite.width || y >= sprite.height) return undefined
  return { x, y }
}

export function visiblePixelRange(viewport: ViewportState, sprite: SpriteBounds): VisibleCellRange {
  return visibleCellRange(viewport, { ...sprite, cellWidth: 1, cellHeight: 1 })
}

export function shouldShowPixelGrid(viewport: ViewportState): boolean { return viewport.zoom >= 6 }

const LEFT = 1
const RIGHT = 2
const TOP = 4
const BOTTOM = 8

function outCode(point: Point, width: number, height: number): number {
  let code = 0
  if (point.x < 0) code |= LEFT
  else if (point.x > width - 1) code |= RIGHT
  if (point.y < 0) code |= TOP
  else if (point.y > height - 1) code |= BOTTOM
  return code
}

function assertStrokePoint(point: Point): void {
  if (!Number.isInteger(point.x) || !Number.isInteger(point.y)
    || Math.abs(point.x) > 1_000_000 || Math.abs(point.y) > 1_000_000) throw new RangeError('PIXEL_STROKE_INVALID')
}

function clipLine(start: Point, end: Point, bounds: SpriteBounds): readonly [Point, Point] | undefined {
  let x0 = start.x
  let y0 = start.y
  let x1 = end.x
  let y1 = end.y
  let code0 = outCode(start, bounds.width, bounds.height)
  let code1 = outCode(end, bounds.width, bounds.height)
  while (true) {
    if (!(code0 | code1)) return [{ x: Math.round(x0), y: Math.round(y0) }, { x: Math.round(x1), y: Math.round(y1) }]
    if (code0 & code1) return undefined
    const code = code0 || code1
    let x = 0
    let y = 0
    if (code & TOP) { x = x0 + (x1 - x0) * (0 - y0) / (y1 - y0); y = 0 }
    else if (code & BOTTOM) { x = x0 + (x1 - x0) * (bounds.height - 1 - y0) / (y1 - y0); y = bounds.height - 1 }
    else if (code & RIGHT) { y = y0 + (y1 - y0) * (bounds.width - 1 - x0) / (x1 - x0); x = bounds.width - 1 }
    else { y = y0 + (y1 - y0) * (0 - x0) / (x1 - x0); x = 0 }
    if (code === code0) { x0 = x; y0 = y; code0 = outCode({ x, y }, bounds.width, bounds.height) }
    else { x1 = x; y1 = y; code1 = outCode({ x, y }, bounds.width, bounds.height) }
  }
}

export function rasterizeClippedPixelStroke(start: Point, end: Point, bounds: SpriteBounds): readonly Point[] {
  assertStrokePoint(start)
  assertStrokePoint(end)
  if (!Number.isInteger(bounds.width) || !Number.isInteger(bounds.height) || bounds.width < 1 || bounds.height < 1) {
    throw new RangeError('PIXEL_STROKE_INVALID')
  }
  const clipped = clipLine(start, end, bounds)
  if (!clipped) return []
  let [x0, y0] = [clipped[0].x, clipped[0].y]
  const [x1, y1] = [clipped[1].x, clipped[1].y]
  const dx = Math.abs(x1 - x0)
  const sx = x0 < x1 ? 1 : -1
  const dy = -Math.abs(y1 - y0)
  const sy = y0 < y1 ? 1 : -1
  let error = dx + dy
  const result: Point[] = []
  while (true) {
    result.push({ x: x0, y: y0 })
    if (x0 === x1 && y0 === y1) break
    const twice = 2 * error
    if (twice >= dy) { error += dy; x0 += sx }
    if (twice <= dx) { error += dx; y0 += sy }
  }
  return result
}

export function composeSpriteFrame(document: SpriteDocument, frameId: string): Uint8ClampedArray {
  if (!document.frames.some((frame) => frame.id === frameId)) throw new Error('SPRITE_FRAME_NOT_FOUND')
  const output = new Uint8ClampedArray(document.width * document.height * 4)
  for (const layer of document.layers) {
    if (!layer.visible || layer.opacity <= 0) continue
    const cel = layer.cels.get(frameId)
    if (!cel) continue
    const source = cel.pixels.toUint8Array()
    for (let offset = 0; offset < output.length; offset += 4) {
      const sourceAlpha = (source[offset + 3] ?? 0) / 255 * layer.opacity
      if (sourceAlpha <= 0) continue
      const destinationAlpha = (output[offset + 3] ?? 0) / 255
      const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha)
      for (let channel = 0; channel < 3; channel += 1) {
        output[offset + channel] = Math.round(((source[offset + channel] ?? 0) * sourceAlpha
          + (output[offset + channel] ?? 0) * destinationAlpha * (1 - sourceAlpha)) / outputAlpha)
      }
      output[offset + 3] = Math.round(outputAlpha * 255)
    }
  }
  return output
}

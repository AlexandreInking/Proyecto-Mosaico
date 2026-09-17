import type { GridCoordinate } from '@mosaico/domain'

export const BRUSH_SIZE_MIN = 1
export const BRUSH_SIZE_MAX = 32
export type BrushShape = 'square' | 'circle' | 'diamond'
export const brushShapes: readonly BrushShape[] = ['square', 'circle', 'diamond']

export function clampBrushSize(value: number): number {
  if (!Number.isFinite(value)) return BRUSH_SIZE_MIN
  return Math.max(BRUSH_SIZE_MIN, Math.min(BRUSH_SIZE_MAX, Math.trunc(value)))
}

function includesStampPixel(shape: BrushShape, dx: number, dy: number, size: number): boolean {
  const center = (size - 1) / 2; const fx = dx - center; const fy = dy - center
  if (shape === 'circle') return fx * fx + fy * fy <= (size / 2 - 0.25) ** 2
  if (shape === 'diamond') return Math.abs(fx) + Math.abs(fy) <= size / 2
  return true
}

export function stampPoints(center: GridCoordinate, size: number, shape: BrushShape): GridCoordinate[] {
  const radius = clampBrushSize(size); const start = -(radius >> 1); const points: GridCoordinate[] = []
  for (let dy = 0; dy < radius; dy += 1) for (let dx = 0; dx < radius; dx += 1) if (includesStampPixel(shape, dx, dy, radius)) points.push({ x: center.x + start + dx, y: center.y + start + dy })
  return points
}

export function expandStroke(base: readonly GridCoordinate[], size: number, shape: BrushShape, width: number, height: number, wrapX: boolean, wrapY: boolean): GridCoordinate[] {
  const seen = new Set<number>(); const expanded: GridCoordinate[] = []; const modulo = (value: number, bound: number) => ((value % bound) + bound) % bound
  for (const point of base) for (const stamp of stampPoints(point, size, shape)) {
    let x = stamp.x; let y = stamp.y
    if (wrapX) x = modulo(x, width)
    if (wrapY) y = modulo(y, height)
    if (x < 0 || y < 0 || x >= width || y >= height) continue
    const key = y * width + x; if (seen.has(key)) continue; seen.add(key); expanded.push({ x, y })
  }
  return expanded
}

export type SelectionMode = 'rectangle' | 'ellipse' | 'lasso' | 'magic'
export interface PixelPoint { readonly x: number; readonly y: number }
export interface SelectionMask { readonly width: number; readonly height: number; readonly pixels: ReadonlySet<number> }

const key = (point: PixelPoint, width: number) => point.y * width + point.x
const inside = (point: PixelPoint, width: number, height: number) => point.x >= 0 && point.y >= 0 && point.x < width && point.y < height

export function rectangleMask(start: PixelPoint, end: PixelPoint, width: number, height: number): SelectionMask {
  const pixels = new Set<number>()
  for (let y = Math.max(0, Math.min(start.y, end.y)); y <= Math.min(height - 1, Math.max(start.y, end.y)); y += 1)
    for (let x = Math.max(0, Math.min(start.x, end.x)); x <= Math.min(width - 1, Math.max(start.x, end.x)); x += 1) pixels.add(key({ x, y }, width))
  return { width, height, pixels }
}

export function ellipseMask(start: PixelPoint, end: PixelPoint, width: number, height: number): SelectionMask {
  const box = rectangleMask(start, end, width, height); const pixels = new Set<number>()
  const minX = Math.min(start.x, end.x); const minY = Math.min(start.y, end.y); const rx = (Math.abs(end.x - start.x) + 1) / 2; const ry = (Math.abs(end.y - start.y) + 1) / 2
  for (const index of box.pixels) { const x = index % width; const y = Math.floor(index / width); if (((x + 0.5 - minX) / rx - 1) ** 2 + ((y + 0.5 - minY) / ry - 1) ** 2 <= 1) pixels.add(index) }
  return { width, height, pixels }
}

export function polygonMask(points: readonly PixelPoint[], width: number, height: number): SelectionMask {
  const pixels = new Set<number>(); if (points.length < 3) return { width, height, pixels }
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    let hit = false
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) { const a = points[i]!; const b = points[j]!; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) hit = !hit }
    if (hit) pixels.add(key({ x, y }, width))
  }
  return { width, height, pixels }
}

export function magicMask(origin: PixelPoint, width: number, height: number, colorAt: (point: PixelPoint) => string): SelectionMask {
  const pixels = new Set<number>(); if (!inside(origin, width, height)) return { width, height, pixels }
  const target = colorAt(origin); const queue = [origin]
  for (let cursor = 0; cursor < queue.length; cursor += 1) { const point = queue[cursor]!; const index = key(point, width); if (pixels.has(index) || !inside(point, width, height) || colorAt(point) !== target) continue; pixels.add(index); queue.push({ x: point.x - 1, y: point.y }, { x: point.x + 1, y: point.y }, { x: point.x, y: point.y - 1 }, { x: point.x, y: point.y + 1 }) }
  return { width, height, pixels }
}

export function combineSelection(current: SelectionMask | undefined, next: SelectionMask, operation: 'replace' | 'add' | 'subtract'): SelectionMask {
  if (!current || operation === 'replace') return next
  const pixels = new Set(current.pixels); for (const index of next.pixels) operation === 'add' ? pixels.add(index) : pixels.delete(index)
  return { ...next, pixels }
}

export function invertSelection(mask: SelectionMask): SelectionMask {
  const pixels = new Set<number>(); for (let index = 0; index < mask.width * mask.height; index += 1) if (!mask.pixels.has(index)) pixels.add(index)
  return { ...mask, pixels }
}

export function translateSelection(mask: SelectionMask, dx: number, dy: number): SelectionMask {
  const pixels = new Set<number>()
  for (const index of mask.pixels) {
    const x = index % mask.width + dx; const y = Math.floor(index / mask.width) + dy
    if (x >= 0 && y >= 0 && x < mask.width && y < mask.height) pixels.add(y * mask.width + x)
  }
  return { ...mask, pixels }
}

export function selectionBounds(mask: SelectionMask): { x: number; y: number; width: number; height: number } | undefined {
  if (!mask.pixels.size) return undefined
  const xs = [...mask.pixels].map((index) => index % mask.width); const ys = [...mask.pixels].map((index) => Math.floor(index / mask.width)); const x = Math.min(...xs); const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x + 1, height: Math.max(...ys) - y + 1 }
}

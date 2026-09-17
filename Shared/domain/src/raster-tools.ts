import type { GridCoordinate } from './map-document.js'

function unique(points: readonly GridCoordinate[]): GridCoordinate[] {
  return [...new Map(points.map((point) => [`${point.x},${point.y}`, point])).values()]
}

export function linePixels(start: GridCoordinate, end: GridCoordinate): GridCoordinate[] {
  const points: GridCoordinate[] = []
  let x = start.x; let y = start.y
  const dx = Math.abs(end.x - x); const sx = x < end.x ? 1 : -1
  const dy = -Math.abs(end.y - y); const sy = y < end.y ? 1 : -1
  let error = dx + dy
  while (true) {
    points.push({ x, y })
    if (x === end.x && y === end.y) return points
    const doubled = error * 2
    if (doubled >= dy) { error += dy; x += sx }
    if (doubled <= dx) { error += dx; y += sy }
  }
}

export function snapLineEnd(start: GridCoordinate, end: GridCoordinate, angleStepDegrees = 22.5): GridCoordinate {
  const dx = end.x - start.x; const dy = end.y - start.y
  if (dx === 0 && dy === 0) return end
  const step = angleStepDegrees * Math.PI / 180
  const angle = Math.round(Math.atan2(dy, dx) / step) * step
  const dominant = Math.max(Math.abs(dx), Math.abs(dy))
  const scale = dominant / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)))
  return { x: start.x + Math.round(Math.cos(angle) * scale), y: start.y + Math.round(Math.sin(angle) * scale) }
}

export function constrainSquareEnd(start: GridCoordinate, end: GridCoordinate): GridCoordinate {
  const size = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y))
  return { x: start.x + Math.sign(end.x - start.x || 1) * size, y: start.y + Math.sign(end.y - start.y || 1) * size }
}

export function rectanglePixels(start: GridCoordinate, end: GridCoordinate, filled: boolean): GridCoordinate[] {
  const left = Math.min(start.x, end.x); const right = Math.max(start.x, end.x)
  const top = Math.min(start.y, end.y); const bottom = Math.max(start.y, end.y)
  const points: GridCoordinate[] = []
  for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1) {
    if (filled || x === left || x === right || y === top || y === bottom) points.push({ x, y })
  }
  return points
}

export function ellipsePixels(start: GridCoordinate, end: GridCoordinate, filled: boolean): GridCoordinate[] {
  const left = Math.min(start.x, end.x); const right = Math.max(start.x, end.x)
  const top = Math.min(start.y, end.y); const bottom = Math.max(start.y, end.y)
  const centerX = (left + right) / 2; const centerY = (top + bottom) / 2
  const radiusX = Math.max(0.5, (right - left + 1) / 2); const radiusY = Math.max(0.5, (bottom - top + 1) / 2)
  const inside = (x: number, y: number, inset = 0) => {
    const rx = radiusX - inset; const ry = radiusY - inset
    return rx > 0 && ry > 0 && ((x - centerX) / rx) ** 2 + ((y - centerY) / ry) ** 2 <= 1
  }
  const points: GridCoordinate[] = []
  for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1) {
    if (inside(x, y) && (filled || !inside(x, y, 1))) points.push({ x, y })
  }
  return unique(points)
}

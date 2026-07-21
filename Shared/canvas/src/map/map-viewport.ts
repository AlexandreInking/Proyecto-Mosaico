import type { MapDocument, TileReference } from '@mosaico/domain'
import { isPointInsideViewport, screenToWorld, worldToScreen, type Point, type ViewportState } from '../viewport.js'

export interface OrthogonalGrid {
  readonly width: number
  readonly height: number
  readonly cellWidth: number
  readonly cellHeight: number
}

export interface VisibleCellRange {
  readonly startX: number
  readonly startY: number
  readonly endX: number
  readonly endY: number
}

export interface VisibleMapCell extends TileReference {
  readonly layerId: string
  readonly opacity: number
  readonly x: number
  readonly y: number
  readonly screenX: number
  readonly screenY: number
  readonly screenWidth: number
  readonly screenHeight: number
}

export function pickOrthogonalCell(viewport: ViewportState, point: Point, grid: OrthogonalGrid): Point | undefined {
  if (!isPointInsideViewport(viewport, point)) return undefined
  const world = screenToWorld(viewport, point)
  const x = Math.floor(world.x / grid.cellWidth)
  const y = Math.floor(world.y / grid.cellHeight)
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return undefined
  return { x, y }
}

export function visibleCellRange(viewport: ViewportState, grid: OrthogonalGrid): VisibleCellRange {
  const topLeft = screenToWorld(viewport, { x: 0, y: 0 })
  const bottomRight = screenToWorld(viewport, { x: viewport.width, y: viewport.height })
  return {
    startX: Math.max(0, Math.min(grid.width, Math.floor(topLeft.x / grid.cellWidth))),
    startY: Math.max(0, Math.min(grid.height, Math.floor(topLeft.y / grid.cellHeight))),
    endX: Math.max(0, Math.min(grid.width, Math.ceil(bottomRight.x / grid.cellWidth))),
    endY: Math.max(0, Math.min(grid.height, Math.ceil(bottomRight.y / grid.cellHeight))),
  }
}

function coordinateFromKey(key: string): Point {
  const separator = key.indexOf(',')
  return { x: Number(key.slice(0, separator)), y: Number(key.slice(separator + 1)) }
}

export function visibleMapCells(document: MapDocument, viewport: ViewportState): readonly VisibleMapCell[] {
  const range = visibleCellRange(viewport, document)
  if (range.startX >= range.endX || range.startY >= range.endY) return []
  const result: VisibleMapCell[] = []
  for (const layer of document.layers) {
    if (!layer.visible || layer.opacity <= 0) continue
    for (const [key, tile] of layer.cells) {
      const coordinate = coordinateFromKey(key)
      if (coordinate.x < range.startX || coordinate.x >= range.endX
        || coordinate.y < range.startY || coordinate.y >= range.endY) continue
      const screen = worldToScreen(viewport, { x: coordinate.x * document.cellWidth, y: coordinate.y * document.cellHeight })
      result.push({
        layerId: layer.id,
        opacity: layer.opacity,
        ...coordinate,
        ...tile,
        screenX: screen.x,
        screenY: screen.y,
        screenWidth: document.cellWidth * viewport.zoom,
        screenHeight: document.cellHeight * viewport.zoom,
      })
    }
  }
  return result
}

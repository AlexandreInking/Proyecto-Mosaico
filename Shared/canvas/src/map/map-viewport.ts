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

const SPATIAL_CHUNK_SIZE = 32
interface IndexedTileCell extends Point { readonly tile: TileReference }
type SpatialIndex = ReadonlyMap<string, readonly IndexedTileCell[]>
const spatialIndexes = new WeakMap<ReadonlyMap<string, TileReference>, SpatialIndex>()

function spatialIndex(cells: ReadonlyMap<string, TileReference>): SpatialIndex {
  const cached = spatialIndexes.get(cells)
  if (cached) return cached
  const mutable = new Map<string, IndexedTileCell[]>()
  for (const [key, tile] of cells) {
    const coordinate = coordinateFromKey(key)
    const chunkKey = `${Math.floor(coordinate.x / SPATIAL_CHUNK_SIZE)},${Math.floor(coordinate.y / SPATIAL_CHUNK_SIZE)}`
    const chunk = mutable.get(chunkKey) ?? []
    chunk.push({ ...coordinate, tile })
    mutable.set(chunkKey, chunk)
  }
  spatialIndexes.set(cells, mutable)
  return mutable
}

export function visibleMapCells(document: MapDocument, viewport: ViewportState): readonly VisibleMapCell[] {
  const range = visibleCellRange(viewport, document)
  if (range.startX >= range.endX || range.startY >= range.endY) return []
  const result: VisibleMapCell[] = []
  const tilesets = new Map(document.tilesets.map((tileset) => [tileset.id, tileset]))
  for (const layer of document.layers) {
    if (layer.isFolder || !layer.visible || layer.opacity <= 0) continue
    const index = spatialIndex(layer.cells)
    const startChunkX = Math.floor(range.startX / SPATIAL_CHUNK_SIZE)
    const startChunkY = Math.floor(range.startY / SPATIAL_CHUNK_SIZE)
    const endChunkX = Math.floor((range.endX - 1) / SPATIAL_CHUNK_SIZE)
    const endChunkY = Math.floor((range.endY - 1) / SPATIAL_CHUNK_SIZE)
    for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY += 1) {
      for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX += 1) {
        for (const cell of index.get(`${chunkX},${chunkY}`) ?? []) {
          if (cell.x < range.startX || cell.x >= range.endX || cell.y < range.startY || cell.y >= range.endY) continue
          const tileset = tilesets.get(cell.tile.tilesetId)
          const tileWidth = tileset?.tileWidth ?? document.cellWidth
          const tileHeight = tileset?.tileHeight ?? document.cellHeight
          const screen = worldToScreen(viewport, {
            x: cell.x * document.cellWidth,
            y: (cell.y + 1) * document.cellHeight - tileHeight,
          })
          result.push({
            layerId: layer.id,
            opacity: layer.opacity,
            x: cell.x,
            y: cell.y,
            ...cell.tile,
            screenX: screen.x,
            screenY: screen.y,
            screenWidth: tileWidth * viewport.zoom,
            screenHeight: tileHeight * viewport.zoom,
          })
        }
      }
    }
  }
  return result
}

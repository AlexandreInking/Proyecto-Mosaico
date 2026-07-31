import { addTileset, applyMapCells, transformTile, type GridCoordinate, type MapCellChange, type MapDocument, type TileReference } from '@mosaico/domain'
import type { TilesetContract } from '@mosaico/contracts'

export interface TilePattern {
  readonly width: number
  readonly height: number
  readonly cells: readonly (TileReference | undefined)[]
}

export interface TileSelection {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

function tilesetGeometryKey(tileset: TilesetContract): string {
  return [tileset.assetId, tileset.imageWidth, tileset.imageHeight, tileset.tileWidth, tileset.tileHeight,
    tileset.marginX, tileset.marginY, tileset.spacingX, tileset.spacingY, tileset.offsetX ?? 0, tileset.offsetY ?? 0, tileset.tileCount].join('|')
}

export interface PreparedClipboardPaste {
  readonly document: MapDocument
  readonly pattern: TilePattern
}

/**
 * Match clipboard tilesets by stable id first, then by asset+slicing. Missing
 * sources are embedded in destination document so paste remains self-contained.
 */
export function prepareClipboardPaste(document: MapDocument, pattern: TilePattern, sourceTilesets: readonly TilesetContract[]): PreparedClipboardPaste {
  let next = document
  const byId = new Map(next.tilesets.map((tileset) => [tileset.id, tileset]))
  const byGeometry = new Map(next.tilesets.map((tileset) => [tilesetGeometryKey(tileset), tileset]))
  const ids = new Map<string, string>()
  for (const source of sourceTilesets) {
    const sameId = byId.get(source.id)
    if (sameId && tilesetGeometryKey(sameId) === tilesetGeometryKey(source)) { ids.set(source.id, sameId.id); continue }
    const sameSource = byGeometry.get(tilesetGeometryKey(source))
    if (sameSource) { ids.set(source.id, sameSource.id); continue }
    let target = source
    if (sameId) target = { ...source, id: crypto.randomUUID() }
    next = addTileset(next, target)
    byId.set(target.id, target); byGeometry.set(tilesetGeometryKey(target), target); ids.set(source.id, target.id)
  }
  const cells = pattern.cells.map((tile) => tile ? { ...tile, tilesetId: ids.get(tile.tilesetId) ?? tile.tilesetId } : undefined)
  if (cells.some((tile) => tile && !byId.has(tile.tilesetId))) throw new Error('MAP_CLIPBOARD_TILESET_MISSING')
  return { document: next, pattern: { ...pattern, cells } }
}

export const selectionBetween = (start: GridCoordinate, end: GridCoordinate): TileSelection => ({
  left: Math.min(start.x, end.x),
  top: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x) + 1,
  height: Math.abs(end.y - start.y) + 1,
})

export function patternChanges(document: MapDocument, origins: readonly GridCoordinate[], pattern: TilePattern): MapCellChange[] {
  const changes = new Map<string, MapCellChange>()
  for (const origin of origins) for (let y = 0; y < pattern.height; y += 1) for (let x = 0; x < pattern.width; x += 1) {
    const tile = pattern.cells[y * pattern.width + x]
    const target = { x: origin.x + x, y: origin.y + y }
    if (target.x < 0 || target.y < 0 || target.x >= document.width || target.y >= document.height) continue
    changes.set(`${target.x},${target.y}`, { ...target, tile })
  }
  return [...changes.values()]
}

export function captureSelection(document: MapDocument, layerId: string, selection: TileSelection): TilePattern {
  const layer = document.layers.find((candidate) => candidate.id === layerId)
  if (!layer) throw new Error('MAP_LAYER_NOT_FOUND')
  const cells: (TileReference | undefined)[] = []
  for (let y = 0; y < selection.height; y += 1) for (let x = 0; x < selection.width; x += 1) {
    cells.push(layer.cells.get(`${selection.left + x},${selection.top + y}`))
  }
  return { width: selection.width, height: selection.height, cells }
}

export function deleteSelection(document: MapDocument, layerId: string, selection: TileSelection): MapDocument {
  const changes: MapCellChange[] = []
  for (let y = 0; y < selection.height; y += 1) for (let x = 0; x < selection.width; x += 1) {
    const point = { x: selection.left + x, y: selection.top + y }
    if (point.x >= 0 && point.y >= 0 && point.x < document.width && point.y < document.height) changes.push(point)
  }
  return applyMapCells(document, layerId, changes)
}

export function pastePattern(document: MapDocument, layerId: string, origin: GridCoordinate, pattern: TilePattern): MapDocument {
  if (origin.x < 0 || origin.y < 0 || origin.x + pattern.width > document.width || origin.y + pattern.height > document.height) throw new RangeError('MAP_SELECTION_OUT_OF_BOUNDS')
  return applyMapCells(document, layerId, patternChanges(document, [origin], pattern).filter((change) => change.tile))
}

export function moveSelection(document: MapDocument, layerId: string, selection: TileSelection, origin: GridCoordinate): MapDocument {
  const pattern = captureSelection(document, layerId, selection)
  const erase: MapCellChange[] = []
  for (let y = 0; y < selection.height; y += 1) for (let x = 0; x < selection.width; x += 1) {
    const point = { x: selection.left + x, y: selection.top + y }
    if (point.x >= 0 && point.y >= 0 && point.x < document.width && point.y < document.height) erase.push(point)
  }
  return applyMapCells(document, layerId, [...erase, ...patternChanges(document, [origin], pattern).filter((change) => change.tile)])
}

export function transformPattern(pattern: TilePattern, operation: 'flipX' | 'flipY' | 'rotate90' | 'rotate180' | 'rotate270'): TilePattern {
  const quarterTurn = operation === 'rotate90' || operation === 'rotate270'
  const width = quarterTurn ? pattern.height : pattern.width
  const height = quarterTurn ? pattern.width : pattern.height
  const cells: (TileReference | undefined)[] = Array.from({ length: width * height })
  for (let y = 0; y < pattern.height; y += 1) for (let x = 0; x < pattern.width; x += 1) {
    const target = operation === 'flipX' ? { x: width - 1 - x, y }
      : operation === 'flipY' ? { x, y: height - 1 - y }
        : operation === 'rotate90' ? { x: pattern.height - 1 - y, y: x }
          : operation === 'rotate180' ? { x: pattern.width - 1 - x, y: pattern.height - 1 - y }
            : { x: y, y: pattern.width - 1 - x }
    const tile = pattern.cells[y * pattern.width + x]
    const transform = operation === 'flipX' ? { flipX: true } : operation === 'flipY' ? { flipY: true }
      : { rotation: (operation === 'rotate90' ? 90 : operation === 'rotate180' ? 180 : 270) as 90 | 180 | 270 }
    cells[target.y * width + target.x] = tile ? transformTile(tile, transform) : undefined
  }
  return { width, height, cells }
}

export interface SlicePreviewViewport {
  readonly columns: number
  readonly rows: number
  readonly tileWidth: number
  readonly tileHeight: number
  readonly spacingX: number
  readonly spacingY: number
  readonly originX: number
  readonly originY: number
  readonly zoom: number
  readonly scrollLeft: number
  readonly scrollTop: number
  readonly viewportWidth: number
  readonly viewportHeight: number
}

export function visibleSliceIndexes(viewport: SlicePreviewViewport): readonly number[] {
  const stepX = (viewport.tileWidth + viewport.spacingX) * viewport.zoom
  const stepY = (viewport.tileHeight + viewport.spacingY) * viewport.zoom
  const firstColumn = Math.max(0, Math.floor((viewport.scrollLeft - viewport.originX * viewport.zoom) / stepX) - 1)
  const firstRow = Math.max(0, Math.floor((viewport.scrollTop - viewport.originY * viewport.zoom) / stepY) - 1)
  const lastColumn = Math.min(viewport.columns, Math.ceil((viewport.scrollLeft + viewport.viewportWidth - viewport.originX * viewport.zoom) / stepX) + 1)
  const lastRow = Math.min(viewport.rows, Math.ceil((viewport.scrollTop + viewport.viewportHeight - viewport.originY * viewport.zoom) / stepY) + 1)
  const indexes: number[] = []
  for (let row = firstRow; row < lastRow; row += 1) for (let column = firstColumn; column < lastColumn; column += 1) indexes.push(row * viewport.columns + column)
  return indexes
}

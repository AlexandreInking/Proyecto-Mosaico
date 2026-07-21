import type { TilesetContract } from '@mosaico/contracts'

export const MAXIMUM_MAP_LAYERS = 128
export const MAXIMUM_MAP_TILESETS = 64
export const MAXIMUM_OCCUPIED_CELLS = 1_000_000

export interface GridCoordinate {
  readonly x: number
  readonly y: number
}

export interface TileReference {
  readonly tilesetId: string
  readonly tileId: number
}

export interface MapLayer {
  readonly id: string
  readonly name: string
  readonly kind: 'tile'
  readonly visible: boolean
  readonly locked: boolean
  readonly opacity: number
  readonly cells: ReadonlyMap<string, TileReference>
}

export interface MapDocument {
  readonly format: 'mosaico-map'
  readonly formatVersion: 2
  readonly id: string
  readonly revision: number
  readonly name: string
  readonly orientation: 'orthogonal'
  readonly width: number
  readonly height: number
  readonly cellWidth: number
  readonly cellHeight: number
  readonly activeLayerId: string
  readonly tilesets: readonly TilesetContract[]
  readonly layers: readonly MapLayer[]
}

export interface CreateMapDocumentInput {
  readonly id: string
  readonly name: string
  readonly width: number
  readonly height: number
  readonly cellWidth: number
  readonly cellHeight: number
  readonly layerId: string
  readonly tilesets?: readonly TilesetContract[]
}

export interface OrphanTileCoordinate extends GridCoordinate {
  readonly layerId: string
}

export interface OrphanTileDiagnostic {
  readonly code: 'MAP_ORPHAN_TILESET'
  readonly severity: 'error'
  readonly groupKey: string
  readonly count: number
  readonly message: string
  readonly tilesetId: string
  readonly coordinates: readonly OrphanTileCoordinate[]
}

function coordinateKey(coordinate: GridCoordinate): string {
  return `${coordinate.x},${coordinate.y}`
}

function parseCoordinate(key: string): GridCoordinate {
  const separator = key.indexOf(',')
  return { x: Number(key.slice(0, separator)), y: Number(key.slice(separator + 1)) }
}

function assertCoordinate(document: MapDocument, coordinate: GridCoordinate): void {
  if (!Number.isInteger(coordinate.x) || !Number.isInteger(coordinate.y)
    || coordinate.x < 0 || coordinate.y < 0
    || coordinate.x >= document.width || coordinate.y >= document.height) {
    throw new RangeError('MAP_COORDINATE_OUT_OF_BOUNDS')
  }
}

function requireLayer(document: MapDocument, layerId: string): MapLayer {
  const layer = document.layers.find((candidate) => candidate.id === layerId)
  if (!layer) throw new Error('MAP_LAYER_NOT_FOUND')
  return layer
}

function requireEditableLayer(document: MapDocument, layerId: string): MapLayer {
  const layer = requireLayer(document, layerId)
  if (layer.locked) throw new Error('MAP_LAYER_LOCKED')
  return layer
}

function replaceLayer(document: MapDocument, nextLayer: MapLayer): MapDocument {
  return {
    ...document,
    revision: document.revision + 1,
    layers: document.layers.map((layer) => layer.id === nextLayer.id ? nextLayer : layer),
  }
}

function tileReferencesEqual(left: TileReference | undefined, right: TileReference | undefined): boolean {
  return left?.tilesetId === right?.tilesetId && left?.tileId === right?.tileId
}

function occupiedCellCount(document: MapDocument): number {
  return document.layers.reduce((total, layer) => total + layer.cells.size, 0)
}

function validateTileForPaint(document: MapDocument, tile: TileReference): void {
  const tileset = document.tilesets.find((candidate) => candidate.id === tile.tilesetId)
  if (!tileset) throw new Error('MAP_TILESET_NOT_FOUND')
  if (!Number.isInteger(tile.tileId) || tile.tileId < 0 || tile.tileId >= tileset.tileCount) {
    throw new RangeError('MAP_TILE_ID_OUT_OF_BOUNDS')
  }
}

export function createMapDocument(input: CreateMapDocumentInput): MapDocument {
  if (!input.id || !input.layerId || !input.name.trim()) throw new Error('MAP_REQUIRED_FIELD')
  for (const value of [input.width, input.height, input.cellWidth, input.cellHeight]) {
    if (!Number.isInteger(value) || value < 1 || value > 4096) throw new RangeError('MAP_DIMENSION_OUT_OF_BOUNDS')
  }
  const tilesets = [...input.tilesets ?? []]
  if (tilesets.length > MAXIMUM_MAP_TILESETS) throw new RangeError('MAP_TILESET_LIMIT')
  const identifiers = [input.layerId, ...tilesets.map((tileset) => tileset.id)]
  if (new Set(identifiers).size !== identifiers.length) throw new Error('MAP_DUPLICATE_ID')
  return {
    format: 'mosaico-map',
    formatVersion: 2,
    id: input.id,
    revision: 0,
    name: input.name.trim(),
    orientation: 'orthogonal',
    width: input.width,
    height: input.height,
    cellWidth: input.cellWidth,
    cellHeight: input.cellHeight,
    activeLayerId: input.layerId,
    tilesets,
    layers: [{
      id: input.layerId,
      name: 'Capa 1',
      kind: 'tile',
      visible: true,
      locked: false,
      opacity: 1,
      cells: new Map(),
    }],
  }
}

export function getTile(document: MapDocument, layerId: string, coordinate: GridCoordinate): TileReference | undefined {
  assertCoordinate(document, coordinate)
  return requireLayer(document, layerId).cells.get(coordinateKey(coordinate))
}

export function setTile(document: MapDocument, layerId: string, coordinate: GridCoordinate, tile: TileReference): MapDocument {
  assertCoordinate(document, coordinate)
  validateTileForPaint(document, tile)
  const layer = requireEditableLayer(document, layerId)
  const key = coordinateKey(coordinate)
  if (tileReferencesEqual(layer.cells.get(key), tile)) return document
  if (!layer.cells.has(key) && occupiedCellCount(document) >= MAXIMUM_OCCUPIED_CELLS) {
    throw new RangeError('MAP_OCCUPIED_CELL_LIMIT')
  }
  const cells = new Map(layer.cells)
  cells.set(key, { ...tile })
  return replaceLayer(document, { ...layer, cells })
}

export function eraseTile(document: MapDocument, layerId: string, coordinate: GridCoordinate): MapDocument {
  assertCoordinate(document, coordinate)
  const layer = requireEditableLayer(document, layerId)
  const key = coordinateKey(coordinate)
  if (!layer.cells.has(key)) return document
  const cells = new Map(layer.cells)
  cells.delete(key)
  return replaceLayer(document, { ...layer, cells })
}

export function fillTiles(document: MapDocument, layerId: string, origin: GridCoordinate, replacement: TileReference): MapDocument {
  assertCoordinate(document, origin)
  validateTileForPaint(document, replacement)
  const layer = requireEditableLayer(document, layerId)
  const target = layer.cells.get(coordinateKey(origin))
  if (tileReferencesEqual(target, replacement)) return document

  const cells = new Map(layer.cells)
  const queue: GridCoordinate[] = [origin]
  const visited = new Set<string>()
  let nextOccupiedCount = occupiedCellCount(document)
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const coordinate = queue[cursor]
    if (!coordinate) continue
    const key = coordinateKey(coordinate)
    if (visited.has(key)) continue
    visited.add(key)
    if (!tileReferencesEqual(cells.get(key), target)) continue
    if (!cells.has(key)) {
      nextOccupiedCount += 1
      if (nextOccupiedCount > MAXIMUM_OCCUPIED_CELLS) throw new RangeError('MAP_OCCUPIED_CELL_LIMIT')
    }
    cells.set(key, { ...replacement })
    if (coordinate.x > 0) queue.push({ x: coordinate.x - 1, y: coordinate.y })
    if (coordinate.x + 1 < document.width) queue.push({ x: coordinate.x + 1, y: coordinate.y })
    if (coordinate.y > 0) queue.push({ x: coordinate.x, y: coordinate.y - 1 })
    if (coordinate.y + 1 < document.height) queue.push({ x: coordinate.x, y: coordinate.y + 1 })
  }
  return replaceLayer(document, { ...layer, cells })
}

export function addMapLayer(document: MapDocument, input: { readonly id: string; readonly name: string }): MapDocument {
  if (document.layers.length >= MAXIMUM_MAP_LAYERS) throw new RangeError('MAP_LAYER_LIMIT')
  if (!input.id || !input.name.trim()) throw new Error('MAP_REQUIRED_FIELD')
  if (document.layers.some((layer) => layer.id === input.id)
    || document.tilesets.some((tileset) => tileset.id === input.id)) throw new Error('MAP_DUPLICATE_ID')
  const layer: MapLayer = {
    id: input.id,
    name: input.name.trim(),
    kind: 'tile',
    visible: true,
    locked: false,
    opacity: 1,
    cells: new Map(),
  }
  return { ...document, revision: document.revision + 1, activeLayerId: layer.id, layers: [...document.layers, layer] }
}

export function removeMapLayer(document: MapDocument, layerId: string): MapDocument {
  requireLayer(document, layerId)
  if (document.layers.length === 1) throw new Error('MAP_REQUIRES_LAYER')
  const layers = document.layers.filter((layer) => layer.id !== layerId)
  return {
    ...document,
    revision: document.revision + 1,
    activeLayerId: document.activeLayerId === layerId ? layers[0]!.id : document.activeLayerId,
    layers,
  }
}

export function removeTileset(document: MapDocument, tilesetId: string): MapDocument {
  if (!document.tilesets.some((tileset) => tileset.id === tilesetId)) throw new Error('MAP_TILESET_NOT_FOUND')
  return {
    ...document,
    revision: document.revision + 1,
    tilesets: document.tilesets.filter((tileset) => tileset.id !== tilesetId),
  }
}

export function orphanTileDiagnostics(document: MapDocument): readonly OrphanTileDiagnostic[] {
  const knownTilesets = new Set(document.tilesets.map((tileset) => tileset.id))
  const grouped = new Map<string, OrphanTileCoordinate[]>()
  const counts = new Map<string, number>()
  for (const layer of document.layers) {
    for (const [key, tile] of layer.cells) {
      if (knownTilesets.has(tile.tilesetId)) continue
      counts.set(tile.tilesetId, (counts.get(tile.tilesetId) ?? 0) + 1)
      const coordinates = grouped.get(tile.tilesetId) ?? []
      if (coordinates.length < 100) coordinates.push({ layerId: layer.id, ...parseCoordinate(key) })
      grouped.set(tile.tilesetId, coordinates)
    }
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([tilesetId, count]) => ({
    code: 'MAP_ORPHAN_TILESET',
    severity: 'error',
    groupKey: `orphan:${tilesetId}`,
    count,
    message: count === 1 ? '1 celda referencia un tileset eliminado.' : `${count} celdas referencian un tileset eliminado.`,
    tilesetId,
    coordinates: grouped.get(tilesetId) ?? [],
  }))
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index))
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }
  return hash.toString(16).padStart(16, '0')
}

export function mapSemanticFingerprint(document: MapDocument): string {
  const lines = [
    `${document.format}|${document.formatVersion}|${document.id}|${document.name}|${document.orientation}`,
    `${document.width}|${document.height}|${document.cellWidth}|${document.cellHeight}|${document.activeLayerId}`,
  ]
  for (const tileset of [...document.tilesets].sort((left, right) => left.id.localeCompare(right.id))) {
    lines.push(`T|${tileset.id}|${tileset.name}|${tileset.assetId}|${tileset.imageWidth}|${tileset.imageHeight}|${tileset.tileWidth}|${tileset.tileHeight}|${tileset.marginX}|${tileset.marginY}|${tileset.spacingX}|${tileset.spacingY}|${tileset.tileCount}`)
  }
  for (const layer of document.layers) {
    lines.push(`L|${layer.id}|${layer.name}|${layer.visible}|${layer.locked}|${layer.opacity}`)
    const cells = [...layer.cells.entries()].map(([key, tile]) => ({ ...parseCoordinate(key), tile }))
      .sort((left, right) => left.y - right.y || left.x - right.x)
    for (const cell of cells) lines.push(`C|${cell.x}|${cell.y}|${cell.tile.tilesetId}|${cell.tile.tileId}`)
  }
  return fnv1a64(`${lines.join('\n')}\n`)
}

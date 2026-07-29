import type { TilesetContract } from '@mosaico/contracts'

export const MAXIMUM_MAP_LAYERS = 128
export const MAXIMUM_MAP_TILESETS = 64
export const MAXIMUM_AUTOTILE_SETS = 256
export const MAXIMUM_OCCUPIED_CELLS = 1_000_000

export interface GridCoordinate {
  readonly x: number
  readonly y: number
}

export interface TileReference {
  readonly tilesetId: string
  readonly tileId: number
  readonly flipX?: boolean
  readonly flipY?: boolean
  readonly rotation?: 0 | 90 | 180 | 270
  readonly autotileSetId?: string
  readonly autotileProfile?: 'terrain' | 'contour'
  readonly animationId?: string
  readonly animationFrame?: number
  readonly animationDurationMs?: number
}

export type MapBackground = { readonly kind: 'transparent' } | { readonly kind: 'color'; readonly color: string }

export interface MapGridSettings {
  readonly visible: boolean
  readonly color: string
}

export type TerrainRole =
  | 'center' | 'top' | 'right' | 'bottom' | 'left'
  | 'outerTopLeft' | 'outerTopRight' | 'outerBottomRight' | 'outerBottomLeft'
  | 'innerTopLeft' | 'innerTopRight' | 'innerBottomRight' | 'innerBottomLeft'

export interface AutotileSet {
  readonly id: string
  readonly name: string
  readonly tilesetId: string
  readonly centerTileId: number
  readonly terrain: Readonly<Partial<Record<TerrainRole, number>>>
  readonly contour: Readonly<Record<string, number>>
}

export interface MapLayer {
  readonly id: string
  readonly name: string
  readonly kind: 'tile'
  readonly visible: boolean
  readonly locked: boolean
  readonly opacity: number
  readonly cells: ReadonlyMap<string, TileReference>
  readonly isFolder?: boolean
  readonly parentId?: string
  readonly collapsed?: boolean
}

export interface MapDocument {
  readonly format: 'mosaico-map'
  readonly formatVersion: 3
  readonly id: string
  readonly revision: number
  readonly name: string
  readonly orientation: 'orthogonal'
  readonly width: number
  readonly height: number
  readonly cellWidth: number
  readonly cellHeight: number
  readonly background: MapBackground
  readonly grid: MapGridSettings
  readonly activeLayerId: string
  readonly tilesets: readonly TilesetContract[]
  readonly autotileSets: readonly AutotileSet[]
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
  readonly background?: MapBackground
  readonly grid?: MapGridSettings
  readonly autotileSets?: readonly AutotileSet[]
}

export interface OrphanTileCoordinate extends GridCoordinate {
  readonly layerId: string
}

export interface OrphanTileDiagnostic {
  readonly code: 'MAP_ORPHAN_TILESET' | 'MAP_ORPHAN_TILE'
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
  if (layer.isFolder) throw new Error('MAP_LAYER_FOLDER')
  if (layer.locked) throw new Error('MAP_LAYER_LOCKED')
  if (!layer.visible) throw new Error('MAP_LAYER_HIDDEN')
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
    && !!left?.flipX === !!right?.flipX && !!left?.flipY === !!right?.flipY
    && (left?.rotation ?? 0) === (right?.rotation ?? 0)
    && left?.autotileSetId === right?.autotileSetId
    && left?.autotileProfile === right?.autotileProfile
    && left?.animationId === right?.animationId && left?.animationFrame === right?.animationFrame && left?.animationDurationMs === right?.animationDurationMs
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
  if ((tile.rotation === 90 || tile.rotation === 270) && tileset.tileWidth !== tileset.tileHeight) {
    throw new Error('MAP_ROTATION_REQUIRES_SQUARE_TILE')
  }
}

function validateTilesetGeometry(tileset: TilesetContract): void {
  const originX = (tileset.offsetX ?? 0) + tileset.marginX
  const originY = (tileset.offsetY ?? 0) + tileset.marginY
  const columns = Math.floor((tileset.imageWidth - originX - tileset.marginX + tileset.spacingX) / (tileset.tileWidth + tileset.spacingX))
  const rows = Math.floor((tileset.imageHeight - originY - tileset.marginY + tileset.spacingY) / (tileset.tileHeight + tileset.spacingY))
  if (columns < 1 || rows < 1 || columns * rows !== tileset.tileCount) throw new Error('MAP_TILESET_GEOMETRY_INVALID')
}

export function createMapDocument(input: CreateMapDocumentInput): MapDocument {
  if (!input.id || !input.layerId || !input.name.trim()) throw new Error('MAP_REQUIRED_FIELD')
  for (const value of [input.width, input.height, input.cellWidth, input.cellHeight]) {
    if (!Number.isInteger(value) || value < 1 || value > 4096) throw new RangeError('MAP_DIMENSION_OUT_OF_BOUNDS')
  }
  const tilesets = [...input.tilesets ?? []]
  const autotileSets = [...input.autotileSets ?? []]
  tilesets.forEach(validateTilesetGeometry)
  const background = input.background ?? { kind: 'transparent' }
  const grid = input.grid ?? { visible: true, color: '#41505899' }
  if ((background.kind === 'color' && !/^#[0-9a-f]{8}$/i.test(background.color)) || !/^#[0-9a-f]{8}$/i.test(grid.color)) throw new Error('MAP_COLOR_INVALID')
  if (tilesets.length > MAXIMUM_MAP_TILESETS) throw new RangeError('MAP_TILESET_LIMIT')
  if (autotileSets.length > MAXIMUM_AUTOTILE_SETS) throw new RangeError('MAP_AUTOTILE_SET_LIMIT')
  const identifiers = [input.layerId, ...tilesets.map((tileset) => tileset.id), ...autotileSets.map((set) => set.id)]
  if (new Set(identifiers).size !== identifiers.length) throw new Error('MAP_DUPLICATE_ID')
  const tileCounts = new Map(tilesets.map((tileset) => [tileset.id, tileset.tileCount]))
  for (const set of autotileSets) {
    const count = tileCounts.get(set.tilesetId)
    if (!count || [set.centerTileId, ...Object.values(set.terrain), ...Object.values(set.contour)].some((id) => !Number.isInteger(id) || id! < 0 || id! >= count)) throw new Error('MAP_AUTOTILE_INVALID')
  }
  return {
    format: 'mosaico-map',
    formatVersion: 3,
    id: input.id,
    revision: 0,
    name: input.name.trim(),
    orientation: 'orthogonal',
    width: input.width,
    height: input.height,
    cellWidth: input.cellWidth,
    cellHeight: input.cellHeight,
    background,
    grid,
    activeLayerId: input.layerId,
    tilesets,
    autotileSets,
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

export interface MapCellChange extends GridCoordinate {
  readonly tile?: TileReference
}

export interface MapCellApplyOptions {
  readonly allowLocked?: boolean
}

export function applyMapCells(document: MapDocument, layerId: string, changes: readonly MapCellChange[], options: MapCellApplyOptions = {}): MapDocument {
  if (!changes.length) return document
  const layer = options.allowLocked ? requireLayer(document, layerId) : requireEditableLayer(document, layerId)
  const cells = new Map(layer.cells)
  let occupied = occupiedCellCount(document)
  let changed = false
  for (const change of changes) {
    assertCoordinate(document, change)
    const key = coordinateKey(change)
    const previous = cells.get(key)
    if (!change.tile) {
      if (previous) { cells.delete(key); occupied -= 1; changed = true }
      continue
    }
    validateTileForPaint(document, change.tile)
    if (tileReferencesEqual(previous, change.tile)) continue
    if (!previous && ++occupied > MAXIMUM_OCCUPIED_CELLS) throw new RangeError('MAP_OCCUPIED_CELL_LIMIT')
    cells.set(key, { ...change.tile })
    changed = true
  }
  return changed ? replaceLayer(document, { ...layer, cells }) : document
}

export function transformTile(
  tile: TileReference,
  transform: { readonly flipX?: boolean; readonly flipY?: boolean; readonly rotation?: 0 | 90 | 180 | 270 },
): TileReference {
  return {
    ...tile,
    flipX: !!tile.flipX !== !!transform.flipX,
    flipY: !!tile.flipY !== !!transform.flipY,
    rotation: ((tile.rotation ?? 0) + (transform.rotation ?? 0)) % 360 as 0 | 90 | 180 | 270,
  }
}

export function fillTiles(document: MapDocument, layerId: string, origin: GridCoordinate, replacement: TileReference): MapDocument {
  assertCoordinate(document, origin)
  validateTileForPaint(document, replacement)
  const layer = requireEditableLayer(document, layerId)
  const target = layer.cells.get(coordinateKey(origin))
  if (tileReferencesEqual(target, replacement)) return document

  const cells = new Map(layer.cells)
  const queue: GridCoordinate[] = [origin]
  const queued = new Set<string>([coordinateKey(origin)])
  const enqueue = (coordinate: GridCoordinate) => { const key = coordinateKey(coordinate); if (queued.has(key)) return; queued.add(key); queue.push(coordinate) }
  let nextOccupiedCount = occupiedCellCount(document)
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const coordinate = queue[cursor]
    if (!coordinate) continue
    const key = coordinateKey(coordinate)
    if (!tileReferencesEqual(cells.get(key), target)) continue
    if (!cells.has(key)) {
      nextOccupiedCount += 1
      if (nextOccupiedCount > MAXIMUM_OCCUPIED_CELLS) throw new RangeError('MAP_OCCUPIED_CELL_LIMIT')
    }
    cells.set(key, { ...replacement })
    if (coordinate.x > 0) enqueue({ x: coordinate.x - 1, y: coordinate.y })
    if (coordinate.x + 1 < document.width) enqueue({ x: coordinate.x + 1, y: coordinate.y })
    if (coordinate.y > 0) enqueue({ x: coordinate.x, y: coordinate.y - 1 })
    if (coordinate.y + 1 < document.height) enqueue({ x: coordinate.x, y: coordinate.y + 1 })
  }
  return replaceLayer(document, { ...layer, cells })
}

export function connectedTileRegion(document: MapDocument, layerId: string, origin: GridCoordinate): GridCoordinate[] {
  assertCoordinate(document, origin)
  const layer = requireLayer(document, layerId)
  const target = layer.cells.get(coordinateKey(origin))
  const queue: GridCoordinate[] = [origin]
  const queued = new Set<string>([coordinateKey(origin)])
  const enqueue = (coordinate: GridCoordinate) => { const key = coordinateKey(coordinate); if (queued.has(key)) return; queued.add(key); queue.push(coordinate) }
  const region: GridCoordinate[] = []
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const coordinate = queue[cursor]!
    const key = coordinateKey(coordinate)
    if (!tileReferencesEqual(layer.cells.get(key), target)) continue
    region.push(coordinate)
    if (region.length > MAXIMUM_OCCUPIED_CELLS) throw new RangeError('MAP_FILL_LIMIT')
    if (coordinate.x > 0) enqueue({ x: coordinate.x - 1, y: coordinate.y })
    if (coordinate.x + 1 < document.width) enqueue({ x: coordinate.x + 1, y: coordinate.y })
    if (coordinate.y > 0) enqueue({ x: coordinate.x, y: coordinate.y - 1 })
    if (coordinate.y + 1 < document.height) enqueue({ x: coordinate.x, y: coordinate.y + 1 })
  }
  return region
}

export interface CooperativeMapOptions {
  readonly signal?: AbortSignal
  readonly yieldEvery?: number
  readonly onProgress?: (progress: number) => void
}

const yieldTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

export async function connectedTileRegionAsync(document: MapDocument, layerId: string, origin: GridCoordinate, options: CooperativeMapOptions = {}): Promise<GridCoordinate[]> {
  assertCoordinate(document, origin)
  const layer = requireLayer(document, layerId)
  const target = layer.cells.get(coordinateKey(origin))
  const queue: GridCoordinate[] = [origin]
  const queued = new Set<string>([coordinateKey(origin)]); const region: GridCoordinate[] = []
  const yieldEvery = Math.max(256, options.yieldEvery ?? 4096)
  let sliceStarted = globalThis.performance?.now() ?? Date.now()
  const enqueue = (coordinate: GridCoordinate) => {
    const key = coordinateKey(coordinate)
    if (queued.has(key)) return
    queued.add(key); queue.push(coordinate)
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    if (cursor % yieldEvery === 0) {
      if (options.signal?.aborted) throw new DOMException('Operación cancelada', 'AbortError')
      options.onProgress?.(Math.min(0.99, cursor / (document.width * document.height)))
      if (cursor && (cursor % (yieldEvery * 2) === 0 || (globalThis.performance?.now() ?? Date.now()) - sliceStarted >= 6)) {
        await yieldTask(); sliceStarted = globalThis.performance?.now() ?? Date.now()
      }
    }
    const coordinate = queue[cursor]!
    const key = coordinateKey(coordinate)
    if (!tileReferencesEqual(layer.cells.get(key), target)) continue
    region.push(coordinate)
    if (region.length > MAXIMUM_OCCUPIED_CELLS) throw new RangeError('MAP_FILL_LIMIT')
    if (coordinate.x > 0) enqueue({ x: coordinate.x - 1, y: coordinate.y })
    if (coordinate.x + 1 < document.width) enqueue({ x: coordinate.x + 1, y: coordinate.y })
    if (coordinate.y > 0) enqueue({ x: coordinate.x, y: coordinate.y - 1 })
    if (coordinate.y + 1 < document.height) enqueue({ x: coordinate.x, y: coordinate.y + 1 })
  }
  options.onProgress?.(1)
  return region
}

export async function fillTilesAsync(document: MapDocument, layerId: string, origin: GridCoordinate, replacement: TileReference, options: CooperativeMapOptions = {}): Promise<MapDocument> {
  validateTileForPaint(document, replacement)
  requireEditableLayer(document, layerId)
  const region = await connectedTileRegionAsync(document, layerId, origin, options)
  return applyMapCells(document, layerId, region.map((coordinate) => ({ ...coordinate, tile: replacement })))
}

function validateMapParent(document: MapDocument, layerId: string, parentId?: string): void {
  if (!parentId) return
  if (parentId === layerId) throw new Error('MAP_LAYER_PARENT_INVALID')
  const parent = document.layers.find((layer) => layer.id === parentId)
  if (!parent?.isFolder) throw new Error('MAP_LAYER_PARENT_INVALID')
  const seen = new Set<string>([layerId]); let current: string | undefined = parentId
  while (current) {
    if (seen.has(current)) throw new Error('MAP_LAYER_PARENT_INVALID')
    seen.add(current); current = document.layers.find((layer) => layer.id === current)?.parentId
  }
}

export function addMapFolder(document: MapDocument, input: { readonly id: string; readonly name: string; readonly parentId?: string }): MapDocument {
  if (document.layers.length >= MAXIMUM_MAP_LAYERS) throw new RangeError('MAP_LAYER_LIMIT')
  if (!input.id || !input.name.trim()) throw new Error('MAP_REQUIRED_FIELD')
  if (document.layers.some((layer) => layer.id === input.id)
    || document.tilesets.some((tileset) => tileset.id === input.id)
    || document.autotileSets.some((set) => set.id === input.id)) throw new Error('MAP_DUPLICATE_ID')
  validateMapParent(document, input.id, input.parentId)
  const layer: MapLayer = { id: input.id, name: input.name.trim(), kind: 'tile', visible: true, locked: false, opacity: 1, cells: new Map(), isFolder: true, collapsed: false, parentId: input.parentId }
  return { ...document, revision: document.revision + 1, layers: [...document.layers, layer] }
}

export function addMapLayer(document: MapDocument, input: { readonly id: string; readonly name: string; readonly parentId?: string }): MapDocument {
  if (document.layers.length >= MAXIMUM_MAP_LAYERS) throw new RangeError('MAP_LAYER_LIMIT')
  if (!input.id || !input.name.trim()) throw new Error('MAP_REQUIRED_FIELD')
  if (document.layers.some((layer) => layer.id === input.id)
    || document.tilesets.some((tileset) => tileset.id === input.id)
    || document.autotileSets.some((set) => set.id === input.id)) throw new Error('MAP_DUPLICATE_ID')
  validateMapParent(document, input.id, input.parentId)
  const layer: MapLayer = {
    id: input.id,
    name: input.name.trim(),
    kind: 'tile',
    visible: true,
    locked: false,
    opacity: 1,
    cells: new Map(),
    parentId: input.parentId,
  }
  return { ...document, revision: document.revision + 1, activeLayerId: layer.id, layers: [...document.layers, layer] }
}

export function removeMapLayer(document: MapDocument, layerId: string): MapDocument {
  const target = requireLayer(document, layerId)
  if (document.layers.length === 1) throw new Error('MAP_REQUIRES_LAYER')
  const layers = document.layers.filter((layer) => layer.id !== layerId).map((layer) => layer.parentId === layerId ? { ...layer, parentId: target.parentId } : layer)
  return {
    ...document,
    revision: document.revision + 1,
    activeLayerId: document.activeLayerId === layerId ? layers[0]!.id : document.activeLayerId,
    layers,
  }
}

export function updateMapLayer(
  document: MapDocument,
  layerId: string,
  patch: { readonly name?: string; readonly visible?: boolean; readonly locked?: boolean; readonly opacity?: number; readonly parentId?: string; readonly collapsed?: boolean },
): MapDocument {
  const layer = requireLayer(document, layerId)
  const name = patch.name === undefined ? layer.name : patch.name.trim()
  const opacity = patch.opacity ?? layer.opacity
  if (!name) throw new Error('MAP_REQUIRED_FIELD')
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw new RangeError('MAP_LAYER_OPACITY_INVALID')
  if ('parentId' in patch) validateMapParent(document, layerId, patch.parentId)
  const next = { ...layer, ...patch, name, opacity }
  if (next.name === layer.name && next.visible === layer.visible && next.locked === layer.locked && next.opacity === layer.opacity && next.parentId === layer.parentId && next.collapsed === layer.collapsed) return document
  return replaceLayer(document, next)
}

export function setMapLayerParent(document: MapDocument, layerId: string, parentId?: string): MapDocument {
  return updateMapLayer(document, layerId, { parentId })
}

export function selectMapLayer(document: MapDocument, layerId: string): MapDocument {
  requireLayer(document, layerId)
  return document.activeLayerId === layerId ? document : { ...document, revision: document.revision + 1, activeLayerId: layerId }
}

export function reorderMapLayer(document: MapDocument, layerId: string, targetIndex: number): MapDocument {
  const index = document.layers.findIndex((layer) => layer.id === layerId)
  if (index < 0) throw new Error('MAP_LAYER_NOT_FOUND')
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= document.layers.length) throw new RangeError('MAP_LAYER_INDEX_INVALID')
  if (index === targetIndex) return document
  const layers = [...document.layers]
  const [layer] = layers.splice(index, 1)
  layers.splice(targetIndex, 0, layer!)
  return { ...document, revision: document.revision + 1, layers }
}

export function duplicateMapLayer(document: MapDocument, layerId: string, id: string): MapDocument {
  if (document.layers.length >= MAXIMUM_MAP_LAYERS) throw new RangeError('MAP_LAYER_LIMIT')
  if (!id || document.layers.some((layer) => layer.id === id) || document.tilesets.some((tileset) => tileset.id === id) || document.autotileSets.some((set) => set.id === id)) throw new Error('MAP_DUPLICATE_ID')
  const source = requireLayer(document, layerId)
  const copy: MapLayer = { ...source, id, name: `${source.name} copy`, cells: new Map(source.cells) }
  return { ...document, revision: document.revision + 1, activeLayerId: id, layers: [...document.layers, copy] }
}

export type ResizeAnchor =
  | 'top-left' | 'top' | 'top-right'
  | 'left' | 'center' | 'right'
  | 'bottom-left' | 'bottom' | 'bottom-right'

export interface ResizeMapResult {
  readonly document: MapDocument
  readonly croppedCells: number
}

function anchorOffset(oldSize: number, nextSize: number, position: 'start' | 'center' | 'end'): number {
  const difference = nextSize - oldSize
  return position === 'start' ? 0 : position === 'end' ? difference : Math.floor(difference / 2)
}

export function resizeMapDocument(document: MapDocument, width: number, height: number, anchor: ResizeAnchor): ResizeMapResult {
  for (const value of [width, height]) if (!Number.isInteger(value) || value < 1 || value > 4096) throw new RangeError('MAP_DIMENSION_OUT_OF_BOUNDS')
  if (width === document.width && height === document.height) return { document, croppedCells: 0 }
  const positions: Record<ResizeAnchor, readonly ['top' | 'center' | 'bottom', 'left' | 'center' | 'right']> = {
    'top-left': ['top', 'left'], top: ['top', 'center'], 'top-right': ['top', 'right'],
    left: ['center', 'left'], center: ['center', 'center'], right: ['center', 'right'],
    'bottom-left': ['bottom', 'left'], bottom: ['bottom', 'center'], 'bottom-right': ['bottom', 'right'],
  }
  const [vertical, horizontal] = positions[anchor]
  const xPosition = horizontal === 'left' ? 'start' : horizontal === 'right' ? 'end' : 'center'
  const yPosition = vertical === 'top' ? 'start' : vertical === 'bottom' ? 'end' : 'center'
  const offsetX = anchorOffset(document.width, width, xPosition)
  const offsetY = anchorOffset(document.height, height, yPosition)
  let croppedCells = 0
  const layers = document.layers.map((layer) => {
    const cells = new Map<string, TileReference>()
    for (const [key, tile] of layer.cells) {
      const coordinate = parseCoordinate(key)
      const x = coordinate.x + offsetX
      const y = coordinate.y + offsetY
      if (x < 0 || y < 0 || x >= width || y >= height) { croppedCells += 1; continue }
      cells.set(`${x},${y}`, tile)
    }
    return { ...layer, cells }
  })
  return { document: { ...document, revision: document.revision + 1, width, height, layers }, croppedCells }
}

export function addTileset(document: MapDocument, tileset: TilesetContract): MapDocument {
  if (document.tilesets.length >= MAXIMUM_MAP_TILESETS) throw new RangeError('MAP_TILESET_LIMIT')
  validateTilesetGeometry(tileset)
  if (document.tilesets.some((candidate) => candidate.id === tileset.id)
    || document.layers.some((layer) => layer.id === tileset.id)
    || document.autotileSets.some((set) => set.id === tileset.id)) throw new Error('MAP_DUPLICATE_ID')
  return { ...document, revision: document.revision + 1, tilesets: [...document.tilesets, { ...tileset }] }
}

export function removeTileset(document: MapDocument, tilesetId: string): MapDocument {
  if (!document.tilesets.some((tileset) => tileset.id === tilesetId)) throw new Error('MAP_TILESET_NOT_FOUND')
  return {
    ...document,
    revision: document.revision + 1,
    tilesets: document.tilesets.filter((tileset) => tileset.id !== tilesetId),
    autotileSets: document.autotileSets.filter((set) => set.tilesetId !== tilesetId),
  }
}

export function updateTileset(document: MapDocument, tilesetId: string, patch: { readonly name?: string }): MapDocument {
  const tileset = document.tilesets.find((candidate) => candidate.id === tilesetId)
  if (!tileset) throw new Error('MAP_TILESET_NOT_FOUND')
  const name = patch.name?.trim() ?? tileset.name
  if (!name) throw new Error('MAP_REQUIRED_FIELD')
  if (name === tileset.name) return document
  return { ...document, revision: document.revision + 1, tilesets: document.tilesets.map((item) => item.id === tilesetId ? { ...item, name } : item) }
}

export function orphanTileDiagnostics(document: MapDocument): readonly OrphanTileDiagnostic[] {
  const knownTilesets = new Map(document.tilesets.map((tileset) => [tileset.id, tileset]))
  const grouped = new Map<string, OrphanTileCoordinate[]>()
  const counts = new Map<string, number>()
  for (const layer of document.layers) {
    for (const [key, tile] of layer.cells) {
      const tileset = knownTilesets.get(tile.tilesetId)
      const invalid = !tileset || tile.tileId < 0 || tile.tileId >= tileset.tileCount
      if (!invalid) continue
      const groupKey = tileset ? `tile:${tile.tilesetId}:${tile.tileId}` : `orphan:${tile.tilesetId}`
      counts.set(groupKey, (counts.get(groupKey) ?? 0) + 1)
      const coordinates = grouped.get(groupKey) ?? []
      if (coordinates.length < 100) coordinates.push({ layerId: layer.id, ...parseCoordinate(key) })
      grouped.set(groupKey, coordinates)
    }
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([groupKey, count]) => {
    const [, tilesetId, tileId] = groupKey.split(':')
    const missingTileset = groupKey.startsWith('orphan:')
    return {
    code: missingTileset ? 'MAP_ORPHAN_TILESET' : 'MAP_ORPHAN_TILE',
    severity: 'error',
    groupKey,
    count,
    message: missingTileset
      ? (count === 1 ? '1 celda referencia un tileset eliminado.' : `${count} celdas referencian un tileset eliminado.`)
      : (count === 1 ? `1 celda referencia tile ${tileId} fuera del tileset.` : `${count} celdas referencian tile ${tileId} fuera del tileset.`),
    tilesetId: tilesetId!,
    coordinates: grouped.get(groupKey) ?? [],
  }
  })
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
    lines.push(`T|${tileset.id}|${tileset.name}|${tileset.assetId}|${tileset.imageWidth}|${tileset.imageHeight}|${tileset.tileWidth}|${tileset.tileHeight}|${tileset.marginX}|${tileset.marginY}|${tileset.spacingX}|${tileset.spacingY}|${tileset.offsetX ?? 0}|${tileset.offsetY ?? 0}|${tileset.sha256 ?? ''}|${tileset.byteSize ?? ''}|${tileset.mediaType ?? ''}|${tileset.tileCount}`)
  }
  lines.push(`B|${document.background.kind}|${document.background.kind === 'color' ? document.background.color : ''}`)
  lines.push(`G|${document.grid.visible}|${document.grid.color}`)
  for (const set of [...document.autotileSets].sort((left, right) => left.id.localeCompare(right.id))) {
    lines.push(`A|${set.id}|${set.name}|${set.tilesetId}|${set.centerTileId}|${JSON.stringify(set.terrain)}|${JSON.stringify(set.contour)}`)
  }
  for (const layer of document.layers) {
    lines.push(`L|${layer.id}|${layer.name}|${layer.visible}|${layer.locked}|${layer.opacity}`)
    const cells = [...layer.cells.entries()].map(([key, tile]) => ({ ...parseCoordinate(key), tile }))
      .sort((left, right) => left.y - right.y || left.x - right.x)
    for (const cell of cells) lines.push(`C|${cell.x}|${cell.y}|${cell.tile.tilesetId}|${cell.tile.tileId}|${!!cell.tile.flipX}|${!!cell.tile.flipY}|${cell.tile.rotation ?? 0}|${cell.tile.autotileSetId ?? ''}|${cell.tile.autotileProfile ?? ''}`)
  }
  return fnv1a64(`${lines.join('\n')}\n`)
}

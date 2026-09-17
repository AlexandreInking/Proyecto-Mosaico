import type { GridCoordinate, MapDocument, MapLayer, TileReference } from './map-document.js'

type MapHeader = Omit<MapDocument, 'layers'>
type LayerDescriptor = Omit<MapLayer, 'cells'>

export interface MapDirtyBounds {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export interface MapCellDelta {
  readonly key: string
  readonly before?: TileReference
  readonly after?: TileReference
}

export interface MapLayerDelta {
  readonly id: string
  readonly cells: readonly MapCellDelta[]
}

export interface MapDocumentDelta {
  readonly before: { readonly header: MapHeader; readonly layers: readonly LayerDescriptor[] }
  readonly after: { readonly header: MapHeader; readonly layers: readonly LayerDescriptor[] }
  readonly layerChanges: readonly MapLayerDelta[]
  readonly dirtyBounds?: MapDirtyBounds
}

const descriptor = ({ cells: _cells, ...layer }: MapLayer): LayerDescriptor => layer
const header = ({ layers: _layers, ...document }: MapDocument): MapHeader => document
const sameTile = (left?: TileReference, right?: TileReference) =>
  left?.tilesetId === right?.tilesetId && left?.tileId === right?.tileId && !!left?.flipX === !!right?.flipX
  && !!left?.flipY === !!right?.flipY && (left?.rotation ?? 0) === (right?.rotation ?? 0)
  && left?.autotileSetId === right?.autotileSetId && left?.autotileProfile === right?.autotileProfile

function coordinate(key: string): GridCoordinate {
  const separator = key.indexOf(',')
  return { x: Number(key.slice(0, separator)), y: Number(key.slice(separator + 1)) }
}

export function createMapDocumentDelta(before: MapDocument, after: MapDocument): MapDocumentDelta {
  const beforeLayers = new Map(before.layers.map((layer) => [layer.id, layer]))
  const afterLayers = new Map(after.layers.map((layer) => [layer.id, layer]))
  const layerChanges: MapLayerDelta[] = []
  let left = Infinity; let top = Infinity; let right = -Infinity; let bottom = -Infinity
  for (const id of new Set([...beforeLayers.keys(), ...afterLayers.keys()])) {
    const oldCells = beforeLayers.get(id)?.cells ?? new Map<string, TileReference>()
    const newCells = afterLayers.get(id)?.cells ?? new Map<string, TileReference>()
    const cells: MapCellDelta[] = []
    for (const key of new Set([...oldCells.keys(), ...newCells.keys()])) {
      const oldTile = oldCells.get(key); const newTile = newCells.get(key)
      if (sameTile(oldTile, newTile)) continue
      cells.push({ key, before: oldTile, after: newTile })
      const point = coordinate(key); left = Math.min(left, point.x); top = Math.min(top, point.y); right = Math.max(right, point.x); bottom = Math.max(bottom, point.y)
    }
    if (cells.length) layerChanges.push({ id, cells })
  }
  const headerChanged = before.width !== after.width || before.height !== after.height || before.cellWidth !== after.cellWidth || before.cellHeight !== after.cellHeight
    || before.background.kind !== after.background.kind || (before.background.kind === 'color' && after.background.kind === 'color' && before.background.color !== after.background.color)
    || before.grid.visible !== after.grid.visible || before.grid.color !== after.grid.color
  const fullBounds = headerChanged ? { left: 0, top: 0, right: Math.max(before.width, after.width) - 1, bottom: Math.max(before.height, after.height) - 1 } : undefined
  return {
    before: { header: header(before), layers: before.layers.map(descriptor) },
    after: { header: header(after), layers: after.layers.map(descriptor) },
    layerChanges,
    dirtyBounds: fullBounds ?? (left === Infinity ? undefined : { left, top, right, bottom }),
  }
}

export function applyMapDocumentDelta(current: MapDocument, delta: MapDocumentDelta, direction: 'undo' | 'redo'): MapDocument {
  const target = direction === 'undo' ? delta.before : delta.after
  const currentLayers = new Map(current.layers.map((layer) => [layer.id, layer]))
  const changes = new Map(delta.layerChanges.map((layer) => [layer.id, layer.cells]))
  const layers: MapLayer[] = target.layers.map((description) => {
    const cells = new Map(currentLayers.get(description.id)?.cells)
    for (const change of changes.get(description.id) ?? []) {
      const tile = direction === 'undo' ? change.before : change.after
      if (tile) cells.set(change.key, tile); else cells.delete(change.key)
    }
    return { ...description, cells }
  })
  return { ...target.header, layers }
}

import { describe, expect, it } from 'vitest'
import {
  addMapLayer,
  addTileset,
  applyMapCells,
  createMapDocument,
  connectedTileRegion,
  connectedTileRegionAsync,
  duplicateMapLayer,
  getTile,
  resizeMapDocument,
  reorderMapLayer,
  removeTileset,
  setTile,
  transformTile,
  updateMapLayer,
  type MapDocument,
  type TileReference,
} from '../src/index.js'

const tilesetId = '10000000-0000-4000-8000-000000000001'
const layerId = '20000000-0000-4000-8000-000000000001'
const tileset = {
  id: tilesetId, name: 'Terrain', assetId: 'asset', imageWidth: 32, imageHeight: 16, tileWidth: 16, tileHeight: 16,
  marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 2,
}
const tile: TileReference = { tilesetId, tileId: 0 }

function createDocument(): MapDocument {
  return createMapDocument({
    id: '30000000-0000-4000-8000-000000000001',
    name: 'Advanced',
    width: 4,
    height: 3,
    cellWidth: 16,
    cellHeight: 16,
    layerId,
    tilesets: [tileset],
  })
}

describe('advanced orthogonal map domain', () => {
  it('creates v3 map metadata with safe defaults', () => {
    const document = createDocument()
    expect(document.formatVersion).toBe(3)
    expect(document.background).toEqual({ kind: 'transparent' })
    expect(document.grid).toEqual({ visible: true, color: '#41505899' })
    expect(document.autotileSets).toEqual([])
    expect(() => createMapDocument({ id: crypto.randomUUID(), name: 'Bad', width: 1, height: 1, cellWidth: 16, cellHeight: 16, layerId: crypto.randomUUID(), background: { kind: 'color', color: '#fff' } })).toThrow('MAP_COLOR_INVALID')
    expect(() => createMapDocument({ id: crypto.randomUUID(), name: 'Bad tileset', width: 1, height: 1, cellWidth: 16, cellHeight: 16, layerId: crypto.randomUUID(), tilesets: [{ ...tileset, tileCount: 3 }] })).toThrow('MAP_TILESET_GEOMETRY_INVALID')
  })

  it('applies a bulk patch with one revision and rejects hidden layers', () => {
    const initial = createDocument()
    const painted = applyMapCells(initial, layerId, [
      { x: 0, y: 0, tile },
      { x: 1, y: 0, tile: { ...tile, tileId: 1 } },
    ])
    expect(painted.revision).toBe(1)
    expect(getTile(painted, layerId, { x: 1, y: 0 })?.tileId).toBe(1)

    const hidden = updateMapLayer(painted, layerId, { visible: false })
    expect(() => setTile(hidden, layerId, { x: 2, y: 0 }, tile)).toThrow('MAP_LAYER_HIDDEN')
  })

  it('resizes from any anchor and reports cropped cells', () => {
    const source = applyMapCells(createDocument(), layerId, [
      { x: 0, y: 0, tile },
      { x: 3, y: 2, tile: { ...tile, tileId: 1 } },
    ])
    const expanded = resizeMapDocument(source, 6, 5, 'bottom-right')
    expect(expanded.croppedCells).toBe(0)
    expect(getTile(expanded.document, layerId, { x: 2, y: 2 })?.tileId).toBe(0)
    expect(getTile(expanded.document, layerId, { x: 5, y: 4 })?.tileId).toBe(1)

    const reduced = resizeMapDocument(source, 2, 2, 'top-left')
    expect(reduced.croppedCells).toBe(1)
    expect(getTile(reduced.document, layerId, { x: 0, y: 0 })).toEqual(tile)
  })

  it('updates, reorders and duplicates layers without sharing mutable cells', () => {
    const withSecond = addMapLayer(createDocument(), { id: '20000000-0000-4000-8000-000000000002', name: 'Top' })
    const renamed = updateMapLayer(withSecond, layerId, { name: 'Ground', opacity: 0.4 })
    const reordered = reorderMapLayer(renamed, layerId, 1)
    expect(reordered.layers.map((layer) => layer.name)).toEqual(['Top', 'Ground'])
    const duplicated = duplicateMapLayer(reordered, layerId, '20000000-0000-4000-8000-000000000003')
    expect(duplicated.layers.at(-1)).toMatchObject({ name: 'Ground copy', opacity: 0.4 })
    expect(duplicated.layers.at(-1)?.cells).not.toBe(duplicated.layers[1]?.cells)
  })

  it('composes flip and rotation metadata without duplicating textures', () => {
    expect(transformTile(tile, { flipX: true, rotation: 90 })).toEqual({
      ...tile, flipX: true, flipY: false, rotation: 90,
    })
    expect(transformTile({ ...tile, rotation: 270 }, { rotation: 90 })).toEqual({
      ...tile, flipX: false, flipY: false, rotation: 0,
    })
  })

  it('rejects quarter-turn transforms for rectangular source tiles', () => {
    const rectangular = addTileset(createDocument(), {
      id: crypto.randomUUID(), name: 'Rectangular', assetId: 'asset-rect', imageWidth: 24, imageHeight: 16,
      tileWidth: 24, tileHeight: 16, marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 1,
    })
    expect(() => setTile(rectangular, rectangular.activeLayerId, { x: 0, y: 0 }, { tilesetId: rectangular.tilesets[1]!.id, tileId: 0, rotation: 90 }))
      .toThrow('MAP_ROTATION_REQUIRES_SQUARE_TILE')
  })

  it('adds tilesets and removes their autotile configuration', () => {
    const tileset = { id: crypto.randomUUID(), name: 'Sheet', assetId: 'asset', imageWidth: 16, imageHeight: 16, tileWidth: 16, tileHeight: 16, marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 1 }
    const withTileset = addTileset(createDocument(), tileset)
    const configured = { ...withTileset, autotileSets: [{ id: crypto.randomUUID(), name: 'Terrain', tilesetId: tileset.id, centerTileId: 0, terrain: {}, contour: {} }] }
    expect(removeTileset(configured, tileset.id).autotileSets).toEqual([])
  })

  it('finds connected regions iteratively with four-way connectivity', () => {
    let document = createDocument()
    document = applyMapCells(document, layerId, [{ x: 0, y: 0, tile }, { x: 1, y: 0, tile }, { x: 1, y: 1, tile }, { x: 3, y: 2, tile }])
    expect(connectedTileRegion(document, layerId, { x: 0, y: 0 })).toHaveLength(3)
  })

  it('yields and supports cancellation during cooperative fill scans', async () => {
    const controller = new AbortController(); controller.abort()
    await expect(connectedTileRegionAsync(createDocument(), layerId, { x: 0, y: 0 }, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })
})

import { describe, expect, it } from 'vitest'
import {
  addMapLayer,
  addMapFolder,
  createMapDocument,
  eraseTile,
  fillTiles,
  getTile,
  mapSemanticFingerprint,
  orphanTileDiagnostics,
  removeMapLayer,
  removeTileset,
  setTile,
  setMapLayerParent,
  type MapDocument,
  type TileReference,
} from '../src/index.js'

const layerId = '00000000-0000-4000-8000-000000000002'
const tilesetId = '00000000-0000-4000-8000-000000000003'
const grass: TileReference = { tilesetId, tileId: 0 }
const stone: TileReference = { tilesetId, tileId: 1 }

function createDocument(): MapDocument {
  return createMapDocument({
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Test',
    width: 4,
    height: 3,
    cellWidth: 16,
    cellHeight: 16,
    layerId,
    tilesets: [{
      id: tilesetId,
      name: 'Terrain',
      assetId: 'asset-terrain',
      imageWidth: 32,
      imageHeight: 32,
      tileWidth: 16,
      tileHeight: 16,
      marginX: 0,
      marginY: 0,
      spacingX: 0,
      spacingY: 0,
      tileCount: 4,
    }],
  })
}

describe('orthogonal map domain', () => {
  it('sets and erases tiles without mutating previous revisions', () => {
    const original = createDocument()
    const painted = setTile(original, layerId, { x: 1, y: 2 }, grass)
    const erased = eraseTile(painted, layerId, { x: 1, y: 2 })

    expect(getTile(original, layerId, { x: 1, y: 2 })).toBeUndefined()
    expect(getTile(painted, layerId, { x: 1, y: 2 })).toEqual(grass)
    expect(getTile(erased, layerId, { x: 1, y: 2 })).toBeUndefined()
    expect([original.revision, painted.revision, erased.revision]).toEqual([0, 1, 2])
  })

  it('rejects writes outside logical bounds and locked layers', () => {
    const document = createDocument()
    expect(() => setTile(document, layerId, { x: 4, y: 0 }, grass)).toThrow('MAP_COORDINATE_OUT_OF_BOUNDS')

    const locked = { ...document, layers: document.layers.map((layer) => ({ ...layer, locked: true })) }
    expect(() => setTile(locked, layerId, { x: 0, y: 0 }, grass)).toThrow('MAP_LAYER_LOCKED')
  })

  it('flood fills one bounded contiguous region', () => {
    let document = createDocument()
    for (let y = 0; y < document.height; y += 1) document = setTile(document, layerId, { x: 2, y }, stone)

    const filled = fillTiles(document, layerId, { x: 0, y: 0 }, grass)
    expect(filled.layers[0]?.cells.size).toBe(9)
    expect(getTile(filled, layerId, { x: 1, y: 2 })).toEqual(grass)
    expect(getTile(filled, layerId, { x: 3, y: 2 })).toBeUndefined()
    expect(getTile(filled, layerId, { x: 2, y: 2 })).toEqual(stone)
  })

  it('retains tile references and groups diagnostics after removing a tileset', () => {
    const painted = setTile(createDocument(), layerId, { x: 0, y: 0 }, grass)
    const withoutTileset = removeTileset(painted, tilesetId)

    expect(getTile(withoutTileset, layerId, { x: 0, y: 0 })).toEqual(grass)
    expect(orphanTileDiagnostics(withoutTileset)).toEqual([{
      code: 'MAP_ORPHAN_TILESET',
      severity: 'error',
      groupKey: `orphan:${tilesetId}`,
      count: 1,
      message: '1 celda referencia un tileset eliminado.',
      tilesetId,
      coordinates: [{ layerId, x: 0, y: 0 }],
    }])
  })

  it('preserves at least one layer and assigns a new active layer when deleting', () => {
    const withSecond = addMapLayer(createDocument(), {
      id: '00000000-0000-4000-8000-000000000004',
      name: 'Objetos',
    })
    const removed = removeMapLayer(withSecond, layerId)

    expect(removed.layers).toHaveLength(1)
    expect(removed.activeLayerId).toBe('00000000-0000-4000-8000-000000000004')
    expect(() => removeMapLayer(removed, removed.activeLayerId)).toThrow('MAP_REQUIRES_LAYER')
  })

  it('creates folders and reparents layers without allowing cycles', () => {
    const folderId = '00000000-0000-4000-8000-000000000005'
    const childId = '00000000-0000-4000-8000-000000000006'
    const withFolder = addMapFolder(createDocument(), { id: folderId, name: 'Decoración' })
    const withChild = addMapLayer(withFolder, { id: childId, name: 'Objetos', parentId: folderId })
    expect(withChild.layers.find((layer) => layer.id === folderId)).toMatchObject({ isFolder: true, collapsed: false })
    expect(withChild.layers.find((layer) => layer.id === childId)?.parentId).toBe(folderId)
    expect(() => setMapLayerParent(withChild, folderId, folderId)).toThrow('MAP_LAYER_PARENT_INVALID')
    expect(() => setMapLayerParent(withChild, folderId, childId)).toThrow('MAP_LAYER_PARENT_INVALID')
  })

  it('produces same semantic fingerprint regardless of paint insertion order', () => {
    const first = setTile(setTile(createDocument(), layerId, { x: 1, y: 0 }, grass), layerId, { x: 0, y: 0 }, stone)
    const second = setTile(setTile(createDocument(), layerId, { x: 0, y: 0 }, stone), layerId, { x: 1, y: 0 }, grass)

    expect(mapSemanticFingerprint(first)).toBe(mapSemanticFingerprint(second))
  })
})

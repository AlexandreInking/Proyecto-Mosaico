import { describe, expect, it } from 'vitest'
import { addMapLayer, applyMapCells, applyMapDocumentDelta, createMapDocument, createMapDocumentDelta, mapSemanticFingerprint, updateMapLayer } from '../src/index.js'

const tileset = { id: crypto.randomUUID(), name: 'Tiles', assetId: 'asset', imageWidth: 16, imageHeight: 16, tileWidth: 16, tileHeight: 16, marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 1 }

describe('map document deltas', () => {
  it('undoes and redoes cell, layer and metadata changes without storing full cell maps', () => {
    const before = createMapDocument({ id: crypto.randomUUID(), name: 'Map', width: 4, height: 4, cellWidth: 16, cellHeight: 16, layerId: crypto.randomUUID(), tilesets: [tileset] })
    let after = applyMapCells(before, before.activeLayerId, [{ x: 2, y: 1, tile: { tilesetId: tileset.id, tileId: 0 } }])
    after = addMapLayer(after, { id: crypto.randomUUID(), name: 'Top' })
    after = updateMapLayer(after, before.activeLayerId, { opacity: 0.5 })
    const delta = createMapDocumentDelta(before, after)
    expect(delta.dirtyBounds).toEqual({ left: 2, top: 1, right: 2, bottom: 1 })
    expect(delta.layerChanges[0]?.cells).toHaveLength(1)
    expect(mapSemanticFingerprint(applyMapDocumentDelta(after, delta, 'undo'))).toBe(mapSemanticFingerprint(before))
    expect(mapSemanticFingerprint(applyMapDocumentDelta(before, delta, 'redo'))).toBe(mapSemanticFingerprint(after))
  })

  it('marks full map dirty when resize or background changes', () => {
    const before = createMapDocument({ id: crypto.randomUUID(), name: 'Map', width: 4, height: 4, cellWidth: 16, cellHeight: 16, layerId: crypto.randomUUID() })
    const after = { ...before, width: 8, height: 6, background: { kind: 'color' as const, color: '#102030ff' } }
    expect(createMapDocumentDelta(before, after).dirtyBounds).toEqual({ left: 0, top: 0, right: 7, bottom: 5 })
  })
})

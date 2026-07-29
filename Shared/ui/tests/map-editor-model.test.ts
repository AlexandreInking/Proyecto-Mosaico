import { describe, expect, it } from 'vitest'
import { createMapDocument, setTile } from '@mosaico/domain'
import { captureSelection, moveSelection, pastePattern, patternChanges, prepareClipboardPaste, selectionBetween, transformPattern, visibleSliceIndexes } from '../src/map-editor-model.js'

const tileset = { id: '10000000-0000-4000-8000-000000000001', name: 'Sheet', assetId: 'asset', imageWidth: 32, imageHeight: 16, tileWidth: 16, tileHeight: 16, marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 2 }
const create = () => createMapDocument({ id: crypto.randomUUID(), name: 'Map', width: 4, height: 4, cellWidth: 16, cellHeight: 16, layerId: crypto.randomUUID(), tilesets: [tileset] })

describe('map editor model', () => {
  it('virtualizes tilesheet preview boxes around viewport', () => {
    const indexes = visibleSliceIndexes({ columns: 1000, rows: 1000, tileWidth: 16, tileHeight: 16, spacingX: 2, spacingY: 2, originX: 4, originY: 4, zoom: 1, scrollLeft: 1600, scrollTop: 1600, viewportWidth: 160, viewportHeight: 160 })
    expect(indexes.length).toBeLessThan(200)
    expect(indexes).toContain(90 * 1000 + 90)
  })

  it('stamps a rectangular pattern clipped to map bounds', () => {
    const changes = patternChanges(create(), [{ x: 3, y: 3 }], { width: 2, height: 1, cells: [{ tilesetId: tileset.id, tileId: 0 }, { tilesetId: tileset.id, tileId: 1 }] })
    expect(changes).toEqual([{ x: 3, y: 3, tile: { tilesetId: tileset.id, tileId: 0 } }])
  })

  it('preserves empty cells so paste and move clear destination tiles', () => {
    const changes = patternChanges(create(), [{ x: 1, y: 1 }], { width: 2, height: 1, cells: [{ tilesetId: tileset.id, tileId: 0 }, undefined] })
    expect(changes).toEqual([{ x: 1, y: 1, tile: { tilesetId: tileset.id, tileId: 0 } }, { x: 2, y: 1 }])
  })

  it('captures and moves only the active layer in one document revision', () => {
    let document = create()
    document = setTile(document, document.activeLayerId, { x: 0, y: 0 }, { tilesetId: tileset.id, tileId: 1 })
    const before = document.revision
    const moved = moveSelection(document, document.activeLayerId, selectionBetween({ x: 0, y: 0 }, { x: 0, y: 0 }), { x: 2, y: 2 })
    expect(moved.revision).toBe(before + 1)
    expect(captureSelection(moved, moved.activeLayerId, { left: 2, top: 2, width: 1, height: 1 }).cells[0]?.tileId).toBe(1)
  })

  it('rejects paste and move that would clip a selection outside map', () => {
    const document = create()
    const pattern = { width: 2, height: 1, cells: [{ tilesetId: tileset.id, tileId: 0 }, { tilesetId: tileset.id, tileId: 1 }] }
    expect(() => pastePattern(document, document.activeLayerId, { x: 3, y: 0 }, pattern)).toThrow('MAP_SELECTION_OUT_OF_BOUNDS')
    expect(() => moveSelection(document, document.activeLayerId, { left: 0, top: 0, width: 2, height: 1 }, { x: 3, y: 0 })).toThrow('MAP_SELECTION_OUT_OF_BOUNDS')
  })

  it('rotates pattern coordinates and tile metadata', () => {
    const result = transformPattern({ width: 2, height: 1, cells: [{ tilesetId: tileset.id, tileId: 0 }, { tilesetId: tileset.id, tileId: 1 }] }, 'rotate90')
    expect(result).toMatchObject({ width: 1, height: 2 })
    expect(result.cells.map((tile) => tile?.rotation)).toEqual([90, 90])
    expect(transformPattern(result, 'rotate270')).toMatchObject({ width: 2, height: 1 })
  })

  it('remaps clipboard tiles to a destination tileset with matching asset slicing', () => {
    const destinationTileset = { ...tileset, id: '10000000-0000-4000-8000-000000000099' }
    const destination = createMapDocument({ id: crypto.randomUUID(), name: 'Destination', width: 4, height: 4, cellWidth: 16, cellHeight: 16, layerId: crypto.randomUUID(), tilesets: [destinationTileset] })
    const sourcePattern = { width: 1, height: 1, cells: [{ tilesetId: tileset.id, tileId: 1 }] }
    const prepared = prepareClipboardPaste(destination, sourcePattern, [tileset])
    expect(prepared.pattern.cells[0]?.tilesetId).toBe(destinationTileset.id)
    expect(prepared.document.tilesets).toHaveLength(1)
  })

  it('adds a missing clipboard tileset and keeps its stable id', () => {
    const destination = createMapDocument({ id: crypto.randomUUID(), name: 'Destination', width: 4, height: 4, cellWidth: 16, cellHeight: 16, layerId: crypto.randomUUID(), tilesets: [] })
    const sourcePattern = { width: 1, height: 1, cells: [{ tilesetId: tileset.id, tileId: 1 }] }
    const prepared = prepareClipboardPaste(destination, sourcePattern, [tileset])
    expect(prepared.document.tilesets[0]?.id).toBe(tileset.id)
    expect(prepared.pattern.cells[0]?.tilesetId).toBe(tileset.id)
  })
})

import { describe, expect, it } from 'vitest'
import { createMapDocument, setTile } from '@mosaico/domain'
import {
  canvasBackingSize,
  createViewport,
  panViewport,
  pickOrthogonalCell,
  screenToWorld,
  visibleCellRange,
  visibleMapCells,
  worldToScreen,
  zoomViewportAt,
} from '../src/index.js'

describe('orthogonal viewport', () => {
  it('keeps world position fixed beneath cursor while zooming', () => {
    const viewport = createViewport({ width: 800, height: 600, zoom: 1, offsetX: 100, offsetY: 80 })
    const cursor = { x: 320, y: 240 }
    const before = screenToWorld(viewport, cursor)
    const zoomed = zoomViewportAt(viewport, cursor, 2)

    expect(screenToWorld(zoomed, cursor)).toEqual(before)
    expect(worldToScreen(zoomed, before)).toEqual(cursor)
  })

  it('pans in screen pixels and rejects picking outside viewport or map', () => {
    const viewport = panViewport(createViewport({ width: 200, height: 100 }), 20, 10)

    expect(pickOrthogonalCell(viewport, { x: 21, y: 11 }, { width: 4, height: 3, cellWidth: 16, cellHeight: 16 }))
      .toEqual({ x: 0, y: 0 })
    expect(pickOrthogonalCell(viewport, { x: -1, y: 20 }, { width: 4, height: 3, cellWidth: 16, cellHeight: 16 })).toBeUndefined()
    expect(pickOrthogonalCell(viewport, { x: 190, y: 90 }, { width: 4, height: 3, cellWidth: 16, cellHeight: 16 })).toBeUndefined()
  })

  it('returns a clamped visible cell range with exclusive ends', () => {
    const viewport = createViewport({ width: 48, height: 32, offsetX: -16, offsetY: 0 })
    expect(visibleCellRange(viewport, { width: 10, height: 10, cellWidth: 16, cellHeight: 16 }))
      .toEqual({ startX: 1, startY: 0, endX: 4, endY: 2 })
  })

  it('separates CSS viewport size from HiDPI backing pixels', () => {
    expect(canvasBackingSize(333, 201, 2.5)).toEqual({ width: 833, height: 503, resolution: 2.5 })
    expect(() => canvasBackingSize(100, 100, 0)).toThrow('VIEWPORT_DPR_INVALID')
  })

  it('collects only occupied cells intersecting the viewport', () => {
    const tileset = {
      id: '11111111-1111-4111-8111-111111111111', name: 'Tiles', assetId: 'asset',
      imageWidth: 16, imageHeight: 16, tileWidth: 16, tileHeight: 16,
      marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 1,
    }
    let document = createMapDocument({
      id: '22222222-2222-4222-8222-222222222222', name: 'Map', width: 100, height: 100,
      cellWidth: 16, cellHeight: 16, layerId: '33333333-3333-4333-8333-333333333333', tilesets: [tileset],
    })
    document = setTile(document, document.activeLayerId, { x: 1, y: 1 }, { tilesetId: tileset.id, tileId: 0 })
    document = setTile(document, document.activeLayerId, { x: 80, y: 80 }, { tilesetId: tileset.id, tileId: 0 })

    const visible = visibleMapCells(document, createViewport({ width: 64, height: 64 }))
    expect(visible).toHaveLength(1)
    expect(visible[0]).toMatchObject({ x: 1, y: 1, layerId: document.activeLayerId })
  })

  it('renders mixed-size tiles at native size anchored to the cell bottom-left', () => {
    const tileset = {
      id: '11111111-1111-4111-8111-111111111111', name: 'Tall tiles', assetId: 'asset',
      imageWidth: 24, imageHeight: 32, tileWidth: 24, tileHeight: 32,
      marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 1,
    }
    let document = createMapDocument({
      id: '22222222-2222-4222-8222-222222222222', name: 'Map', width: 4, height: 4,
      cellWidth: 16, cellHeight: 16, layerId: '33333333-3333-4333-8333-333333333333', tilesets: [tileset],
    })
    document = setTile(document, document.activeLayerId, { x: 1, y: 1 }, { tilesetId: tileset.id, tileId: 0 })

    expect(visibleMapCells(document, createViewport({ width: 100, height: 100, zoom: 2 }))[0])
      .toMatchObject({ screenX: 32, screenY: 0, screenWidth: 48, screenHeight: 64 })
  })
})

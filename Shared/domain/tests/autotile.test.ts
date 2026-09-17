import { describe, expect, it } from 'vitest'
import {
  BLOB_CLASSES,
  ISOLATED_BLOB_CLASS,
  addAutotileSet,
  applyAutotileCells,
  autotileDiagnostics,
  canonicalBlobMask,
  createMapDocument,
  eraseAutotileCells,
  getTile,
  resolveBlobMask,
  resolveContourMask,
  resolveTerrainRole,
  updateAutotileSet,
  updateMapLayer,
  type AutotileSet,
} from '../src/index.js'

const tilesetId = 'a0000000-0000-4000-8000-000000000001'
const set: AutotileSet = {
  id: 'b0000000-0000-4000-8000-000000000001',
  name: 'Ground',
  tilesetId,
  centerTileId: 0,
  terrain: { top: 1, outerTopLeft: 2, innerTopLeft: 3 },
  contour: { 0: 4, 2: 5, 8: 6, 10: 7 },
}

function document() {
  return addAutotileSet(createMapDocument({
    id: 'c0000000-0000-4000-8000-000000000001',
    name: 'Auto', width: 5, height: 5, cellWidth: 16, cellHeight: 16,
    layerId: 'd0000000-0000-4000-8000-000000000001',
    tilesets: [{
      id: tilesetId, name: 'Terrain', assetId: 'asset',
      imageWidth: 128, imageHeight: 16, tileWidth: 16, tileHeight: 16,
      marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 8,
    }],
  }), set)
}

describe('basic autotiling', () => {
  it('resolves terrain edges and corners deterministically', () => {
    expect(resolveTerrainRole({ north: false, east: true, south: true, west: true })).toBe('top')
    expect(resolveTerrainRole({ north: false, east: true, south: true, west: false })).toBe('outerTopLeft')
    expect(resolveTerrainRole({
      north: true, east: true, south: true, west: true,
      northWest: false, northEast: true, southEast: true, southWest: true,
    })).toBe('innerTopLeft')
  })

  it('encodes all cardinal contour connections as a four-bit mask', () => {
    expect(resolveContourMask({ north: true, east: false, south: true, west: false })).toBe(5)
    expect(resolveContourMask({ north: false, east: true, south: false, west: true })).toBe(10)
  })

  it('covers every terrain role and contour mask deterministically', () => {
    const all = { north: true, east: true, south: true, west: true, northWest: true, northEast: true, southEast: true, southWest: true }
    const roles = [
      [all, 'center'],
      [{ ...all, north: false }, 'top'], [{ ...all, east: false }, 'right'], [{ ...all, south: false }, 'bottom'], [{ ...all, west: false }, 'left'],
      [{ north: false, east: true, south: true, west: false }, 'outerTopLeft'],
      [{ north: false, east: false, south: true, west: true }, 'outerTopRight'],
      [{ north: true, east: false, south: false, west: true }, 'outerBottomRight'],
      [{ north: true, east: true, south: false, west: false }, 'outerBottomLeft'],
      [{ ...all, northWest: false }, 'innerTopLeft'], [{ ...all, northEast: false }, 'innerTopRight'],
      [{ ...all, southEast: false }, 'innerBottomRight'], [{ ...all, southWest: false }, 'innerBottomLeft'],
    ] as const
    for (const [neighbors, role] of roles) expect(resolveTerrainRole(neighbors)).toBe(role)
    for (let mask = 0; mask < 16; mask += 1) expect(resolveContourMask({ north: !!(mask & 1), east: !!(mask & 2), south: !!(mask & 4), west: !!(mask & 8) })).toBe(mask)
  })

  it('applies a contour and recalculates only the changed cells plus neighbors', () => {
    const initial = document()
    const next = applyAutotileCells(initial, initial.activeLayerId, [{ x: 1, y: 2 }, { x: 2, y: 2 }], set.id, 'contour')
    expect(getTile(next, next.activeLayerId, { x: 1, y: 2 })).toMatchObject({ tileId: 5, autotileSetId: set.id, autotileProfile: 'contour' })
    expect(getTile(next, next.activeLayerId, { x: 2, y: 2 })).toMatchObject({ tileId: 6, autotileSetId: set.id, autotileProfile: 'contour' })
  })

  it('erases autotile cells and recalculates surviving neighbors', () => {
    const initial = document()
    const painted = applyAutotileCells(initial, initial.activeLayerId, [{ x: 1, y: 2 }, { x: 2, y: 2 }], set.id, 'contour')
    const next = eraseAutotileCells(painted, painted.activeLayerId, [{ x: 2, y: 2 }])
    expect(getTile(next, next.activeLayerId, { x: 2, y: 2 })).toBeUndefined()
    expect(getTile(next, next.activeLayerId, { x: 1, y: 2 })?.tileId).toBe(4)
  })

  it('recalculates cells when set changes, including locked layers', () => {
    const initial = document()
    const painted = applyAutotileCells(initial, initial.activeLayerId, [{ x: 1, y: 2 }], set.id, 'contour')
    const locked = updateMapLayer(painted, painted.activeLayerId, { locked: true })
    const next = updateAutotileSet(locked, { ...set, contour: { ...set.contour, 0: 7 } })
    expect(getTile(next, next.activeLayerId, { x: 1, y: 2 })?.tileId).toBe(7)
  })

  it('reports missing role assignments only after a profile is used', () => {
    const initial = document()
    expect(autotileDiagnostics(initial)).toHaveLength(0)
    const used = applyAutotileCells(initial, initial.activeLayerId, [{ x: 1, y: 1 }], set.id, 'terrain')
    expect(autotileDiagnostics(used)[0]).toMatchObject({ code: 'MAP_AUTOTILE_ROLE_MISSING', profile: 'terrain', severity: 'warning' })
  })
})

describe('blob autotiling (47/48 pieces)', () => {
  it('reduces the 8-bit neighborhood to exactly 47 canonical classes', () => {
    expect(BLOB_CLASSES).toHaveLength(47)
    expect(new Set(BLOB_CLASSES).size).toBe(47)
    for (let mask = 0; mask <= 255; mask += 1) expect(BLOB_CLASSES).toContain(canonicalBlobMask(mask))
  })

  it('ignores diagonals that lack both adjacent cardinals', () => {
    expect(canonicalBlobMask(0)).toBe(0)
    expect(ISOLATED_BLOB_CLASS).toBe(0)
    // NE sin N+E se ignora
    expect(canonicalBlobMask(2)).toBe(canonicalBlobMask(0))
    // NE con N+E es la pieza de esquina interna
    expect(canonicalBlobMask(1 | 4)).toBe(5)
    expect(canonicalBlobMask(1 | 4 | 2)).toBe(7)
  })

  it('encodes diagonal neighbors into the blob mask', () => {
    expect(resolveBlobMask({ north: true, northEast: true, east: false, south: false, west: false })).toBe(3)
    expect(resolveBlobMask({ north: false, east: true, southWest: true, south: false, west: false })).toBe(36)
  })

  it('resolves blob classes when painting and supports the extra isolated slot', () => {
    const blobSet: AutotileSet = {
      id: 'b0000000-0000-4000-8000-000000000002',
      name: 'Blob', tilesetId, centerTileId: 0, terrain: {}, contour: {},
      layout: 'tiles48',
      blob: {
        [canonicalBlobMask(resolveBlobMask({ north: false, east: true, south: false, west: false }))]: 5,
        [canonicalBlobMask(resolveBlobMask({ north: false, east: false, south: false, west: true }))]: 7,
        extra: 6,
      },
    }
    const withSet = addAutotileSet(document(), blobSet)
    const painted = applyAutotileCells(withSet, withSet.activeLayerId, [{ x: 1, y: 1 }, { x: 2, y: 1 }], blobSet.id, 'blob')
    expect(getTile(painted, painted.activeLayerId, { x: 1, y: 1 })?.tileId).toBe(5)
    expect(getTile(painted, painted.activeLayerId, { x: 2, y: 1 })?.tileId).toBe(7)
    const isolated = applyAutotileCells(withSet, withSet.activeLayerId, [{ x: 4, y: 4 }], blobSet.id, 'blob')
    expect(getTile(isolated, isolated.activeLayerId, { x: 4, y: 4 })?.tileId).toBe(6)
    expect(getTile(isolated, isolated.activeLayerId, { x: 4, y: 4 })?.autotileProfile).toBe('blob')
  })
})

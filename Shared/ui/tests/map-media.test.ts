import { describe, expect, it } from 'vitest'
import { addAutotileSet, addMapLayer, applyMapCells, createMapDocument, mapSemanticFingerprint, removeTileset, serializeMapDocument, updateMapLayer } from '@mosaico/domain'
import { sha256 } from '@mosaico/pipeline'
import { strToU8, zipSync } from 'fflate'
import { createMapPackage, loadMapProject, MAP_PROJECT_EXTENSION, MAP_PROJECT_MEDIA_TYPE, neutralMapJson } from '../src/map-media.js'

describe('map media', () => {
  it('uses mtm for new map project saves while accepting legacy mosaico on load', () => {
    expect(MAP_PROJECT_EXTENSION).toBe('.mtm')
    expect(MAP_PROJECT_MEDIA_TYPE).toBe('application/vnd.mosaico.tilemap+zip')
  })

  it('round-trips a self-contained package and reads legacy plain JSON', async () => {
    const document = createMapDocument({ id: crypto.randomUUID(), name: 'Map', width: 2, height: 2, cellWidth: 16, cellHeight: 16, layerId: crypto.randomUUID() })
    const packageBlob = await createMapPackage(document, new Map())
    expect((await loadMapProject(packageBlob)).document.name).toBe('Map')
    expect((await loadMapProject(new Blob([serializeMapDocument(document)]))).document.name).toBe('Map')
    expect([...new Uint8Array(await (await createMapPackage(document, new Map())).arrayBuffer())])
      .toEqual([...new Uint8Array(await (await createMapPackage(document, new Map())).arrayBuffer())])
  })

  it('loads WPF v1 manifest assets using their safe archive paths', async () => {
    const assetId = '99999999-9999-4999-8999-999999999999'
    const layerId = crypto.randomUUID()
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const hash = await sha256(blob)
    const legacy = {
      format: 'mosaico-project', formatVersion: 1, id: crypto.randomUUID(), name: 'Legacy', orientation: 'orthogonal',
      width: 1, height: 1, cellWidth: 16, cellHeight: 16, activeLayerId: layerId,
      tilesets: [{ id: assetId, name: 'Legacy sheet', assetPath: `assets/${assetId}.png`, imageWidth: 16, imageHeight: 16, tileWidth: 16, tileHeight: 16, marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, sha256: hash }],
      layers: [{ id: layerId, name: 'Layer', order: 0, isVisible: true, isLocked: false, cells: [] }],
    }
    const bytes = zipSync({ 'manifest.json': strToU8(JSON.stringify(legacy)), [`assets/${assetId}.png`]: new Uint8Array(await blob.arrayBuffer()) })
    const loaded = await loadMapProject(new Blob([bytes.slice().buffer as ArrayBuffer]))
    expect(loaded.document.tilesets[0]?.assetId).toBe(assetId)
    expect(loaded.assets.has(assetId)).toBe(true)
  })

  it('emits neutral layer and transform fields', () => {
    const document = createMapDocument({ id: crypto.randomUUID(), name: 'Map', width: 2, height: 2, cellWidth: 16, cellHeight: 16, layerId: crypto.randomUUID() })
    expect(JSON.parse(neutralMapJson(document))).toMatchObject({ format: 'mosaico-neutral-tilemap', map: { width: 2, tileWidth: 16 }, layers: [{ visible: true, locked: false, opacity: 1 }] })
  })

  it('emits neutral tiles in deterministic coordinate order', () => {
    const tileset = { id: crypto.randomUUID(), name: 'Sheet', assetId: 'asset', imageWidth: 16, imageHeight: 16, tileWidth: 16, tileHeight: 16, marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 1 }
    const document = createMapDocument({ id: crypto.randomUUID(), name: 'Map', width: 2, height: 2, cellWidth: 16, cellHeight: 16, layerId: crypto.randomUUID(), tilesets: [tileset] })
    const first = applyMapCells(document, document.activeLayerId, [{ x: 1, y: 1, tile: { tilesetId: tileset.id, tileId: 0 } }])
    const second = applyMapCells(first, first.activeLayerId, [{ x: 0, y: 0, tile: { tilesetId: tileset.id, tileId: 0 } }])
    const tiles = JSON.parse(neutralMapJson(second)).layers[0].tiles
    expect(tiles.map((tile: { x: number; y: number }) => [tile.x, tile.y])).toEqual([[0, 0], [1, 1]])
  })

  it('rejects unsafe neutral asset references', () => {
    const document = createMapDocument({
      id: crypto.randomUUID(), name: 'Unsafe', width: 1, height: 1, cellWidth: 16, cellHeight: 16, layerId: crypto.randomUUID(),
      tilesets: [{ id: crypto.randomUUID(), name: 'Sheet', assetId: '../outside', imageWidth: 16, imageHeight: 16, tileWidth: 16, tileHeight: 16, marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 1 }],
    })
    expect(() => neutralMapJson(document)).toThrow('MAP_ASSET_REFERENCE_INVALID')
  })

  it('round-trips embedded asset bytes with hash verification', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const hash = await sha256(blob)
    const document = createMapDocument({
      id: crypto.randomUUID(), name: 'Assets', width: 1, height: 1, cellWidth: 16, cellHeight: 16, layerId: crypto.randomUUID(),
      tilesets: [{ id: crypto.randomUUID(), name: 'Sheet', assetId: 'asset', imageWidth: 16, imageHeight: 16, tileWidth: 16, tileHeight: 16, marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 1, byteSize: blob.size, sha256: hash, mediaType: 'image/png' }],
    })
    const loaded = await loadMapProject(await createMapPackage(document, new Map([['asset', { blob, url: 'blob:test' }]])))
    expect([...new Uint8Array(await loaded.assets.get('asset')!.blob.arrayBuffer())]).toEqual([1, 2, 3])
  })

  it('round-trips complete map metadata, transforms and layer state', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const hash = await sha256(blob)
    const tileset = { id: crypto.randomUUID(), name: 'Sheet', assetId: 'asset', imageWidth: 16, imageHeight: 16, tileWidth: 16, tileHeight: 16, marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 1, byteSize: blob.size, sha256: hash, mediaType: 'image/png' as const }
    let document = createMapDocument({ id: crypto.randomUUID(), name: 'Complete', width: 2, height: 2, cellWidth: 16, cellHeight: 16, layerId: crypto.randomUUID(), tilesets: [tileset], background: { kind: 'color', color: '#102030ff' }, grid: { visible: false, color: '#ff00ff80' } })
    const auto = { id: crypto.randomUUID(), name: 'Ground', tilesetId: tileset.id, centerTileId: 0, terrain: {}, contour: { 0: 0 } }
    document = addAutotileSet(document, auto)
    document = addMapLayer(document, { id: crypto.randomUUID(), name: 'Top' })
    document = updateMapLayer(document, document.activeLayerId, { visible: false, locked: true, opacity: 0.35 })
    document = applyMapCells(document, document.layers[0]!.id, [{ x: 1, y: 1, tile: { tilesetId: tileset.id, tileId: 0, flipX: true, rotation: 180, autotileSetId: auto.id, autotileProfile: 'contour' } }])
    const loaded = await loadMapProject(await createMapPackage(document, new Map([['asset', { blob, url: 'blob:test' }]])))
    expect(mapSemanticFingerprint(loaded.document)).toBe(mapSemanticFingerprint(document))
  })

  it('rejects embedded assets with a mismatched recorded byte size', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const document = createMapDocument({
      id: crypto.randomUUID(), name: 'Assets', width: 1, height: 1, cellWidth: 16, cellHeight: 16, layerId: crypto.randomUUID(),
      tilesets: [{ id: crypto.randomUUID(), name: 'Sheet', assetId: 'asset', imageWidth: 16, imageHeight: 16, tileWidth: 16, tileHeight: 16, marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 1, byteSize: blob.size + 1, mediaType: 'image/png' }],
    })
    const bytes = zipSync({ 'project.json': strToU8(serializeMapDocument(document)), 'assets/asset.png': new Uint8Array(await blob.arrayBuffer()) })
    await expect(loadMapProject(new Blob([bytes.slice().buffer as ArrayBuffer]))).rejects.toThrow('MAP_PACKAGE_ASSET_SIZE_MISMATCH')
  })

  it('rejects saving an asset whose bytes no longer match the tileset metadata', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const document = createMapDocument({
      id: crypto.randomUUID(), name: 'Assets', width: 1, height: 1, cellWidth: 16, cellHeight: 16, layerId: crypto.randomUUID(),
      tilesets: [{ id: crypto.randomUUID(), name: 'Sheet', assetId: 'asset', imageWidth: 16, imageHeight: 16, tileWidth: 16, tileHeight: 16, marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 1, byteSize: blob.size + 1, mediaType: 'image/png' }],
    })
    await expect(createMapPackage(document, new Map([['asset', { blob, url: 'blob:test' }]]))).rejects.toThrow('MAP_ASSET_SIZE_MISMATCH')
  })

  it('rejects unsafe archive paths before loading project data', async () => {
    const bytes = zipSync({ '../evil.json': strToU8('{}'), 'project.json': strToU8('{}') })
    await expect(loadMapProject(new Blob([bytes.slice().buffer as ArrayBuffer]))).rejects.toThrow('MAP_PACKAGE_ENTRIES_INVALID')
  })

  it('blocks game export when tileset references are orphaned', () => {
    const tileset = { id: crypto.randomUUID(), name: 'Sheet', assetId: 'asset', imageWidth: 16, imageHeight: 16, tileWidth: 16, tileHeight: 16, marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 1 }
    const created = createMapDocument({ id: crypto.randomUUID(), name: 'Orphan', width: 1, height: 1, cellWidth: 16, cellHeight: 16, layerId: crypto.randomUUID(), tilesets: [tileset] })
    const painted = applyMapCells(created, created.activeLayerId, [{ x: 0, y: 0, tile: { tilesetId: tileset.id, tileId: 0 } }])
    expect(() => neutralMapJson(removeTileset(painted, tileset.id))).toThrow('MAP_EXPORT_ORPHANS')
  })
})

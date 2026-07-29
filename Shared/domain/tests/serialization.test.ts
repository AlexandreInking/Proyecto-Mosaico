import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  createMapDocument,
  createSpriteDocument,
  deserializeMapDocument,
  deserializeSpriteDocument,
  getPixel,
  getTile,
  mapSemanticFingerprint,
  migrateLegacyMapManifest,
  orphanTileDiagnostics,
  serializeMapDocument,
  serializeSpriteDocument,
  setPixel,
  setTile,
  spriteSemanticFingerprint,
} from '../src/index.js'

const fixturePath = fileURLToPath(new URL('../../../fixtures/t2/map-v1-wpf-project.json', import.meta.url))

describe('authoring serialization', () => {
  it('writes deterministic map v3 and preserves its semantic fingerprint', () => {
    const tileset = {
      id: '11111111-1111-4111-8111-111111111111', name: 'Tiles', assetId: 'asset',
      imageWidth: 16, imageHeight: 16, tileWidth: 16, tileHeight: 16,
      marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 1,
    }
    const initial = createMapDocument({
      id: '22222222-2222-4222-8222-222222222222', name: 'Mapa', width: 2, height: 2,
      cellWidth: 16, cellHeight: 16, layerId: '33333333-3333-4333-8333-333333333333', tilesets: [tileset],
    })
    const painted = setTile(initial, initial.activeLayerId, { x: 1, y: 1 }, { tilesetId: tileset.id, tileId: 0 })
    const first = serializeMapDocument(painted)
    const second = serializeMapDocument(deserializeMapDocument(first))

    expect(second).toBe(first)
    expect(mapSemanticFingerprint(deserializeMapDocument(first))).toBe(mapSemanticFingerprint(painted))
  })

  it('round-trips exact RGBA sprite bytes', () => {
    const initial = createSpriteDocument({
      id: '44444444-4444-4444-8444-444444444444', name: 'Sprite', width: 2, height: 1,
      layerId: '55555555-5555-4555-8555-555555555555', frameId: '66666666-6666-4666-8666-666666666666',
    })
    const painted = setPixel(initial, initial.activeLayerId, initial.activeFrameId, { x: 1, y: 0 }, { r: 7, g: 8, b: 9, a: 255 })
    const restored = deserializeSpriteDocument(serializeSpriteDocument(painted))

    expect(spriteSemanticFingerprint(restored)).toBe(spriteSemanticFingerprint(painted))
    expect(getPixel(restored, restored.activeLayerId, restored.activeFrameId, { x: 1, y: 0 }))
      .toEqual({ r: 7, g: 8, b: 9, a: 255 })
  })

  it('round-trips tileset source byte size metadata', () => {
    const tileset = {
      id: '11111111-1111-4111-8111-111111111111', name: 'Tiles', assetId: 'asset',
      imageWidth: 16, imageHeight: 16, tileWidth: 16, tileHeight: 16,
      marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 1, byteSize: 1234,
    }
    const document = createMapDocument({
      id: '22222222-2222-4222-8222-222222222222', name: 'Mapa', width: 1, height: 1,
      cellWidth: 16, cellHeight: 16, layerId: '33333333-3333-4333-8333-333333333333', tilesets: [tileset],
    })
    expect(deserializeMapDocument(serializeMapDocument(document)).tilesets[0]?.byteSize).toBe(1234)
  })

  it('migrates WPF v1 IDs, layer order, known tiles and orphan references', () => {
    const legacyText = readFileSync(fixturePath, 'utf8')
    const migrated = migrateLegacyMapManifest(legacyText)

    expect(migrated.formatVersion).toBe(3)
    expect(migrated.id).toBe('77777777-7777-4777-8777-777777777777')
    expect(migrated.tilesets[0]?.assetId).toBe('99999999-9999-4999-8999-999999999999')
    expect(getTile(migrated, migrated.activeLayerId, { x: 0, y: 0 })?.tileId).toBe(1)
    expect(getTile(migrated, migrated.activeLayerId, { x: 2, y: 1 }))
      .toEqual({ tilesetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tileId: 7 })
    expect(orphanTileDiagnostics(migrated)[0]?.count).toBe(1)
    expect(mapSemanticFingerprint(deserializeMapDocument(legacyText))).toBe(mapSemanticFingerprint(migrated))
  })

  it('rejects unsafe asset paths in legacy manifests', () => {
    const legacy = JSON.parse(readFileSync(fixturePath, 'utf8')) as { tilesets: Array<{ assetPath: string }> }
    legacy.tilesets[0]!.assetPath = '../escape.png'
    expect(() => migrateLegacyMapManifest(JSON.stringify(legacy))).toThrow('AUTHORING_FORMAT_INVALID')
  })

  it.each([
    ['invalid JSON', '{'],
    ['wrong format', '{"format":"evil","formatVersion":2}'],
    ['outside coordinate', JSON.stringify({
      format: 'mosaico-map', formatVersion: 2, id: '22222222-2222-4222-8222-222222222222', revision: 0,
      name: 'Bad', orientation: 'orthogonal', width: 1, height: 1, cellWidth: 16, cellHeight: 16,
      activeLayerId: '33333333-3333-4333-8333-333333333333', tilesets: [], layers: [{
        id: '33333333-3333-4333-8333-333333333333', name: 'Layer', kind: 'tile', visible: true, locked: false,
        opacity: 1, cells: [{ x: 1, y: 0, tilesetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tileId: 0 }],
      }],
    })],
  ])('rejects corrupt input: %s', (_name, input) => {
    expect(() => deserializeMapDocument(input)).toThrow('AUTHORING_FORMAT_INVALID')
  })

  it('rejects persisted quarter-turns for rectangular tiles', () => {
    const input = {
      format: 'mosaico-map', formatVersion: 3, id: '22222222-2222-4222-8222-222222222222', revision: 0,
      name: 'Bad rotation', orientation: 'orthogonal', width: 1, height: 1, cellWidth: 16, cellHeight: 16,
      background: { kind: 'transparent' }, grid: { visible: true, color: '#41505899' }, activeLayerId: '33333333-3333-4333-8333-333333333333',
      tilesets: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Rect', assetId: 'asset', imageWidth: 24, imageHeight: 16, tileWidth: 24, tileHeight: 16, marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 1 }],
      autotileSets: [], layers: [{ id: '33333333-3333-4333-8333-333333333333', name: 'Layer', kind: 'tile', visible: true, locked: false, opacity: 1, cells: [{ x: 0, y: 0, tilesetId: '11111111-1111-4111-8111-111111111111', tileId: 0, rotation: 90 }] }],
    }
    expect(() => deserializeMapDocument(JSON.stringify(input))).toThrow('AUTHORING_FORMAT_INVALID')
  })
})

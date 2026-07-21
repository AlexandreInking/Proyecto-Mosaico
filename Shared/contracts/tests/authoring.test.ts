import { describe, expect, it } from 'vitest'
import { mapDocumentSchema, spriteDocumentSchema } from '../src/index.js'

const mapFixture = {
  format: 'mosaico-map',
  formatVersion: 2,
  id: '00000000-0000-4000-8000-000000000001',
  revision: 0,
  name: 'Mapa de prueba',
  orientation: 'orthogonal',
  width: 32,
  height: 18,
  cellWidth: 16,
  cellHeight: 16,
  activeLayerId: '00000000-0000-4000-8000-000000000002',
  tilesets: [{
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Terreno',
    assetId: 'asset-terrain',
    imageWidth: 64,
    imageHeight: 64,
    tileWidth: 16,
    tileHeight: 16,
    marginX: 0,
    marginY: 0,
    spacingX: 0,
    spacingY: 0,
    tileCount: 16,
  }],
  layers: [{
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Suelo',
    kind: 'tile',
    visible: true,
    locked: false,
    opacity: 1,
    cells: [{ x: 0, y: 0, tilesetId: '00000000-0000-4000-8000-000000000003', tileId: 0 }],
  }],
} as const

const spriteFixture = {
  format: 'mosaico-sprite',
  formatVersion: 1,
  id: '00000000-0000-4000-8000-000000000010',
  revision: 0,
  name: 'Hero',
  width: 16,
  height: 16,
  colorMode: 'rgba',
  activeLayerId: '00000000-0000-4000-8000-000000000011',
  activeFrameId: '00000000-0000-4000-8000-000000000012',
  frames: [{ id: '00000000-0000-4000-8000-000000000012', durationMs: 100 }],
  layers: [{
    id: '00000000-0000-4000-8000-000000000011',
    name: 'Capa 1',
    kind: 'raster',
    visible: true,
    locked: false,
    opacity: 1,
    cels: [{ frameId: '00000000-0000-4000-8000-000000000012', rgbaBase64: '' }],
  }],
  palette: ['#00000000', '#ffffffff'],
} as const

describe('T2 authoring contracts', () => {
  it('accepts minimal versioned map and sprite documents', () => {
    expect(mapDocumentSchema.parse(mapFixture)).toBeTruthy()
    expect(spriteDocumentSchema.parse(spriteFixture)).toBeTruthy()
  })

  it('rejects duplicate stable identifiers', () => {
    const duplicateLayer = { ...mapFixture.layers[0], name: 'Duplicada' }
    expect(() => mapDocumentSchema.parse({ ...mapFixture, layers: [mapFixture.layers[0], duplicateLayer] })).toThrow()
  })

  it('rejects map cells outside logical bounds while retaining orphan tileset references', () => {
    const orphan = { ...mapFixture.layers[0], cells: [{ x: 1, y: 1, tilesetId: '00000000-0000-4000-8000-000000000099', tileId: 7 }] }
    expect(mapDocumentSchema.parse({ ...mapFixture, layers: [orphan] })).toBeTruthy()

    const outside = { ...mapFixture.layers[0], cells: [{ x: 32, y: 0, tilesetId: mapFixture.tilesets[0].id, tileId: 0 }] }
    expect(() => mapDocumentSchema.parse({ ...mapFixture, layers: [outside] })).toThrow()

    const invalidKnownTile = { ...mapFixture.layers[0], cells: [{ x: 0, y: 0, tilesetId: mapFixture.tilesets[0].id, tileId: 16 }] }
    expect(() => mapDocumentSchema.parse({ ...mapFixture, layers: [invalidKnownTile] })).toThrow()
  })

  it('rejects sprite cels that reference unknown frames', () => {
    const invalidLayer = { ...spriteFixture.layers[0], cels: [{ frameId: '00000000-0000-4000-8000-000000000099', rgbaBase64: '' }] }
    expect(() => spriteDocumentSchema.parse({ ...spriteFixture, layers: [invalidLayer] })).toThrow()
  })
})

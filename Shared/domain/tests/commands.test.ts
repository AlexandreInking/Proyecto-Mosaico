import { describe, expect, it } from 'vitest'
import {
  CommandHistory,
  createMapCommandRegistry,
  createMapDocument,
  createSpriteCommandRegistry,
  createSpriteDocument,
  getPixel,
  getTile,
  mapSemanticFingerprint,
} from '../src/index.js'

const tileset = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Terreno',
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
}

function createDocument() {
  return createMapDocument({
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Mapa',
    width: 4,
    height: 4,
    cellWidth: 16,
    cellHeight: 16,
    layerId: '33333333-3333-4333-8333-333333333333',
    tilesets: [tileset],
  })
}

describe('authoring command history', () => {
  it('validates parameters before changing document or history', () => {
    const initial = createDocument()
    const history = new CommandHistory(initial, createMapCommandRegistry())

    expect(() => history.execute({
      commandId: 'map.tile.set',
      commandVersion: 1,
      params: { layerId: initial.activeLayerId, x: -1, y: 0, tilesetId: tileset.id, tileId: 0 },
      origin: { kind: 'user' },
    })).toThrow()

    expect(history.document).toBe(initial)
    expect(history.canUndo).toBe(false)
  })

  it('undo and redo restore exact semantic fingerprints', () => {
    const initial = createDocument()
    const history = new CommandHistory(initial, createMapCommandRegistry())
    const initialHash = mapSemanticFingerprint(initial)

    const entry = history.execute({
      commandId: 'map.tile.set',
      commandVersion: 1,
      params: { layerId: initial.activeLayerId, x: 1, y: 2, tilesetId: tileset.id, tileId: 3 },
      origin: { kind: 'user' },
    })
    const paintedHash = mapSemanticFingerprint(history.document)

    expect(entry.beforeFingerprint).toBe(initialHash)
    expect(entry.afterFingerprint).toBe(paintedHash)
    expect(entry.origin).toEqual({ kind: 'user' })
    expect(getTile(history.document, initial.activeLayerId, { x: 1, y: 2 })).toEqual({ tilesetId: tileset.id, tileId: 3 })
    expect(history.undo()).toBe(true)
    expect(mapSemanticFingerprint(history.document)).toBe(initialHash)
    expect(history.redo()).toBe(true)
    expect(mapSemanticFingerprint(history.document)).toBe(paintedHash)
  })

  it('does not commit a command cancelled before execution', () => {
    const initial = createDocument()
    const history = new CommandHistory(initial, createMapCommandRegistry())
    const controller = new AbortController()
    controller.abort()

    expect(() => history.execute({
      commandId: 'map.tile.erase',
      commandVersion: 1,
      params: { layerId: initial.activeLayerId, x: 0, y: 0 },
      origin: { kind: 'generator', id: 'wfc-preview' },
      signal: controller.signal,
    })).toThrow('COMMAND_ABORTED')
    expect(history.document).toBe(initial)
    expect(history.canUndo).toBe(false)
  })

  it('rejects unknown versions and exposes declared schemas', () => {
    const initial = createDocument()
    const registry = createMapCommandRegistry()
    const history = new CommandHistory(initial, registry)

    expect(registry.describe()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'map.tile.set', version: 1 }),
      expect.objectContaining({ id: 'map.tile.fill', version: 1 }),
      expect.objectContaining({ id: 'map.layer.add', version: 1 }),
      expect.objectContaining({ id: 'map.tileset.remove', version: 1 }),
    ]))
    expect(() => history.execute({
      commandId: 'map.tile.set',
      commandVersion: 2,
      params: {},
      origin: { kind: 'script', id: 'test-script' },
    })).toThrow('COMMAND_NOT_REGISTERED')
  })

  it('bounds retained undo snapshots and clears redo after a new command', () => {
    const initial = createDocument()
    const history = new CommandHistory(initial, createMapCommandRegistry(), { capacity: 2 })
    for (let x = 0; x < 3; x += 1) {
      history.execute({
        commandId: 'map.tile.set',
        commandVersion: 1,
        params: { layerId: initial.activeLayerId, x, y: 0, tilesetId: tileset.id, tileId: x },
        origin: { kind: 'user' },
      })
    }
    expect(history.undo()).toBe(true)
    expect(history.undo()).toBe(true)
    expect(history.undo()).toBe(false)
    expect(history.redo()).toBe(true)
    history.execute({
      commandId: 'map.tile.erase',
      commandVersion: 1,
      params: { layerId: initial.activeLayerId, x: 0, y: 0 },
      origin: { kind: 'user' },
    })
    expect(history.canRedo).toBe(false)
  })

  it('commits a map stroke as one undo transaction', () => {
    const initial = createDocument()
    const history = new CommandHistory(initial, createMapCommandRegistry())
    history.execute({
      commandId: 'map.tile.stroke', commandVersion: 1, origin: { kind: 'user' },
      params: {
        layerId: initial.activeLayerId,
        cells: [
          { x: 0, y: 0, tilesetId: tileset.id, tileId: 0 },
          { x: 1, y: 0, tilesetId: tileset.id, tileId: 1 },
        ],
      },
    })
    expect(getTile(history.document, initial.activeLayerId, { x: 1, y: 0 })?.tileId).toBe(1)
    expect(history.undo()).toBe(true)
    expect(mapSemanticFingerprint(history.document)).toBe(mapSemanticFingerprint(initial))
    expect(history.canUndo).toBe(false)
  })

  it('routes pixel strokes and layer edits through the same boundary', () => {
    const initial = createSpriteDocument({
      id: '44444444-4444-4444-8444-444444444444', name: 'Sprite', width: 2, height: 2,
      layerId: '55555555-5555-4555-8555-555555555555', frameId: '66666666-6666-4666-8666-666666666666',
    })
    const registry = createSpriteCommandRegistry()
    const history = new CommandHistory(initial, registry)
    history.execute({
      commandId: 'sprite.pixel.stroke', commandVersion: 1, origin: { kind: 'user' },
      params: {
        layerId: initial.activeLayerId, frameId: initial.activeFrameId,
        pixels: [{ x: 0, y: 0, r: 1, g: 2, b: 3, a: 255 }, { x: 1, y: 0, r: 4, g: 5, b: 6, a: 255 }],
      },
    })
    expect(getPixel(history.document, initial.activeLayerId, initial.activeFrameId, { x: 1, y: 0 }))
      .toEqual({ r: 4, g: 5, b: 6, a: 255 })
    expect(registry.describe()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'sprite.pixel.fill', version: 1 }),
      expect.objectContaining({ id: 'sprite.layer.add', version: 1 }),
    ]))
    expect(history.undo()).toBe(true)
    expect(getPixel(history.document, initial.activeLayerId, initial.activeFrameId, { x: 1, y: 0 }).a).toBe(0)
  })
})

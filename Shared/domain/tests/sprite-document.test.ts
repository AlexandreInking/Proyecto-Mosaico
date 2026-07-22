import { describe, expect, it } from 'vitest'
import {
  addSpriteLayer,
  createSpriteDocument,
  erasePixel,
  fillPixels,
  getPixel,
  removeSpriteLayer,
  selectSpriteLayer,
  updateSpriteLayer,
  setPixel,
  spriteSemanticFingerprint,
  type RgbaColor,
  type SpriteDocument,
} from '../src/index.js'

const layerId = '00000000-0000-4000-8000-000000000011'
const frameId = '00000000-0000-4000-8000-000000000012'
const red: RgbaColor = { r: 255, g: 0, b: 0, a: 255 }
const blue: RgbaColor = { r: 0, g: 64, b: 255, a: 255 }
const transparent: RgbaColor = { r: 0, g: 0, b: 0, a: 0 }

function createDocument(): SpriteDocument {
  return createSpriteDocument({
    id: '00000000-0000-4000-8000-000000000010',
    name: 'Hero',
    width: 4,
    height: 3,
    layerId,
    frameId,
  })
}

describe('pixel sprite domain', () => {
  it('sets and erases RGBA pixels without mutating previous revisions', () => {
    const original = createDocument()
    const painted = setPixel(original, layerId, frameId, { x: 1, y: 2 }, red)
    const erased = erasePixel(painted, layerId, frameId, { x: 1, y: 2 })

    expect(getPixel(original, layerId, frameId, { x: 1, y: 2 })).toEqual(transparent)
    expect(getPixel(painted, layerId, frameId, { x: 1, y: 2 })).toEqual(red)
    expect(getPixel(erased, layerId, frameId, { x: 1, y: 2 })).toEqual(transparent)
    expect([original.revision, painted.revision, erased.revision]).toEqual([0, 1, 2])
  })

  it('does not expose mutable pixel storage', () => {
    const document = createDocument()
    const exported = document.layers[0]?.cels.get(frameId)?.pixels.toUint8Array()
    if (!exported) throw new Error('Expected initial cel')
    exported[0] = 255

    expect(getPixel(document, layerId, frameId, { x: 0, y: 0 })).toEqual(transparent)
  })

  it('rejects pixels outside bounds, invalid channels and locked layers', () => {
    const document = createDocument()
    expect(() => setPixel(document, layerId, frameId, { x: -1, y: 0 }, red)).toThrow('SPRITE_COORDINATE_OUT_OF_BOUNDS')
    expect(() => setPixel(document, layerId, frameId, { x: 0, y: 0 }, { ...red, r: 256 })).toThrow('SPRITE_COLOR_INVALID')

    const locked = { ...document, layers: document.layers.map((layer) => ({ ...layer, locked: true })) }
    expect(() => setPixel(locked, layerId, frameId, { x: 0, y: 0 }, red)).toThrow('SPRITE_LAYER_LOCKED')
  })

  it('flood fills one contiguous RGBA region', () => {
    let document = createDocument()
    for (let y = 0; y < document.height; y += 1) document = setPixel(document, layerId, frameId, { x: 2, y }, blue)

    const filled = fillPixels(document, layerId, frameId, { x: 0, y: 0 }, red)
    expect(getPixel(filled, layerId, frameId, { x: 1, y: 2 })).toEqual(red)
    expect(getPixel(filled, layerId, frameId, { x: 2, y: 2 })).toEqual(blue)
    expect(getPixel(filled, layerId, frameId, { x: 3, y: 2 })).toEqual(transparent)
  })

  it('preserves one raster layer and selects another after deletion', () => {
    const secondId = '00000000-0000-4000-8000-000000000013'
    const withSecond = addSpriteLayer(createDocument(), { id: secondId, name: 'Luz' })
    const removed = removeSpriteLayer(withSecond, layerId)

    expect(removed.layers).toHaveLength(1)
    expect(removed.activeLayerId).toBe(secondId)
    expect(() => removeSpriteLayer(removed, secondId)).toThrow('SPRITE_REQUIRES_LAYER')
  })

  it('selects layers and updates visibility, lock, opacity and name', () => {
    const secondId = '00000000-0000-4000-8000-000000000013'
    const withSecond = addSpriteLayer(createDocument(), { id: secondId, name: 'Luz' })
    const selected = selectSpriteLayer(withSecond, layerId)
    const updated = updateSpriteLayer(selected, layerId, { name: 'Fondo', visible: false, locked: true, opacity: 0.5 })

    expect(updated.activeLayerId).toBe(layerId)
    expect(updated.layers[0]).toMatchObject({ name: 'Fondo', visible: false, locked: true, opacity: 0.5 })
  })

  it('produces a deterministic semantic fingerprint for equal pixels', () => {
    const first = setPixel(setPixel(createDocument(), layerId, frameId, { x: 1, y: 0 }, red), layerId, frameId, { x: 0, y: 0 }, blue)
    const second = setPixel(setPixel(createDocument(), layerId, frameId, { x: 0, y: 0 }, blue), layerId, frameId, { x: 1, y: 0 }, red)

    expect(spriteSemanticFingerprint(first)).toBe(spriteSemanticFingerprint(second))
  })
})

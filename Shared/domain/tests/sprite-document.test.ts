import { describe, expect, it } from 'vitest'
import {
  addSpriteLayer,
  addSpriteFrame,
  createSpriteDocument,
  erasePixel,
  fillPixels,
  getPixel,
  removeSpriteLayer,
  removeSpriteFrame,
  flipSpriteRegion,
  moveSpritePixels,
  moveSpriteRegion,
  selectSpriteLayer,
  selectSpriteFrame,
  updateSpriteFrame,
  updateSpriteLayer,
  setPixel,
  setPixels,
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

    const hidden = updateSpriteLayer(document, layerId, { visible: false })
    expect(() => setPixel(hidden, layerId, frameId, { x: 0, y: 0 }, red)).toThrow('SPRITE_LAYER_HIDDEN')
    expect(() => fillPixels(hidden, layerId, frameId, { x: 0, y: 0 }, red)).toThrow('SPRITE_LAYER_HIDDEN')
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

  it('writes a raster batch in one immutable revision', () => {
    const painted = setPixels(createDocument(), layerId, frameId, [{ x: 0, y: 0 }, { x: 3, y: 2 }], red)
    expect(painted.revision).toBe(1)
    expect(getPixel(painted, layerId, frameId, { x: 0, y: 0 })).toEqual(red)
    expect(getPixel(painted, layerId, frameId, { x: 3, y: 2 })).toEqual(red)
  })

  it('moves a selected region without mutating pixels outside it', () => {
    const source = setPixels(createDocument(), layerId, frameId, [{ x: 0, y: 0 }, { x: 1, y: 0 }], red)
    const moved = moveSpriteRegion(source, layerId, frameId, { x: 0, y: 0, width: 2, height: 1 }, 1, 1)
    expect(getPixel(moved, layerId, frameId, { x: 0, y: 0 })).toEqual(transparent)
    expect(getPixel(moved, layerId, frameId, { x: 1, y: 1 })).toEqual(red)
    expect(getPixel(moved, layerId, frameId, { x: 2, y: 1 })).toEqual(red)
  })

  it('moves selected paint without erasing destination below transparent holes', () => {
    const source = setPixels(setPixels(createDocument(), layerId, frameId, [{ x: 0, y: 0 }], red), layerId, frameId, [{ x: 2, y: 0 }], blue)
    const moved = moveSpritePixels(source, layerId, frameId, [0, 1], 1, 0)
    expect(getPixel(moved, layerId, frameId, { x: 0, y: 0 })).toEqual(transparent)
    expect(getPixel(moved, layerId, frameId, { x: 1, y: 0 })).toEqual(red)
    expect(getPixel(moved, layerId, frameId, { x: 2, y: 0 })).toEqual(blue)
  })

  it('flips a selected region horizontally and vertically', () => {
    const source = setPixel(createDocument(), layerId, frameId, { x: 0, y: 0 }, red)
    const horizontal = flipSpriteRegion(source, layerId, frameId, { x: 0, y: 0, width: 3, height: 2 }, 'horizontal')
    const vertical = flipSpriteRegion(source, layerId, frameId, { x: 0, y: 0, width: 3, height: 2 }, 'vertical')
    expect(getPixel(horizontal, layerId, frameId, { x: 2, y: 0 })).toEqual(red)
    expect(getPixel(vertical, layerId, frameId, { x: 0, y: 1 })).toEqual(red)
  })

  it('adds blank and duplicated frames across every layer', () => {
    const secondFrameId = '00000000-0000-4000-8000-000000000014'
    const painted = setPixel(createDocument(), layerId, frameId, { x: 1, y: 1 }, red)
    const blank = addSpriteFrame(painted, { id: secondFrameId, duplicateFromFrameId: undefined })
    expect(blank.activeFrameId).toBe(secondFrameId)
    expect(getPixel(blank, layerId, secondFrameId, { x: 1, y: 1 })).toEqual(transparent)

    const thirdFrameId = '00000000-0000-4000-8000-000000000015'
    const duplicate = addSpriteFrame(blank, { id: thirdFrameId, duplicateFromFrameId: frameId })
    expect(getPixel(duplicate, layerId, thirdFrameId, { x: 1, y: 1 })).toEqual(red)
  })

  it('selects frames, updates duration and preserves one frame on deletion', () => {
    const secondFrameId = '00000000-0000-4000-8000-000000000014'
    const added = addSpriteFrame(createDocument(), { id: secondFrameId })
    const selected = selectSpriteFrame(added, frameId)
    const timed = updateSpriteFrame(selected, frameId, { durationMs: 240 })
    const removed = removeSpriteFrame(timed, frameId)

    expect(timed.frames[0]?.durationMs).toBe(240)
    expect(removed.frames.map((frame) => frame.id)).toEqual([secondFrameId])
    expect(removed.activeFrameId).toBe(secondFrameId)
    expect(() => removeSpriteFrame(removed, secondFrameId)).toThrow('SPRITE_REQUIRES_FRAME')
    expect(() => updateSpriteFrame(removed, secondFrameId, { durationMs: 0 })).toThrow('SPRITE_FRAME_DURATION_INVALID')
  })
})

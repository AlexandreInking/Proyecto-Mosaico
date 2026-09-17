import { describe, expect, it } from 'vitest'
import { createSpriteDocument, getPixel } from '@mosaico/domain'
import { applySpriteFilter, createBrightnessFilter, createContrastFilter, createOutlineFilter, grayscaleFilter, invertFilter, sepiaFilter } from '../src/sprite-filter.js'

const layerId = '00000000-0000-4000-8000-000000000011'
const frameId = '00000000-0000-4000-8000-000000000012'
const red = { r: 255, g: 0, b: 0, a: 255 }

function documentWithPixel(x: number, y: number): ReturnType<typeof createSpriteDocument> {
  const base = createSpriteDocument({ id: '00000000-0000-4000-8000-000000000010', name: 'F', width: 4, height: 4, layerId, frameId })
  return applySpriteFilter(base, (bytes, width) => { const offset = (y * width + x) * 4; bytes[offset] = 255; bytes[offset + 3] = 255 }).next
}

describe('sprite filters', () => {
  it('inverts rgb channels and preserves alpha', () => {
    const source = documentWithPixel(1, 1)
    const { next, changed } = applySpriteFilter(source, invertFilter)
    expect(changed).toBe(16)
    expect(getPixel(next, layerId, frameId, { x: 1, y: 1 })).toEqual({ r: 0, g: 255, b: 255, a: 255 })
    expect(getPixel(next, layerId, frameId, { x: 0, y: 0 })).toEqual({ r: 255, g: 255, b: 255, a: 0 })
  })

  it('desaturates using luminance weights', () => {
    const source = documentWithPixel(0, 0)
    const { next } = applySpriteFilter(source, grayscaleFilter)
    const pixel = getPixel(next, layerId, frameId, { x: 0, y: 0 })
    expect(pixel.r).toBe(pixel.g)
    expect(pixel.g).toBe(pixel.b)
    expect(pixel.r).toBeGreaterThan(50)
  })

  it('sepia shifts channels toward warm tones', () => {
    const source = documentWithPixel(0, 0)
    const { next } = applySpriteFilter(source, sepiaFilter)
    const pixel = getPixel(next, layerId, frameId, { x: 0, y: 0 })
    expect(pixel.r).toBeGreaterThanOrEqual(pixel.g)
    expect(pixel.g).toBeGreaterThanOrEqual(pixel.b)
  })

  it('brightness clamps at both ends', () => {
    const source = documentWithPixel(1, 1)
    const brighter = applySpriteFilter(source, createBrightnessFilter(64)).next
    expect(getPixel(brighter, layerId, frameId, { x: 1, y: 1 })).toEqual({ r: 255, g: 64, b: 64, a: 255 })
    const darker = applySpriteFilter(source, createBrightnessFilter(-999)).next
    expect(getPixel(darker, layerId, frameId, { x: 1, y: 1 })).toEqual({ r: 0, g: 0, b: 0, a: 255 })
  })

  it('contrast pushes midtones away from gray', () => {
    const source = documentWithPixel(1, 1)
    const next = applySpriteFilter(source, createContrastFilter(50)).next
    expect(getPixel(next, layerId, frameId, { x: 1, y: 1 }).r).toBe(255)
  })

  it('outlines transparent neighbours of opaque pixels without overwriting art', () => {
    const source = documentWithPixel(1, 1)
    const outline = createOutlineFilter({ r: 10, g: 20, b: 30, a: 255 })
    const { next, changed } = applySpriteFilter(source, outline)
    expect(changed).toBe(4)
    expect(getPixel(next, layerId, frameId, { x: 0, y: 1 })).toEqual({ r: 10, g: 20, b: 30, a: 255 })
    expect(getPixel(next, layerId, frameId, { x: 1, y: 1 })).toEqual(red)
    expect(getPixel(next, layerId, frameId, { x: 3, y: 3 })).toEqual({ r: 0, g: 0, b: 0, a: 0 })
  })

  it('scopes filter effects to the provided points', () => {
    const source = documentWithPixel(1, 1)
    const { changed } = applySpriteFilter(source, invertFilter, { points: [{ x: 0, y: 0 }] })
    expect(changed).toBe(1)
  })

  it('reports zero changes when the filter is a no-op', () => {
    const source = documentWithPixel(1, 1)
    expect(applySpriteFilter(source, (bytes) => { for (let offset = 0; offset < bytes.length; offset += 4) { bytes[offset] = bytes[offset]!; bytes[offset + 3] = bytes[offset + 3]! } }).changed).toBe(0)
  })
})

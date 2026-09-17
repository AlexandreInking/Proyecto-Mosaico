import { describe, expect, it } from 'vitest'
import { addSpriteLayer, createSpriteDocument, setPixel } from '@mosaico/domain'
import {
  composeSpriteFrame,
  createViewport,
  pickSpritePixel,
  rasterizeClippedPixelStroke,
  shouldShowPixelGrid,
  visiblePixelRange,
} from '../src/index.js'

describe('pixel viewport', () => {
  it('picks exact pixels and rejects viewport or sprite overflow', () => {
    const viewport = createViewport({ width: 80, height: 60, zoom: 10, offsetX: 20, offsetY: 10 })
    expect(pickSpritePixel(viewport, { x: 35, y: 25 }, { width: 4, height: 3 })).toEqual({ x: 1, y: 1 })
    expect(pickSpritePixel(viewport, { x: 79, y: 59 }, { width: 4, height: 3 })).toBeUndefined()
    expect(pickSpritePixel(viewport, { x: 80, y: 20 }, { width: 4, height: 3 })).toBeUndefined()
  })

  it('clips strokes crossing canvas bounds before rasterization', () => {
    expect(rasterizeClippedPixelStroke({ x: -10, y: 1 }, { x: 10, y: 1 }, { width: 4, height: 3 }))
      .toEqual([{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }])
    expect(rasterizeClippedPixelStroke({ x: -5, y: -5 }, { x: -1, y: -1 }, { width: 4, height: 3 })).toEqual([])
  })

  it('returns only visible sprite pixels and shows grid at useful scale', () => {
    const viewport = createViewport({ width: 32, height: 24, zoom: 8, offsetX: -8, offsetY: 0 })
    expect(visiblePixelRange(viewport, { width: 10, height: 10 }))
      .toEqual({ startX: 1, startY: 0, endX: 5, endY: 3 })
    expect(shouldShowPixelGrid(viewport)).toBe(true)
    expect(shouldShowPixelGrid({ ...viewport, zoom: 5.99 })).toBe(false)
  })

  it('composites visible raster layers in document order', () => {
    let document = createSpriteDocument({
      id: '11111111-1111-4111-8111-111111111111', name: 'Sprite', width: 1, height: 1,
      layerId: '22222222-2222-4222-8222-222222222222', frameId: '33333333-3333-4333-8333-333333333333',
    })
    document = setPixel(document, document.activeLayerId, document.activeFrameId, { x: 0, y: 0 }, { r: 255, g: 0, b: 0, a: 255 })
    document = addSpriteLayer(document, { id: '44444444-4444-4444-8444-444444444444', name: 'Top' })
    document = setPixel(document, document.activeLayerId, document.activeFrameId, { x: 0, y: 0 }, { r: 0, g: 0, b: 255, a: 128 })

    expect([...composeSpriteFrame(document, document.activeFrameId)]).toEqual([127, 0, 128, 255])
  })

  it('rejects non-finite or excessive stroke endpoints', () => {
    expect(() => rasterizeClippedPixelStroke({ x: Number.NaN, y: 0 }, { x: 1, y: 1 }, { width: 4, height: 4 }))
      .toThrow('PIXEL_STROKE_INVALID')
    expect(() => rasterizeClippedPixelStroke({ x: -2_000_000, y: 0 }, { x: 1, y: 1 }, { width: 4, height: 4 }))
      .toThrow('PIXEL_STROKE_INVALID')
  })
})

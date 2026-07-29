import { describe, expect, it } from 'vitest'
import { sliceTileset } from '../src/index.js'

describe('tileset slicing', () => {
  it('ignores UI-only metadata', () => {
    const input = { imageWidth: 32, imageHeight: 32, tileWidth: 16, tileHeight: 16, marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, offsetX: 0, offsetY: 0 }
    const withUiMetadata = { ...input, name: 'terrain', zoom: 0.5 }
    expect(sliceTileset(withUiMetadata)).toEqual(sliceTileset(input))
  })
  it('returns complete source rectangles with margin, spacing and offset', () => {
    const result = sliceTileset({
      imageWidth: 70, imageHeight: 38, tileWidth: 16, tileHeight: 8,
      marginX: 1, marginY: 2, spacingX: 2, spacingY: 1, offsetX: 3, offsetY: 1,
    })
    expect(result.columns).toBe(3)
    expect(result.rows).toBe(3)
    expect(result.rectangles[0]).toEqual({ x: 4, y: 3, width: 16, height: 8 })
    expect(result.rectangles.at(-1)).toEqual({ x: 40, y: 21, width: 16, height: 8 })
  })

  it('never emits partial tiles and rejects configurations without one full tile', () => {
    const result = sliceTileset({
      imageWidth: 32, imageHeight: 17, tileWidth: 16, tileHeight: 16,
      marginX: 0, marginY: 0, spacingX: 1, spacingY: 0, offsetX: 0, offsetY: 0,
    })
    expect(result.rectangles).toHaveLength(1)
    expect(() => sliceTileset({
      imageWidth: 8, imageHeight: 8, tileWidth: 16, tileHeight: 16,
      marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, offsetX: 0, offsetY: 0,
    })).toThrow('TILESET_SLICE_EMPTY')
  })
})

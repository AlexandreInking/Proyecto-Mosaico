import { describe, expect, it } from 'vitest'
import { scaleRgba } from '../src/pixel-media.js'

describe('pixel media export', () => {
  it('scales RGBA pixels by integer nearest-neighbor multiples', () => {
    const source = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255])
    expect([...scaleRgba(source, 2, 1, 2)]).toEqual([
      255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255,
      255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255,
    ])
  })

  it('rejects non-integer export scales', () => {
    expect(() => scaleRgba(new Uint8ClampedArray(4), 1, 1, 1.5)).toThrow('IMAGE_SCALE_INVALID')
    expect(() => scaleRgba(new Uint8ClampedArray(4), 4096, 4096, 32)).toThrow('IMAGE_EXPORT_TOO_LARGE')
  })
})

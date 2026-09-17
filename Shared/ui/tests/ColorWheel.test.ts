import { describe, expect, it } from 'vitest'
import { hexToHsv, hsvToHex } from '../src/ColorWheel.js'

describe('ColorWheel', () => {
  it('round-trips RGB colors through HSV', () => {
    for (const color of ['#ff0000', '#4bc3b7', '#000000', '#ffffff']) expect(hsvToHex(hexToHsv(color))).toBe(color)
  })
})

import { describe, expect, it } from 'vitest'
import { BRUSH_SIZE_MAX, clampBrushSize, expandStroke, stampPoints } from '../src/brush-model.js'

const keys = (points: readonly { x: number; y: number }[]) => points.map(({ x, y }) => `${x},${y}`).sort()

describe('pixel brush model', () => {
  it('clamps brush sizes into the documented 1..32 range', () => {
    expect(clampBrushSize(Number.NaN)).toBe(1)
    expect(clampBrushSize(0)).toBe(1)
    expect(clampBrushSize(7.9)).toBe(7)
    expect(clampBrushSize(64)).toBe(BRUSH_SIZE_MAX)
  })

  it('stamps squares centered on the cursor for odd and even sizes', () => {
    expect(stampPoints({ x: 0, y: 0 }, 1, 'square')).toEqual([{ x: 0, y: 0 }])
    expect(keys(stampPoints({ x: 0, y: 0 }, 3, 'square'))).toHaveLength(9)
    expect(keys(stampPoints({ x: 0, y: 0 }, 2, 'square'))).toEqual(['-1,-1', '-1,0', '0,-1', '0,0'])
  })

  it('stamps circles that drop corners while keeping axes', () => {
    expect(stampPoints({ x: 0, y: 0 }, 1, 'circle')).toEqual([{ x: 0, y: 0 }])
    expect(keys(stampPoints({ x: 2, y: 2 }, 3, 'circle'))).toEqual(['1,2', '2,1', '2,2', '2,3', '3,2'])
    expect(keys(stampPoints({ x: 0, y: 0 }, 4, 'circle'))).toHaveLength(12)
    expect(keys(stampPoints({ x: 0, y: 0 }, 5, 'circle'))).toHaveLength(21)
  })

  it('stamps diamonds as rotated squares', () => {
    expect(keys(stampPoints({ x: 0, y: 0 }, 3, 'diamond'))).toEqual(['-1,0', '0,-1', '0,0', '0,1', '1,0'])
    expect(keys(stampPoints({ x: 0, y: 0 }, 2, 'diamond'))).toHaveLength(4)
  })

  it('expands strokes with dedupe and seamless wrapping', () => {
    const base = [{ x: 5, y: 5 }]
    expect(expandStroke(base, 1, 'square', 32, 8, false, false)).toEqual(base)
    const wrapped = expandStroke([{ x: 31, y: 0 }, { x: 0, y: 0 }], 2, 'square', 32, 8, true, false)
    expect(wrapped.every(({ x, y }) => x >= 0 && x < 32 && y >= 0 && y < 8)).toBe(true)
    expect(new Set(wrapped.map(({ x, y }) => `${x},${y}`)).size).toBe(wrapped.length)
    const vertical = expandStroke([{ x: 0, y: 0 }], 2, 'square', 32, 8, false, true)
    expect(vertical.length).toBeGreaterThan(0)
    expect(vertical.every(({ x, y }) => x === 0 && (y === 0 || y === 7))).toBe(true)
    const clipped = expandStroke([{ x: 0, y: 0 }], 2, 'square', 32, 8, false, false)
    expect(clipped.every(({ x, y }) => x >= 0 && y >= 0)).toBe(true)
  })

  it('caps oversized stamps at the spec limit', () => {
    expect(clampBrushSize(-3)).toBe(1)
    expect(keys(stampPoints({ x: 0, y: 0 }, 33, 'square'))).toHaveLength(1024)
  })
})

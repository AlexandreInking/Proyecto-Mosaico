import { describe, expect, it } from 'vitest'
import { combineSelection, ellipseMask, invertSelection, magicMask, polygonMask, rectangleMask, selectionBounds, selectionOutlinePath, translateSelection } from '../src/selection-model.js'

describe('selection model', () => {
  it('builds, combines and inverts pixel masks', () => {
    const rectangle = rectangleMask({ x: 0, y: 0 }, { x: 1, y: 1 }, 4, 4)
    const ellipse = ellipseMask({ x: 1, y: 1 }, { x: 3, y: 3 }, 4, 4)
    expect(combineSelection(rectangle, ellipse, 'add').pixels.size).toBeGreaterThan(rectangle.pixels.size)
    expect(combineSelection(rectangle, ellipse, 'subtract').pixels.size).toBeLessThan(rectangle.pixels.size)
    expect(invertSelection(rectangle).pixels.size).toBe(12)
  })

  it('supports polygon and contiguous color selection', () => {
    expect(polygonMask([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 3 }], 4, 4).pixels.size).toBeGreaterThan(0)
    const magic = magicMask({ x: 0, y: 0 }, 3, 2, ({ x }) => x < 2 ? 'red' : 'blue')
    expect(magic.pixels.size).toBe(4)
  })

  it('translates exact selected pixels within canvas bounds', () => {
    const moved = translateSelection(rectangleMask({ x: 0, y: 0 }, { x: 1, y: 0 }, 3, 2), 1, 1)
    expect(selectionBounds(moved)).toEqual({ x: 1, y: 1, width: 2, height: 1 })
  })

  it('keeps a floating selection outside the canvas and draws only its exterior border', () => {
    const rectangle = rectangleMask({ x: 0, y: 0 }, { x: 1, y: 0 }, 3, 2)
    const moved = translateSelection(rectangle, -2, -1)
    expect(selectionBounds(moved)).toEqual({ x: -2, y: -1, width: 2, height: 1 })
    expect(selectionOutlinePath(rectangle)).not.toContain('M1 0v1')
  })
})

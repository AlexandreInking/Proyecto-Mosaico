import { describe, expect, it } from 'vitest'
import { constrainSquareEnd, ellipsePixels, linePixels, rectanglePixels, snapLineEnd } from '../src/index.js'

const keys = (points: readonly { x: number; y: number }[]) => points.map(({ x, y }) => `${x},${y}`).sort()

describe('raster authoring tools', () => {
  it('creates a continuous one-pixel line in either direction', () => {
    expect(keys(linePixels({ x: 1, y: 1 }, { x: 4, y: 3 }))).toEqual(['1,1', '2,2', '3,2', '4,3'])
    expect(keys(linePixels({ x: 4, y: 3 }, { x: 1, y: 1 }))).toEqual(['1,1', '2,2', '3,2', '4,3'])
  })

  it('creates outlined and filled rectangles with normalized corners', () => {
    expect(keys(rectanglePixels({ x: 2, y: 2 }, { x: 0, y: 0 }, false))).toHaveLength(8)
    expect(keys(rectanglePixels({ x: 2, y: 2 }, { x: 0, y: 0 }, true))).toHaveLength(9)
  })

  it('creates symmetric outlined and filled ellipses', () => {
    const outline = keys(ellipsePixels({ x: 0, y: 0 }, { x: 4, y: 4 }, false))
    expect(outline).toEqual(expect.arrayContaining(['0,2', '2,0', '2,4', '4,2']))
    expect(keys(ellipsePixels({ x: 0, y: 0 }, { x: 4, y: 4 }, true))).toHaveLength(21)
  })

  it('snaps constrained lines to the nearest 22.5 degree direction', () => {
    expect(snapLineEnd({ x: 10, y: 10 }, { x: 18, y: 13 })).toEqual({ x: 18, y: 13 })
    expect(snapLineEnd({ x: 10, y: 10 }, { x: 17, y: 15 })).toEqual({ x: 17, y: 17 })
  })

  it('constrains rectangles and ellipses to equal sides while preserving direction', () => {
    expect(constrainSquareEnd({ x: 5, y: 5 }, { x: 11, y: 8 })).toEqual({ x: 11, y: 11 })
    expect(constrainSquareEnd({ x: 5, y: 5 }, { x: 2, y: 9 })).toEqual({ x: 1, y: 9 })
  })
})

import { describe, expect, it } from 'vitest'
import { createMapDocument, type MapDocument, type MapLayer } from '@mosaico/domain'
import { createViewport, pickOrthogonalCell, visibleMapCells } from '../src/index.js'

function percentile95(samples: readonly number[]): number {
  return [...samples].sort((left, right) => left - right)[Math.floor(samples.length * 0.95)] ?? Number.POSITIVE_INFINITY
}

function largeSparseMap(): MapDocument {
  const tileset = {
    id: '11111111-1111-4111-8111-111111111111', name: 'Tiles', assetId: 'asset',
    imageWidth: 16, imageHeight: 16, tileWidth: 16, tileHeight: 16,
    marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 1,
  }
  const document = createMapDocument({
    id: '22222222-2222-4222-8222-222222222222', name: 'Benchmark', width: 1000, height: 1000,
    cellWidth: 16, cellHeight: 16, layerId: '33333333-3333-4333-8333-333333333333', tilesets: [tileset],
  })
  const cells = new Map<string, { tilesetId: string; tileId: number }>()
  for (let index = 0; index < 100_000; index += 1) {
    const x = index % 1000
    const y = Math.floor(index / 1000)
    cells.set(`${x},${y}`, { tilesetId: tileset.id, tileId: 0 })
  }
  const layer: MapLayer = { ...document.layers[0]!, cells }
  return { ...document, layers: [layer] }
}

describe('canvas performance budget', () => {
  it('keeps orthogonal picking below 0.1 ms p95', () => {
    const viewport = createViewport({ width: 1280, height: 720, zoom: 1.25, offsetX: -200, offsetY: -100 })
    const samples: number[] = []
    for (let index = 0; index < 20_000; index += 1) {
      const start = performance.now()
      pickOrthogonalCell(viewport, { x: index % 1280, y: index % 720 }, { width: 1000, height: 1000, cellWidth: 16, cellHeight: 16 })
      samples.push(performance.now() - start)
    }
    const p95 = percentile95(samples)
    console.info(`T2_PICKING_P95_MS=${p95.toFixed(4)}`)
    expect(p95).toBeLessThan(0.1)
  })

  it('culls 100k occupied tiles within one 60fps frame p95', () => {
    const document = largeSparseMap()
    const samples: number[] = []
    const coldStart = performance.now()
    visibleMapCells(document, createViewport({ width: 1280, height: 720 }))
    const coldDuration = performance.now() - coldStart
    for (let frame = 0; frame < 40; frame += 1) {
      const viewport = createViewport({ width: 1280, height: 720, offsetX: -frame * 16, offsetY: 0 })
      const start = performance.now()
      const visible = visibleMapCells(document, viewport)
      samples.push(performance.now() - start)
      expect(visible.length).toBeLessThanOrEqual(80 * 45)
    }
    const p95 = percentile95(samples)
    console.info(`T2_CULL_100K_COLD_MS=${coldDuration.toFixed(4)}`)
    console.info(`T2_CULL_100K_P95_MS=${p95.toFixed(4)}`)
    expect(coldDuration).toBeLessThan(100)
    expect(p95).toBeLessThan(16.7)
  })
})

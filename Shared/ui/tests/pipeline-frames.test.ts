import { describe, expect, it } from 'vitest'
import { createDemoNode } from '../src/pipeline-editor-model.js'
import { createSurface, evaluatePipeline, surfaceHash } from '../src/pipeline-evaluator.js'
import { renderPipelineFrames, samplePipelineTimes } from '../src/pipeline-frames.js'

const assetSurface = createSurface(2, 1, new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]))

describe('pipeline frames and advanced CPU2D nodes', () => {
  it('samples regular FPS times and includes keyframes', () => {
    expect(samplePipelineTimes({ durationMs: 1000, fps: 2 }, [{ nodeId: 'node', parameterId: 'amount', timeMs: 250, value: 1 }])).toEqual([0, 250, 500, 1000])
  })

  it('caps interactive sampling for extreme ranges', () => {
    expect(samplePipelineTimes({ durationMs: 86_400_000, fps: 60 }, [])).toHaveLength(3_600)
  })

  it('renders deterministic frames and preserves frame selection', () => {
    const asset = { ...createDemoNode('asset', 'asset', { x: 0, y: 0 }), assetId: 'source' }
    const graph = { nodes: [asset], edges: [] }
    const settings = { durationMs: 1000, fps: 2, selectedFrameTimesMs: [500] }
    const first = renderPipelineFrames(graph, new Map([['source', assetSurface]]), [], settings)
    const second = renderPipelineFrames(graph, new Map([['source', assetSurface]]), [], settings)
    expect(first.map((frame) => frame.selected)).toEqual([false, true, false])
    expect(first.map((frame) => surfaceHash(frame.surface))).toEqual(second.map((frame) => surfaceHash(frame.surface)))
  })

  it('evaluates advanced filters, data output and deterministic VFX', () => {
    const asset = { ...createDemoNode('asset', 'asset', { x: 0, y: 0 }), assetId: 'source' }
    const blur = createDemoNode('blur', 'blur', { x: 0, y: 0 })
    const particle = createDemoNode('particle', 'particle', { x: 0, y: 0 })
    const pixel = createDemoNode('get-pixel', 'pixel', { x: 0, y: 0 })
    const graph = { nodes: [asset, blur, particle, pixel], edges: [
      { sourceNodeId: 'asset', sourcePortId: 'surface-out', targetNodeId: 'blur', targetPortId: 'surface-in' },
      { sourceNodeId: 'blur', sourcePortId: 'surface-out', targetNodeId: 'particle', targetPortId: 'surface-in' },
      { sourceNodeId: 'asset', sourcePortId: 'surface-out', targetNodeId: 'pixel', targetPortId: 'surface-in' },
    ] }
    const first = evaluatePipeline(graph, new Map([['source', assetSurface]]), 250)
    const second = evaluatePipeline(graph, new Map([['source', assetSurface]]), 250)
    expect(first.outputs.get('blur')?.get('surface-out')).toBeDefined()
    expect(surfaceHash(first.outputs.get('particle')?.get('surface-out') as ReturnType<typeof createSurface>)).toBe(surfaceHash(second.outputs.get('particle')?.get('surface-out') as ReturnType<typeof createSurface>))
    expect(first.outputs.get('pixel')?.get('color-out')).toEqual([255, 0, 0, 255])
  })
})

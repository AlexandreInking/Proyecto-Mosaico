import { describe, expect, it } from 'vitest'
import { createCustomDemoNode, createDemoNode } from '../src/pipeline-editor-model.js'
import { createSurface, evaluatePipeline } from '../src/pipeline-evaluator.js'
import { parseCustomNodeDsl } from '../src/custom-node.js'

describe('custom node evaluation', () => {
  it('evaluates a safe custom AST deterministically', () => {
    const definition = parseCustomNodeDsl('input source: Surface\noutput result: Surface\nresult = invert(source)', 'Invert custom').definition!
    const asset = { ...createDemoNode('asset', 'asset-1', { x: 0, y: 0 }), assetId: 'asset-1' }
    const custom = createCustomDemoNode(definition, 'custom-1', { x: 100, y: 0 })
    const source = createSurface(1, 1, new Uint8ClampedArray([10, 20, 30, 255]))
    const evaluation = evaluatePipeline({ nodes: [asset, custom], edges: [{ sourceNodeId: asset.id, sourcePortId: 'surface-out', targetNodeId: custom.id, targetPortId: 'source' }] }, new Map([['asset-1', source]]))
    expect(evaluation.diagnostics).toEqual([])
    expect(evaluation.outputs.get('custom-1')?.get('result')).toMatchObject({ width: 1, height: 1, pixels: new Uint8ClampedArray([245, 235, 225, 255]) })
  })
})

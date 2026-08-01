import { describe, expect, it } from 'vitest'
import { backlogPipelineNodes, getPipelineNodeDefinition, getPublishedNodeLibrary, publishedPipelineNodes } from '../src/pipeline-node-registry.js'
import { createDemoNode } from '../src/pipeline-editor-model.js'
import { evaluatePipeline } from '../src/pipeline-evaluator.js'

describe('pipeline node registry', () => {
  it('publishes only nodes with a real model and evaluator metadata', () => {
    expect(publishedPipelineNodes.length).toBeGreaterThan(50)
    expect(publishedPipelineNodes.every((definition) => definition.status === 'published' && definition.evaluatorKey !== 'not-implemented')).toBe(true)
    expect(getPublishedNodeLibrary().some((item) => item.kind === 'solid')).toBe(true)
    expect(getPublishedNodeLibrary().some((item) => String(item.kind) === '3d-cube')).toBe(false)
  })

  it('keeps legacy technical IDs and resolves aliases', () => {
    expect(getPipelineNodeDefinition('rotation')?.labelKey).toBe('rotation')
    expect(getPipelineNodeDefinition('rotate')?.kind).toBe('rotation')
    expect(createDemoNode('flip', 'flip', { x: 0, y: 0 }).title).toBe('Flip')
    expect(backlogPipelineNodes.some((definition) => definition.kind === '3d-cube')).toBe(true)
  })

  it('does not publish a node that falls through the evaluator', () => {
    for (const definition of publishedPipelineNodes) {
      const node = createDemoNode(definition.kind as Parameters<typeof createDemoNode>[0], `test-${definition.kind}`, { x: 0, y: 0 })
      expect(evaluatePipeline({ nodes: [node], edges: [] }, new Map()).diagnostics, definition.kind).not.toContain('NODE_KIND_UNSUPPORTED')
    }
  })

  it('creates one handle per parameter without duplicate legacy inputs', () => {
    for (const definition of publishedPipelineNodes) {
      const node = createDemoNode(definition.kind as Parameters<typeof createDemoNode>[0], `normalized-${definition.kind}`, { x: 0, y: 0 })
      expect(new Set(node.parameters.map((parameter) => parameter.id)).size, definition.kind).toBe(node.parameters.length)
      expect(new Set(node.inputs.map((port) => port.id)).size, definition.kind).toBe(node.inputs.length)
      if (['add', 'subtract', 'multiply', 'divide'].includes(definition.kind)) expect(node.inputs.some((port) => ['surface-a', 'value-a', 'surface-b', 'value-b'].includes(port.id))).toBe(false)
      if (['noise', 'cellular-noise', 'perlin', 'simplex'].includes(definition.kind)) expect(node.inputs.some((port) => ['seed-in', 'roughness-in'].includes(port.id))).toBe(false)
    }
  })
})

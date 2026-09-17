import { describe, expect, it } from 'vitest'
import { pipelineDocumentSchema, pipelineNodeDefinitionSchema, pipelinePortTypeSchema } from '../src/pipeline.js'

const asset = {
  id: 'asset-a', name: 'Mi capa.png', mediaType: 'image/png' as const,
  sha256: 'a'.repeat(64), byteSize: 4, width: 1, height: 1, importedAt: '2026-07-31T00:00:00.000Z',
}

const valid = {
  format: 'mosaico-pipeline' as const, formatVersion: 1 as const, id: 'pipeline-a', revision: 0, name: 'Mi pipeline',
  nodes: [{ id: 'asset-node', kind: 'asset', x: 0, y: 0, assetId: asset.id, parameters: [] }],
  edges: [], assets: [asset],
  timeline: { mode: 'animation' as const, durationMs: 1000, currentTimeMs: 0, keyframes: [], snapshots: [] },
  viewport: { x: 0, y: 0, zoom: 1 },
}

describe('pipelineDocumentSchema', () => {
  it('accepts surface, color, gradient, scalar and vector port types', () => {
    for (const type of ['surface', 'color', 'gradient', 'value', 'int', 'float', 'bool', 'vector2', 'vector3', 'vector4', 'array', 'point', 'path', 'matrix', 'string', 'mesh', 'camera', 'scene', 'texture'] as const) {
      expect(pipelinePortTypeSchema.parse(type)).toBe(type)
    }
  })

  it('validates versioned node registry metadata', () => {
    const definition = pipelineNodeDefinitionSchema.parse({ version: 1, kind: 'solid', family: 'Generator', labelKey: 'solid', descriptionKey: 'solid.description', aliases: [], status: 'published', capabilities: ['cpu2d'], preview: 'surface', evaluatorKey: 'solid' })
    expect(definition.kind).toBe('solid')
    expect(pipelineNodeDefinitionSchema.safeParse({ ...definition, evaluatorKey: '' }).success).toBe(false)
  })

  it('accepts boolean parameters and typed parameter ports', () => {
    const result = pipelineDocumentSchema.parse({ ...valid, nodes: [{ ...valid.nodes[0], kind: 'bool', outputs: [{ id: 'value-out', type: 'bool' as const, direction: 'output' as const }], parameters: [{ id: 'value', type: 'boolean' as const, value: true, portType: 'bool' as const, showInNode: true }] }] })
    expect(result.nodes[0]?.parameters[0]?.portType).toBe('bool')
  })

  it('accepts stable pipeline data with asset references and timeline', () => {
    expect(pipelineDocumentSchema.parse(valid)).toEqual(valid)
  })

  it('accepts animated GIF metadata and advanced timeline curves', () => {
    const result = pipelineDocumentSchema.parse({
      ...valid,
      assets: [{ ...asset, mediaType: 'image/gif', animation: { frameCount: 2, frameDurationsMs: [80, 120], loop: true } }],
      timeline: { ...valid.timeline, loop: true, keyframes: [{ id: 'kf-1', nodeId: 'asset-node', parameterId: 'amount', timeMs: 500, value: 1, interpolation: 'bezier', easing: 'ease-in-out', handles: { in: [0.2, 0], out: [0.8, 1] } }] },
    })
    expect(result.assets[0]?.animation?.frameDurationsMs).toEqual([80, 120])
    expect(result.timeline.keyframes[0]?.interpolation).toBe('bezier')
  })

  it('rejects a node asset reference that is absent from the package', () => {
    const result = pipelineDocumentSchema.safeParse({ ...valid, nodes: [{ ...valid.nodes[0], assetId: 'missing' }] })
    expect(result.success).toBe(false)
  })

  it('rejects timeline data outside its declared duration', () => {
    const result = pipelineDocumentSchema.safeParse({ ...valid, timeline: { ...valid.timeline, currentTimeMs: 1001 } })
    expect(result.success).toBe(false)
  })

  it('accepts user names without translating or normalizing them', () => {
    const result = pipelineDocumentSchema.parse({ ...valid, name: 'Слой / Carpeta 1', assets: [{ ...asset, name: 'Carpeta 1.png' }] })
    expect(result.name).toBe('Слой / Carpeta 1')
    expect(result.assets[0]?.name).toBe('Carpeta 1.png')
  })

  it('rejects edges that reference undeclared ports', () => {
    const source = { ...valid.nodes[0], inputs: [], outputs: [{ id: 'surface-out', type: 'surface' as const, direction: 'output' as const }] }
    const target = { id: 'preview', kind: 'preview', x: 1, y: 1, inputs: [{ id: 'surface-in', type: 'surface' as const, direction: 'input' as const }], outputs: [], parameters: [] }
    const result = pipelineDocumentSchema.safeParse({ ...valid, nodes: [source, target], edges: [{ sourceNodeId: source.id, sourcePortId: 'missing', targetNodeId: target.id, targetPortId: 'surface-in' }] })
    expect(result.success).toBe(false)
  })
})

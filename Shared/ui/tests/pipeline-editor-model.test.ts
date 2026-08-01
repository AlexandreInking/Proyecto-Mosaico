import { describe, expect, it } from 'vitest'
import {
  addDemoNode,
  connectDemoPorts,
  createDemoGraph,
  createDemoNode,
  moveDemoNode,
  selectDemoNode,
  syncDemoNodePorts,
  updateDemoParameter,
} from '../src/pipeline-editor-model.js'

describe('pipeline editor demo graph', () => {
  it('creates the documented sample graph with two asset inputs', () => {
    const graph = createDemoGraph()

    expect(graph.nodes.map((node) => node.id)).toEqual([
      'asset-a',
      'asset-b',
      'resize-a',
      'color-a',
      'blend',
      'preview',
    ])
    expect(graph.edges).toHaveLength(5)
  })

  it('selects and moves a node without mutating the previous graph', () => {
    const graph = createDemoGraph()
    const selected = selectDemoNode(graph, 'resize-a')
    const moved = moveDemoNode(selected, 'resize-a', { x: 320, y: 180 })

    expect(graph.selectedNodeId).toBeUndefined()
    expect(moved.selectedNodeId).toBe('resize-a')
    expect(moved.nodes.find((node) => node.id === 'resize-a')).toMatchObject({ x: 320, y: 180 })
  })

  it('adds a new node and selects it', () => {
    const graph = createDemoGraph()
    const node = createDemoNode('flip', 'flip-1', { x: 420, y: 420 })
    const next = addDemoNode(graph, node)

    expect(next.nodes).toContainEqual(node)
    expect(next.selectedNodeId).toBe('flip-1')
  })

  it('updates visual parameters without mutating the source graph', () => {
    const graph = createDemoGraph()
    const next = updateDemoParameter(graph, 'resize-a', 'width', 64)

    expect(next.nodes.find((node) => node.id === 'resize-a')?.parameters[0]?.value).toBe(64)
    expect(graph.nodes.find((node) => node.id === 'resize-a')?.parameters[0]?.value).toBe(32)
  })

  it('accepts a new output-to-input connection', () => {
    const graph = addDemoNode(createDemoGraph(), createDemoNode('flip', 'flip-1', { x: 420, y: 420 }))
    const result = connectDemoPorts(graph, {
      sourceNodeId: 'asset-b',
      sourcePortId: 'surface-out',
      targetNodeId: 'flip-1',
      targetPortId: 'surface-in',
    })

    expect(result.error).toBeUndefined()
    expect(result.graph.edges).toContainEqual({
      sourceNodeId: 'asset-b',
      sourcePortId: 'surface-out',
      targetNodeId: 'flip-1',
      targetPortId: 'surface-in',
    })
  })

  it('exposes surface arithmetic alongside typed numeric and vector nodes', () => {
    const multiply = createDemoNode('multiply', 'multiply-1', { x: 0, y: 0 })
    const color = createDemoNode('color', 'color-1', { x: 0, y: 0 })
    const gradient = createDemoNode('gradient', 'gradient-1', { x: 0, y: 0 })
    const int = createDemoNode('int', 'int-1', { x: 0, y: 0 })
    const vector4 = createDemoNode('vector4', 'vector4-1', { x: 0, y: 0 })

    expect(multiply.inputs.filter((port) => port.id.startsWith('parameter:') && port.type === 'surface-or-value')).toHaveLength(2)
    expect(color.outputs[0]?.type).toBe('surface')
    expect(gradient.outputs[0]?.type).toBe('surface')
    expect(int.outputs[0]?.type).toBe('int')
    expect(vector4.outputs[0]?.type).toBe('vector4')
    expect(connectDemoPorts({ nodes: [int, multiply], edges: [] }, {
      sourceNodeId: 'int-1', sourcePortId: 'value-out', targetNodeId: 'multiply-1', targetPortId: 'value-a',
    }).error).toBeUndefined()
    expect(connectDemoPorts({ nodes: [vector4, multiply], edges: [] }, {
      sourceNodeId: 'vector4-1', sourcePortId: 'value-out', targetNodeId: 'multiply-1', targetPortId: 'value-a',
    }).error).toBeUndefined()
  })

  it('exposes evaluable VFX nodes and typed motion links', () => {
    const noise = createDemoNode('perlin', 'perlin-1', { x: 0, y: 0 })
    const seed = createDemoNode('seed', 'seed-1', { x: 0, y: 0 })
    const direction = createDemoNode('direction', 'direction-1', { x: 0, y: 0 })
    const movement = createDemoNode('movement', 'movement-1', { x: 0, y: 0 })

    expect(noise.outputs[0]?.type).toBe('surface')
    expect(connectDemoPorts({ nodes: [seed, noise], edges: [] }, { sourceNodeId: 'seed-1', sourcePortId: 'value-out', targetNodeId: 'perlin-1', targetPortId: 'seed-in' }).error).toBeUndefined()
    expect(connectDemoPorts({ nodes: [direction, movement], edges: [] }, { sourceNodeId: 'direction-1', sourcePortId: 'value-out', targetNodeId: 'movement-1', targetPortId: 'offset-in' }).error).toBeUndefined()
  })

  it('normalizes legacy generator inputs into one inspector parameter and one handle', () => {
    for (const kind of ['rings-noise', 'voronoi-noise', 'white-noise'] as const) {
      const node = createDemoNode(kind, `${kind}-1`, { x: 0, y: 0 })
      const inputIds = node.inputs.map((port) => port.id)

      expect(inputIds).not.toContain('seed-in')
      expect(inputIds).not.toContain('roughness-in')
      expect(inputIds.filter((id) => id === 'parameter:seed')).toHaveLength(1)
      expect(inputIds.filter((id) => id === 'parameter:roughness')).toHaveLength(1)
      expect(node.parameters.filter((parameter) => parameter.id === 'seed')).toHaveLength(1)
      expect(node.parameters.filter((parameter) => parameter.id === 'roughness')).toHaveLength(1)
    }
  })

  it('exposes the core pixel composition nodes with stable ports', () => {
    const invert = createDemoNode('invert', 'invert-1', { x: 0, y: 0 })
    const select = createDemoNode('select', 'select-1', { x: 0, y: 0 })
    const replace = createDemoNode('replace', 'replace-1', { x: 0, y: 0 })
    const outline = createDemoNode('outline', 'outline-1', { x: 0, y: 0 })
    const rotate = createDemoNode('rotation', 'rotate-1', { x: 0, y: 0 })

    expect(invert.outputs.map((port) => port.id)).toEqual(['surface-out'])
    expect(select.outputs.map((port) => port.id)).toEqual(['mask-out'])
    expect(replace.inputs.filter((port) => !port.id.startsWith('parameter:')).map((port) => port.id)).toEqual(['surface-a', 'surface-b'])
    expect(replace.inputs.filter((port) => port.id.startsWith('parameter:')).map((port) => port.id)).toEqual(['parameter:color', 'parameter:tolerance'])
    expect(outline.outputs.map((port) => port.id)).toEqual(['surface-out', 'outline-out'])
    expect(rotate.title).toBe('Rotate')
    expect(rotate.parameters.map((parameter) => parameter.id)).toEqual(['angle', 'direction', 'anchor', 'offsetX', 'offsetY'])
  })

  it('exposes typed parameter handles and supports temporal/logical node kinds', () => {
    const rotation = createDemoNode('rotation', 'rotation-ports', { x: 0, y: 0 })
    const time = createDemoNode('time', 'time', { x: 0, y: 0 })
    const bool = createDemoNode('bool', 'bool', { x: 0, y: 0 })
    const rotateConnection = connectDemoPorts({ nodes: [time, rotation], edges: [] }, { sourceNodeId: 'time', sourcePortId: 'value-out', targetNodeId: 'rotation-ports', targetPortId: 'parameter:angle' })
    const invalidConnection = connectDemoPorts({ nodes: [bool, rotation], edges: [] }, { sourceNodeId: 'bool', sourcePortId: 'value-out', targetNodeId: 'rotation-ports', targetPortId: 'parameter:angle' })

    expect(rotation.inputs.some((port) => port.id === 'parameter:angle' && port.type === 'float')).toBe(true)
    expect(time.outputs[0]?.type).toBe('float')
    expect(bool.outputs[0]?.type).toBe('bool')
    expect(rotateConnection.error).toBeUndefined()
    expect(invalidConnection.error).toBe('CONNECTION_DIRECTION_INVALID')
  })

  it('removes a hidden parameter handle while keeping its inspector value', () => {
    const node = createDemoNode('rotation', 'rotation-hidden', { x: 0, y: 0 })
    const hidden = syncDemoNodePorts(node, node.parameters.map((parameter) => parameter.id === 'angle' ? { ...parameter, showInNode: false } : parameter))

    expect(hidden.parameters.find((parameter) => parameter.id === 'angle')?.value).toBe(0)
    expect(hidden.inputs.some((port) => port.id === 'parameter:angle')).toBe(false)
  })

  it('rejects duplicate, self and unknown-port connections without changing graph', () => {
    const graph = createDemoGraph()

    const duplicate = connectDemoPorts(graph, {
      sourceNodeId: 'asset-a',
      sourcePortId: 'surface-out',
      targetNodeId: 'resize-a',
      targetPortId: 'surface-in',
    })
    const self = connectDemoPorts(graph, {
      sourceNodeId: 'resize-a',
      sourcePortId: 'surface-out',
      targetNodeId: 'resize-a',
      targetPortId: 'surface-in',
    })
    const unknownPort = connectDemoPorts(graph, {
      sourceNodeId: 'resize-a',
      sourcePortId: 'missing',
      targetNodeId: 'preview',
      targetPortId: 'surface-in',
    })
    const occupied = connectDemoPorts(graph, {
      sourceNodeId: 'asset-b',
      sourcePortId: 'surface-out',
      targetNodeId: 'resize-a',
      targetPortId: 'surface-in',
    })

    expect(duplicate.error).toBe('CONNECTION_DUPLICATE')
    expect(self.error).toBe('CONNECTION_SELF')
    expect(unknownPort.error).toBe('CONNECTION_PORT_NOT_FOUND')
    expect(occupied.error).toBe('CONNECTION_INPUT_OCCUPIED')
    expect(duplicate.graph).toEqual(graph)
    expect(self.graph).toEqual(graph)
    expect(unknownPort.graph).toEqual(graph)
    expect(occupied.graph).toEqual(graph)
  })
})

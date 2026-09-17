import { describe, expect, it } from 'vitest'
import { createDemoNode, type DemoGraph } from '../src/pipeline-editor-model.js'
import { createSurface, evaluatePipeline, surfaceHash, type PipelineAnimation, type PipelineSurface } from '../src/pipeline-evaluator.js'

const surface = (pixels: readonly number[], width = 1, height = 1): PipelineSurface => createSurface(width, height, new Uint8ClampedArray(pixels))
const graph = (...nodes: DemoGraph['nodes']): DemoGraph => ({ nodes, edges: [] })

describe('pipeline evaluator', () => {
  it('evaluates real Asset → Blend → Preview pixels and stays deterministic', () => {
    const assetA = createDemoNode('asset', 'a', { x: 0, y: 0 })
    const assetB = createDemoNode('asset', 'b', { x: 0, y: 0 })
    const blend = createDemoNode('blend', 'blend', { x: 0, y: 0 })
    const preview = createDemoNode('preview', 'preview', { x: 0, y: 0 })
    const sourceA = { ...assetA, assetId: 'asset-a' }
    const sourceB = { ...assetB, assetId: 'asset-b' }
    const document: DemoGraph = {
      nodes: [sourceA, sourceB, blend, preview],
      edges: [
        { sourceNodeId: 'a', sourcePortId: 'surface-out', targetNodeId: 'blend', targetPortId: 'surface-a' },
        { sourceNodeId: 'b', sourcePortId: 'surface-out', targetNodeId: 'blend', targetPortId: 'surface-b' },
        { sourceNodeId: 'blend', sourcePortId: 'surface-out', targetNodeId: 'preview', targetPortId: 'surface-in' },
      ],
    }
    const assets = new Map([['asset-a', surface([255, 0, 0, 255])], ['asset-b', surface([0, 0, 255, 255])]])
    const first = evaluatePipeline(document, assets)
    const second = evaluatePipeline(document, assets)

    expect(first.diagnostics).toEqual([])
    expect(first.preview?.pixels).toEqual(new Uint8ClampedArray([255, 0, 255, 255]))
    expect(surfaceHash(first.preview!)).toBe(surfaceHash(second.preview!))
  })

  it('uses every arithmetic node as an RGBA image operator', () => {
    const expected: Record<'add' | 'subtract' | 'multiply' | 'divide', number[]> = {
      add: [255, 150, 75, 255], subtract: [100, 50, 25, 255], multiply: [78, 20, 5, 255], divide: [255, 255, 255, 255],
    }
    for (const kind of Object.keys(expected) as Array<keyof typeof expected>) {
      const first = { ...createDemoNode('asset', `${kind}-a`, { x: 0, y: 0 }), assetId: `${kind}-a` }
      const second = { ...createDemoNode('asset', `${kind}-b`, { x: 0, y: 0 }), assetId: `${kind}-b` }
      const operation = createDemoNode(kind, kind, { x: 0, y: 0 })
      const preview = createDemoNode('preview', `${kind}-preview`, { x: 0, y: 0 })
      const result = evaluatePipeline({ nodes: [first, second, operation, preview], edges: [
        { sourceNodeId: first.id, sourcePortId: 'surface-out', targetNodeId: kind, targetPortId: 'surface-a' },
        { sourceNodeId: second.id, sourcePortId: 'surface-out', targetNodeId: kind, targetPortId: 'surface-b' },
        { sourceNodeId: kind, sourcePortId: 'surface-out', targetNodeId: preview.id, targetPortId: 'surface-in' },
      ] }, new Map([[first.assetId!, surface([200, 100, 50, 255])], [second.assetId!, surface([100, 50, 25, 255])]]))
      expect(result.preview?.pixels.slice(0, 4)).toEqual(new Uint8ClampedArray(expected[kind]))
    }
  })

  it('returns transparent output for missing assets and isolated preview', () => {
    const missing = { ...createDemoNode('asset', 'asset', { x: 0, y: 0 }), assetId: 'missing' }
    const preview = createDemoNode('preview', 'preview', { x: 0, y: 0 })
    const result = evaluatePipeline({ nodes: [missing, preview], edges: [{ sourceNodeId: 'asset', sourcePortId: 'surface-out', targetNodeId: 'preview', targetPortId: 'surface-in' }] }, new Map())

    expect(result.preview?.pixels.every((value) => value === 0)).toBe(true)
    expect(evaluatePipeline(graph(preview), new Map()).preview?.pixels.every((value) => value === 0)).toBe(true)
  })

  it('evaluates arithmetic parameters and rejects division by zero', () => {
    const add = createDemoNode('add', 'add', { x: 0, y: 0 })
    const divideBase = createDemoNode('divide', 'divide', { x: 0, y: 0 })
    const divide = { ...divideBase, parameters: divideBase.parameters.map((item) => item.id === 'b' ? { ...item, value: 0 } : item) }
    const result = evaluatePipeline({ nodes: [add, divide], edges: [] }, new Map())

    expect(result.values.get('add')).toBe(0)
    expect(result.values.get('divide')).toBe(0)
    expect(result.diagnostics).toContain('DIVISION_BY_ZERO')
  })

  it('uses arithmetic nodes as image operators and supports typed values', () => {
    const asset = { ...createDemoNode('asset', 'asset', { x: 0, y: 0 }), assetId: 'gray' }
    const colorBase = createDemoNode('color', 'color', { x: 0, y: 0 })
    const color = { ...colorBase, parameters: colorBase.parameters.map((item) => item.id === 'color' ? { ...item, value: '#ff0000' } : item) }
    const multiply = createDemoNode('multiply', 'multiply', { x: 0, y: 0 })
    const preview = createDemoNode('preview', 'preview', { x: 0, y: 0 })
    const int = { ...createDemoNode('int', 'int', { x: 0, y: 0 }), parameters: [{ id: 'value', label: 'Valor', kind: 'number' as const, value: 4 }] }
    const float = { ...createDemoNode('float', 'float', { x: 0, y: 0 }), parameters: [{ id: 'value', label: 'Valor', kind: 'float' as const, value: 0.5 }] }
    const graph: DemoGraph = {
      nodes: [asset, color, multiply, preview, int, float],
      edges: [
        { sourceNodeId: 'asset', sourcePortId: 'surface-out', targetNodeId: 'multiply', targetPortId: 'parameter:a' },
        { sourceNodeId: 'color', sourcePortId: 'surface-out', targetNodeId: 'multiply', targetPortId: 'parameter:b' },
        { sourceNodeId: 'multiply', sourcePortId: 'surface-out', targetNodeId: 'preview', targetPortId: 'surface-in' },
      ],
    }
    const result = evaluatePipeline(graph, new Map([['gray', surface([128, 128, 128, 255])]]))

    expect(result.preview?.pixels.slice(0, 4)).toEqual(new Uint8ClampedArray([128, 0, 0, 255]))
    expect(result.values.get('int')).toBe(4)
    expect(result.values.get('float')).toBe(0.5)
  })

  it('evaluates gradients and vector arithmetic as real pipeline values', () => {
    const gradientBase = createDemoNode('gradient', 'gradient', { x: 0, y: 0 })
    const gradient = { ...gradientBase, parameters: gradientBase.parameters.map((item) => item.id === 'width' ? { ...item, value: 2 } : item.id === 'height' ? { ...item, value: 1 } : item) }
    const vector2 = { ...createDemoNode('vector2', 'vector2', { x: 0, y: 0 }), parameters: [{ id: 'x', label: 'X', kind: 'float' as const, value: 2 }, { id: 'y', label: 'Y', kind: 'float' as const, value: 4 }] }
    const vector3 = { ...createDemoNode('vector3', 'vector3', { x: 0, y: 0 }), parameters: [{ id: 'x', label: 'X', kind: 'float' as const, value: 1 }, { id: 'y', label: 'Y', kind: 'float' as const, value: 3 }, { id: 'z', label: 'Z', kind: 'float' as const, value: 5 }] }
    const add = createDemoNode('add', 'add-vectors', { x: 0, y: 0 })
    const result = evaluatePipeline({ nodes: [gradient, vector2, vector3, add], edges: [
      { sourceNodeId: 'vector2', sourcePortId: 'value-out', targetNodeId: 'add-vectors', targetPortId: 'parameter:a' },
      { sourceNodeId: 'vector3', sourcePortId: 'value-out', targetNodeId: 'add-vectors', targetPortId: 'parameter:b' },
    ] }, new Map())

    expect(result.outputs.get('gradient')?.get('surface-out')).toMatchObject({ width: 2, height: 1 })
    expect(result.outputs.get('add-vectors')?.get('value-out')).toEqual([3, 7, 7])
    expect(result.vectors.get('add-vectors')).toEqual([3, 7, 7])
  })

  it('evaluates deterministic VFX noise and moves real pixels with typed motion', () => {
    const kinds = ['noise', 'cellular-noise', 'perlin', 'simplex'] as const
    for (const kind of kinds) {
      const base = createDemoNode(kind, kind, { x: 0, y: 0 })
      const node = { ...base, parameters: base.parameters.map((item) => item.id === 'width' || item.id === 'height' ? { ...item, value: 8 } : item) }
      const first = evaluatePipeline(graph(node), new Map())
      const second = evaluatePipeline(graph(node), new Map())
      const output = first.outputs.get(kind)?.get('surface-out') as PipelineSurface
      expect(output.width).toBe(8)
      expect(output.pixels.some((value, index) => index % 4 === 3 && value === 255)).toBe(true)
      expect(surfaceHash(output)).toBe(surfaceHash(second.outputs.get(kind)?.get('surface-out') as PipelineSurface))
    }

    const asset = { ...createDemoNode('asset', 'asset', { x: 0, y: 0 }), assetId: 'motion' }
    const directionBase = createDemoNode('direction', 'direction', { x: 0, y: 0 })
    const direction = { ...directionBase, parameters: directionBase.parameters.map((item) => item.id === 'angle' ? { ...item, value: 0 } : item.id === 'magnitude' ? { ...item, value: 1 } : item) }
    const movement = createDemoNode('movement', 'movement', { x: 0, y: 0 })
    const moved = evaluatePipeline({ nodes: [asset, direction, movement], edges: [
      { sourceNodeId: 'asset', sourcePortId: 'surface-out', targetNodeId: 'movement', targetPortId: 'surface-in' },
      { sourceNodeId: 'direction', sourcePortId: 'value-out', targetNodeId: 'movement', targetPortId: 'offset-in' },
    ] }, new Map([['motion', surface([255, 0, 0, 255, 0, 0, 255, 255], 2, 1)]]))
    expect(moved.vectors.get('direction')).toEqual([1, 0])
    expect((moved.outputs.get('movement')?.get('surface-out') as PipelineSurface).pixels).toEqual(new Uint8ClampedArray([0, 0, 0, 0, 255, 0, 0, 255]))
  })

  it('applies generator Offset as a Vector2 input', () => {
    const base = createDemoNode('white-noise', 'base', { x: 0, y: 0 })
    const offset = createDemoNode('white-noise', 'offset', { x: 0, y: 0 })
    const sourceBase = createDemoNode('vector2', 'source', { x: 0, y: 0 })
    const source = { ...sourceBase, parameters: sourceBase.parameters.map((parameter) => parameter.id === 'x' ? { ...parameter, value: 3 } : parameter.id === 'y' ? { ...parameter, value: 2 } : parameter) }
    const result = evaluatePipeline({ nodes: [base, offset, source], edges: [{ sourceNodeId: 'source', sourcePortId: 'value-out', targetNodeId: 'offset', targetPortId: 'offset-in' }] }, new Map())
    expect((result.outputs.get('offset')?.get('surface-out') as PipelineSurface).pixels).not.toEqual((result.outputs.get('base')?.get('surface-out') as PipelineSurface).pixels)
  })

  it('normalizes rotation and reports cycles without producing opaque pixels', () => {
    const rotation = createDemoNode('rotation', 'rotation', { x: 0, y: 0 })
    const parameter = rotation.parameters.find((item) => item.id === 'angle')!
    const cycle: DemoGraph = {
      nodes: [{ ...rotation, parameters: [{ ...parameter, value: 359.99 }] }, createDemoNode('preview', 'preview', { x: 0, y: 0 })],
      edges: [
        { sourceNodeId: 'rotation', sourcePortId: 'surface-out', targetNodeId: 'preview', targetPortId: 'surface-in' },
        { sourceNodeId: 'preview', sourcePortId: 'surface-in', targetNodeId: 'rotation', targetPortId: 'surface-in' },
      ],
    }
    const result = evaluatePipeline(cycle, new Map())

    expect(result.diagnostics).toContain('GRAPH_CYCLE')
    expect(result.preview?.pixels.every((value) => value === 0)).toBe(true)
    const invalid = { ...rotation, parameters: [{ ...parameter, value: 360 }] }
    expect(evaluatePipeline({ nodes: [invalid], edges: [] }, new Map()).diagnostics).toContain('PARAMETER_OUT_OF_RANGE')
  })

  it('keeps unary transform dimensions and honors counterclockwise rotation', () => {
    const asset = { ...createDemoNode('asset', 'asset', { x: 0, y: 0 }), assetId: 'asset' }
    const rotateBase = createDemoNode('rotation', 'rotation', { x: 0, y: 0 })
    const rotateClockwise = { ...rotateBase, parameters: rotateBase.parameters.map((item) => item.id === 'angle' ? { ...item, value: 90 } : item) }
    const rotateCounterclockwise = { ...rotateClockwise, id: 'counter', parameters: rotateClockwise.parameters.map((item) => item.id === 'direction' ? { ...item, value: 'Counterclockwise' } : item) }
    const pixels = new Uint8ClampedArray(3 * 3 * 4); pixels.set([255, 0, 0, 255], 0); pixels.set([0, 255, 0, 255], 4); pixels.set([0, 0, 255, 255], 8)
    const clockwise = evaluatePipeline({ nodes: [asset, rotateClockwise], edges: [{ sourceNodeId: 'asset', sourcePortId: 'surface-out', targetNodeId: 'rotation', targetPortId: 'surface-in' }] }, new Map([['asset', surface([...pixels], 3, 3)]])).outputs.get('rotation')?.get('surface-out') as PipelineSurface
    const counterclockwise = evaluatePipeline({ nodes: [asset, rotateCounterclockwise], edges: [{ sourceNodeId: 'asset', sourcePortId: 'surface-out', targetNodeId: 'counter', targetPortId: 'surface-in' }] }, new Map([['asset', surface([...pixels], 3, 3)]])).outputs.get('counter')?.get('surface-out') as PipelineSurface
    expect(clockwise.width).toBe(3); expect(clockwise.height).toBe(3); expect(surfaceHash(clockwise)).not.toBe(surfaceHash(counterclockwise))
    const zoom = createDemoNode('zoom', 'zoom', { x: 0, y: 0 })
    const zoomed = evaluatePipeline({ nodes: [asset, zoom], edges: [{ sourceNodeId: 'asset', sourcePortId: 'surface-out', targetNodeId: 'zoom', targetPortId: 'surface-in' }] }, new Map([['asset', surface([...pixels], 3, 3)]])).outputs.get('zoom')?.get('surface-out') as PipelineSurface
    expect(zoomed.width).toBe(3); expect(zoomed.height).toBe(3)
  })

  it('evaluates invert, select, replace and outline on real surfaces', () => {
    const source = { ...createDemoNode('asset', 'source', { x: 0, y: 0 }), assetId: 'source' }
    const invert = createDemoNode('invert', 'invert', { x: 0, y: 0 })
    const selectBase = createDemoNode('select', 'select', { x: 0, y: 0 })
    const select = { ...selectBase, parameters: selectBase.parameters.map((item) => item.id === 'color' ? { ...item, value: '#0a141e80' } : item) }
    const replacement = { ...createDemoNode('asset', 'replacement', { x: 0, y: 0 }), assetId: 'replacement' }
    const replaceBase = createDemoNode('replace', 'replace', { x: 0, y: 0 })
    const replace = { ...replaceBase, parameters: replaceBase.parameters.map((item) => item.id === 'color' ? { ...item, value: '#0a141e80' } : item) }
    const outlineBase = createDemoNode('outline', 'outline', { x: 0, y: 0 })
    const outline = { ...outlineBase, parameters: outlineBase.parameters.map((item) => item.id === 'color' ? { ...item, value: '#ff0000ff' } : item) }
    const input = surface([0, 0, 0, 0, 10, 20, 30, 128, 0, 0, 0, 0, 0, 0, 0, 0], 2, 2)
    const graph: DemoGraph = {
      nodes: [source, invert, select, replacement, replace, outline],
      edges: [
        { sourceNodeId: 'source', sourcePortId: 'surface-out', targetNodeId: 'invert', targetPortId: 'surface-in' },
        { sourceNodeId: 'source', sourcePortId: 'surface-out', targetNodeId: 'select', targetPortId: 'surface-in' },
        { sourceNodeId: 'source', sourcePortId: 'surface-out', targetNodeId: 'replace', targetPortId: 'surface-a' },
        { sourceNodeId: 'replacement', sourcePortId: 'surface-out', targetNodeId: 'replace', targetPortId: 'surface-b' },
        { sourceNodeId: 'source', sourcePortId: 'surface-out', targetNodeId: 'outline', targetPortId: 'surface-in' },
      ],
    }
    const result = evaluatePipeline(graph, new Map([['source', input], ['replacement', surface([0, 0, 255, 255])]]))

    expect(result.outputs.get('invert')?.get('surface-out')).toMatchObject({ pixels: new Uint8ClampedArray([255, 255, 255, 0, 245, 235, 225, 128, 255, 255, 255, 0, 255, 255, 255, 0]) })
    expect((result.outputs.get('select')?.get('mask-out') as PipelineSurface).pixels).toEqual(new Uint8ClampedArray([0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0]))
    expect((result.outputs.get('replace')?.get('surface-out') as PipelineSurface).pixels.slice(0, 8)).toEqual(new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 255, 255]))
    expect([...((result.outputs.get('outline')?.get('outline-out') as PipelineSurface).pixels)].filter((value, index) => index % 4 === 3 && value === 255)).toHaveLength(3)
  })

  it('uses A dimensions with nearest B resizing and evaluates GIF frames by timeline time', () => {
    const first = { ...createDemoNode('asset', 'first', { x: 0, y: 0 }), assetId: 'first' }
    const second = { ...createDemoNode('asset', 'second', { x: 0, y: 0 }), assetId: 'second' }
    const add = createDemoNode('add', 'add', { x: 0, y: 0 })
    const preview = createDemoNode('preview', 'preview', { x: 0, y: 0 })
    const graph: DemoGraph = { nodes: [first, second, add, preview], edges: [
      { sourceNodeId: 'first', sourcePortId: 'surface-out', targetNodeId: 'add', targetPortId: 'surface-a' },
      { sourceNodeId: 'second', sourcePortId: 'surface-out', targetNodeId: 'add', targetPortId: 'surface-b' },
      { sourceNodeId: 'add', sourcePortId: 'surface-out', targetNodeId: 'preview', targetPortId: 'surface-in' },
    ] }
    const gif: PipelineAnimation = { frames: [surface([255, 0, 0, 255]), surface([0, 0, 255, 255])], frameDurationsMs: [100, 100], loop: true }
    const frameGraph: DemoGraph = { nodes: [first, preview], edges: [{ sourceNodeId: 'first', sourcePortId: 'surface-out', targetNodeId: 'preview', targetPortId: 'surface-in' }] }
    expect(evaluatePipeline(frameGraph, new Map([['first', gif]]), 0).preview?.pixels).toEqual(new Uint8ClampedArray([255, 0, 0, 255]))
    expect(evaluatePipeline(frameGraph, new Map([['first', gif]]), 100).preview?.pixels).toEqual(new Uint8ClampedArray([0, 0, 255, 255]))
    const result = evaluatePipeline(graph, new Map([['first', surface([255, 0, 0, 255, 0, 0, 255, 255], 2, 1)], ['second', surface([0, 255, 0, 255])]]))
    expect(result.preview).toMatchObject({ width: 2, height: 1 })
    expect(result.preview?.pixels).toEqual(new Uint8ClampedArray([255, 255, 0, 255, 0, 255, 255, 255]))
  })

  it('evaluates Time and DeltaTime from explicit timeline context', () => {
    const time = createDemoNode('time', 'time', { x: 0, y: 0 })
    const delta = createDemoNode('delta-time', 'delta', { x: 0, y: 0 })
    const result = evaluatePipeline(graph(time, delta), new Map(), 1000, { previousTimeMs: 250 })

    expect(result.outputs.get('time')?.get('value-out')).toBe(1)
    expect(result.outputs.get('delta')?.get('value-out')).toBe(1)
    expect(evaluatePipeline(graph(delta), new Map(), 1000).outputs.get('delta')?.get('value-out')).toBe(1)
  })

  it('evaluates deterministic math, arrays and 2D generators', () => {
    const number = { ...createDemoNode('number', 'number', { x: 0, y: 0 }), parameters: createDemoNode('number', 'tmp', { x: 0, y: 0 }).parameters.map((parameter) => parameter.id === 'value' ? { ...parameter, value: -2.5 } : parameter) }
    const absolute = createDemoNode('absolute', 'absolute', { x: 0, y: 0 })
    const checker = createDemoNode('checkerboard', 'checker', { x: 0, y: 0 })
    const noise = createDemoNode('white-noise', 'noise', { x: 0, y: 0 })
    const array = { ...createDemoNode('number-array', 'array', { x: 0, y: 0 }), parameters: createDemoNode('number-array', 'tmp-array', { x: 0, y: 0 }).parameters.map((parameter) => parameter.id === 'value' ? { ...parameter, value: [3, 1, 2] } : parameter) }
    const length = createDemoNode('array-length', 'length', { x: 0, y: 0 })
    const graph: DemoGraph = { nodes: [number, absolute, checker, noise, array, length], edges: [
      { sourceNodeId: 'number', sourcePortId: 'value-out', targetNodeId: 'absolute', targetPortId: 'value-in' },
      { sourceNodeId: 'array', sourcePortId: 'array-out', targetNodeId: 'length', targetPortId: 'array-in' },
    ] }
    const first = evaluatePipeline(graph, new Map())
    const second = evaluatePipeline(graph, new Map())
    expect(first.outputs.get('absolute')?.get('value-out')).toBe(2.5)
    expect(first.outputs.get('length')?.get('value-out')).toBe(3)
    expect(first.outputs.get('checker')?.get('surface-out')).toMatchObject({ width: 64, height: 64 })
    expect((first.outputs.get('noise')?.get('surface-out') as PipelineSurface).pixels).toEqual((second.outputs.get('noise')?.get('surface-out') as PipelineSurface).pixels)
  })

  it('renders deterministic drawing generators and normalizes vectors', () => {
    const shape = createDemoNode('draw-shape', 'shape', { x: 0, y: 0 })
    const text = createDemoNode('draw-text', 'text', { x: 0, y: 0 })
    const points = { ...createDemoNode('draw-path', 'path', { x: 0, y: 0 }), parameters: createDemoNode('draw-path', 'tmp-path', { x: 0, y: 0 }).parameters }
    const normalize = createDemoNode('normalize', 'normalize', { x: 0, y: 0 })
    const vector = { ...createDemoNode('vector2', 'vector', { x: 0, y: 0 }), parameters: createDemoNode('vector2', 'tmp-vector', { x: 0, y: 0 }).parameters.map((parameter) => parameter.id === 'x' ? { ...parameter, value: 3 } : parameter.id === 'y' ? { ...parameter, value: 4 } : parameter) }
    const result = evaluatePipeline({ nodes: [shape, text, points, normalize, vector], edges: [{ sourceNodeId: 'vector', sourcePortId: 'value-out', targetNodeId: 'normalize', targetPortId: 'vector-in' }] }, new Map())
    expect((result.outputs.get('shape')?.get('surface-out') as PipelineSurface).pixels.some((value) => value !== 0)).toBe(true)
    expect((result.outputs.get('text')?.get('surface-out') as PipelineSurface).pixels.some((value) => value !== 0)).toBe(true)
    expect(result.outputs.get('normalize')?.get('value-out')).toEqual([0.6, 0.8])
  })

  it('evaluates boolean truth tables, comparisons and typed If/Switch', () => {
    const boolA = { ...createDemoNode('bool', 'bool-a', { x: 0, y: 0 }), parameters: createDemoNode('bool', 'tmp-a', { x: 0, y: 0 }).parameters.map((parameter) => parameter.id === 'value' ? { ...parameter, value: true } : parameter) }
    const boolB = createDemoNode('bool', 'bool-b', { x: 0, y: 0 })
    const and = createDemoNode('and', 'and', { x: 0, y: 0 })
    const not = createDemoNode('not', 'not', { x: 0, y: 0 })
    const compare = createDemoNode('compare', 'compare', { x: 0, y: 0 })
    const intA = { ...createDemoNode('int', 'int-a', { x: 0, y: 0 }), parameters: createDemoNode('int', 'tmp-int', { x: 0, y: 0 }).parameters.map((parameter) => parameter.id === 'value' ? { ...parameter, value: 4 } : parameter) }
    const intB = { ...createDemoNode('int', 'int-b', { x: 0, y: 0 }), parameters: createDemoNode('int', 'tmp-int-b', { x: 0, y: 0 }).parameters.map((parameter) => parameter.id === 'value' ? { ...parameter, value: 2 } : parameter) }
    const ifNode = createDemoNode('if', 'if', { x: 0, y: 0 })
    const preview = createDemoNode('preview', 'preview', { x: 0, y: 0 })
    const sourceA = { ...createDemoNode('asset', 'source-a', { x: 0, y: 0 }), assetId: 'a' }
    const sourceB = { ...createDemoNode('asset', 'source-b', { x: 0, y: 0 }), assetId: 'b' }
    const result = evaluatePipeline({ nodes: [boolA, boolB, and, not, compare, intA, intB, ifNode, preview, sourceA, sourceB], edges: [
      { sourceNodeId: 'bool-a', sourcePortId: 'value-out', targetNodeId: 'and', targetPortId: 'value-a' },
      { sourceNodeId: 'bool-b', sourcePortId: 'value-out', targetNodeId: 'and', targetPortId: 'value-b' },
      { sourceNodeId: 'and', sourcePortId: 'value-out', targetNodeId: 'not', targetPortId: 'value-in' },
      { sourceNodeId: 'int-a', sourcePortId: 'value-out', targetNodeId: 'compare', targetPortId: 'value-a' },
      { sourceNodeId: 'int-b', sourcePortId: 'value-out', targetNodeId: 'compare', targetPortId: 'value-b' },
      { sourceNodeId: 'compare', sourcePortId: 'value-out', targetNodeId: 'if', targetPortId: 'condition' },
      { sourceNodeId: 'source-a', sourcePortId: 'surface-out', targetNodeId: 'if', targetPortId: 'true-in' },
      { sourceNodeId: 'source-b', sourcePortId: 'surface-out', targetNodeId: 'if', targetPortId: 'false-in' },
      { sourceNodeId: 'if', sourcePortId: 'result', targetNodeId: 'preview', targetPortId: 'surface-in' },
    ] }, new Map([['a', surface([255, 0, 0, 255])], ['b', surface([0, 0, 255, 255])]]))

    expect(result.outputs.get('and')?.get('value-out')).toBe(false)
    expect(result.outputs.get('not')?.get('value-out')).toBe(true)
    expect(result.outputs.get('compare')?.get('value-out')).toBe(false)
    expect(result.preview?.pixels).toEqual(new Uint8ClampedArray([0, 0, 255, 255]))
    expect(result.diagnostics).not.toContain('GRAPH_CYCLE')
  })
})

import type { CustomNodeDefinition } from '@mosaico/contracts'

export type DemoNodeKind = 'asset' | 'resize' | 'flip' | 'invert' | 'select' | 'replace' | 'outline' | 'color' | 'gradient' | 'blend' | 'add' | 'subtract' | 'multiply' | 'divide' | 'rotation' | 'zoom' | 'noise' | 'cellular-noise' | 'perlin' | 'simplex' | 'seed' | 'rough' | 'movement' | 'direction' | 'velocity' | 'int' | 'float' | 'number' | 'number-array' | 'vector2' | 'vector3' | 'vector4' | 'time' | 'delta-time' | 'bool' | 'compare' | 'if' | 'switch' | 'not' | 'and' | 'or' | 'xor' | 'nor' | 'nand' | 'absolute' | 'ceil' | 'clamp' | 'cosine' | 'floor' | 'lerp' | 'max' | 'min' | 'modulo' | 'normalize' | 'round' | 'sine' | 'square-root' | 'tangent' | 'angle' | 'distance' | 'evaluate' | 'vector-add' | 'vector-distance' | 'vector-length' | 'vector-normalize' | 'vector-scale' | 'array-find' | 'array-get' | 'array-length' | 'array-range' | 'array-reverse' | 'array-set' | 'array-shuffle' | 'array-sort' | 'array-split' | 'array-zip' | 'solid' | 'linear-gradient' | 'radial-gradient' | 'bilinear-gradient' | 'normalized-gradient' | 'checkerboard' | 'grid' | 'grid-triangular' | 'stripe' | 'draw-curve' | 'draw-path' | 'draw-shape' | 'draw-group' | 'draw-text' | 'white-noise' | 'blue-noise' | 'gaussian-noise' | 'impulse-noise' | 'pink-noise' | 'brown-noise' | 'fbm' | 'turbulent-noise' | 'rings-noise' | 'rays-noise' | 'euclidean-noise' | 'voronoi-noise' | 'manhattan-noise' | 'chebyshev-noise' | 'worley-noise' | 'tricubic-noise' | 'discrete-noise' | 'seamless-noise' | 'spots-noise' | 'atlas' | 'corner-warp' | 'crop' | 'deform' | 'displace' | 'lattice-warp' | 'mirror' | 'move' | 'move-to' | 'nine-slice' | 'padding' | 'pivot' | 'polar-distance' | 'repeat' | 'scale' | 'skew' | 'tile' | 'transform' | 'alpha-cut' | 'blur' | 'blur-directional' | 'blur-gaussian' | 'brightness-contrast' | 'color-adjust' | 'color-replace' | 'colorize' | 'dither' | 'dither-bayer' | 'dither-cluster' | 'edge-detect' | 'glow' | 'hue-saturation-value' | 'level' | 'palette-apply' | 'match-palette' | 'pixelate' | 'posterize' | 'shadow' | 'shading' | 'sharpen' | 'threshold' | 'alpha-to-color' | 'clean-edge' | 'half-tone' | 'mask' | 'mix' | 'remap' | 'stack' | 'array-randomizer' | 'get-pixel' | 'isolate-color' | 'frame-blend' | 'frame-bypass' | 'resource-loader' | 'region-system' | 'uv-workflow' | 'condition' | 'delay' | 'feedback' | 'iteration' | 'loop' | 'loop-start' | 'loop-end' | 'script' | 'bloom' | 'godray' | 'mk-godray' | 'particle' | 'particle-spawn' | 'pixel-cloud' | 'trail' | 'vfx' | 'preview' | 'custom'
export type DemoPortType = 'surface' | 'surface-or-value' | 'color' | 'gradient' | 'value' | 'int' | 'float' | 'bool' | 'vector2' | 'vector3' | 'vector4' | 'array' | 'point' | 'path' | 'matrix' | 'string' | 'mesh' | 'camera' | 'scene' | 'texture'
export type DemoPortDirection = 'input' | 'output'

export interface DemoPosition {
  readonly x: number
  readonly y: number
}

export interface DemoPort {
  readonly id: string
  readonly label: string
  readonly type: DemoPortType
  readonly direction: DemoPortDirection
}

export interface DemoParameter {
  readonly id: string
  readonly label: string
  readonly kind: 'text' | 'number' | 'float' | 'range' | 'select' | 'color' | 'boolean' | 'array'
  readonly value: string | number | boolean | readonly number[] | readonly (string | number | boolean)[]
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly unit?: string
  readonly options?: readonly string[]
  readonly portType?: DemoPortType
  readonly showInNode?: boolean
}

export interface DemoNode extends DemoPosition {
  readonly id: string
  readonly kind: DemoNodeKind
  readonly family: string
  readonly title: string
  readonly inputs: readonly DemoPort[]
  readonly outputs: readonly DemoPort[]
  readonly parameters: readonly DemoParameter[]
  readonly assetId?: string
  readonly customNodeId?: string
  readonly customDefinition?: CustomNodeDefinition
  readonly previewVisible?: boolean
}

export const parameterPortId = (parameterId: string): string => `parameter:${parameterId}`

function parameterPortType(parameter: DemoParameter): DemoPortType | undefined {
  if (parameter.portType) return parameter.portType
  if (parameter.kind === 'boolean') return 'bool'
  if (parameter.kind === 'color') return 'color'
  if (parameter.kind === 'float' || parameter.kind === 'range') return 'float'
  if (parameter.kind === 'number') return 'value'
  if (parameter.kind === 'array') return 'array'
  if (parameter.kind === 'select' || parameter.kind === 'text') return 'value'
  return undefined
}

export function parameterInputPorts(parameters: readonly DemoParameter[]): DemoPort[] {
  return parameters.flatMap((parameter) => {
    const type = parameterPortType(parameter)
    return parameter.showInNode === false || !type ? [] : [{ id: parameterPortId(parameter.id), label: parameter.label, type, direction: 'input' as const }]
  })
}

const legacyParameterPortIds = new Set(['surface-a', 'surface-b', 'value-a', 'value-b', 'seed-in', 'roughness-in'])
const noiseKinds = new Set<string>(['noise', 'cellular-noise', 'perlin', 'simplex', 'white-noise', 'blue-noise', 'gaussian-noise', 'impulse-noise', 'pink-noise', 'brown-noise', 'fbm', 'turbulent-noise', 'rings-noise', 'rays-noise', 'euclidean-noise', 'voronoi-noise', 'manhattan-noise', 'chebyshev-noise', 'worley-noise', 'tricubic-noise', 'discrete-noise', 'seamless-noise', 'spots-noise'])
const parameterAliases: Readonly<Record<string, string>> = { 'surface-a': 'a', 'value-a': 'a', 'surface-b': 'b', 'value-b': 'b', 'seed-in': 'seed', 'roughness-in': 'roughness' }

export function normalizeParameterId(id: string): string {
  return parameterAliases[id] ?? id
}

function isParameterPort(port: DemoPort, parameters: readonly DemoParameter[]): boolean {
  const rawId = port.id.startsWith('parameter:') ? port.id.slice('parameter:'.length) : port.id
  const id = normalizeParameterId(rawId)
  return parameters.some((parameter) => parameter.id === id)
}

function normalizedParameters(node: DemoNode): readonly DemoParameter[] {
  const seen = new Set<string>()
  return node.parameters.flatMap((parameter) => {
    const id = normalizeParameterId(parameter.id)
    if (seen.has(id)) return []
    seen.add(id)
    const normalized = { ...parameter, id }
    if (['add', 'subtract', 'multiply', 'divide'].includes(node.kind) && (id === 'a' || id === 'b')) return [{ ...normalized, label: id === 'a' ? 'Valor A' : 'Valor B', portType: 'surface-or-value' }]
    if (noiseKinds.has(node.kind) && id === 'seed') return [{ ...normalized, portType: 'int' }]
    if (noiseKinds.has(node.kind) && id === 'roughness') return [{ ...normalized, portType: 'float' }]
    return [normalized]
  })
}

export function normalizeDemoNode(node: DemoNode): DemoNode {
  return syncDemoNodePorts({ ...node, previewVisible: node.previewVisible !== false }, normalizedParameters(node))
}

export function normalizeDemoEdge(edge: DemoEdge, nodes: readonly DemoNode[]): DemoEdge {
  const target = nodes.find((node) => node.id === edge.targetNodeId)
  if (!target) return edge
  const rawPortId = edge.targetPortId.startsWith('parameter:') ? edge.targetPortId.slice('parameter:'.length) : edge.targetPortId
  const canonical = normalizeParameterId(rawPortId)
  const targetPortId = target.parameters.some((parameter) => parameter.id === canonical) && (parameterAliases[rawPortId] !== undefined || edge.targetPortId.startsWith('parameter:')) ? parameterPortId(canonical) : edge.targetPortId
  return targetPortId === edge.targetPortId ? edge : { ...edge, targetPortId }
}

export interface DemoEdge {
  readonly sourceNodeId: string
  readonly sourcePortId: string
  readonly targetNodeId: string
  readonly targetPortId: string
}

export interface DemoGraph {
  readonly nodes: readonly DemoNode[]
  readonly edges: readonly DemoEdge[]
  readonly selectedNodeId?: string
}

export type DemoConnectionRequest = DemoEdge

export type DemoGraphError =
  | 'CONNECTION_NODE_NOT_FOUND'
  | 'CONNECTION_PORT_NOT_FOUND'
  | 'CONNECTION_DIRECTION_INVALID'
  | 'CONNECTION_SELF'
  | 'CONNECTION_DUPLICATE'
  | 'CONNECTION_INPUT_OCCUPIED'

export interface DemoGraphResult {
  readonly graph: DemoGraph
  readonly error?: DemoGraphError
}

const baseKindDetails: Readonly<Record<Extract<DemoNodeKind, 'asset' | 'resize' | 'flip' | 'invert' | 'select' | 'replace' | 'outline' | 'color' | 'gradient' | 'blend' | 'add' | 'subtract' | 'multiply' | 'divide' | 'rotation' | 'zoom' | 'noise' | 'cellular-noise' | 'perlin' | 'simplex' | 'seed' | 'rough' | 'movement' | 'direction' | 'velocity' | 'int' | 'float' | 'vector2' | 'vector3' | 'vector4' | 'time' | 'delta-time' | 'bool' | 'compare' | 'if' | 'switch' | 'not' | 'and' | 'or' | 'xor' | 'nor' | 'nand' | 'preview' | 'custom'>, Omit<DemoNode, 'id' | 'x' | 'y'>>> = {
  asset: {
    kind: 'asset',
    family: 'Entrada / salida',
    title: 'Asset',
    inputs: [],
    outputs: [{ id: 'surface-out', label: 'Surface', type: 'surface', direction: 'output' }],
    parameters: [{ id: 'asset-name', label: 'Fuente', kind: 'text', value: '' }],
  },
  resize: {
    kind: 'resize',
    family: 'Transformación',
    title: 'Resize',
    inputs: [{ id: 'surface-in', label: 'Surface', type: 'surface', direction: 'input' }],
    outputs: [{ id: 'surface-out', label: 'Surface', type: 'surface', direction: 'output' }],
    parameters: [
      { id: 'width', label: 'Ancho', kind: 'number', value: 32, min: 1, max: 2048, step: 1, unit: 'px' },
      { id: 'height', label: 'Alto', kind: 'number', value: 32, min: 1, max: 2048, step: 1, unit: 'px' },
    ],
  },
  flip: {
    kind: 'flip',
    family: 'Transformación',
    title: 'Flip 90°',
    inputs: [{ id: 'surface-in', label: 'Surface', type: 'surface', direction: 'input' }],
    outputs: [{ id: 'surface-out', label: 'Surface', type: 'surface', direction: 'output' }],
    parameters: [{ id: 'axis', label: 'Eje', kind: 'select', value: 'Horizontal', options: ['Horizontal', 'Vertical'] }],
  },
  invert: {
    kind: 'invert',
    family: 'Transform',
    title: 'Invert',
    inputs: [{ id: 'surface-in', label: 'Surface', type: 'surface', direction: 'input' }],
    outputs: [{ id: 'surface-out', label: 'Surface', type: 'surface', direction: 'output' }],
    parameters: [{ id: 'channels', label: 'Channels', kind: 'select', value: 'RGB', options: ['RGB', 'RGBA'] }],
  },
  select: {
    kind: 'select',
    family: 'Mask',
    title: 'Select',
    inputs: [{ id: 'surface-in', label: 'Surface', type: 'surface', direction: 'input' }],
    outputs: [{ id: 'mask-out', label: 'Mask', type: 'surface', direction: 'output' }],
    parameters: [
      { id: 'mode', label: 'Mode', kind: 'select', value: 'Color', options: ['Color', 'Alpha', 'Luminance'] },
      { id: 'color', label: 'Color A', kind: 'color', value: '#ffffff' },
      { id: 'tolerance', label: 'Tolerance', kind: 'range', value: 0, min: 0, max: 255, step: 1 },
      { id: 'min', label: 'Minimum', kind: 'range', value: 0, min: 0, max: 255, step: 1 },
      { id: 'max', label: 'Maximum', kind: 'range', value: 255, min: 0, max: 255, step: 1 },
    ],
  },
  replace: {
    kind: 'replace',
    family: 'Composition',
    title: 'Replace',
    inputs: [
      { id: 'surface-a', label: 'A', type: 'surface', direction: 'input' },
      { id: 'surface-b', label: 'Replacement', type: 'surface', direction: 'input' },
    ],
    outputs: [{ id: 'surface-out', label: 'Surface', type: 'surface', direction: 'output' }],
    parameters: [
      { id: 'color', label: 'Color A', kind: 'color', value: '#ffffff' },
      { id: 'tolerance', label: 'Tolerance', kind: 'range', value: 0, min: 0, max: 255, step: 1 },
    ],
  },
  outline: {
    kind: 'outline',
    family: 'VFX / Outline',
    title: 'Outline',
    inputs: [{ id: 'surface-in', label: 'Surface', type: 'surface', direction: 'input' }],
    outputs: [{ id: 'surface-out', label: 'Original', type: 'surface', direction: 'output' }, { id: 'outline-out', label: 'Outline', type: 'surface', direction: 'output' }],
    parameters: [
      { id: 'color', label: 'Color', kind: 'color', value: '#000000ff' },
      { id: 'thickness', label: 'Thickness', kind: 'number', value: 1, min: 1, max: 16, step: 1 },
      { id: 'threshold', label: 'Alpha threshold', kind: 'number', value: 1, min: 0, max: 255, step: 1 },
      { id: 'mode', label: 'Mode', kind: 'select', value: 'Outside', options: ['Inside', 'Outside', 'Both'] },
    ],
  },
  color: {
    kind: 'color',
    family: 'Color',
    title: 'Color',
    inputs: [{ id: 'surface-in', label: 'Surface opcional', type: 'surface', direction: 'input' }],
    outputs: [{ id: 'surface-out', label: 'Surface', type: 'surface', direction: 'output' }],
    parameters: [{ id: 'mode', label: 'Modo', kind: 'select', value: 'Solid', options: ['Solid', 'Tint', 'Multiply'] }, { id: 'color', label: 'Color', kind: 'color', value: '#ffffff' }, { id: 'width', label: 'Ancho', kind: 'number', value: 64, min: 1, max: 2048, step: 1 }, { id: 'height', label: 'Alto', kind: 'number', value: 64, min: 1, max: 2048, step: 1 }],
  },
  gradient: {
    kind: 'gradient',
    family: 'VFX / Color',
    title: 'Gradient',
    inputs: [],
    outputs: [{ id: 'surface-out', label: 'Surface', type: 'surface', direction: 'output' }],
    parameters: [
      { id: 'from', label: 'Desde', kind: 'color', value: '#000000ff' },
      { id: 'to', label: 'Hasta', kind: 'color', value: '#ffffffff' },
      { id: 'direction', label: 'Dirección', kind: 'select', value: 'Horizontal', options: ['Horizontal', 'Vertical', 'Diagonal'] },
      { id: 'width', label: 'Ancho', kind: 'number', value: 64, min: 1, max: 2048, step: 1 },
      { id: 'height', label: 'Alto', kind: 'number', value: 64, min: 1, max: 2048, step: 1 },
    ],
  },
  blend: {
    kind: 'blend',
    family: 'Composición',
    title: 'Blend',
    inputs: [
      { id: 'surface-a', label: 'A', type: 'surface', direction: 'input' },
      { id: 'surface-b', label: 'B', type: 'surface', direction: 'input' },
    ],
    outputs: [{ id: 'surface-out', label: 'Surface', type: 'surface', direction: 'output' }],
    parameters: [{ id: 'mode', label: 'Modo', kind: 'select', value: 'Screen', options: ['Screen', 'Multiply', 'Add'] }],
  },
  add: {
    kind: 'add',
    family: 'Aritmética',
    title: 'Add',
    inputs: [],
    outputs: [{ id: 'surface-out', label: 'Surface', type: 'surface', direction: 'output' }, { id: 'value-out', label: 'Value', type: 'value', direction: 'output' }],
    parameters: [{ id: 'a', label: 'Valor A', kind: 'number', value: 0, portType: 'surface-or-value' }, { id: 'b', label: 'Valor B', kind: 'number', value: 0, portType: 'surface-or-value' }],
  },
  subtract: {
    kind: 'subtract',
    family: 'Aritmética',
    title: 'Subtract',
    inputs: [],
    outputs: [{ id: 'surface-out', label: 'Surface', type: 'surface', direction: 'output' }, { id: 'value-out', label: 'Value', type: 'value', direction: 'output' }],
    parameters: [{ id: 'a', label: 'Valor A', kind: 'number', value: 0, portType: 'surface-or-value' }, { id: 'b', label: 'Valor B', kind: 'number', value: 0, portType: 'surface-or-value' }],
  },
  multiply: {
    kind: 'multiply',
    family: 'Aritmética',
    title: 'Multiply',
    inputs: [],
    outputs: [{ id: 'surface-out', label: 'Surface', type: 'surface', direction: 'output' }, { id: 'value-out', label: 'Value', type: 'value', direction: 'output' }],
    parameters: [{ id: 'a', label: 'Valor A', kind: 'number', value: 1, portType: 'surface-or-value' }, { id: 'b', label: 'Valor B', kind: 'number', value: 1, portType: 'surface-or-value' }],
  },
  divide: {
    kind: 'divide',
    family: 'Aritmética',
    title: 'Divide',
    inputs: [],
    outputs: [{ id: 'surface-out', label: 'Surface', type: 'surface', direction: 'output' }, { id: 'value-out', label: 'Value', type: 'value', direction: 'output' }],
    parameters: [{ id: 'a', label: 'Valor A', kind: 'number', value: 0, portType: 'surface-or-value' }, { id: 'b', label: 'Valor B', kind: 'number', value: 1, portType: 'surface-or-value' }],
  },
  rotation: {
    kind: 'rotation',
    family: 'Transformación',
    title: 'Rotation',
    inputs: [{ id: 'surface-in', label: 'Surface', type: 'surface', direction: 'input' }],
    outputs: [{ id: 'surface-out', label: 'Surface', type: 'surface', direction: 'output' }],
    parameters: [{ id: 'angle', label: 'Ángulo', kind: 'float', value: 0, min: 0, max: 359.99, step: 0.01, unit: '°' }],
  },
  zoom: {
    kind: 'zoom',
    family: 'Transformación',
    title: 'Zoom',
    inputs: [{ id: 'surface-in', label: 'Surface', type: 'surface', direction: 'input' }],
    outputs: [{ id: 'surface-out', label: 'Surface', type: 'surface', direction: 'output' }],
    parameters: [{ id: 'scale', label: 'Escala', kind: 'range', value: 1, min: 0.05, max: 8, step: 0.05, unit: 'x' }],
  },
  int: {
    kind: 'int',
    family: 'Datos',
    title: 'Int',
    inputs: [],
    outputs: [{ id: 'value-out', label: 'Int', type: 'int', direction: 'output' }],
    parameters: [{ id: 'value', label: 'Valor', kind: 'number', value: 0, min: -32768, max: 32767, step: 1 }],
  },
  float: {
    kind: 'float',
    family: 'Datos',
    title: 'Float',
    inputs: [],
    outputs: [{ id: 'value-out', label: 'Float', type: 'float', direction: 'output' }],
    parameters: [{ id: 'value', label: 'Valor', kind: 'float', value: 0, min: -100000, max: 100000, step: 0.01 }],
  },
  vector2: {
    kind: 'vector2',
    family: 'Datos',
    title: 'Vector2',
    inputs: [],
    outputs: [{ id: 'value-out', label: 'Vector2', type: 'vector2', direction: 'output' }],
    parameters: [{ id: 'x', label: 'X', kind: 'float', value: 0, step: 0.01 }, { id: 'y', label: 'Y', kind: 'float', value: 0, step: 0.01 }],
  },
  vector3: {
    kind: 'vector3',
    family: 'Datos',
    title: 'Vector3',
    inputs: [],
    outputs: [{ id: 'value-out', label: 'Vector3', type: 'vector3', direction: 'output' }],
    parameters: [{ id: 'x', label: 'X', kind: 'float', value: 0, step: 0.01 }, { id: 'y', label: 'Y', kind: 'float', value: 0, step: 0.01 }, { id: 'z', label: 'Z', kind: 'float', value: 0, step: 0.01 }],
  },
  vector4: {
    kind: 'vector4',
    family: 'Datos',
    title: 'Vector4',
    inputs: [],
    outputs: [{ id: 'value-out', label: 'Vector4', type: 'vector4', direction: 'output' }],
    parameters: [{ id: 'x', label: 'X', kind: 'float', value: 0, step: 0.01 }, { id: 'y', label: 'Y', kind: 'float', value: 0, step: 0.01 }, { id: 'z', label: 'Z', kind: 'float', value: 0, step: 0.01 }, { id: 'w', label: 'W', kind: 'float', value: 0, step: 0.01 }],
  },
  noise: {
    kind: 'noise',
    family: 'VFX / Ruido',
    title: 'Noise',
    inputs: [],
    outputs: [{ id: 'surface-out', label: 'Surface', type: 'surface', direction: 'output' }],
    parameters: [
      { id: 'width', label: 'Ancho', kind: 'number', value: 64, min: 1, max: 512, step: 1 },
      { id: 'height', label: 'Alto', kind: 'number', value: 64, min: 1, max: 512, step: 1 },
      { id: 'scale', label: 'Escala', kind: 'float', value: 0.08, min: 0.005, max: 4, step: 0.005 },
      { id: 'seed', label: 'Seed', kind: 'number', value: 1, min: -2147483648, max: 2147483647, step: 1, portType: 'int' },
      { id: 'roughness', label: 'Rough', kind: 'range', value: 0.5, min: 0, max: 1, step: 0.01, portType: 'float' },
      { id: 'octaves', label: 'Octavas', kind: 'number', value: 4, min: 1, max: 8, step: 1 },
      { id: 'levels', label: 'Niveles', kind: 'number', value: 8, min: 2, max: 64, step: 1 },
    ],
  },
  'cellular-noise': {
    kind: 'cellular-noise',
    family: 'VFX / Ruido',
    title: 'Cellular Noise',
    inputs: [],
    outputs: [{ id: 'surface-out', label: 'Surface', type: 'surface', direction: 'output' }],
    parameters: [
      { id: 'width', label: 'Ancho', kind: 'number', value: 64, min: 1, max: 512, step: 1 },
      { id: 'height', label: 'Alto', kind: 'number', value: 64, min: 1, max: 512, step: 1 },
      { id: 'scale', label: 'Escala', kind: 'float', value: 0.08, min: 0.005, max: 4, step: 0.005 },
      { id: 'seed', label: 'Seed', kind: 'number', value: 1, min: -2147483648, max: 2147483647, step: 1, portType: 'int' },
      { id: 'roughness', label: 'Rough', kind: 'range', value: 0.5, min: 0, max: 1, step: 0.01, portType: 'float' },
      { id: 'levels', label: 'Niveles', kind: 'number', value: 8, min: 2, max: 64, step: 1 },
    ],
  },
  perlin: {
    kind: 'perlin',
    family: 'VFX / Ruido',
    title: 'Perlin Noise',
    inputs: [],
    outputs: [{ id: 'surface-out', label: 'Surface', type: 'surface', direction: 'output' }],
    parameters: [
      { id: 'width', label: 'Ancho', kind: 'number', value: 64, min: 1, max: 512, step: 1 },
      { id: 'height', label: 'Alto', kind: 'number', value: 64, min: 1, max: 512, step: 1 },
      { id: 'scale', label: 'Escala', kind: 'float', value: 0.08, min: 0.005, max: 4, step: 0.005 },
      { id: 'seed', label: 'Seed', kind: 'number', value: 1, min: -2147483648, max: 2147483647, step: 1, portType: 'int' },
      { id: 'roughness', label: 'Rough', kind: 'range', value: 0.5, min: 0, max: 1, step: 0.01, portType: 'float' },
      { id: 'octaves', label: 'Octavas', kind: 'number', value: 4, min: 1, max: 8, step: 1 },
      { id: 'levels', label: 'Niveles', kind: 'number', value: 8, min: 2, max: 64, step: 1 },
    ],
  },
  simplex: {
    kind: 'simplex',
    family: 'VFX / Ruido',
    title: 'Simplex Noise',
    inputs: [],
    outputs: [{ id: 'surface-out', label: 'Surface', type: 'surface', direction: 'output' }],
    parameters: [
      { id: 'width', label: 'Ancho', kind: 'number', value: 64, min: 1, max: 512, step: 1 },
      { id: 'height', label: 'Alto', kind: 'number', value: 64, min: 1, max: 512, step: 1 },
      { id: 'scale', label: 'Escala', kind: 'float', value: 0.08, min: 0.005, max: 4, step: 0.005 },
      { id: 'seed', label: 'Seed', kind: 'number', value: 1, min: -2147483648, max: 2147483647, step: 1, portType: 'int' },
      { id: 'roughness', label: 'Rough', kind: 'range', value: 0.5, min: 0, max: 1, step: 0.01, portType: 'float' },
      { id: 'octaves', label: 'Octavas', kind: 'number', value: 4, min: 1, max: 8, step: 1 },
      { id: 'levels', label: 'Niveles', kind: 'number', value: 8, min: 2, max: 64, step: 1 },
    ],
  },
  seed: {
    kind: 'seed',
    family: 'VFX / Datos',
    title: 'Seed',
    inputs: [],
    outputs: [{ id: 'value-out', label: 'Seed', type: 'int', direction: 'output' }],
    parameters: [{ id: 'value', label: 'Valor', kind: 'number', value: 1, min: -2147483648, max: 2147483647, step: 1 }],
  },
  rough: {
    kind: 'rough',
    family: 'VFX / Datos',
    title: 'Rough',
    inputs: [],
    outputs: [{ id: 'value-out', label: 'Rough', type: 'float', direction: 'output' }],
    parameters: [{ id: 'value', label: 'Valor', kind: 'range', value: 0.5, min: 0, max: 1, step: 0.01 }],
  },
  movement: {
    kind: 'movement',
    family: 'VFX / Movimiento',
    title: 'Movement',
    inputs: [{ id: 'surface-in', label: 'Surface', type: 'surface', direction: 'input' }, { id: 'offset-in', label: 'Offset', type: 'vector2', direction: 'input' }],
    outputs: [{ id: 'surface-out', label: 'Surface', type: 'surface', direction: 'output' }],
    parameters: [{ id: 'x', label: 'X', kind: 'float', value: 0, step: 1 }, { id: 'y', label: 'Y', kind: 'float', value: 0, step: 1 }, { id: 'wrap', label: 'Borde', kind: 'select', value: 'Transparent', options: ['Transparent', 'Wrap'] }],
  },
  direction: {
    kind: 'direction',
    family: 'VFX / Movimiento',
    title: 'Direction',
    inputs: [],
    outputs: [{ id: 'value-out', label: 'Vector2', type: 'vector2', direction: 'output' }],
    parameters: [{ id: 'angle', label: 'Ángulo', kind: 'float', value: 0, min: 0, max: 359.99, step: 0.01, unit: '°' }, { id: 'magnitude', label: 'Magnitud', kind: 'float', value: 1, min: -2048, max: 2048, step: 0.01 }],
  },
  velocity: {
    kind: 'velocity',
    family: 'VFX / Movimiento',
    title: 'Velocity',
    inputs: [],
    outputs: [{ id: 'value-out', label: 'Vector2', type: 'vector2', direction: 'output' }],
    parameters: [{ id: 'x', label: 'X', kind: 'float', value: 0, step: 0.01 }, { id: 'y', label: 'Y', kind: 'float', value: 0, step: 0.01 }],
  },
  time: {
    kind: 'time',
    family: 'VFX / Tiempo',
    title: 'Time',
    inputs: [],
    outputs: [{ id: 'value-out', label: 'Seconds', type: 'float', direction: 'output' }],
    parameters: [],
  },
  'delta-time': {
    kind: 'delta-time',
    family: 'VFX / Tiempo',
    title: 'DeltaTime',
    inputs: [],
    outputs: [{ id: 'value-out', label: 'Ticks', type: 'int', direction: 'output' }],
    parameters: [{ id: 'ticksPerSecond', label: 'Ticks per second', kind: 'number', value: 1, min: 1, max: 240, step: 1 }, { id: 'value', label: 'Value', kind: 'number', value: 1, min: -100000, max: 100000, step: 1, portType: 'value' }],
  },
  bool: {
    kind: 'bool',
    family: 'Lógica / Datos',
    title: 'Bool',
    inputs: [],
    outputs: [{ id: 'value-out', label: 'Boolean', type: 'bool', direction: 'output' }],
    parameters: [{ id: 'value', label: 'Value', kind: 'boolean', value: false, portType: 'bool' }],
  },
  compare: {
    kind: 'compare',
    family: 'Lógica / Comparación',
    title: 'Compare',
    inputs: [{ id: 'value-a', label: 'A', type: 'value', direction: 'input' }, { id: 'value-b', label: 'B', type: 'value', direction: 'input' }],
    outputs: [{ id: 'value-out', label: 'Boolean', type: 'bool', direction: 'output' }],
    parameters: [{ id: 'operation', label: 'Operation', kind: 'select', value: 'Equal', options: ['Equal', 'Not Equal', 'Less', 'Less Equal', 'Greater', 'Greater Equal'] }],
  },
  if: {
    kind: 'if',
    family: 'Lógica / Condición',
    title: 'If',
    inputs: [{ id: 'condition', label: 'Condition', type: 'bool', direction: 'input' }],
    outputs: [{ id: 'result', label: 'Result', type: 'surface', direction: 'output' }],
    parameters: [{ id: 'data-type', label: 'Data type', kind: 'select', value: 'Surface', options: ['Surface', 'Color', 'Gradient', 'Float', 'Int', 'Bool', 'Vector2', 'Vector3', 'Vector4'] }],
  },
  switch: {
    kind: 'switch',
    family: 'Lógica / Condición',
    title: 'Switch',
    inputs: [{ id: 'selector', label: 'Selector', type: 'int', direction: 'input' }],
    outputs: [{ id: 'result', label: 'Result', type: 'surface', direction: 'output' }],
    parameters: [{ id: 'data-type', label: 'Data type', kind: 'select', value: 'Surface', options: ['Surface', 'Color', 'Gradient', 'Float', 'Int', 'Bool', 'Vector2', 'Vector3', 'Vector4'] }],
  },
  not: {
    kind: 'not',
    family: 'Lógica',
    title: 'Not',
    inputs: [{ id: 'value-in', label: 'Value', type: 'bool', direction: 'input' }],
    outputs: [{ id: 'value-out', label: 'Boolean', type: 'bool', direction: 'output' }],
    parameters: [],
  },
  and: {
    kind: 'and',
    family: 'Lógica',
    title: 'And',
    inputs: [{ id: 'value-a', label: 'A', type: 'bool', direction: 'input' }, { id: 'value-b', label: 'B', type: 'bool', direction: 'input' }],
    outputs: [{ id: 'value-out', label: 'Boolean', type: 'bool', direction: 'output' }],
    parameters: [],
  },
  or: {
    kind: 'or',
    family: 'Lógica',
    title: 'Or',
    inputs: [{ id: 'value-a', label: 'A', type: 'bool', direction: 'input' }, { id: 'value-b', label: 'B', type: 'bool', direction: 'input' }],
    outputs: [{ id: 'value-out', label: 'Boolean', type: 'bool', direction: 'output' }],
    parameters: [],
  },
  xor: {
    kind: 'xor',
    family: 'Lógica',
    title: 'Xor',
    inputs: [{ id: 'value-a', label: 'A', type: 'bool', direction: 'input' }, { id: 'value-b', label: 'B', type: 'bool', direction: 'input' }],
    outputs: [{ id: 'value-out', label: 'Boolean', type: 'bool', direction: 'output' }],
    parameters: [],
  },
  nor: {
    kind: 'nor',
    family: 'Lógica',
    title: 'Nor',
    inputs: [{ id: 'value-a', label: 'A', type: 'bool', direction: 'input' }, { id: 'value-b', label: 'B', type: 'bool', direction: 'input' }],
    outputs: [{ id: 'value-out', label: 'Boolean', type: 'bool', direction: 'output' }],
    parameters: [],
  },
  nand: {
    kind: 'nand',
    family: 'Lógica',
    title: 'Nand',
    inputs: [{ id: 'value-a', label: 'A', type: 'bool', direction: 'input' }, { id: 'value-b', label: 'B', type: 'bool', direction: 'input' }],
    outputs: [{ id: 'value-out', label: 'Boolean', type: 'bool', direction: 'output' }],
    parameters: [],
  },
  preview: {
    kind: 'preview',
    family: 'Entrada / salida',
    title: 'Preview',
    inputs: [{ id: 'surface-in', label: 'Surface', type: 'surface', direction: 'input' }],
    outputs: [],
    parameters: [{ id: 'zoom', label: 'Zoom', kind: 'select', value: '1×', options: ['1×', '2×', '4×'] }],
  },
  custom: {
    kind: 'custom',
    family: 'Custom',
    title: 'Custom',
    inputs: [],
    outputs: [],
    parameters: [],
  },
}

type NodeDetails = Omit<DemoNode, 'id' | 'x' | 'y'>
const valueInput = (id: string, label: string, type: DemoPortType = 'value'): DemoPort => ({ id, label, type, direction: 'input' })
const valueOutput = (id = 'value-out', label = 'Value', type: DemoPortType = 'value'): DemoPort => ({ id, label, type, direction: 'output' })
const surfaceOutput = (id = 'surface-out', label = 'Surface'): DemoPort => ({ id, label, type: 'surface', direction: 'output' })
const numericParameter = (id: string, label: string, value = 0, min?: number, max?: number, step = 0.01): DemoParameter => ({ id, label, kind: step >= 1 ? 'number' : 'float', value, min, max, step })
const valueNode = (kind: DemoNodeKind, title: string, inputs: DemoPort[], parameters: DemoParameter[] = []): NodeDetails => ({ kind, family: 'Math & Data', title, inputs, outputs: [valueOutput()], parameters })
const binaryValueNode = (kind: DemoNodeKind, title: string): NodeDetails => valueNode(kind, title, [valueInput('value-a', 'A'), valueInput('value-b', 'B')])
const arrayNode = (kind: DemoNodeKind, title: string, inputs: DemoPort[] = [valueInput('array-in', 'Array', 'array')], outputs: DemoPort[] = [valueOutput('array-out', 'Array', 'array')], parameters: DemoParameter[] = []): NodeDetails => ({ kind, family: 'Array', title, inputs, outputs, parameters })
const generatorParameters = (): DemoParameter[] => [
  { id: 'width', label: 'Width', kind: 'number', value: 64, min: 1, max: 512, step: 1 },
  { id: 'height', label: 'Height', kind: 'number', value: 64, min: 1, max: 512, step: 1 },
]
const noiseParameters = (): DemoParameter[] => [...generatorParameters(), { id: 'scale', label: 'Scale', kind: 'float', value: 0.08, min: 0.005, max: 4, step: 0.005 }, { id: 'seed', label: 'Seed', kind: 'number', value: 1, min: -2147483648, max: 2147483647, step: 1 }, { id: 'roughness', label: 'Roughness', kind: 'range', value: 0.5, min: 0, max: 1, step: 0.01 }, { id: 'octaves', label: 'Octaves', kind: 'number', value: 4, min: 1, max: 8, step: 1 }, { id: 'levels', label: 'Levels', kind: 'number', value: 8, min: 2, max: 64, step: 1 }]
const generatedKindDetails: Record<string, NodeDetails> = {
  number: valueNode('number', 'Number', [], [numericParameter('value', 'Value', 0, -100000, 100000, 0.01)]),
  'number-array': arrayNode('number-array', 'Number Array', [], [valueOutput('array-out', 'Array', 'array')], [{ id: 'value', label: 'Values', kind: 'array', value: [0, 1, 2] }]),
  absolute: valueNode('absolute', 'Absolute', [valueInput('value-in', 'Value')]),
  ceil: valueNode('ceil', 'Ceil', [valueInput('value-in', 'Value')]),
  clamp: valueNode('clamp', 'Clamp', [valueInput('value-in', 'Value'), valueInput('min-in', 'Min'), valueInput('max-in', 'Max')], [numericParameter('min', 'Min', 0), numericParameter('max', 'Max', 1)]),
  cosine: valueNode('cosine', 'Cosine', [valueInput('value-in', 'Value')]),
  floor: valueNode('floor', 'Floor', [valueInput('value-in', 'Value')]),
  normalize: { kind: 'normalize', family: 'Math & Data', title: 'Normalize', inputs: [valueInput('vector-in', 'Vector', 'vector2')], outputs: [valueOutput('value-out', 'Vector', 'vector2')], parameters: [] },
  lerp: valueNode('lerp', 'Lerp', [valueInput('a', 'A'), valueInput('b', 'B'), valueInput('t', 'T')]),
  max: binaryValueNode('max', 'Max'),
  min: binaryValueNode('min', 'Min'),
  modulo: binaryValueNode('modulo', 'Modulo'),
  round: valueNode('round', 'Round', [valueInput('value-in', 'Value')]),
  sine: valueNode('sine', 'Sine', [valueInput('value-in', 'Value')]),
  'square-root': valueNode('square-root', 'Square Root', [valueInput('value-in', 'Value')]),
  tangent: valueNode('tangent', 'Tangent', [valueInput('value-in', 'Value')]),
  angle: valueNode('angle', 'Angle', [valueInput('vector-in', 'Vector', 'vector2')], [],),
  distance: valueNode('distance', 'Distance', [valueInput('a', 'A', 'vector2'), valueInput('b', 'B', 'vector2')]),
  evaluate: valueNode('evaluate', 'Evaluate', [valueInput('value-in', 'Value')]),
  'vector-add': { kind: 'vector-add', family: 'Vectors', title: 'Vector Add', inputs: [valueInput('a', 'A', 'vector2'), valueInput('b', 'B', 'vector2')], outputs: [valueOutput('value-out', 'Vector', 'vector2')], parameters: [] },
  'vector-distance': valueNode('vector-distance', 'Vector Distance', [valueInput('a', 'A', 'vector2'), valueInput('b', 'B', 'vector2')]),
  'vector-length': valueNode('vector-length', 'Vector Length', [valueInput('vector-in', 'Vector', 'vector2')]),
  'vector-normalize': { kind: 'vector-normalize', family: 'Vectors', title: 'Vector Normalize', inputs: [valueInput('vector-in', 'Vector', 'vector2')], outputs: [valueOutput('value-out', 'Vector', 'vector2')], parameters: [] },
  'vector-scale': { kind: 'vector-scale', family: 'Vectors', title: 'Vector Scale', inputs: [valueInput('vector-in', 'Vector', 'vector2'), valueInput('scale', 'Scale')], outputs: [valueOutput('value-out', 'Vector', 'vector2')], parameters: [] },
  'array-find': arrayNode('array-find', 'Array Find', [valueInput('array-in', 'Array', 'array'), valueInput('value-in', 'Value')], [valueOutput('value-out', 'Index', 'int')]),
  'array-get': arrayNode('array-get', 'Array Get', [valueInput('array-in', 'Array', 'array'), valueInput('index', 'Index', 'int')], [valueOutput('value-out', 'Value')]),
  'array-length': arrayNode('array-length', 'Array Length', [valueInput('array-in', 'Array', 'array')], [valueOutput('value-out', 'Length', 'int')]),
  'array-range': arrayNode('array-range', 'Array Range', [valueInput('start', 'Start'), valueInput('end', 'End'), valueInput('step', 'Step')], [valueOutput('array-out', 'Array', 'array')]),
  'array-reverse': arrayNode('array-reverse', 'Array Reverse'),
  'array-set': arrayNode('array-set', 'Array Set', [valueInput('array-in', 'Array', 'array'), valueInput('index', 'Index', 'int'), valueInput('value-in', 'Value')]),
  'array-shuffle': arrayNode('array-shuffle', 'Array Shuffle', [valueInput('array-in', 'Array', 'array')], [valueOutput('array-out', 'Array', 'array')], [{ id: 'seed', label: 'Seed', kind: 'number', value: 1, step: 1 }]),
  'array-sort': arrayNode('array-sort', 'Array Sort'),
  'array-split': arrayNode('array-split', 'Array Split', [valueInput('array-in', 'Array', 'array'), valueInput('size', 'Size', 'int')], [valueOutput('array-out', 'Array', 'array')]),
  'array-zip': arrayNode('array-zip', 'Array Zip', [valueInput('a', 'A', 'array'), valueInput('b', 'B', 'array')]),
  solid: { kind: 'solid', family: 'Generators', title: 'Solid', inputs: [], outputs: [surfaceOutput()], parameters: [...generatorParameters(), { id: 'color', label: 'Color', kind: 'color', value: '#ffffffff' }] },
  'linear-gradient': { kind: 'linear-gradient', family: 'Generators', title: 'Linear Gradient', inputs: [], outputs: [surfaceOutput()], parameters: [...generatorParameters(), { id: 'from', label: 'From', kind: 'color', value: '#000000ff' }, { id: 'to', label: 'To', kind: 'color', value: '#ffffffff' }, { id: 'direction', label: 'Direction', kind: 'select', value: 'Horizontal', options: ['Horizontal', 'Vertical', 'Diagonal'] }] },
  'radial-gradient': { kind: 'radial-gradient', family: 'Generators', title: 'Radial Gradient', inputs: [], outputs: [surfaceOutput()], parameters: [...generatorParameters(), { id: 'from', label: 'From', kind: 'color', value: '#000000ff' }, { id: 'to', label: 'To', kind: 'color', value: '#ffffffff' }] },
  'bilinear-gradient': { kind: 'bilinear-gradient', family: 'Generators', title: 'Bilinear Gradient', inputs: [], outputs: [surfaceOutput()], parameters: [...generatorParameters(), { id: 'top-left', label: 'Top Left', kind: 'color', value: '#000000ff' }, { id: 'top-right', label: 'Top Right', kind: 'color', value: '#ffffffff' }, { id: 'bottom-left', label: 'Bottom Left', kind: 'color', value: '#ffffffff' }, { id: 'bottom-right', label: 'Bottom Right', kind: 'color', value: '#000000ff' }] },
  'normalized-gradient': { kind: 'normalized-gradient', family: 'Generators', title: 'Normalized Gradient', inputs: [], outputs: [surfaceOutput()], parameters: [...generatorParameters()] },
  checkerboard: { kind: 'checkerboard', family: 'Generators', title: 'Checkerboard', inputs: [], outputs: [surfaceOutput()], parameters: [...generatorParameters(), { id: 'cell', label: 'Cell', kind: 'number', value: 8, min: 1, max: 128, step: 1 }, { id: 'a', label: 'Color A', kind: 'color', value: '#000000ff' }, { id: 'b', label: 'Color B', kind: 'color', value: '#ffffffff' }] },
  grid: { kind: 'grid', family: 'Generators', title: 'Grid', inputs: [], outputs: [surfaceOutput()], parameters: [...generatorParameters(), { id: 'cell', label: 'Cell', kind: 'number', value: 8, min: 1, max: 128, step: 1 }, { id: 'color', label: 'Color', kind: 'color', value: '#ffffffff' }] },
  'grid-triangular': { kind: 'grid-triangular', family: 'Generators', title: 'Grid Triangular', inputs: [], outputs: [surfaceOutput()], parameters: [...generatorParameters(), { id: 'cell', label: 'Cell', kind: 'number', value: 8, min: 1, max: 128, step: 1 }, { id: 'color', label: 'Color', kind: 'color', value: '#ffffffff' }] },
  stripe: { kind: 'stripe', family: 'Generators', title: 'Stripe', inputs: [], outputs: [surfaceOutput()], parameters: [...generatorParameters(), { id: 'width', label: 'Stripe Width', kind: 'number', value: 4, min: 1, max: 128, step: 1 }, { id: 'a', label: 'Color A', kind: 'color', value: '#000000ff' }, { id: 'b', label: 'Color B', kind: 'color', value: '#ffffffff' }] },
  'draw-curve': { kind: 'draw-curve', family: 'Generators', title: 'Draw Curve', inputs: [valueInput('points-in', 'Points', 'array')], outputs: [surfaceOutput()], parameters: [...generatorParameters(), { id: 'color', label: 'Color', kind: 'color', value: '#ffffffff' }] },
  'draw-path': { kind: 'draw-path', family: 'Generators', title: 'Draw Path', inputs: [valueInput('points-in', 'Points', 'array')], outputs: [surfaceOutput()], parameters: [...generatorParameters(), { id: 'color', label: 'Color', kind: 'color', value: '#ffffffff' }] },
  'draw-shape': { kind: 'draw-shape', family: 'Generators', title: 'Draw Shape', inputs: [], outputs: [surfaceOutput()], parameters: [...generatorParameters(), { id: 'shape', label: 'Shape', kind: 'select', value: 'Rectangle', options: ['Rectangle', 'Circle', 'Line'] }, { id: 'color', label: 'Color', kind: 'color', value: '#ffffffff' }] },
  'draw-group': { kind: 'draw-group', family: 'Generators', title: 'Draw Group', inputs: [{ id: 'surface-a', label: 'A', type: 'surface', direction: 'input' }, { id: 'surface-b', label: 'B', type: 'surface', direction: 'input' }], outputs: [surfaceOutput()], parameters: [] },
  'draw-text': { kind: 'draw-text', family: 'Generators', title: 'Draw Text', inputs: [], outputs: [surfaceOutput()], parameters: [...generatorParameters(), { id: 'text', label: 'Text', kind: 'text', value: 'M' }, { id: 'color', label: 'Color', kind: 'color', value: '#ffffffff' }] },
}

for (const kind of ['white-noise', 'blue-noise', 'gaussian-noise', 'impulse-noise', 'pink-noise', 'brown-noise', 'fbm', 'turbulent-noise', 'rings-noise', 'rays-noise', 'euclidean-noise', 'voronoi-noise', 'manhattan-noise', 'chebyshev-noise', 'worley-noise', 'tricubic-noise', 'discrete-noise', 'seamless-noise', 'spots-noise']) {
  generatedKindDetails[kind] = { kind: kind as DemoNodeKind, family: 'Generators / Noise', title: kind.split('-').map((part) => part[0]!.toUpperCase() + part.slice(1)).join(' '), inputs: [valueInput('seed-in', 'Seed', 'int'), valueInput('roughness-in', 'Roughness', 'float')], outputs: [surfaceOutput()], parameters: noiseParameters() }
}

const advancedSurfaceUnary = ['atlas', 'corner-warp', 'crop', 'deform', 'displace', 'lattice-warp', 'mirror', 'move', 'move-to', 'nine-slice', 'padding', 'pivot', 'polar-distance', 'repeat', 'scale', 'skew', 'tile', 'transform', 'alpha-cut', 'blur', 'blur-directional', 'blur-gaussian', 'brightness-contrast', 'color-adjust', 'color-replace', 'colorize', 'dither', 'dither-bayer', 'dither-cluster', 'edge-detect', 'glow', 'hue-saturation-value', 'level', 'palette-apply', 'match-palette', 'pixelate', 'posterize', 'shadow', 'shading', 'sharpen', 'threshold', 'alpha-to-color', 'clean-edge', 'half-tone', 'mask', 'mix', 'remap', 'stack', 'get-pixel', 'isolate-color', 'frame-blend', 'frame-bypass', 'resource-loader', 'region-system', 'uv-workflow', 'condition', 'delay', 'feedback', 'iteration', 'loop', 'loop-start', 'loop-end', 'script', 'bloom', 'godray', 'mk-godray', 'particle', 'particle-spawn', 'pixel-cloud', 'trail', 'vfx'] as const
const advancedSurfaceBinary = ['color-replace', 'mask', 'mix', 'remap', 'stack', 'frame-blend'] as const
const advancedArrayKinds = ['array-randomizer'] as const
const advancedTitle = (kind: string): string => kind.split('-').map((part) => part ? part[0]!.toUpperCase() + part.slice(1) : part).join(' ')
const effectParameters = (kind: string): DemoParameter[] => {
  const parameters: DemoParameter[] = [{ id: 'amount', label: 'Amount', kind: 'range', value: 1, min: 0, max: 4, step: 0.01 }]
  if (['blur', 'blur-directional', 'blur-gaussian', 'glow', 'shadow', 'bloom', 'godray', 'mk-godray'].includes(kind)) parameters.push({ id: 'radius', label: 'Radius', kind: 'number', value: 1, min: 0, max: 32, step: 1 })
  if (['move', 'move-to', 'displace', 'deform', 'corner-warp', 'lattice-warp', 'padding', 'pivot', 'skew', 'transform'].includes(kind)) parameters.push({ id: 'offsetX', label: 'Offset X', kind: 'float', value: 0, min: -2048, max: 2048, step: 0.01 }, { id: 'offsetY', label: 'Offset Y', kind: 'float', value: 0, min: -2048, max: 2048, step: 0.01 })
  if (['particle', 'particle-spawn', 'pixel-cloud', 'trail', 'vfx'].includes(kind)) parameters.push({ id: 'seed', label: 'Seed', kind: 'number', value: 1, min: -2147483648, max: 2147483647, step: 1 }, { id: 'count', label: 'Count', kind: 'number', value: 16, min: 1, max: 512, step: 1 })
  return parameters
}
for (const kind of advancedSurfaceUnary) {
  const inputs: DemoPort[] = [{ id: 'surface-in', label: 'Surface', type: 'surface', direction: 'input' }]
  const outputs: DemoPort[] = [{ id: 'surface-out', label: 'Surface', type: 'surface', direction: 'output' }]
  generatedKindDetails[kind] = { kind: kind as DemoNodeKind, family: kind.startsWith('alpha-') || ['blur', 'glow', 'invert', 'outline', 'sharpen', 'threshold'].includes(kind) ? 'Filter' : kind.startsWith('array-') ? 'Array' : ['mask', 'mix', 'remap', 'stack', 'frame-blend', 'frame-bypass'].includes(kind) ? 'Compose' : ['resource-loader', 'get-pixel', 'region-system', 'uv-workflow', 'script'].includes(kind) ? 'I/O' : ['particle', 'particle-spawn', 'pixel-cloud', 'trail', 'vfx', 'bloom', 'godray', 'mk-godray'].includes(kind) ? 'Generator' : 'Transform', title: advancedTitle(kind), inputs, outputs, parameters: effectParameters(kind) }
}
for (const kind of advancedSurfaceBinary) {
  generatedKindDetails[kind] = { kind: kind as DemoNodeKind, family: 'Compose', title: advancedTitle(kind), inputs: [{ id: 'surface-a', label: 'A', type: 'surface', direction: 'input' }, { id: 'surface-b', label: 'B', type: 'surface', direction: 'input' }], outputs: [surfaceOutput()], parameters: effectParameters(kind) }
}
for (const kind of advancedArrayKinds) generatedKindDetails[kind] = arrayNode(kind, advancedTitle(kind), [valueInput('array-in', 'Array', 'array')], [valueOutput('array-out', 'Array', 'array')], [{ id: 'seed', label: 'Seed', kind: 'number', value: 1, step: 1 }])

generatedKindDetails['get-pixel'] = {
  kind: 'get-pixel',
  family: 'Input / Output',
  title: 'Get Pixel',
  inputs: [{ id: 'surface-in', label: 'Surface', type: 'surface', direction: 'input' }, { id: 'point-in', label: 'Point', type: 'vector2', direction: 'input' }],
  outputs: [{ id: 'color-out', label: 'Color', type: 'color', direction: 'output' }],
  parameters: [{ id: 'x', label: 'X', kind: 'number', value: 0, min: 0, max: 2048, step: 1 }, { id: 'y', label: 'Y', kind: 'number', value: 0, min: 0, max: 2048, step: 1 }],
}

generatedKindDetails['array-randomizer'] = arrayNode('array-randomizer', 'Array Randomizer', [valueInput('array-in', 'Array', 'array')], [valueOutput('array-out', 'Array', 'array')], [{ id: 'seed', label: 'Seed', kind: 'number', value: 1, step: 1 }])

const kindDetails: Readonly<Record<string, NodeDetails>> = { ...baseKindDetails, ...generatedKindDetails }

export function isDemoNodeKind(value: string): value is DemoNodeKind {
  return Object.prototype.hasOwnProperty.call(kindDetails, value)
}

function compatiblePortTypes(source: DemoPortType, target: DemoPortType): boolean {
  if (source === target) return true
  if (target === 'surface-or-value') return source === 'surface' || ['value', 'int', 'float', 'vector2', 'vector3', 'vector4'].includes(source)
  if (source === 'surface-or-value') return target === 'surface' || ['value', 'int', 'float', 'vector2', 'vector3', 'vector4'].includes(target)
  const numeric = new Set<DemoPortType>(['value', 'int', 'float'])
  if (source === 'bool' || target === 'bool') return source === 'bool' && target === 'bool'
  const vector = new Set<DemoPortType>(['vector2', 'vector3', 'vector4'])
  if (numeric.has(source) && numeric.has(target)) return true
  return (source === 'value' && vector.has(target)) || (target === 'value' && vector.has(source))
}

function selectedDataType(parameters: readonly DemoParameter[]): DemoPortType {
  const value = String(parameters.find((parameter) => parameter.id === 'data-type')?.value ?? 'Surface')
  const types: Record<string, DemoPortType> = { Surface: 'surface', Color: 'color', Gradient: 'gradient', Float: 'float', Int: 'int', Bool: 'bool', Vector2: 'vector2', Vector3: 'vector3', Vector4: 'vector4' }
  return types[value] ?? 'surface'
}

function dynamicPorts(kind: DemoNodeKind, parameters: readonly DemoParameter[]): { inputs: DemoPort[]; outputs: DemoPort[] } {
  if (kind !== 'if' && kind !== 'switch') return { inputs: [], outputs: [] }
  const type = selectedDataType(parameters)
  if (kind === 'if') return {
    inputs: [{ id: 'true-in', label: 'True', type, direction: 'input' }, { id: 'false-in', label: 'False', type, direction: 'input' }],
    outputs: [{ id: 'result', label: 'Result', type, direction: 'output' }],
  }
  return {
    inputs: [{ id: 'case-0', label: 'Case 0', type, direction: 'input' }, { id: 'case-1', label: 'Case 1', type, direction: 'input' }, { id: 'default', label: 'Default', type, direction: 'input' }],
    outputs: [{ id: 'result', label: 'Result', type, direction: 'output' }],
  }
}

export function createDemoNode(kind: DemoNodeKind, id: string, position: DemoPosition): DemoNode {
  const details = kindDetails[kind]
  if (!details) throw new Error('PIPELINE_NODE_KIND_UNSUPPORTED')
  const parameters = kind === 'rotation'
    ? [...details.parameters, { id: 'direction', label: 'Direction', kind: 'select' as const, value: 'Clockwise', options: ['Clockwise', 'Counterclockwise'] }, { id: 'anchor', label: 'Anchor', kind: 'select' as const, value: 'Center', options: ['Center', 'TopLeft', 'Top', 'TopRight', 'Right', 'BottomRight', 'Bottom', 'BottomLeft', 'Left'] }, { id: 'offsetX', label: 'Offset X', kind: 'float' as const, value: 0, step: 0.01 }, { id: 'offsetY', label: 'Offset Y', kind: 'float' as const, value: 0, step: 0.01 }]
    : details.parameters
  const dynamic = dynamicPorts(kind, parameters)
  const node: DemoNode = {
    id,
    x: position.x,
    y: position.y,
    kind: details.kind,
    family: details.family,
    title: kind === 'flip' ? 'Flip' : kind === 'rotation' ? 'Rotate' : details.title,
    inputs: [...details.inputs, ...dynamic.inputs, ...parameterInputPorts(parameters)],
    outputs: dynamic.outputs.length ? dynamic.outputs : details.outputs,
    parameters,
    previewVisible: true,
  }
  return normalizeDemoNode(node)
}

export function syncDemoNodePorts(node: DemoNode, parameters: readonly DemoParameter[] = node.parameters): DemoNode {
  const dynamic = dynamicPorts(node.kind, parameters)
  const normalizedLegacyPorts = ['add', 'subtract', 'multiply', 'divide'].includes(node.kind) || noiseKinds.has(node.kind) ? legacyParameterPortIds : new Set<string>()
  const baseInputs = node.kind === 'if' || node.kind === 'switch' ? (kindDetails[node.kind]?.inputs ?? []) : node.inputs.filter((port) => !isParameterPort(port, parameters) && !normalizedLegacyPorts.has(port.id) && !['true-in', 'false-in', 'case-0', 'case-1', 'default', 'condition', 'selector'].includes(port.id))
  const uniqueInputs = [...new Map(baseInputs.map((port) => [port.id, port] as const)).values()]
  const baseOutputs = node.kind === 'if' || node.kind === 'switch' ? dynamic.outputs : node.outputs
  return { ...node, parameters, inputs: [...(node.kind === 'if' || node.kind === 'switch' ? [...uniqueInputs, ...dynamic.inputs] : uniqueInputs), ...parameterInputPorts(parameters)], outputs: [...new Map(baseOutputs.map((port) => [port.id, port] as const)).values()] }
}

export function createCustomDemoNode(definition: CustomNodeDefinition, id: string, position: DemoPosition): DemoNode {
  return {
    id,
    x: position.x,
    y: position.y,
    kind: 'custom',
    family: definition.family,
    title: definition.name,
    inputs: [...definition.inputs.filter((port) => port.showInNode !== false).map((port) => ({ id: port.id, label: port.label, type: port.type, direction: 'input' as const })), ...parameterInputPorts(definition.parameters.map((parameter) => ({ id: parameter.id, label: parameter.label, kind: parameter.type === 'text' ? 'text' : parameter.type, value: parameter.value, min: parameter.min, max: parameter.max, step: parameter.step, options: parameter.options, showInNode: parameter.showInNode, portType: parameter.portType })))],
    outputs: definition.outputs.filter((port) => port.showInNode !== false).map((port) => ({ id: port.id, label: port.label, type: port.type, direction: 'output' as const })),
    parameters: definition.parameters.map((parameter) => ({ id: parameter.id, label: parameter.label, kind: parameter.type === 'text' ? 'text' : parameter.type, value: parameter.value, min: parameter.min, max: parameter.max, step: parameter.step, options: parameter.options, showInNode: parameter.showInNode, portType: parameter.portType })),
    customNodeId: definition.id,
      customDefinition: definition,
      previewVisible: true,
  }
}

export function createDemoGraph(): DemoGraph {
  return {
    nodes: [
      createDemoNode('asset', 'asset-a', { x: 72, y: 72 }),
      createDemoNode('asset', 'asset-b', { x: 72, y: 286 }),
      createDemoNode('resize', 'resize-a', { x: 310, y: 72 }),
      createDemoNode('color', 'color-a', { x: 540, y: 72 }),
      createDemoNode('blend', 'blend', { x: 770, y: 190 }),
      createDemoNode('preview', 'preview', { x: 1010, y: 190 }),
    ],
    edges: [
      { sourceNodeId: 'asset-a', sourcePortId: 'surface-out', targetNodeId: 'resize-a', targetPortId: 'surface-in' },
      { sourceNodeId: 'resize-a', sourcePortId: 'surface-out', targetNodeId: 'color-a', targetPortId: 'surface-in' },
      { sourceNodeId: 'color-a', sourcePortId: 'surface-out', targetNodeId: 'blend', targetPortId: 'surface-a' },
      { sourceNodeId: 'asset-b', sourcePortId: 'surface-out', targetNodeId: 'blend', targetPortId: 'surface-b' },
      { sourceNodeId: 'blend', sourcePortId: 'surface-out', targetNodeId: 'preview', targetPortId: 'surface-in' },
    ],
  }
}

export function selectDemoNode(graph: DemoGraph, nodeId?: string): DemoGraph {
  if (nodeId && !graph.nodes.some((node) => node.id === nodeId)) return graph
  return { ...graph, selectedNodeId: nodeId }
}

export function moveDemoNode(graph: DemoGraph, nodeId: string, position: DemoPosition): DemoGraph {
  if (!graph.nodes.some((node) => node.id === nodeId)) return graph
  return {
    ...graph,
    nodes: graph.nodes.map((node) => node.id === nodeId ? { ...node, x: position.x, y: position.y } : node),
  }
}

export function addDemoNode(graph: DemoGraph, node: DemoNode): DemoGraph {
  if (graph.nodes.some((candidate) => candidate.id === node.id)) return graph
  return { ...graph, nodes: [...graph.nodes, node], selectedNodeId: node.id }
}

export function updateDemoParameter(graph: DemoGraph, nodeId: string, parameterId: string, value: string | number): DemoGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => node.id !== nodeId
      ? node
      : { ...node, parameters: node.parameters.map((parameter) => parameter.id === parameterId ? { ...parameter, value } : parameter) }),
  }
}

export function connectDemoPorts(graph: DemoGraph, connection: DemoConnectionRequest): DemoGraphResult {
  if (connection.sourceNodeId === connection.targetNodeId) return { graph, error: 'CONNECTION_SELF' }
  const source = graph.nodes.find((node) => node.id === connection.sourceNodeId)
  const target = graph.nodes.find((node) => node.id === connection.targetNodeId)
  if (!source || !target) return { graph, error: 'CONNECTION_NODE_NOT_FOUND' }
  const normalizedConnection = normalizeDemoEdge(connection, graph.nodes)
  const sourcePort = source.outputs.find((port) => port.id === normalizedConnection.sourcePortId)
  const targetPort = target.inputs.find((port) => port.id === normalizedConnection.targetPortId)
  if (!sourcePort || !targetPort) return { graph, error: 'CONNECTION_PORT_NOT_FOUND' }
  if (sourcePort.direction !== 'output' || targetPort.direction !== 'input') return { graph, error: 'CONNECTION_DIRECTION_INVALID' }
  if (!compatiblePortTypes(sourcePort.type, targetPort.type)) return { graph, error: 'CONNECTION_DIRECTION_INVALID' }
  if (graph.edges.some((edge) => edge.sourceNodeId === normalizedConnection.sourceNodeId
    && edge.sourcePortId === normalizedConnection.sourcePortId
    && edge.targetNodeId === normalizedConnection.targetNodeId
    && edge.targetPortId === normalizedConnection.targetPortId)) return { graph, error: 'CONNECTION_DUPLICATE' }
  if (graph.edges.some((edge) => edge.targetNodeId === normalizedConnection.targetNodeId && edge.targetPortId === normalizedConnection.targetPortId)) {
    return { graph, error: 'CONNECTION_INPUT_OCCUPIED' }
  }
  return { graph: { ...graph, edges: [...graph.edges, normalizedConnection] } }
}

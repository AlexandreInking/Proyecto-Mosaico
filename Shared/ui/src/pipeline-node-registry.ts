import { createDemoNode, isDemoNodeKind, type DemoNodeKind } from './pipeline-editor-model.js'

export type PipelineNodeStatus = 'published' | 'backlog'
export type PipelineCapability = 'cpu2d' | 'webgl' | 'webgpu'
export type PipelinePreviewKind = 'surface' | 'value' | 'array'
export const PIPELINE_NODE_REGISTRY_VERSION = 1 as const

export interface PipelineNodeDefinition {
  readonly version: typeof PIPELINE_NODE_REGISTRY_VERSION
  readonly kind: string
  readonly family: string
  readonly labelKey: string
  readonly descriptionKey: string
  readonly aliases: readonly string[]
  readonly status: PipelineNodeStatus
  readonly capabilities: readonly PipelineCapability[]
  readonly preview: PipelinePreviewKind
  readonly evaluatorKey: string
}

const publishedKinds: readonly { kind: DemoNodeKind; family: string; preview: PipelinePreviewKind; evaluatorKey: string; aliases?: readonly string[] }[] = [
  { kind: 'asset', family: 'Input / Output', preview: 'surface', evaluatorKey: 'asset' },
  { kind: 'resize', family: 'Transform', preview: 'surface', evaluatorKey: 'resize' },
  { kind: 'flip', family: 'Transform', preview: 'surface', evaluatorKey: 'flip' },
  { kind: 'rotation', family: 'Transform', preview: 'surface', evaluatorKey: 'rotation', aliases: ['rotate'] },
  { kind: 'zoom', family: 'Transform', preview: 'surface', evaluatorKey: 'zoom' },
  { kind: 'invert', family: 'Filter', preview: 'surface', evaluatorKey: 'invert' },
  { kind: 'select', family: 'Filter', preview: 'surface', evaluatorKey: 'select' },
  { kind: 'replace', family: 'Filter', preview: 'surface', evaluatorKey: 'replace' },
  { kind: 'outline', family: 'Filter', preview: 'surface', evaluatorKey: 'outline' },
  { kind: 'color', family: 'Filter', preview: 'surface', evaluatorKey: 'color' },
  { kind: 'gradient', family: 'Generator', preview: 'surface', evaluatorKey: 'gradient' },
  { kind: 'blend', family: 'Compose', preview: 'surface', evaluatorKey: 'blend' },
  { kind: 'add', family: 'Math', preview: 'value', evaluatorKey: 'add' },
  { kind: 'subtract', family: 'Math', preview: 'value', evaluatorKey: 'subtract' },
  { kind: 'multiply', family: 'Math', preview: 'value', evaluatorKey: 'multiply' },
  { kind: 'divide', family: 'Math', preview: 'value', evaluatorKey: 'divide' },
  { kind: 'int', family: 'Data', preview: 'value', evaluatorKey: 'int' },
  { kind: 'float', family: 'Data', preview: 'value', evaluatorKey: 'float' },
  { kind: 'number', family: 'Math', preview: 'value', evaluatorKey: 'number' },
  { kind: 'number-array', family: 'Array', preview: 'array', evaluatorKey: 'number-array' },
  { kind: 'vector2', family: 'Vector', preview: 'value', evaluatorKey: 'vector2' },
  { kind: 'vector3', family: 'Vector', preview: 'value', evaluatorKey: 'vector3' },
  { kind: 'vector4', family: 'Vector', preview: 'value', evaluatorKey: 'vector4' },
  { kind: 'absolute', family: 'Math', preview: 'value', evaluatorKey: 'absolute' },
  { kind: 'ceil', family: 'Math', preview: 'value', evaluatorKey: 'ceil' },
  { kind: 'clamp', family: 'Math', preview: 'value', evaluatorKey: 'clamp' },
  { kind: 'cosine', family: 'Math', preview: 'value', evaluatorKey: 'cosine' },
  { kind: 'floor', family: 'Math', preview: 'value', evaluatorKey: 'floor' },
  { kind: 'lerp', family: 'Math', preview: 'value', evaluatorKey: 'lerp' },
  { kind: 'max', family: 'Math', preview: 'value', evaluatorKey: 'max' },
  { kind: 'min', family: 'Math', preview: 'value', evaluatorKey: 'min' },
  { kind: 'modulo', family: 'Math', preview: 'value', evaluatorKey: 'modulo' },
  { kind: 'round', family: 'Math', preview: 'value', evaluatorKey: 'round' },
  { kind: 'sine', family: 'Math', preview: 'value', evaluatorKey: 'sine' },
  { kind: 'square-root', family: 'Math', preview: 'value', evaluatorKey: 'square-root' },
  { kind: 'tangent', family: 'Math', preview: 'value', evaluatorKey: 'tangent' },
  { kind: 'normalize', family: 'Math', preview: 'value', evaluatorKey: 'normalize' },
  { kind: 'angle', family: 'Vector', preview: 'value', evaluatorKey: 'angle' },
  { kind: 'distance', family: 'Vector', preview: 'value', evaluatorKey: 'distance' },
  { kind: 'evaluate', family: 'Math', preview: 'value', evaluatorKey: 'evaluate' },
  { kind: 'vector-add', family: 'Vector', preview: 'value', evaluatorKey: 'vector-add' },
  { kind: 'vector-distance', family: 'Vector', preview: 'value', evaluatorKey: 'vector-distance' },
  { kind: 'vector-length', family: 'Vector', preview: 'value', evaluatorKey: 'vector-length' },
  { kind: 'vector-normalize', family: 'Vector', preview: 'value', evaluatorKey: 'vector-normalize' },
  { kind: 'vector-scale', family: 'Vector', preview: 'value', evaluatorKey: 'vector-scale' },
  { kind: 'array-find', family: 'Array', preview: 'value', evaluatorKey: 'array-find' },
  { kind: 'array-get', family: 'Array', preview: 'value', evaluatorKey: 'array-get' },
  { kind: 'array-length', family: 'Array', preview: 'value', evaluatorKey: 'array-length' },
  { kind: 'array-range', family: 'Array', preview: 'array', evaluatorKey: 'array-range' },
  { kind: 'array-reverse', family: 'Array', preview: 'array', evaluatorKey: 'array-reverse' },
  { kind: 'array-set', family: 'Array', preview: 'array', evaluatorKey: 'array-set' },
  { kind: 'array-shuffle', family: 'Array', preview: 'array', evaluatorKey: 'array-shuffle' },
  { kind: 'array-sort', family: 'Array', preview: 'array', evaluatorKey: 'array-sort' },
  { kind: 'array-split', family: 'Array', preview: 'array', evaluatorKey: 'array-split' },
  { kind: 'array-zip', family: 'Array', preview: 'array', evaluatorKey: 'array-zip' },
  { kind: 'solid', family: 'Generator', preview: 'surface', evaluatorKey: 'solid' },
  { kind: 'linear-gradient', family: 'Generator', preview: 'surface', evaluatorKey: 'linear-gradient' },
  { kind: 'radial-gradient', family: 'Generator', preview: 'surface', evaluatorKey: 'radial-gradient' },
  { kind: 'bilinear-gradient', family: 'Generator', preview: 'surface', evaluatorKey: 'bilinear-gradient' },
  { kind: 'normalized-gradient', family: 'Generator', preview: 'surface', evaluatorKey: 'normalized-gradient' },
  { kind: 'checkerboard', family: 'Generator', preview: 'surface', evaluatorKey: 'checkerboard' },
  { kind: 'grid', family: 'Generator', preview: 'surface', evaluatorKey: 'grid' },
  { kind: 'grid-triangular', family: 'Generator', preview: 'surface', evaluatorKey: 'grid-triangular' },
  { kind: 'stripe', family: 'Generator', preview: 'surface', evaluatorKey: 'stripe' },
  { kind: 'draw-curve', family: 'Generator', preview: 'surface', evaluatorKey: 'draw-curve' },
  { kind: 'draw-path', family: 'Generator', preview: 'surface', evaluatorKey: 'draw-path' },
  { kind: 'draw-shape', family: 'Generator', preview: 'surface', evaluatorKey: 'draw-shape' },
  { kind: 'draw-group', family: 'Generator', preview: 'surface', evaluatorKey: 'draw-group' },
  { kind: 'draw-text', family: 'Generator', preview: 'surface', evaluatorKey: 'draw-text' },
  { kind: 'noise', family: 'Generator / Noise', preview: 'surface', evaluatorKey: 'noise' },
  { kind: 'cellular-noise', family: 'Generator / Noise', preview: 'surface', evaluatorKey: 'cellular-noise' },
  { kind: 'perlin', family: 'Generator / Noise', preview: 'surface', evaluatorKey: 'perlin' },
  { kind: 'simplex', family: 'Generator / Noise', preview: 'surface', evaluatorKey: 'simplex' },
  ...(['white-noise', 'blue-noise', 'gaussian-noise', 'impulse-noise', 'pink-noise', 'brown-noise', 'fbm', 'turbulent-noise', 'rings-noise', 'rays-noise', 'euclidean-noise', 'voronoi-noise', 'manhattan-noise', 'chebyshev-noise', 'worley-noise', 'tricubic-noise', 'discrete-noise', 'seamless-noise', 'spots-noise'] as DemoNodeKind[]).map((kind) => ({ kind, family: 'Generator / Noise', preview: 'surface' as const, evaluatorKey: kind })),
  { kind: 'seed', family: 'Data', preview: 'value', evaluatorKey: 'seed' },
  { kind: 'rough', family: 'Data', preview: 'value', evaluatorKey: 'rough' },
  { kind: 'movement', family: 'Transform', preview: 'surface', evaluatorKey: 'movement' },
  { kind: 'direction', family: 'Vector', preview: 'value', evaluatorKey: 'direction' },
  { kind: 'velocity', family: 'Vector', preview: 'value', evaluatorKey: 'velocity' },
  { kind: 'time', family: 'Time', preview: 'value', evaluatorKey: 'time' },
  { kind: 'delta-time', family: 'Time', preview: 'value', evaluatorKey: 'delta-time' },
  { kind: 'bool', family: 'Logic', preview: 'value', evaluatorKey: 'bool' },
  { kind: 'compare', family: 'Logic', preview: 'value', evaluatorKey: 'compare' },
  { kind: 'if', family: 'Logic', preview: 'value', evaluatorKey: 'if' },
  { kind: 'switch', family: 'Logic', preview: 'value', evaluatorKey: 'switch' },
  { kind: 'not', family: 'Logic', preview: 'value', evaluatorKey: 'not' },
  { kind: 'and', family: 'Logic', preview: 'value', evaluatorKey: 'and' },
  { kind: 'or', family: 'Logic', preview: 'value', evaluatorKey: 'or' },
  { kind: 'xor', family: 'Logic', preview: 'value', evaluatorKey: 'xor' },
  { kind: 'nor', family: 'Logic', preview: 'value', evaluatorKey: 'nor' },
  { kind: 'nand', family: 'Logic', preview: 'value', evaluatorKey: 'nand' },
  { kind: 'preview', family: 'Input / Output', preview: 'surface', evaluatorKey: 'preview' },
  ...(['atlas', 'corner-warp', 'crop', 'deform', 'displace', 'lattice-warp', 'mirror', 'move', 'move-to', 'nine-slice', 'padding', 'pivot', 'polar-distance', 'repeat', 'scale', 'skew', 'tile', 'transform'].map((kind) => ({ kind: kind as DemoNodeKind, family: 'Transform', preview: 'surface' as const, evaluatorKey: kind }))),
  ...(['alpha-cut', 'blur', 'blur-directional', 'blur-gaussian', 'brightness-contrast', 'color-adjust', 'color-replace', 'colorize', 'dither', 'dither-bayer', 'dither-cluster', 'edge-detect', 'glow', 'hue-saturation-value', 'level', 'palette-apply', 'match-palette', 'pixelate', 'posterize', 'shadow', 'shading', 'sharpen', 'threshold', 'alpha-to-color', 'clean-edge', 'half-tone'].map((kind) => ({ kind: kind as DemoNodeKind, family: 'Filter', preview: 'surface' as const, evaluatorKey: kind }))),
  ...(['mask', 'mix', 'remap', 'stack', 'array-randomizer', 'get-pixel', 'isolate-color', 'frame-blend', 'frame-bypass', 'resource-loader', 'region-system', 'uv-workflow', 'condition', 'delay', 'feedback', 'iteration', 'loop', 'loop-start', 'loop-end', 'script'].map((kind) => ({ kind: kind as DemoNodeKind, family: ['array-randomizer'].includes(kind) ? 'Array' : ['resource-loader', 'get-pixel', 'region-system', 'uv-workflow', 'script'].includes(kind) ? 'Input / Output' : ['condition', 'delay', 'feedback', 'iteration', 'loop', 'loop-start', 'loop-end'].includes(kind) ? 'Time' : 'Compose', preview: ['array-randomizer'].includes(kind) ? 'array' as const : 'surface' as const, evaluatorKey: kind }))),
  ...(['bloom', 'godray', 'mk-godray', 'particle', 'particle-spawn', 'pixel-cloud', 'trail', 'vfx'].map((kind) => ({ kind: kind as DemoNodeKind, family: 'Generator', preview: 'surface' as const, evaluatorKey: kind }))),
]

const backlogNames = [
  '3d-camera', '3d-cube', '3d-cylinder', '3d-displace', '3d-extrude', '3d-line', '3d-mesh', '3d-node', '3d-point', '3d-point-camera', '3d-plane', '3d-scene', '3d-sphere', 'height-to-normal', 'isometric-projection', 'orthographic-projection', 'mesh-3d', 'path-revolve', 'point-cloud', 'raycast', 'render-3d', 'sphere-projection', 'texture-map', 'fluid-simulation', 'flip-fluid', 'iso-surface', 'liquid', 'mk-cloud', 'mk-tree', 'psystem', 'raymarch', 'rigid-simulation', 'rigidsim', 'smoke-simulation', 'smokesim', 'strand-simulation', 'strandsim', 'volumetric-fire', 'volumetric-smoke',
]

export const pipelineNodeRegistry: readonly PipelineNodeDefinition[] = [
  ...publishedKinds.filter(({ kind }) => isDemoNodeKind(kind)).map(({ kind, family, preview, evaluatorKey, aliases = [] }) => ({ version: PIPELINE_NODE_REGISTRY_VERSION, kind, family, labelKey: kind, descriptionKey: `${kind}.description`, aliases, status: 'published' as const, capabilities: ['cpu2d'] as const, preview, evaluatorKey })),
  ...backlogNames.map((kind) => ({ version: PIPELINE_NODE_REGISTRY_VERSION, kind, family: kind.startsWith('3d-') ? '3D' : 'Backlog', labelKey: kind, descriptionKey: `${kind}.description`, aliases: [], status: 'backlog' as const, capabilities: ['webgl', 'webgpu'] as const, preview: 'surface' as const, evaluatorKey: 'not-implemented' })),
]

export const publishedPipelineNodes = pipelineNodeRegistry.filter((definition) => definition.status === 'published')
export const backlogPipelineNodes = pipelineNodeRegistry.filter((definition) => definition.status === 'backlog')

export function getPipelineNodeDefinition(kind: string): PipelineNodeDefinition | undefined {
  return pipelineNodeRegistry.find((definition) => definition.kind === kind || definition.aliases.includes(kind))
}

export function getPublishedNodeLibrary(): readonly { kind: DemoNodeKind; label: string; description: string; family?: string }[] {
  return publishedPipelineNodes.flatMap((definition) => {
    if (!isDemoNodeKind(definition.kind)) return []
    const node = createDemoNode(definition.kind, `registry-${definition.kind}`, { x: 0, y: 0 })
    return [{ kind: definition.kind, label: node.title, description: `${definition.family} · ${definition.evaluatorKey}`, family: definition.family }]
  })
}

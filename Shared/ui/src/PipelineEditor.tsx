import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useUpdateNodeInternals,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type OnDelete,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/base.css'
import { Check, CheckSquare, Download, Eye, EyeOff, KeyRound, Pause, Play, PanelBottom, Repeat2, Square, Trash2, Upload, X } from 'lucide-react'
import { customNodeDefinitionSchema, type CustomNodeDefinition, type PipelineDocument, type PipelineValue as ContractPipelineValue } from '@mosaico/contracts'
import {
  connectDemoPorts,
  createCustomDemoNode, createDemoNode, parameterInputPorts, parameterPortId, syncDemoNodePorts,
  normalizeDemoEdge, normalizeDemoNode,
  normalizeParameterId,
  isDemoNodeKind,
  type DemoConnectionRequest,
  type DemoEdge,
  type DemoGraph,
  type DemoGraphError,
  type DemoNode,
  type DemoNodeKind,
  type DemoParameter,
  type DemoPort,
} from './pipeline-editor-model.js'
import type { VisibleAsset } from './asset-catalog.js'
import { createSurface, evaluatePipeline, surfaceHash, type PipelineAnimation, type PipelineAssetSource, type PipelineSurface, type PipelineValue } from './pipeline-evaluator.js'
import { createPipelinePackage, loadPipelinePackage, savePipelineProject, PIPELINE_PROJECT_EXTENSION } from './pipeline-media.js'
import { createVisualCustomNodeDefinition, parseCustomNodeDsl } from './custom-node.js'
import { downloadCustomNode, parseCustomNode } from './custom-node-media.js'
import { getPublishedNodeLibrary } from './pipeline-node-registry.js'
import { detectPipelineBackends } from './pipeline-backends.js'
import { exportPipelineFrames, type PipelineExportFormat } from './pipeline-export.js'
import { renderPipelineFrame, samplePipelineTimes, type GeneratedPipelineFrame, type PipelineTransferPayload } from './pipeline-frames.js'

type NodeLibraryItem = { kind: DemoNodeKind; label: string; description: string; family?: string }
const library: readonly NodeLibraryItem[] = [
  { kind: 'asset', label: 'Asset', description: 'Entrada de imagen' },
  { kind: 'resize', label: 'Resize', description: 'Escala pixel-perfect' },
  { kind: 'flip', label: 'Flip', description: 'Transformación visual' },
  { kind: 'color', label: 'Color', description: 'Tinte y paleta' },
  { kind: 'gradient', label: 'Gradient', description: 'Gradiente procedural' },
  { kind: 'noise', label: 'Noise', description: 'Ruido de valor determinista' },
  { kind: 'cellular-noise', label: 'Cellular Noise', description: 'Celdas y distancia' },
  { kind: 'perlin', label: 'Perlin Noise', description: 'Ruido gradientado' },
  { kind: 'simplex', label: 'Simplex Noise', description: 'Ruido simplex' },
  { kind: 'blend', label: 'Blend', description: 'Combina superficies' },
  { kind: 'add', label: 'Add', description: 'Suma superficies o valores' },
  { kind: 'subtract', label: 'Subtract', description: 'Resta superficies o valores' },
  { kind: 'multiply', label: 'Multiply', description: 'Multiplica superficies o valores' },
  { kind: 'divide', label: 'Divide', description: 'Divide superficies o valores' },
  { kind: 'int', label: 'Int', description: 'Valor entero' },
  { kind: 'float', label: 'Float', description: 'Valor decimal' },
  { kind: 'vector2', label: 'Vector2', description: 'Vector 2D' },
  { kind: 'vector3', label: 'Vector3', description: 'Vector 3D' },
  { kind: 'vector4', label: 'Vector4', description: 'Vector 4D' },
  { kind: 'seed', label: 'Seed', description: 'Semilla determinista' },
  { kind: 'rough', label: 'Rough', description: 'Rugosidad 0..1' },
  { kind: 'movement', label: 'Movement', description: 'Desplaza una superficie' },
  { kind: 'direction', label: 'Direction', description: 'Dirección a Vector2' },
  { kind: 'velocity', label: 'Velocity', description: 'Velocidad a Vector2' },
  { kind: 'time', label: 'Time', description: 'Tiempo actual del timeline en segundos' },
  { kind: 'delta-time', label: 'DeltaTime', description: 'Tiempo transcurrido desde la evaluación anterior' },
  { kind: 'bool', label: 'Bool', description: 'Constante booleana' },
  { kind: 'compare', label: 'Compare', description: 'Compara valores escalares' },
  { kind: 'if', label: 'If', description: 'Selecciona entre dos entradas tipadas' },
  { kind: 'switch', label: 'Switch', description: 'Selecciona caso 0, caso 1 o default' },
  { kind: 'not', label: 'Not', description: 'Niega un booleano' },
  { kind: 'and', label: 'And', description: 'Conjunción booleana' },
  { kind: 'or', label: 'Or', description: 'Disyunción booleana' },
  { kind: 'xor', label: 'Xor', description: 'Disyunción exclusiva booleana' },
  { kind: 'nor', label: 'Nor', description: 'Negación de Or' },
  { kind: 'nand', label: 'Nand', description: 'Negación de And' },
  { kind: 'rotation', label: 'Rotate', description: 'Ángulo 0.00–359.99°' },
  { kind: 'zoom', label: 'Zoom', description: 'Escala nearest' },
  { kind: 'preview', label: 'Preview', description: 'Salida visual' },
]

const extraLibrary: readonly NodeLibraryItem[] = [
  { kind: 'invert', label: 'Invert', description: 'Invierte RGB o RGBA' },
  { kind: 'select', label: 'Select', description: 'Crea mascara RGBA por color, alpha o luminancia' },
  { kind: 'replace', label: 'Replace', description: 'Reemplaza color A usando otra Surface' },
  { kind: 'outline', label: 'Outline', description: 'Genera borde separado y conserva original' },
]

const paletteFamilies = ['all', 'Array', 'Compose', 'Data', 'Filter', 'Generator', 'I/O', 'Math & Logic', 'Time', 'Transform', 'Vector'] as const
type PaletteFamily = typeof paletteFamilies[number]
function paletteFamily(value: string | undefined): Exclude<PaletteFamily, 'all'> {
  if (value === 'Array') return 'Array'
  if (value === 'Compose' || value === 'Composition') return 'Compose'
  if (value === 'Filter' || value === 'Mask') return 'Filter'
  if (value === 'Generator' || value?.startsWith('Generator') || value?.startsWith('VFX')) return 'Generator'
  if (value === 'Input / Output' || value === 'Entrada / salida') return 'I/O'
  if (value === 'Time' || value === 'Lógica' || value === 'Logic') return value === 'Time' ? 'Time' : 'Math & Logic'
  if (value === 'Vector' || value === 'Vectors') return 'Vector'
  if (value === 'Math' || value === 'Math & Data' || value === 'Aritmética') return 'Math & Logic'
  if (value === 'Data' || value === 'Datos') return 'Data'
  if (value === 'Transform' || value === 'Transformación') return 'Transform'
  return 'Data'
}

const connectionMessages: Record<DemoGraphError, string> = {
  CONNECTION_NODE_NOT_FOUND: 'Conexión inválida: nodo inexistente.',
  CONNECTION_PORT_NOT_FOUND: 'Conexión inválida: puerto inexistente.',
  CONNECTION_DIRECTION_INVALID: 'Conexión inválida: usa salida hacia entrada del mismo tipo.',
  CONNECTION_SELF: 'Conexión inválida: un nodo no puede conectarse consigo mismo.',
  CONNECTION_DUPLICATE: 'Conexión inválida: esa conexión ya existe.',
  CONNECTION_INPUT_OCCUPIED: 'Conexión inválida: la entrada ya está ocupada.',
}

const PIPELINE_ASSET_DRAG_MIME = 'application/x-mosaico-asset-id'

function hasPipelineAssetDrag(event: React.DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).some((type) => type === PIPELINE_ASSET_DRAG_MIME || type === 'text/plain')
}

function getPipelineAssetDragId(event: React.DragEvent<HTMLElement>): string {
  return event.dataTransfer.getData(PIPELINE_ASSET_DRAG_MIME) || event.dataTransfer.getData('text/plain')
}

interface FlowActions {
  fitView: () => void
  zoomIn: () => void
  zoomOut: () => void
  deleteSelection: () => void
}

interface FlowNodeData extends Record<string, unknown> {
  demo: DemoNode
}

interface PipelineNodeActions {
  onSelect: (nodeId: string, additive?: boolean) => void
  onContextMenu: (nodeId: string, x: number, y: number) => void
  onMoveByKeyboard: (nodeId: string, key: string) => void
  onPortClick: (nodeId: string, port: DemoPort) => void
  onAttachAsset: (nodeId: string, assetId: string) => void
  onToggleParameterVisibility?: (nodeId: string, parameterId: string) => void
}

type FlowNode = Node<FlowNodeData, 'mosaico'>
type FlowEdge = Edge

const PipelineNodeActionsContext = createContext<PipelineNodeActions | null>(null)
const PipelineNodeOutputsContext = createContext<ReadonlyMap<string, ReadonlyMap<string, PipelineValue>>>(new Map())

function usePipelineNodeActions(): PipelineNodeActions {
  const actions = useContext(PipelineNodeActionsContext)
  if (!actions) throw new Error('Pipeline node actions unavailable.')
  return actions
}

function createFlowNode(demo: DemoNode, selected = false): FlowNode {
  return {
    id: demo.id,
    type: 'mosaico',
    position: { x: demo.x, y: demo.y },
    selected,
    data: { demo },
  }
}

function createFlowEdge(edge: DemoEdge): FlowEdge {
  return {
    id: edge.sourceNodeId + ':' + edge.sourcePortId + ':' + edge.targetNodeId + ':' + edge.targetPortId,
    source: edge.sourceNodeId,
    sourceHandle: edge.sourcePortId,
    target: edge.targetNodeId,
    targetHandle: edge.targetPortId,
    type: 'smoothstep',
  }
}

function createGraphFromFlow(nodes: readonly FlowNode[], edges: readonly FlowEdge[]): DemoGraph {
  return {
    nodes: nodes.map((node) => ({ ...node.data.demo, x: node.position.x, y: node.position.y })),
    edges: edges.map((edge) => ({
      sourceNodeId: edge.source,
      sourcePortId: edge.sourceHandle ?? '',
      targetNodeId: edge.target,
      targetPortId: edge.targetHandle ?? '',
    })),
    selectedNodeId: nodes.find((node) => node.selected)?.id,
  }
}

function surfaceOutput(output: ReadonlyMap<string, PipelineValue> | undefined): PipelineSurface | undefined {
  for (const value of output?.values() ?? []) if (typeof value === 'object' && !Array.isArray(value) && 'pixels' in value) return value
  return undefined
}

function PipelineSurfacePreview({ surface, className = 'pipeline-real-preview', ariaLabel = 'Resultado real del pipeline' }: { surface: PipelineSurface; className?: string; ariaLabel?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    canvas.width = surface.width; canvas.height = surface.height
    canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(surface.pixels), surface.width, surface.height), 0, 0)
  }, [surface])
  return <canvas ref={ref} className={className} aria-label={ariaLabel} />
}

export function NodePreview({ surface, large = false }: { surface?: PipelineSurface; large?: boolean }) {
  if (surface) return <PipelineSurfacePreview surface={surface} className={large ? 'pipeline-real-preview' : 'pipeline-node-real-preview'} ariaLabel={large ? 'Resultado real del pipeline' : 'Resultado real del nodo'} />
  return <div
    className={'pipeline-node-preview pipeline-transparent-preview' + (large ? ' large' : '')}
    role={large ? 'img' : undefined}
    aria-label={large ? 'Salida RGBA transparente' : undefined}
    aria-hidden={large ? undefined : true}
  />
}

const PipelineFlowNode = memo(function PipelineFlowNode({ data, selected }: NodeProps<FlowNode>) {
  const { demo } = data
  const actions = usePipelineNodeActions()
  const surface = surfaceOutput(useContext(PipelineNodeOutputsContext).get(demo.id))
  const updateNodeInternals = useUpdateNodeInternals()

  useEffect(() => { updateNodeInternals(demo.id) }, [demo.id, demo.inputs, demo.outputs, demo.parameters, updateNodeInternals])

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      actions.onSelect(demo.id, event.shiftKey)
      return
    }
    if (event.key.startsWith('Arrow')) {
      event.preventDefault()
      event.stopPropagation()
      actions.onMoveByKeyboard(demo.id, event.key)
    }
  }

  function renderPort(port: DemoPort): React.ReactNode {
    const isInput = port.direction === 'input'
    const direction = isInput ? 'input' : 'output'
    const isParameter = port.id.startsWith('parameter:')
    const label = (isParameter ? 'Parámetro ' : isInput ? 'Entrada ' : 'Salida ') + port.label + ' de ' + demo.title + ' (' + port.type + ')'
    return <div className={'pipeline-port-row ' + direction} key={port.id}>
      <Handle
        className={'pipeline-port-handle ' + direction}
        type={isInput ? 'target' : 'source'}
        position={isInput ? Position.Left : Position.Right}
        id={port.id}
        aria-label={label}
      />
      <button
        className={'pipeline-port ' + direction + ' nodrag nopan'}
        type="button"
        title={(isParameter ? 'Parámetro ' : isInput ? 'Entrada ' : 'Salida ') + port.label + ' · ' + port.type}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation()
          actions.onPortClick(demo.id, port)
        }}
      >{port.label}</button>
    </div>
  }

  return <div
    className={'pipeline-node ' + (selected ? 'selected' : '')}
    data-pipeline-node="true"
    role="group"
    tabIndex={0}
    aria-label={demo.title + ', ' + demo.family}
    onClick={(event) => actions.onSelect(demo.id, event.shiftKey)}
    onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); actions.onContextMenu(demo.id, event.clientX, event.clientY) }}
    onKeyDown={handleKeyDown}
    onDragEnter={(event) => { if (demo.kind === 'asset' && hasPipelineAssetDrag(event)) { event.preventDefault(); event.stopPropagation() } }}
    onDragOver={(event) => { if (demo.kind === 'asset' && hasPipelineAssetDrag(event)) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy' } }}
    onDrop={(event) => { const assetId = getPipelineAssetDragId(event); if (assetId && demo.kind === 'asset') { event.preventDefault(); event.stopPropagation(); actions.onAttachAsset(demo.id, assetId) } }}
  >
    <div className="pipeline-node-header">
      <span className={'pipeline-kind-mark ' + demo.kind} aria-hidden="true" />
      <strong className="pipeline-node-title" data-user-content={demo.kind === 'custom' ? 'true' : undefined}>{demo.title}</strong>
      <small>{demo.family}</small>
    </div>
    {demo.previewVisible !== false && <NodePreview surface={surface} />}
    <div className="pipeline-node-ports">
      <div>{demo.inputs.map(renderPort)}</div>
      <div>{demo.outputs.map(renderPort)}</div>
    </div>
    <div className="pipeline-node-parameters" aria-hidden="true">{demo.parameters.filter((parameter) => parameter.showInNode !== false && !demo.inputs.some((port) => port.id === parameterPortId(parameter.id))).map((parameter) => <span key={parameter.id}>{parameter.label}</span>)}</div>
    <div className="pipeline-node-summary">
      <span>{surface ? `${surface.width} × ${surface.height}` : 'RGBA transparente'}</span>
      <span>{demo.parameters[0]?.label ?? 'Surface'}</span>
    </div>
  </div>
})

const nodeTypes = { mosaico: PipelineFlowNode }

interface PipelineFlowProps {
  nodes: FlowNode[]
  edges: FlowEdge[]
  viewport: { x: number; y: number; zoom: number }
  compact: boolean
  actionsRef: { current: FlowActions | null }
  nodeActions: PipelineNodeActions
  nodeOutputs: ReadonlyMap<string, ReadonlyMap<string, PipelineValue>>
  onNodesChange: OnNodesChange<FlowNode>
  onEdgesChange: OnEdgesChange<FlowEdge>
  onConnect: (connection: Connection) => void
  onDelete: OnDelete<FlowNode, FlowEdge>
  onClearSelection: () => void
  onViewportChange: (viewport: { x: number; y: number; zoom: number }) => void
  onDropAsset: (assetId: string | undefined, position: { x: number; y: number }, files: readonly File[]) => void
  onOpenPalette: (position: { x: number; y: number }, screenPosition: { x: number; y: number }) => void
}

function PipelineFlow({
  nodes,
  edges,
  viewport,
  compact,
  actionsRef,
  nodeActions,
  nodeOutputs,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onDelete,
  onClearSelection,
  onViewportChange,
  onDropAsset,
  onOpenPalette,
}: PipelineFlowProps) {
  const { deleteElements, fitView, getEdges, getNodes, screenToFlowPosition, zoomIn, zoomOut } = useReactFlow<FlowNode, FlowEdge>()

  useEffect(() => {
    actionsRef.current = {
      fitView: () => { void fitView({ padding: 0.16, duration: 120 }) },
      zoomIn: () => { void zoomIn({ duration: 120 }) },
      zoomOut: () => { void zoomOut({ duration: 120 }) },
      deleteSelection: () => {
        const selectedNodes = getNodes().filter((node) => node.selected)
        const selectedEdges = getEdges().filter((edge) => edge.selected)
        if (selectedNodes.length || selectedEdges.length) void deleteElements({ nodes: selectedNodes, edges: selectedEdges })
      },
    }
    return () => { actionsRef.current = null }
  }, [actionsRef, deleteElements, fitView, getEdges, getNodes, zoomIn, zoomOut])

  return <PipelineNodeOutputsContext.Provider value={nodeOutputs}>
    <PipelineNodeActionsContext.Provider value={nodeActions}>
    <div className="pipeline-flow-dropzone" onDoubleClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top }; onOpenPalette(screenToFlowPosition({ x: event.clientX, y: event.clientY }), screen) }} onDragEnter={(event) => { if (hasPipelineAssetDrag(event) || event.dataTransfer.types.includes('Files')) event.preventDefault() }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }} onDrop={(event) => {
      event.preventDefault()
      const assetId = getPipelineAssetDragId(event) || undefined
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      onDropAsset(assetId, position, [...event.dataTransfer.files])
    }}>
    <ReactFlow
      className={'pipeline-flow ' + (compact ? 'compact' : '')}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onDelete={onDelete}
      onPaneClick={onClearSelection}
      onViewportChange={onViewportChange}
      defaultViewport={viewport}
      fitView={false}
      fitViewOptions={{ padding: 0.16 }}
      minZoom={0.12}
      maxZoom={3.5}
      panOnDrag
      multiSelectionKeyCode="Shift"
      selectionKeyCode="Alt"
      nodesDraggable
      nodesConnectable
      nodesFocusable
      edgesFocusable
      elementsSelectable
      elevateEdgesOnSelect
      deleteKeyCode={['Backspace', 'Delete']}
      defaultEdgeOptions={{ type: 'smoothstep', style: { stroke: '#5f747d', strokeWidth: 2 } }}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Lines} gap={24} size={1} color="#263036" />
      <Controls showInteractive={false} />
    </ReactFlow>
    </div>
    </PipelineNodeActionsContext.Provider>
  </PipelineNodeOutputsContext.Provider>
}

const NUMERIC_PARAMETER_KINDS: readonly DemoParameter['kind'][] = ['number', 'float', 'range']

function normalizeColorInputValue(value: string): string {
  const raw = value.replace('#', '')
  const hex = raw.length === 3 ? raw.split('').map((part) => part + part).join('') : raw
  return '#' + hex.slice(0, 6).padEnd(6, '0').toLowerCase()
}

export function ParameterValueInput({ inputId, parameter, onCommit }: {
  inputId: string
  parameter: DemoParameter
  onCommit: (value: string) => void
}) {
  const numeric = NUMERIC_PARAMETER_KINDS.includes(parameter.kind)
  const [draft, setDraft] = useState<string | null>(null)
  const committed = Array.isArray(parameter.value) ? JSON.stringify(parameter.value) : String(parameter.value)
  useEffect(() => { setDraft(null) }, [committed])

  if (parameter.kind === 'select') {
    return <select id={inputId} value={committed} onChange={(event) => onCommit(event.target.value)}>
      {parameter.options?.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  }
  if (parameter.kind === 'boolean') {
    return <input id={inputId} type="checkbox" checked={Boolean(parameter.value)} onChange={(event) => onCommit(String(event.target.checked))} />
  }

  const handleChange = (raw: string) => {
    setDraft(raw)
    if (numeric) {
      const text = raw.trim()
      // Mientras el usuario escribe estados intermedios ("-", "0.", "1e-") solo se guarda el borrador:
      // el punto decimal no desaparece y el valor se confirma cuando es un número completo.
      if (!text || !Number.isFinite(Number(text))) return
      onCommit(raw)
      return
    }
    if (parameter.kind === 'array') {
      try { const candidate: unknown = JSON.parse(raw); if (Array.isArray(candidate)) onCommit(raw) } catch { /* espera un array JSON válido */ }
      return
    }
    if (parameter.kind === 'color') {
      const previous = String(parameter.value)
      const alpha = /^#[0-9a-fA-F]{8}$/.test(previous) ? previous.slice(7, 9).toLowerCase() : ''
      onCommit(raw.toLowerCase() + alpha)
      return
    }
    onCommit(raw)
  }

  const type = parameter.kind === 'range' ? 'range' : parameter.kind === 'color' ? 'color' : numeric ? 'number' : 'text'
  const shown = draft ?? (type === 'color' ? normalizeColorInputValue(committed) : committed)
  return <input id={inputId} type={type} min={parameter.min} max={parameter.max} step={parameter.step} value={shown} onChange={(event) => handleChange(event.target.value)} onBlur={() => setDraft(null)} />
}

export function PipelineInspector({
  selectedNode,
  selectedEdge,
  assets = [],
  onUpdateParameter,
  onAttachAsset,
  onToggleParameterVisibility,
}: {
  selectedNode?: DemoNode
  selectedEdge?: FlowEdge
  assets?: readonly VisibleAsset[]
  onUpdateParameter: (node: DemoNode, parameter: DemoParameter, value: string) => void
  onAttachAsset: (nodeId: string, assetId: string) => void
  onToggleParameterVisibility?: (nodeId: string, parameterId: string) => void
}) {
  const attachedAsset = selectedNode?.assetId ? assets.find((asset) => asset.record.id === selectedNode.assetId) : undefined
  const canDropAsset = selectedNode?.kind === 'asset'
  return <aside className="pipeline-inspector" aria-label="Inspector de Pipeline">
    <div className="pipeline-inspector-heading">
      <p className="eyebrow">Propiedades</p>
      <h3 data-user-content={selectedNode?.kind === 'custom' ? 'true' : undefined}>{selectedNode?.title ?? (selectedEdge ? 'Conexión' : 'Sin selección')}</h3>
      <span>{selectedNode?.family ?? (selectedEdge ? 'Flujo de superficie' : 'Selecciona un elemento')}</span>
    </div>
    {selectedNode ? <div className="pipeline-parameters">
      {selectedNode.parameters.map((parameter) => <label className="pipeline-field" key={parameter.id} htmlFor={'pipeline-param-' + selectedNode.id + '-' + parameter.id}>
        <span>{parameter.label}</span>
        <ParameterValueInput inputId={'pipeline-param-' + selectedNode.id + '-' + parameter.id} parameter={parameter} onCommit={(value) => onUpdateParameter(selectedNode, parameter, value)} />
        <button className="pipeline-parameter-visibility" type="button" aria-label={`${parameter.showInNode === false ? 'Mostrar' : 'Ocultar'} ${parameter.label} en el nodo`} title={`${parameter.showInNode === false ? 'Mostrar' : 'Ocultar'} en nodo`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onToggleParameterVisibility?.(selectedNode.id, parameter.id) }}>{parameter.showInNode === false ? <EyeOff size={13} /> : <Eye size={13} />}</button>
      </label>)}
      {canDropAsset && <div
        className="pipeline-asset-drop-target"
        data-pipeline-asset-drop-target={selectedNode.id}
        role="region"
        aria-label="Soltar Asset en el nodo seleccionado"
        onDragEnter={(event) => { if (hasPipelineAssetDrag(event)) { event.preventDefault(); event.stopPropagation() } }}
        onDragOver={(event) => { if (hasPipelineAssetDrag(event)) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy' } }}
        onDrop={(event) => {
          const assetId = getPipelineAssetDragId(event)
          if (!assetId) return
          event.preventDefault()
          event.stopPropagation()
          onAttachAsset(selectedNode.id, assetId)
        }}
      >
        <strong>Fuente del Asset</strong>
        {attachedAsset ? <span className="pipeline-attached-asset"><img src={attachedAsset.thumbnailUrl} alt="" /><b data-user-content="true">{attachedAsset.record.name}</b></span> : <span>Suelta un Asset para usarlo como fuente</span>}
      </div>}
      <div className="pipeline-inspector-inputs">
        <p className="eyebrow">Inputs</p>
        {selectedNode.inputs.filter((port) => !port.id.startsWith('parameter:')).map((port) => <div className="pipeline-inspector-input" key={port.id}><span>{port.label}</span><small>{port.type}</small></div>)}
        {!selectedNode.inputs.some((port) => !port.id.startsWith('parameter:')) && <span className="pipeline-inspector-muted">No structural inputs</span>}
      </div>
      <div className="pipeline-inspector-ports">
        <p className="eyebrow">Puertos</p>
        <span>{selectedNode.inputs.length} entradas</span>
        <span>{selectedNode.outputs.length} salidas</span>
        {selectedNode.assetId && <span>Asset: {selectedNode.assetId}</span>}
      </div>
    </div> : selectedEdge ? <dl className="pipeline-edge-details">
      <div><dt>Origen</dt><dd>{selectedEdge.source}</dd></div>
      <div><dt>Destino</dt><dd>{selectedEdge.target}</dd></div>
      <div><dt>Tipo</dt><dd>Surface</dd></div>
    </dl> : <p className="pipeline-inspector-empty">Selecciona un nodo o conexión para inspeccionarlo. Delete/Backspace elimina la selección.</p>}
  </aside>
}

function toPipelineDocument(graph: DemoGraph, assets: readonly VisibleAsset[], mode: 'animation' | 'snapshots', durationMs: number, currentTimeMs: number, loop: boolean, keyframes: readonly PipelineKeyframeState[], snapshots: readonly PipelineSnapshotState[], viewport: { readonly x: number; readonly y: number; readonly zoom: number }, timelineOptions: { readonly timelineVisible: boolean; readonly timelineHeight: number; readonly fps: number; readonly rangeStartMs: number; readonly rangeEndMs: number; readonly selectedFrameTimesMs: readonly number[] }): PipelineDocument {
  const usedAssetIds = new Set(graph.nodes.flatMap((node) => node.assetId ? [node.assetId] : []))
  return {
    format: 'mosaico-pipeline', formatVersion: 1, id: 'pipeline-local', revision: 1, name: 'Pipeline',
    nodes: graph.nodes.map((node) => ({ id: node.id, kind: node.kind, x: node.x, y: node.y, inputs: [...node.inputs], outputs: [...node.outputs], assetId: node.assetId, customNodeId: node.customNodeId, customDefinition: node.customDefinition, previewVisible: node.previewVisible, parameters: node.parameters.map((parameter) => ({ id: parameter.id, type: parameter.kind === 'number' ? 'number' : parameter.kind === 'float' ? 'float' : parameter.kind === 'range' ? 'range' : parameter.kind === 'select' ? 'select' : parameter.kind === 'color' ? 'color' : parameter.kind === 'boolean' ? 'boolean' : parameter.kind === 'array' ? 'array' : 'text', value: (Array.isArray(parameter.value) ? [...parameter.value] : parameter.value) as string | number | boolean | number[], min: parameter.min, max: parameter.max, step: parameter.step, options: parameter.options ? [...parameter.options] : undefined, showInNode: parameter.showInNode, portType: parameter.portType })) })),
    edges: [...graph.edges],
    assets: assets.filter((asset) => usedAssetIds.has(asset.record.id)).map((asset) => asset.record),
    timeline: { mode, durationMs, currentTimeMs, loop, timelineVisible: timelineOptions.timelineVisible, timelineHeight: timelineOptions.timelineHeight, render: { fps: timelineOptions.fps, rangeStartMs: timelineOptions.rangeStartMs, rangeEndMs: timelineOptions.rangeEndMs, selectedFrameTimesMs: [...timelineOptions.selectedFrameTimesMs] }, keyframes: keyframes.map((keyframe) => ({ ...keyframe, value: keyframe.value ?? 0 })), snapshots: snapshots.map(({ id, label, timeMs, thumbnailPath, selectedNodeId }) => ({ id, label, timeMs, thumbnailPath, selectedNodeId })) },
    viewport, selectedNodeId: graph.selectedNodeId,
  }
}

function fromPipelineDocument(document: PipelineDocument, assetIdMap: ReadonlyMap<string, string> = new Map()): DemoGraph {
  const normalizedNodes = document.nodes.map((node) => {
      if (!isDemoNodeKind(node.kind)) throw new Error('PIPELINE_NODE_KIND_UNSUPPORTED')
      const custom = node.kind === 'custom' ? customNodeDefinitionSchema.safeParse(node.customDefinition) : undefined
      const demo = custom?.success ? createCustomDemoNode(custom.data, node.id, { x: node.x, y: node.y }) : createDemoNode(node.kind, node.id, { x: node.x, y: node.y })
      const inputs = node.inputs?.map((port) => ({ ...port, label: demo.inputs.find((item) => item.id === port.id)?.label ?? port.id }))
      const outputs = node.outputs?.map((port) => ({ ...port, label: demo.outputs.find((item) => item.id === port.id)?.label ?? port.id }))
      const serialized = new Map(node.parameters.map((parameter) => [normalizeParameterId(parameter.id), parameter] as const))
      const parameterIds = new Set(demo.parameters.map((parameter) => parameter.id))
      const parameters = [...demo.parameters.map((base) => {
        const parameter = serialized.get(base.id)
        return parameter ? { ...base, ...parameter, id: base.id, value: parameter.value, options: parameter.options ? [...parameter.options] : base.options, portType: parameter.portType ?? base.portType } : base
      }), ...node.parameters.filter((parameter) => !parameterIds.has(normalizeParameterId(parameter.id))).map((parameter) => ({ ...parameter, id: normalizeParameterId(parameter.id), label: parameter.id, kind: parameter.type === 'number' ? 'number' : parameter.type === 'float' ? 'float' : parameter.type === 'range' ? 'range' : parameter.type === 'select' ? 'select' : parameter.type === 'color' ? 'color' : parameter.type === 'boolean' ? 'boolean' : parameter.type === 'array' ? 'array' : 'text', options: parameter.options ? [...parameter.options] : undefined }))]
      const normalizedParameters = parameters as unknown as DemoParameter[]
      const normalizedInputs = [...(inputs ?? demo.inputs).filter((port) => !port.id.startsWith('parameter:')), ...parameterInputPorts(normalizedParameters)]
      return normalizeDemoNode({ ...demo, inputs: normalizedInputs, outputs: outputs ?? demo.outputs, assetId: node.assetId ? assetIdMap.get(node.assetId) ?? node.assetId : undefined, customNodeId: node.customNodeId ?? demo.customNodeId, customDefinition: custom?.success ? custom.data : demo.customDefinition, previewVisible: node.previewVisible !== false })
    })
  return {
    nodes: normalizedNodes,
    edges: document.edges.map((edge) => normalizeDemoEdge(edge, normalizedNodes)),
    selectedNodeId: document.selectedNodeId,
  }
}

function interpolateTimeline(graph: DemoGraph, keyframes: readonly PipelineKeyframeState[], timeMs: number): DemoGraph {
  return { ...graph, nodes: graph.nodes.map((node) => ({ ...node, parameters: node.parameters.map((parameter) => {
    const frames = keyframes.filter((frame): frame is PipelineKeyframeState & { readonly value: number } => frame.nodeId === node.id && frame.parameterId === parameter.id && typeof frame.value === 'number').sort((left, right) => left.timeMs - right.timeMs)
    if (!frames.length) return parameter
    const before = [...frames].reverse().find((frame) => frame.timeMs <= timeMs); const after = frames.find((frame) => frame.timeMs >= timeMs)
    if (!before) return { ...parameter, value: after?.value ?? parameter.value }
    if (!after || before.id === after.id) return { ...parameter, value: before.value ?? parameter.value }
    const span = Math.max(1, after.timeMs - before.timeMs); let ratio = (timeMs - before.timeMs) / span
    const easing = before.easing ?? 'linear'; if (easing === 'ease-in') ratio *= ratio; else if (easing === 'ease-out') ratio = 1 - (1 - ratio) * (1 - ratio); else if (easing === 'ease-in-out') ratio = ratio < 0.5 ? 2 * ratio * ratio : 1 - Math.pow(-2 * ratio + 2, 2) / 2
    if (before.interpolation === 'step') ratio = 0
    if (before.interpolation === 'bezier') {
      const handles = before.handles ?? { in: [0.25, 0], out: [0.75, 1] }; let low = 0; let high = 1
      for (let iteration = 0; iteration < 12; iteration += 1) { const candidate = (low + high) / 2; const x = 3 * (1 - candidate) ** 2 * candidate * handles.out[0] + 3 * (1 - candidate) * candidate ** 2 * handles.in[0] + candidate ** 3; if (x < ratio) low = candidate; else high = candidate }
      const t = (low + high) / 2; ratio = 3 * (1 - t) ** 2 * t * handles.out[1] + 3 * (1 - t) * t ** 2 * handles.in[1] + t ** 3
    }
    let value = Number(before.value) + (Number(after.value) - Number(before.value)) * Math.max(0, Math.min(1, ratio))
    if (before.interpolation === 'spline') {
      const previous = [...frames].reverse().find((frame) => frame.timeMs < before!.timeMs); const next = frames.find((frame) => frame.timeMs > after!.timeMs); const p0 = Number(previous?.value ?? before.value); const p1 = Number(before.value); const p2 = Number(after.value); const p3 = Number(next?.value ?? after.value); const t2 = ratio * ratio; const t3 = t2 * ratio
      value = 0.5 * ((2 * p1) + (-p0 + p2) * ratio + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
    }
    return { ...parameter, value }
  }) })) }
}

async function decodeImageSurface(blob: Blob): Promise<PipelineSurface> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob)
    try {
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height
      const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) throw new Error('Canvas 2D no está disponible.')
      context.drawImage(bitmap, 0, 0)
      return createSurface(bitmap.width, bitmap.height, context.getImageData(0, 0, bitmap.width, bitmap.height).data)
    } finally {
      bitmap.close()
    }
  }

  if (typeof Image === 'undefined') throw new Error('El navegador no puede decodificar Assets.')
  const url = URL.createObjectURL(blob)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const candidate = new Image()
      candidate.onload = () => resolve(candidate)
      candidate.onerror = () => reject(new Error('No se pudo decodificar un Asset para el grafo.'))
      candidate.src = url
    })
    const width = image.naturalWidth || image.width; const height = image.naturalHeight || image.height
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) throw new Error('Canvas 2D no está disponible.')
    context.drawImage(image, 0, 0)
    return createSurface(width, height, context.getImageData(0, 0, width, height).data)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function decodeImageSource(blob: Blob): Promise<PipelineAssetSource> {
  if (blob.type !== 'image/gif') return decodeImageSurface(blob)
  const Decoder = (globalThis as unknown as { ImageDecoder?: new (input: { data: ArrayBuffer; type: string }) => any }).ImageDecoder
  if (!Decoder) throw new Error('GIF_DECODER_UNAVAILABLE')
  const decoder = new Decoder({ data: await blob.arrayBuffer(), type: blob.type })
  try {
    await decoder.tracks.ready
    const frameCount = decoder.tracks.selectedTrack.frameCount
    if (!Number.isInteger(frameCount) || frameCount < 1 || frameCount > 1024) throw new Error('GIF_FRAME_LIMIT')
    const frames: PipelineSurface[] = []; const frameDurationsMs: number[] = []
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const decoded = await decoder.decode({ frameIndex, completeFramesOnly: true }); const image = decoded.image
      const canvas = document.createElement('canvas'); canvas.width = image.displayWidth; canvas.height = image.displayHeight
      const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) throw new Error('Canvas 2D no disponible')
      context.drawImage(image, 0, 0); frames.push(createSurface(image.displayWidth, image.displayHeight, context.getImageData(0, 0, image.displayWidth, image.displayHeight).data)); frameDurationsMs.push(Math.max(10, Math.round((image.duration ?? 100_000) / 1000))); image.close()
    }
    const animation: PipelineAnimation = { frames, frameDurationsMs, loop: true }; return animation
  } finally {
    decoder.close()
  }
}

export interface PipelineEditorProps {
  readonly assets?: readonly VisibleAsset[]
  readonly onImportFiles?: (files: readonly File[]) => Promise<readonly VisibleAsset[]>
  readonly active?: boolean
}

type PipelineKeyframeState = {
  readonly id: string
  readonly nodeId: string
  readonly parameterId: string
  readonly timeMs: number
  readonly value?: ContractPipelineValue
  readonly interpolation?: 'step' | 'linear' | 'bezier' | 'spline'
  readonly easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
  readonly handles?: { readonly in: [number, number]; readonly out: [number, number] }
}

type PipelineSnapshotState = { readonly id: string; readonly label: string; readonly timeMs: number; readonly hash: string; readonly thumbnailPath?: string; readonly selectedNodeId?: string }

interface PipelineDraft {
  readonly version: 1
  readonly graph: DemoGraph
  readonly viewport: { readonly x: number; readonly y: number; readonly zoom: number }
  readonly timeline: { readonly mode: 'animation' | 'snapshots'; readonly durationMs: number; readonly currentTimeMs: number; readonly loop: boolean; readonly keyframes: readonly PipelineKeyframeState[]; readonly snapshots: readonly PipelineSnapshotState[]; readonly timelineVisible?: boolean; readonly timelineHeight?: number; readonly render?: { readonly fps: number; readonly rangeStartMs: number; readonly rangeEndMs: number; readonly selectedFrameTimesMs: readonly number[] } }
}

interface PipelineDraftLoad {
  readonly draft?: PipelineDraft
  readonly invalid: boolean
}

const pipelineDraftStorageKey = 'mosaico-pipeline-draft-v2'
const customNodesStorageKey = 'mosaico-custom-nodes-v1'
const pipelineAssetSurfaceCache = new Map<string, PipelineAssetSource>()

function loadCustomNodes(): CustomNodeDefinition[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const value = JSON.parse(localStorage.getItem(customNodesStorageKey) ?? '[]') as unknown
    return Array.isArray(value) ? value.flatMap((item) => { const parsed = customNodeDefinitionSchema.safeParse(item); return parsed.success ? [parsed.data] : [] }) : []
  } catch { return [] }
}

function loadPipelineDraft(): PipelineDraftLoad {
  if (typeof localStorage === 'undefined') return { invalid: false }
  try {
    const raw = localStorage.getItem(pipelineDraftStorageKey)
    if (!raw) return { invalid: false }
    const value = JSON.parse(raw) as Partial<PipelineDraft>
    if (value.version !== 1 || !value.graph || !Array.isArray(value.graph.nodes) || !Array.isArray(value.graph.edges)) return { invalid: true }
    const nodes = value.graph.nodes.filter((node): node is DemoNode => !!node && typeof node === 'object' && isDemoNodeKind(String((node as DemoNode).kind)) && typeof (node as DemoNode).id === 'string' && Number.isFinite((node as DemoNode).x) && Number.isFinite((node as DemoNode).y) && Array.isArray((node as DemoNode).inputs) && Array.isArray((node as DemoNode).outputs) && Array.isArray((node as DemoNode).parameters))
    const edges = value.graph.edges.filter((edge): edge is DemoEdge => !!edge && typeof edge === 'object' && typeof (edge as DemoEdge).sourceNodeId === 'string' && typeof (edge as DemoEdge).sourcePortId === 'string' && typeof (edge as DemoEdge).targetNodeId === 'string' && typeof (edge as DemoEdge).targetPortId === 'string')
    if (nodes.length !== value.graph.nodes.length || edges.length !== value.graph.edges.length || new Set(nodes.map((node) => node.id)).size !== nodes.length) return { invalid: true }
    const timeline = value.timeline
    const viewport = value.viewport
    if (!timeline || !Array.isArray(timeline.keyframes) || !Array.isArray(timeline.snapshots) || !viewport || !Number.isFinite(viewport.x) || !Number.isFinite(viewport.y) || !Number.isFinite(viewport.zoom) || viewport.zoom < 0.12 || viewport.zoom > 3.5) return { invalid: true }
    const durationMs = Number(timeline.durationMs); const currentTimeMs = Number(timeline.currentTimeMs)
    if (!Number.isInteger(durationMs) || durationMs < 1 || !Number.isInteger(currentTimeMs) || currentTimeMs < 0 || currentTimeMs > durationMs) return { invalid: true }
    const render = timeline.render && typeof timeline.render === 'object' ? { fps: Math.max(1, Math.min(60, Number(timeline.render.fps) || 12)), rangeStartMs: Math.max(0, Math.min(durationMs, Number(timeline.render.rangeStartMs) || 0)), rangeEndMs: Math.max(0, Math.min(durationMs, Number(timeline.render.rangeEndMs) || durationMs)), selectedFrameTimesMs: Array.isArray(timeline.render.selectedFrameTimesMs) ? timeline.render.selectedFrameTimesMs.filter((time): time is number => Number.isInteger(time) && time >= 0 && time <= durationMs) : [] } : undefined
    const normalizedNodes = nodes.map(normalizeDemoNode)
    const normalizedEdges = edges.map((edge) => normalizeDemoEdge(edge, normalizedNodes))
    return { draft: { version: 1, graph: { nodes: normalizedNodes, edges: normalizedEdges, selectedNodeId: value.graph.selectedNodeId }, viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom }, timeline: { mode: timeline.mode === 'snapshots' ? 'snapshots' : 'animation', durationMs, currentTimeMs, loop: timeline.loop !== false, keyframes: timeline.keyframes as PipelineKeyframeState[], snapshots: timeline.snapshots as PipelineDraft['timeline']['snapshots'], timelineVisible: timeline.timelineVisible !== false, timelineHeight: Math.max(180, Math.min(520, Number(timeline.timelineHeight) || 220)), render } }, invalid: false }
  } catch {
    return { invalid: true }
  }
}

type TimelineTrack = { readonly id: string; readonly nodeId: string; readonly parameterId: string; readonly nodeTitle: string; readonly parameterLabel: string }

export function PipelineTimelineAdvanced({ tracks, keyframes, durationMs, currentTimeMs, playing, loop, timelineZoom, selectedTrack, onPlayPause, onStop, onLoop, onDuration, onZoom, onTime, onSelectTrack, onAdd, onMove, onRemove, onDuplicate, onCurve }: {
  tracks: readonly TimelineTrack[]
  keyframes: readonly PipelineKeyframeState[]
  durationMs: number
  currentTimeMs: number
  playing: boolean
  loop: boolean
  timelineZoom: number
  selectedTrack?: string
  onPlayPause: () => void
  onStop: () => void
  onLoop: () => void
  onDuration: (value: number) => void
  onZoom: (value: number) => void
  onTime: (value: number) => void
  onSelectTrack: (value: string) => void
  onAdd: (trackId: string) => void
  onMove: (id: string, timeMs: number) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onCurve: (id: string, patch: Partial<Pick<PipelineKeyframeState, 'interpolation' | 'easing' | 'handles'>>) => void
}) {
  const rulerSteps = Math.max(2, Math.min(12, Math.round(durationMs / 500)))
  return <section className="pipeline-timeline-advanced" aria-label="Timeline avanzado de Pipelines">
    <div className="pipeline-advanced-toolbar"><strong>Timeline VFX</strong><div><button type="button" onClick={onPlayPause}>{playing ? 'Pause' : 'Play'}</button><button type="button" onClick={onStop}>Stop</button><button type="button" className={loop ? 'active' : ''} onClick={onLoop}>Loop</button><label>Duración <input aria-label="Duración del timeline" type="number" min="100" max="86400000" step="100" value={durationMs} onChange={(event) => onDuration(Math.max(100, Math.min(86_400_000, Number(event.target.value) || 100)))} /></label><label>Zoom <input aria-label="Zoom temporal" type="range" min="0.25" max="4" step="0.25" value={timelineZoom} onChange={(event) => onZoom(Number(event.target.value))} /></label></div></div>
    <div className="pipeline-advanced-ruler"><span>0.00s</span><div className="pipeline-ruler-scale" style={{ width: `${timelineZoom * 100}%` }}>{Array.from({ length: rulerSteps + 1 }, (_, index) => <span key={index} style={{ left: `${(index / rulerSteps) * 100}%` }}>{((durationMs * index / rulerSteps) / 1000).toFixed(2)}s</span>)}</div></div>
    <div className="pipeline-track-scroll"><div className="pipeline-track-canvas" style={{ width: `${timelineZoom * 100}%` }}>
      <div className="pipeline-playhead" style={{ left: `${(currentTimeMs / Math.max(1, durationMs)) * 100}%` }} aria-hidden="true" />
      {tracks.map((track) => {
        const trackKeyframes = keyframes.filter((item) => item.nodeId === track.nodeId && item.parameterId === track.parameterId)
        const selected = trackKeyframes.find((item) => item.id === selectedTrack)
        return <div className={'pipeline-track-row ' + (selectedTrack === track.id ? 'selected' : '')} key={track.id} onClick={() => onSelectTrack(track.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = event.dataTransfer.getData('application/x-mosaico-keyframe'); if (!id) return; const rect = event.currentTarget.getBoundingClientRect(); onMove(id, ((event.clientX - rect.left) / Math.max(1, rect.width)) * durationMs) }}>
          <div className="pipeline-track-label"><strong>{track.nodeTitle}</strong><span>{track.parameterLabel}</span><button type="button" onClick={(event) => { event.stopPropagation(); onAdd(track.id) }}>+</button></div>
          <div className="pipeline-track-lane">{trackKeyframes.map((keyframe) => <button type="button" draggable key={keyframe.id} className="pipeline-keyframe" style={{ left: `${(keyframe.timeMs / Math.max(1, durationMs)) * 100}%` }} title={`${keyframe.interpolation ?? 'linear'} · ${keyframe.easing ?? 'linear'}`} onDragStart={(event) => event.dataTransfer.setData('application/x-mosaico-keyframe', keyframe.id)} onClick={(event) => { event.stopPropagation(); onTime(keyframe.timeMs); onSelectTrack(track.id) }} onDoubleClick={(event) => { event.stopPropagation(); onDuplicate(keyframe.id) }} onContextMenu={(event) => { event.preventDefault(); onRemove(keyframe.id) }} />)}{selected && <div className="pipeline-curve-controls" onClick={(event) => event.stopPropagation()}><select aria-label={`Interpolación ${track.parameterLabel}`} value={selected.interpolation ?? 'linear'} onChange={(event) => onCurve(selected.id, { interpolation: event.target.value as PipelineKeyframeState['interpolation'] })}><option value="step">Step</option><option value="linear">Linear</option><option value="bezier">Bezier</option><option value="spline">Spline</option></select><select aria-label={`Easing ${track.parameterLabel}`} value={selected.easing ?? 'linear'} onChange={(event) => onCurve(selected.id, { easing: event.target.value as PipelineKeyframeState['easing'] })}><option value="linear">Linear</option><option value="ease-in">Ease in</option><option value="ease-out">Ease out</option><option value="ease-in-out">Ease in/out</option></select></div>}</div>
        </div>
      })}
      {!tracks.length && <p className="pipeline-empty">Añade un nodo con parámetros numéricos para crear pistas.</p>}
    </div></div>
    <div className="pipeline-advanced-scrubber"><input aria-label="Scrubber temporal avanzado" type="range" min="0" max={durationMs} step="10" value={currentTimeMs} onChange={(event) => onTime(Number(event.target.value))} /><output>{(currentTimeMs / 1000).toFixed(2)}s / {(durationMs / 1000).toFixed(2)}s</output></div>
  </section>
}

export function PipelineTimelineFixed({ mode, tracks, keyframes, snapshots, durationMs, currentTimeMs, playing, loop, timelineZoom, selectedTrack, selectedKeyframe, hasRealPreview, previewSurface, onModeChange, onPlayPause, onStop, onLoop, onDuration, onZoom, onTime, onSelectTrack, onSelectKeyframe, onAdd, onMove, onRemove, onDuplicate, onCurve, onSnapshot, onRestoreSnapshot }: {
  mode: 'animation' | 'snapshots'
  tracks: readonly TimelineTrack[]
  keyframes: readonly PipelineKeyframeState[]
  snapshots: readonly PipelineSnapshotState[]
  durationMs: number
  currentTimeMs: number
  playing: boolean
  loop: boolean
  timelineZoom: number
  selectedTrack?: string
  selectedKeyframe?: string
  hasRealPreview: boolean
  previewSurface?: PipelineSurface
  onModeChange: (mode: 'animation' | 'snapshots') => void
  onPlayPause: () => void
  onStop: () => void
  onLoop: () => void
  onDuration: (value: number) => void
  onZoom: (value: number) => void
  onTime: (value: number) => void
  onSelectTrack: (value: string) => void
  onSelectKeyframe: (value?: string) => void
  onAdd: (trackId: string) => void
  onMove: (id: string, timeMs: number) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onCurve: (id: string, patch: Partial<Pick<PipelineKeyframeState, 'interpolation' | 'easing' | 'handles'>>) => void
  onSnapshot: () => void
  onRestoreSnapshot: (snapshot: PipelineSnapshotState) => void
}) {
  const steps = Math.max(2, Math.min(16, Math.round(durationMs / 500)))
  return <section className="pipeline-timeline-fixed" aria-label="Pipeline timeline">
    <div className="pipeline-fixed-toolbar"><strong>Timeline VFX</strong><div className="pipeline-fixed-actions"><button type="button" aria-label={playing ? 'Pause timeline' : 'Play timeline'} title={playing ? 'Pause' : 'Play'} onClick={onPlayPause}>{playing ? <Pause size={14} /> : <Play size={14} />}</button><button type="button" aria-label="Stop timeline" title="Stop" onClick={onStop}><Square size={13} /></button><button type="button" aria-label="Loop timeline" title="Loop" className={loop ? 'active' : ''} onClick={onLoop}><Repeat2 size={14} /></button><button type="button" className={mode === 'animation' ? 'active' : ''} onClick={() => onModeChange('animation')}>Animation</button><button type="button" className={mode === 'snapshots' ? 'active' : ''} onClick={() => onModeChange('snapshots')}>Snapshots</button><label>Duration <input aria-label="Timeline duration" type="number" min="100" max="86400000" step="100" value={durationMs} onChange={(event) => onDuration(Math.max(100, Math.min(86_400_000, Number(event.target.value) || 100)))} /></label><label>Zoom <input aria-label="Timeline zoom" type="range" min="0.25" max="4" step="0.25" value={timelineZoom} onChange={(event) => onZoom(Number(event.target.value))} /></label></div></div>
    {mode === 'animation' ? <>
      <div className="pipeline-fixed-ruler"><div className="pipeline-fixed-label">Tracks</div><div className="pipeline-fixed-lane" style={{ width: `${timelineZoom * 100}%` }}>{Array.from({ length: steps + 1 }, (_, index) => <span key={index} style={{ left: `${(index / steps) * 100}%` }}>{(durationMs * index / steps / 1000).toFixed(2)}s</span>)}</div></div>
      <div className="pipeline-fixed-scroll"><div className="pipeline-fixed-canvas" style={{ width: `${timelineZoom * 100}%` }}><div className="pipeline-fixed-playhead" style={{ left: `${(currentTimeMs / Math.max(1, durationMs)) * 100}%` }} aria-hidden="true" />{tracks.map((track) => { const items = keyframes.filter((keyframe) => keyframe.nodeId === track.nodeId && keyframe.parameterId === track.parameterId); const selected = items.find((keyframe) => keyframe.id === selectedKeyframe); return <div className={'pipeline-fixed-row ' + (selectedTrack === track.id ? 'selected' : '')} key={track.id} onClick={() => onSelectTrack(track.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = event.dataTransfer.getData('application/x-mosaico-keyframe'); const rect = event.currentTarget.querySelector<HTMLElement>('.pipeline-fixed-lane')?.getBoundingClientRect(); if (id && rect) onMove(id, ((event.clientX - rect.left) / Math.max(1, rect.width)) * durationMs) }}><div className="pipeline-fixed-label"><strong>{track.nodeTitle}</strong><span>{track.parameterLabel}</span><button type="button" aria-label={`Add keyframe to ${track.parameterLabel}`} onClick={(event) => { event.stopPropagation(); onAdd(track.id) }}><KeyRound size={12} /></button></div><div className="pipeline-fixed-lane">{items.map((keyframe) => <button type="button" draggable key={keyframe.id} className={'pipeline-fixed-keyframe ' + (selectedKeyframe === keyframe.id ? 'selected' : '')} style={{ left: `${(keyframe.timeMs / Math.max(1, durationMs)) * 100}%` }} title={`${keyframe.timeMs}ms`} onDragStart={(event) => event.dataTransfer.setData('application/x-mosaico-keyframe', keyframe.id)} onClick={(event) => { event.stopPropagation(); onTime(keyframe.timeMs); onSelectTrack(track.id); onSelectKeyframe(keyframe.id) }} onDoubleClick={(event) => { event.stopPropagation(); onDuplicate(keyframe.id) }} onContextMenu={(event) => { event.preventDefault(); onRemove(keyframe.id) }} onKeyDown={(event) => { if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); onRemove(keyframe.id) } }} />)}{selected && <div className="pipeline-fixed-curve"><select aria-label={`Interpolation ${track.parameterLabel}`} value={selected.interpolation ?? 'linear'} onChange={(event) => onCurve(selected.id, { interpolation: event.target.value as PipelineKeyframeState['interpolation'] })}><option value="step">Step</option><option value="linear">Linear</option><option value="bezier">Bezier</option><option value="spline">Spline</option></select><select aria-label={`Easing ${track.parameterLabel}`} value={selected.easing ?? 'linear'} onChange={(event) => onCurve(selected.id, { easing: event.target.value as PipelineKeyframeState['easing'] })}><option value="linear">Linear</option><option value="ease-in">Ease in</option><option value="ease-out">Ease out</option><option value="ease-in-out">Ease in/out</option></select><button type="button" aria-label="Delete keyframe" title="Delete keyframe" onClick={() => onRemove(selected.id)}><Trash2 size={12} /></button></div>}</div></div> })}{!tracks.length && <p className="pipeline-empty">Add a node with numeric parameters to create tracks.</p>}</div></div>
      <div className="pipeline-fixed-scrubber"><input aria-label="Timeline scrubber" type="range" min="0" max={durationMs} step="10" value={currentTimeMs} onChange={(event) => onTime(Number(event.target.value))} /><output>{(currentTimeMs / 1000).toFixed(2)}s / {(durationMs / 1000).toFixed(2)}s</output></div>
    </> : <div className="pipeline-fixed-snapshots"><button type="button" disabled={!hasRealPreview || !previewSurface} onClick={onSnapshot}>Capture real result</button>{snapshots.map((snapshot) => <button type="button" data-user-content="true" key={snapshot.id} onClick={() => onRestoreSnapshot(snapshot)}>{snapshot.label} · {(snapshot.timeMs / 1000).toFixed(2)}s</button>)}{!snapshots.length && <span>{hasRealPreview ? 'No snapshots' : 'No real result to capture.'}</span>}</div>}
  </section>
}

function PipelineFrameTimeline({ mode, frames, keyframes, snapshots, durationMs, currentTimeMs, playing, loop, fps, rangeStartMs, rangeEndMs, timelineHeight, hasRealPreview, selectedKeyframe, onModeChange, onPlayPause, onStop, onLoop, onFps, onRange, onTime, onToggleFrame, onSelectAll, onClearFrames, onAddKeyframe, onSelectKeyframe, onRemoveKeyframe, onSnapshot, onRestoreSnapshot }: {
  mode: 'animation' | 'snapshots'
  frames: readonly GeneratedPipelineFrame[]
  keyframes: readonly PipelineKeyframeState[]
  snapshots: readonly PipelineSnapshotState[]
  durationMs: number
  currentTimeMs: number
  playing: boolean
  loop: boolean
  fps: number
  rangeStartMs: number
  rangeEndMs: number
  timelineHeight: number
  hasRealPreview: boolean
  selectedKeyframe?: string
  onModeChange: (mode: 'animation' | 'snapshots') => void
  onPlayPause: () => void
  onStop: () => void
  onLoop: () => void
  onFps: (value: number) => void
  onRange: (start: number, end: number) => void
  onTime: (value: number) => void
  onToggleFrame: (timeMs: number) => void
  onSelectAll: () => void
  onClearFrames: () => void
  onAddKeyframe: () => void
  onSelectKeyframe: (id?: string) => void
  onRemoveKeyframe: (id: string) => void
  onSnapshot: () => void
  onRestoreSnapshot: (snapshot: PipelineSnapshotState) => void
}) {
  const selectedCount = frames.filter((frame) => frame.selected).length
  const currentFrame = frames.reduce<GeneratedPipelineFrame | undefined>((found, frame) => frame.timeMs <= currentTimeMs ? frame : found, frames[0])
  const duration = Math.max(1, rangeEndMs - rangeStartMs)
  return <section className="pipeline-frame-timeline" aria-label="Pipeline frame timeline" style={{ height: `${timelineHeight}px` }}>
    <div className="pipeline-frame-toolbar">
      <strong>Frames</strong>
      <div className="pipeline-frame-actions">
        <button type="button" aria-label={playing ? 'Pause timeline' : 'Play timeline'} title={playing ? 'Pause' : 'Play'} onClick={onPlayPause}>{playing ? <Pause size={14} /> : <Play size={14} />}</button>
        <button type="button" aria-label="Stop timeline" title="Stop" onClick={onStop}><Square size={13} /></button>
        <button type="button" aria-label="Loop timeline" title="Loop" className={loop ? 'active' : ''} onClick={onLoop}><Repeat2 size={14} /></button>
        <button type="button" aria-label="Add keyframe" title="Add keyframe" onClick={onAddKeyframe}><KeyRound size={13} /></button>
        <button type="button" aria-label="Select all rendered frames" title="Select all frames" onClick={onSelectAll}><CheckSquare size={13} /></button>
        <button type="button" aria-label="Clear rendered frame selection" title="Clear frame selection" onClick={onClearFrames}><X size={13} /></button>
        <button type="button" className={mode === 'animation' ? 'active' : ''} onClick={() => onModeChange('animation')}>Frames</button>
        <button type="button" className={mode === 'snapshots' ? 'active' : ''} onClick={() => onModeChange('snapshots')}>Snapshots</button>
        <label>FPS <input aria-label="Render FPS" type="number" min="1" max="60" step="1" value={fps} onChange={(event) => onFps(Math.max(1, Math.min(60, Number(event.target.value) || 12)))} /></label>
        <label>Range <input aria-label="Render range start" type="number" min="0" max={durationMs} step="10" value={rangeStartMs} onChange={(event) => onRange(Math.max(0, Math.min(rangeEndMs, Number(event.target.value) || 0)), rangeEndMs)} />–<input aria-label="Render range end" type="number" min="0" max={durationMs} step="10" value={rangeEndMs} onChange={(event) => onRange(rangeStartMs, Math.max(rangeStartMs, Math.min(durationMs, Number(event.target.value) || durationMs)))} /></label>
      </div>
    </div>
    {mode === 'animation' ? <>
      <div className="pipeline-frame-ruler"><span>0.00s</span><div>{Array.from({ length: 9 }, (_, index) => <span key={index} style={{ left: `${index * 12.5}%` }}>{((rangeStartMs + duration * index / 8) / 1000).toFixed(2)}s</span>)}</div></div>
      <div className="pipeline-frame-scroll"><div className="pipeline-frame-strip">{keyframes.map((keyframe) => <button type="button" key={keyframe.id} className={'pipeline-frame-keyframe-marker ' + (selectedKeyframe === keyframe.id ? 'selected' : '')} style={{ left: `${((keyframe.timeMs - rangeStartMs) / duration) * 100}%` }} aria-label={`Keyframe ${keyframe.timeMs} ms`} title={`${keyframe.parameterId} · ${keyframe.timeMs} ms`} onClick={() => { onTime(keyframe.timeMs); onSelectKeyframe(keyframe.id) }} onContextMenu={(event) => { event.preventDefault(); onRemoveKeyframe(keyframe.id) }} />)}{frames.map((frame) => <div className={'pipeline-generated-frame ' + (frame.timeMs === currentFrame?.timeMs ? 'active' : '')} key={frame.id}><button type="button" className="pipeline-frame-card" onClick={() => onTime(frame.timeMs)} title={`${(frame.timeMs / 1000).toFixed(3)}s · ${frame.durationMs}ms`}><PipelineSurfacePreview surface={frame.surface} className="pipeline-frame-thumb" ariaLabel={`Frame ${(frame.timeMs / 1000).toFixed(3)} segundos`} /><span>{(frame.timeMs / 1000).toFixed(2)}s</span></button><label className="pipeline-frame-check"><input type="checkbox" checked={frame.selected} onChange={() => onToggleFrame(frame.timeMs)} aria-label={`Usar frame ${(frame.timeMs / 1000).toFixed(3)} segundos`} /><Check size={11} /></label></div>)}</div></div>
      <div className="pipeline-frame-footer"><span>{selectedCount}/{frames.length} frames seleccionados</span><input aria-label="Timeline scrubber" type="range" min={rangeStartMs} max={rangeEndMs} step="1" value={currentTimeMs} onChange={(event) => onTime(Number(event.target.value))} /><output>{(currentTimeMs / 1000).toFixed(3)}s</output></div>
    </> : <div className="pipeline-frame-snapshots"><button type="button" disabled={!hasRealPreview} aria-label="Capture snapshot" title="Capture snapshot" onClick={onSnapshot}><Download size={13} /></button>{snapshots.map((snapshot) => <button type="button" data-user-content="true" key={snapshot.id} onClick={() => onRestoreSnapshot(snapshot)}>{snapshot.label} · {(snapshot.timeMs / 1000).toFixed(2)}s</button>)}{!snapshots.length && <span>No snapshots</span>}</div>}
  </section>
}

export function PipelineEditor({ assets = [], onImportFiles = async () => [], active = true }: PipelineEditorProps) {
  const [draftState] = useState<PipelineDraftLoad>(loadPipelineDraft)
  const draft = draftState.draft
  const initialGraph = draft?.graph ?? { nodes: [], edges: [] }
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initialGraph.nodes.map((node) => createFlowNode(node, node.id === initialGraph.selectedNodeId)))
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(initialGraph.edges.map(createFlowEdge))
  const [search, setSearch] = useState('')
  const [familyFilter, setFamilyFilter] = useState('all')
  const [assetSearch, setAssetSearch] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [palettePosition, setPalettePosition] = useState({ x: 24, y: 24 })
  const [nodeContextMenu, setNodeContextMenu] = useState<{ nodeId: string; x: number; y: number }>()
  const [openMenu, setOpenMenu] = useState<string>()
  const [customDefinitions, setCustomDefinitions] = useState<readonly CustomNodeDefinition[]>(loadCustomNodes)
  const [customDialogOpen, setCustomDialogOpen] = useState(false)
  const [customName, setCustomName] = useState('Custom Surface')
  const [customDsl, setCustomDsl] = useState('input source: Surface\noutput result: Surface\n\nresult = invert(source)')
  const [customOperation, setCustomOperation] = useState<'invert' | 'flip' | 'rotate' | 'zoom' | 'color' | 'gradient'>('invert')
  const [customDiagnostics, setCustomDiagnostics] = useState<readonly string[]>([])
  const [viewport, setViewport] = useState(draft?.viewport ?? { x: 0, y: 0, zoom: 1 })
  const [zoom, setZoom] = useState(viewport.zoom)
  const [status, setStatus] = useState(draftState.invalid ? 'Draft local inválido descartado; se conserva IndexedDB.' : draft ? 'Borrador local restaurado. Los resultados vacíos son transparentes.' : 'Doble clic o Space abre la palette. Los resultados vacíos son transparentes.')
  const [assetSurfaces, setAssetSurfaces] = useState<ReadonlyMap<string, PipelineAssetSource>>(new Map())
  const [timelineMode, setTimelineMode] = useState<'animation' | 'snapshots'>(draft?.timeline.mode ?? 'animation')
  const [timelineVisible, setTimelineVisible] = useState(draft?.timeline.timelineVisible !== false)
  const [timelineHeight, setTimelineHeight] = useState(draft?.timeline.timelineHeight ?? 220)
  const [durationMs, setDurationMs] = useState(draft?.timeline.durationMs ?? 5000)
  const [currentTimeMs, setCurrentTimeMs] = useState(draft?.timeline.currentTimeMs ?? 0)
  const [loop, setLoop] = useState(draft?.timeline.loop ?? true)
  const [renderFps, setRenderFps] = useState(draft?.timeline.render?.fps ?? 12)
  const [renderStartMs, setRenderStartMs] = useState(draft?.timeline.render?.rangeStartMs ?? 0)
  const [renderEndMs, setRenderEndMs] = useState(draft?.timeline.render?.rangeEndMs ?? (draft?.timeline.durationMs ?? 5000))
  const [selectedFrameTimesMs, setSelectedFrameTimesMs] = useState<readonly number[]>(draft?.timeline.render?.selectedFrameTimesMs ?? [])
  const [timelineZoom, setTimelineZoom] = useState(1)
  const [selectedTrack, setSelectedTrack] = useState<string>()
  const [selectedKeyframe, setSelectedKeyframe] = useState<string>()
  const [playing, setPlaying] = useState(false)
  const [keyframes, setKeyframes] = useState<readonly PipelineKeyframeState[]>(draft?.timeline.keyframes ?? [])
  const [snapshots, setSnapshots] = useState<readonly PipelineSnapshotState[]>(draft?.timeline.snapshots ?? [])
  const [snapshotThumbnails, setSnapshotThumbnails] = useState<ReadonlyMap<string, Blob>>(new Map())
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [transferName, setTransferName] = useState('Pipeline result')
  const [transferMode, setTransferMode] = useState<'current' | 'selected'>('selected')
  const [exportName, setExportName] = useState('Pipeline result')
  const [exportFormat, setExportFormat] = useState<PipelineExportFormat>('png-single')
  const previousTimeMsRef = useRef(currentTimeMs)
  const actionsRef = useRef<FlowActions | null>(null)
  const projectFileRef = useRef<HTMLInputElement>(null)
  const assetFileRef = useRef<HTMLInputElement>(null)
  const customNodeFileRef = useRef<HTMLInputElement>(null)
  const paletteDragRef = useRef<{ offsetX: number; offsetY: number } | undefined>(undefined)
  const pendingNodePositionRef = useRef<{ x: number; y: number } | undefined>(undefined)
  const canvasViewportRef = useRef<HTMLDivElement>(null)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const keyframesRef = useRef(keyframes)
  const connectionRef = useRef<{ sourceNodeId: string; sourcePortId: string } | null>(null)
  nodesRef.current = nodes
  edgesRef.current = edges
  keyframesRef.current = keyframes

  useEffect(() => {
    if (!paletteOpen && !nodeContextMenu) return
    const close = (event: PointerEvent) => {
      const target = event.target as HTMLElement
      if (paletteOpen && !target.closest('.pipeline-node-palette')) setPaletteOpen(false)
      if (nodeContextMenu && !target.closest('.pipeline-node-context-menu')) setNodeContextMenu(undefined)
    }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setPaletteOpen(false); setNodeContextMenu(undefined) } }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key) }
  }, [nodeContextMenu, paletteOpen])

  const openPaletteAt = useCallback((position?: { x: number; y: number }, screen?: { x: number; y: number }) => {
    const rect = canvasViewportRef.current?.getBoundingClientRect()
    const fallbackScreen = rect ? { x: rect.width / 2 - 180, y: rect.height / 2 - 120 } : { x: 24, y: 24 }
    pendingNodePositionRef.current = position ?? (rect ? { x: (rect.width / 2 - viewport.x) / viewport.zoom, y: (rect.height / 2 - viewport.y) / viewport.zoom } : undefined)
    setPalettePosition(screen ?? fallbackScreen)
    setPaletteOpen(true)
  }, [viewport.x, viewport.y, viewport.zoom])

  const historyRef = useRef<{ undo: { nodes: FlowNode[]; edges: FlowEdge[]; keyframes: readonly PipelineKeyframeState[] }[]; redo: { nodes: FlowNode[]; edges: FlowEdge[]; keyframes: readonly PipelineKeyframeState[] }[] }>({ undo: [], redo: [] })
  const remember = useCallback(() => {
    historyRef.current.undo.push({ nodes: nodesRef.current, edges: edgesRef.current, keyframes: keyframesRef.current }); historyRef.current.redo = []; if (historyRef.current.undo.length > 50) historyRef.current.undo.shift()
  }, [])
  const restoreHistory = useCallback((direction: 'undo' | 'redo') => {
    const source = historyRef.current[direction].pop(); if (!source) { setStatus(direction === 'undo' ? 'No hay cambios para deshacer.' : 'No hay cambios para rehacer.'); return }
    const opposite = direction === 'undo' ? historyRef.current.redo : historyRef.current.undo
    opposite.push({ nodes: nodesRef.current, edges: edgesRef.current, keyframes: keyframesRef.current }); setNodes(source.nodes); setEdges(source.edges); setKeyframes(source.keyframes); setStatus(direction === 'undo' ? 'Cambio deshecho.' : 'Cambio rehecho.')
  }, [setEdges, setKeyframes, setNodes])

  useEffect(() => {
    previousTimeMsRef.current = currentTimeMs
  }, [currentTimeMs])

  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<{ assetId?: string; target?: string }>).detail
      if (detail.target !== 'Pipelines' || !detail.assetId || nodesRef.current.some((node) => node.data.demo.kind === 'asset' && node.data.demo.assetId === detail.assetId)) return
      const demo = createDemoNode('asset', `asset-${crypto.randomUUID()}`, { x: 180 + nodesRef.current.length * 28, y: 120 + nodesRef.current.length * 20 })
      remember()
      setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), createFlowNode({ ...demo, assetId: detail.assetId }, true)])
      setStatus('Asset añadido al canvas.')
    }
    window.addEventListener('mosaico:asset-open', receive)
    return () => window.removeEventListener('mosaico:asset-open', receive)
  }, [remember, setNodes])

  // Ctrl/Cmd+D: duplica los nodos seleccionados con desplazamiento y re-id.
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'd') return
      if (event.repeat) return
      const target = event.target as HTMLElement
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return
      const selectedNodes = nodes.filter((node) => node.selected)
      if (!selectedNodes.length) return
      event.preventDefault(); remember()
      setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), ...selectedNodes.map((node) => ({
        id: crypto.randomUUID(),
        type: 'mosaico' as const,
        position: { x: node.position.x + 48, y: node.position.y + 48 },
        selected: true,
        data: { demo: { ...node.data.demo, id: crypto.randomUUID() } },
      }))])
      setStatus(`${selectedNodes.length} nodo(s) duplicado(s).`)
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [nodes, remember])

  const usedAssetKey = useMemo(() => [...new Set(nodes.flatMap((node) => node.data.demo.assetId ? [node.data.demo.assetId] : []))].sort().join('|'), [nodes])
  const usedAssetIds = useMemo(() => new Set(usedAssetKey ? usedAssetKey.split('|') : []), [usedAssetKey])

  useEffect(() => {
    if (!active) return
    let mounted = true
    Promise.allSettled(assets.filter((asset) => usedAssetIds.has(asset.record.id)).map(async (asset) => {
      const cacheKey = `${asset.record.id}:${asset.record.sha256}`
      const cached = pipelineAssetSurfaceCache.get(cacheKey)
      if (cached) return [asset.record.id, cached] as const
      const decoded = await decodeImageSource(asset.original)
      pipelineAssetSurfaceCache.set(cacheKey, decoded)
      return [asset.record.id, decoded] as const
    })).then((results) => {
      if (!mounted) return
      const entries = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
      setAssetSurfaces(new Map(entries))
      if (results.some((result) => result.status === 'rejected')) setStatus('Algunos Assets no pudieron decodificarse para el grafo.')
    })
    return () => { mounted = false }
  }, [active, assets, usedAssetIds])

  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    const draftValue: PipelineDraft = { version: 1, graph: createGraphFromFlow(nodes, edges), viewport, timeline: { mode: timelineMode, durationMs, currentTimeMs, loop, keyframes, snapshots, timelineVisible, timelineHeight, render: { fps: renderFps, rangeStartMs: renderStartMs, rangeEndMs: renderEndMs, selectedFrameTimesMs } } }
    const saveDraft = () => { try { localStorage.setItem(pipelineDraftStorageKey, JSON.stringify(draftValue)) } catch { /* local draft is best effort */ } }
    const handle = window.setTimeout(saveDraft, 250)
    return () => window.clearTimeout(handle)
  }, [currentTimeMs, durationMs, edges, keyframes, loop, nodes, renderEndMs, renderFps, renderStartMs, selectedFrameTimesMs, snapshots, timelineHeight, timelineMode, timelineVisible, viewport])

  useEffect(() => {
    try { localStorage.setItem(customNodesStorageKey, JSON.stringify(customDefinitions)) } catch { setStatus('Custom nodes could not be persisted.') }
  }, [customDefinitions])

  const frameSelectionInitializedRef = useRef(false)
  const previousRenderedTimesRef = useRef<readonly number[]>([])
  const evaluationGraphKey = useMemo(() => {
    const graph = createGraphFromFlow(nodes, edges)
  return JSON.stringify({ nodes: graph.nodes.map(({ x: _x, y: _y, ...node }) => node), edges: graph.edges })
  }, [edges, nodes])
  const evaluationGraph = useMemo(() => createGraphFromFlow(nodes, edges), [evaluationGraphKey])
  const [renderedFrameSurfaces, setRenderedFrameSurfaces] = useState<readonly GeneratedPipelineFrame[]>([])
  useEffect(() => {
    if (!active || !timelineVisible) return
    const graph = evaluationGraph
    const times = samplePipelineTimes({ durationMs, fps: renderFps, rangeStartMs: renderStartMs, rangeEndMs: renderEndMs }, keyframes)
    const selected = new Set(selectedFrameTimesMs.length ? selectedFrameTimesMs : times)
    const defaultDuration = Math.max(10, Math.round(1000 / Math.max(1, Math.min(60, renderFps))))
    const frames: GeneratedPipelineFrame[] = []
    let index = 0; let cancelled = false; let timer = 0
    const renderChunk = () => {
      if (cancelled) return
      const started = performance.now()
      while (index < times.length && performance.now() - started < 8) {
        const timeMs = times[index]!; const nextTime = times[index + 1]
        frames.push(renderPipelineFrame(graph, assetSurfaces, keyframes, timeMs, Math.max(10, nextTime === undefined ? defaultDuration : nextTime - timeMs), selected.has(timeMs)))
        index += 1
      }
      setRenderedFrameSurfaces([...frames])
      if (index < times.length) timer = window.setTimeout(renderChunk, 0)
    }
    timer = window.setTimeout(renderChunk, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [active, assetSurfaces, durationMs, evaluationGraph, keyframes, renderEndMs, renderFps, renderStartMs, timelineVisible])
  const renderedFrames = useMemo(() => {
    const selected = new Set(selectedFrameTimesMs)
    return renderedFrameSurfaces.map((frame) => ({ ...frame, selected: frameSelectionInitializedRef.current ? selected.has(frame.timeMs) : frame.selected }))
  }, [renderedFrameSurfaces, selectedFrameTimesMs])
  useEffect(() => {
    if (!active || !timelineVisible || !renderedFrames.length) return
    const nextTimes = renderedFrames.map((frame) => frame.timeMs)
    if (!frameSelectionInitializedRef.current) { frameSelectionInitializedRef.current = true; previousRenderedTimesRef.current = nextTimes; setSelectedFrameTimesMs(nextTimes); return }
    const previousTimes = new Set(previousRenderedTimesRef.current)
    previousRenderedTimesRef.current = nextTimes
    setSelectedFrameTimesMs((current) => {
      const next = current.filter((time) => renderedFrames.some((frame) => frame.timeMs === time))
      for (const time of nextTimes) if (!previousTimes.has(time) && !next.includes(time)) next.push(time)
      next.sort((left, right) => left - right)
      return next.length === current.length && next.every((time, index) => time === current[index]) ? current : next
    })
  }, [active, renderedFrames, timelineVisible])

  useEffect(() => {
    if (!active || !playing) return
    const selectedFrames = renderedFrames.filter((frame) => frame.selected)
    if (!selectedFrames.length) { setPlaying(false); return }
    const currentIndex = Math.max(0, selectedFrames.findIndex((frame) => frame.timeMs >= currentTimeMs))
    const current = selectedFrames[currentIndex] ?? selectedFrames[0]!
    const next = selectedFrames[currentIndex + 1] ?? (loop ? selectedFrames[0] : undefined)
    const timer = window.setTimeout(() => { if (next) setCurrentTimeMs(next.timeMs); else { setCurrentTimeMs(current.timeMs); setPlaying(false) } }, current.durationMs)
    return () => window.clearTimeout(timer)
  }, [active, currentTimeMs, loop, playing, renderedFrames])

  useEffect(() => { if (!active) setPlaying(false) }, [active])

  useEffect(() => {
    setKeyframes((current) => {
      let changed = false
      const next = current.map((frame) => {
        if (frame.value !== undefined) return frame
        const node = nodes.find((item) => item.id === frame.nodeId)?.data.demo; const value = node?.parameters.find((parameter) => parameter.id === frame.parameterId)?.value
        if (typeof value !== 'number' && typeof value !== 'string') return frame
        changed = true; return { ...frame, value: typeof value === 'number' ? value : Number(value) }
      })
      return changed ? next : current
    })
  }, [nodes])

  const selectedNode = nodes.find((node) => node.selected)?.data.demo!
  const selectedEdge = edges.find((edge) => edge.selected)
  const evaluation = useMemo(() => evaluatePipeline(interpolateTimeline(evaluationGraph, keyframes, currentTimeMs), assetSurfaces, currentTimeMs, { previousTimeMs: previousTimeMsRef.current }), [assetSurfaces, currentTimeMs, evaluationGraph, keyframes])
  const backendStatuses = useMemo(() => detectPipelineBackends(), [])
  const webGpuStatus = backendStatuses.find((backend) => backend.kind === 'webgpu')
  const selectedSurface = surfaceOutput(selectedNode ? evaluation.outputs.get(selectedNode.id) : undefined)
  const pipelinePreview = nodes.some((node) => node.data.demo.kind === 'preview') ? evaluation.preview : undefined
  const previewSurface = selectedSurface ?? pipelinePreview
  const displayPreview = previewSurface ?? createSurface(1, 1)
  const hasRealPreview = !!previewSurface?.pixels.some((value, index) => index % 4 === 3 && value > 0)

  useEffect(() => {
    const surface = previewSurface; const pending = snapshots.filter((snapshot) => !snapshotThumbnails.has(snapshot.id))
    if (!active || !surface || !pending.length || typeof document === 'undefined') return
    let mounted = true
    const source = document.createElement('canvas'); source.width = surface.width; source.height = surface.height; source.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(surface.pixels), surface.width, surface.height), 0, 0)
    Promise.all(pending.map(async (snapshot) => {
      const scale = Math.min(1, 256 / Math.max(surface.width, surface.height)); const thumb = document.createElement('canvas'); thumb.width = Math.max(1, Math.round(surface.width * scale)); thumb.height = Math.max(1, Math.round(surface.height * scale)); const context = thumb.getContext('2d'); if (!context) return undefined; context.imageSmoothingEnabled = false; context.drawImage(source, 0, 0, thumb.width, thumb.height); const blob = await new Promise<Blob | null>((resolve) => thumb.toBlob(resolve, 'image/png')); return blob ? [snapshot.id, blob] as const : undefined
    })).then((entries) => { if (!mounted) return; const next = new Map(snapshotThumbnails); for (const entry of entries) if (entry) next.set(entry[0], entry[1]); setSnapshotThumbnails(next); setSnapshots((current) => current.map((snapshot) => next.has(snapshot.id) && !snapshot.thumbnailPath ? { ...snapshot, thumbnailPath: `snapshots/${snapshot.id}.png` } : snapshot)) }).catch(() => undefined)
    return () => { mounted = false }
  }, [active, previewSurface, snapshotThumbnails, snapshots])
  const hasSelection = nodes.some((node) => node.selected) || edges.some((edge) => edge.selected)
  const filteredLibrary = useMemo(() => {
    const unique = new Map([...library, ...extraLibrary, ...getPublishedNodeLibrary()].map((item) => [item.kind, item] as const))
    return [...unique.values()].map((item) => item.kind === 'flip' ? { ...item, label: 'Flip' } : item.kind === 'rotation' ? { ...item, label: 'Rotate' } : item).map((item) => ({ ...item, paletteFamily: paletteFamily(item.family) })).filter((item) => (familyFilter === 'all' || item.paletteFamily === familyFilter) && (item.label + ' ' + item.description).toLowerCase().includes(search.toLowerCase()))
  }, [familyFilter, search])
  const filteredCustomLibrary = useMemo(() => customDefinitions.filter((definition) => (familyFilter === 'all' || paletteFamily(definition.family) === familyFilter) && `${definition.name} ${definition.family}`.toLowerCase().includes(search.toLowerCase())), [customDefinitions, familyFilter, search])
  const timelineTracks = useMemo(() => nodes.flatMap((node) => node.data.demo.parameters.filter((parameter) => ['number', 'float', 'range'].includes(parameter.kind)).map((parameter) => ({ id: `${node.id}:${parameter.id}`, nodeId: node.id, parameterId: parameter.id, nodeTitle: node.data.demo.title, parameterLabel: parameter.label }))), [nodes])

  const addKeyframe = useCallback((trackId = selectedTrack) => {
    const track = timelineTracks.find((item) => item.id === trackId) ?? (selectedNode ? timelineTracks.find((item) => item.nodeId === selectedNode.id) : undefined)
    if (!track) { setStatus('Selecciona un parámetro numérico para crear keyframe.'); return }
    const node = nodesRef.current.find((item) => item.id === track.nodeId)?.data.demo; const parameter = node?.parameters.find((item) => item.id === track.parameterId); if (!parameter) return
    const id = crypto.randomUUID(); remember(); setSelectedTrack(track.id); setSelectedKeyframe(id); setKeyframes((items) => [...items.filter((item) => !(item.nodeId === track.nodeId && item.parameterId === track.parameterId && item.timeMs === currentTimeMs)), { id, nodeId: track.nodeId, parameterId: track.parameterId, timeMs: currentTimeMs, value: parameter.value as ContractPipelineValue, interpolation: 'linear', easing: 'linear' }]); setStatus('Keyframe creado.')
  }, [currentTimeMs, remember, selectedNode, selectedTrack, timelineTracks])

  const updateKeyframeTime = useCallback((keyframeId: string, timeMs: number) => {
    const nextTime = Math.max(0, Math.min(durationMs, Math.round(timeMs / 10) * 10)); remember(); setKeyframes((items) => { const source = items.find((item) => item.id === keyframeId); if (!source) return items; return items.filter((item) => item.id === keyframeId || !(item.nodeId === source.nodeId && item.parameterId === source.parameterId && item.timeMs === nextTime)).map((item) => item.id === keyframeId ? { ...item, timeMs: nextTime } : item) })
  }, [durationMs, remember])

  const removeKeyframe = useCallback((keyframeId: string) => { remember(); setKeyframes((items) => items.filter((item) => item.id !== keyframeId)); setSelectedKeyframe((current) => current === keyframeId ? undefined : current); setStatus('Keyframe eliminado.') }, [remember])
  const duplicateKeyframe = useCallback((keyframeId: string) => { const source = keyframesRef.current.find((item) => item.id === keyframeId); if (!source) return; const occupied = new Set(keyframesRef.current.filter((item) => item.nodeId === source.nodeId && item.parameterId === source.parameterId).map((item) => item.timeMs)); const nextTime = [source.timeMs + 100, source.timeMs - 100].find((value) => value >= 0 && value <= durationMs && !occupied.has(value)); if (nextTime === undefined) { setStatus('No se puede duplicar: tiempo ocupado.'); return } remember(); setKeyframes((items) => [...items, { ...source, id: crypto.randomUUID(), timeMs: nextTime }]); setStatus('Keyframe duplicado.') }, [durationMs, remember])
  const updateKeyframeCurve = useCallback((keyframeId: string, patch: Partial<Pick<PipelineKeyframeState, 'interpolation' | 'easing' | 'handles'>>) => { remember(); setKeyframes((items) => items.map((item) => item.id === keyframeId ? { ...item, ...patch } : item)) }, [remember])

  const clearSelection = useCallback(() => {
    setNodes((current) => current.map((node) => node.selected ? { ...node, selected: false } : node))
    setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge))
  }, [setEdges, setNodes])

  const selectNode = useCallback((nodeId: string, additive = false) => {
    setNodes((current) => current.map((node) => ({ ...node, selected: additive ? (node.selected || node.id === nodeId) : node.id === nodeId })))
    if (!additive) setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge))
  }, [setEdges, setNodes])

  const moveNodeByKeyboard = useCallback((nodeId: string, key: string) => {
    const deltas: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -8, y: 0 },
      ArrowRight: { x: 8, y: 0 },
      ArrowUp: { x: 0, y: -8 },
      ArrowDown: { x: 0, y: 8 },
    }
    const delta = deltas[key]
    if (!delta) return
    setNodes((current) => current.map((node) => node.id === nodeId
      ? { ...node, position: { x: node.position.x + delta.x, y: node.position.y + delta.y }, selected: true }
      : node))
  }, [setNodes])

  const commitConnection = useCallback((connection: DemoConnectionRequest) => {
    const result = connectDemoPorts(createGraphFromFlow(nodesRef.current, edgesRef.current), connection)
    connectionRef.current = null
    if (result.error) {
      setStatus(connectionMessages[result.error])
      return
    }
    remember(); setEdges((current) => [...current, createFlowEdge(connection)])
    setStatus('Conexión creada: ' + connection.sourceNodeId + ' → ' + connection.targetNodeId + '.')
  }, [remember, setEdges])

  const handlePortClick = useCallback((nodeId: string, port: DemoPort) => {
    if (port.direction === 'output') {
      connectionRef.current = { sourceNodeId: nodeId, sourcePortId: port.id }
      const node = nodesRef.current.find((candidate) => candidate.id === nodeId)
      setStatus('Conectando desde ' + (node?.data.demo.title ?? nodeId) + ' · ' + port.label + '. Selecciona una entrada.')
      return
    }
    const source = connectionRef.current
    if (!source) return
    commitConnection({
      sourceNodeId: source.sourceNodeId,
      sourcePortId: source.sourcePortId,
      targetNodeId: nodeId,
      targetPortId: port.id,
    })
  }, [commitConnection])

  const nodeActions = useMemo<PipelineNodeActions>(() => ({
    onSelect: selectNode,
    onContextMenu: (nodeId, x, y) => { selectNode(nodeId); setNodeContextMenu({ nodeId, x, y }) },
    onMoveByKeyboard: moveNodeByKeyboard,
    onPortClick: handlePortClick,
    onAttachAsset: (nodeId, assetId) => {
      remember()
      setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, data: { demo: { ...node.data.demo, assetId } } } : node))
      setStatus('Asset enlazado al nodo en memoria.')
    },
    onToggleParameterVisibility: (nodeId, parameterId) => {
      remember()
      const source = nodesRef.current.find((node) => node.id === nodeId)
      if (!source) return
      const parameters = source.data.demo.parameters.map((parameter) => parameter.id === parameterId ? { ...parameter, showInNode: parameter.showInNode === false } : parameter)
      const synced = syncDemoNodePorts(source.data.demo, parameters)
      setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, data: { demo: synced } } : node))
      setEdges((current) => current.filter((edge) => edge.target !== nodeId || synced.inputs.some((port) => port.id === edge.targetHandle)))
      setStatus('Visibilidad de variable actualizada.')
    },
  }), [handlePortClick, moveNodeByKeyboard, remember, selectNode, setNodes])

  function handleReactFlowConnection(connection: Connection): void {
    if (!connection.sourceHandle || !connection.targetHandle) {
      setStatus(connectionMessages.CONNECTION_PORT_NOT_FOUND)
      return
    }
    commitConnection({
      sourceNodeId: connection.source,
      sourcePortId: connection.sourceHandle,
      targetNodeId: connection.target,
      targetPortId: connection.targetHandle,
    })
  }

  function addNode(kind: DemoNodeKind, label: string): void {
    remember()
    setNodes((current) => {
      const demo = createDemoNode(kind, kind + '-' + crypto.randomUUID(), {
        x: pendingNodePositionRef.current?.x ?? (140 + ((current.length * 86) % 760)),
        y: pendingNodePositionRef.current?.y ?? (72 + ((current.length * 64) % 420)),
      })
      pendingNodePositionRef.current = undefined
      return [...current.map((node) => ({ ...node, selected: false })), createFlowNode(demo, true)]
    })
    setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge))
    setStatus('Nodo ' + label + ' añadido al canvas.')
    setPaletteOpen(false)
  }

  function addCustomNode(definition: CustomNodeDefinition): void {
    remember()
    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), createFlowNode(createCustomDemoNode(definition, `custom-${crypto.randomUUID()}`, { x: 140 + ((current.length * 86) % 760), y: 72 + ((current.length * 64) % 420) }), true)])
    pendingNodePositionRef.current = undefined
    setPaletteOpen(false); setStatus(`Nodo personalizado ${definition.name} añadido.`)
  }

  function saveCustomNode(definition: CustomNodeDefinition | undefined, diagnostics: readonly string[]): void {
    if (!definition) { setCustomDiagnostics(diagnostics); return }
    setCustomDefinitions((items) => [...items.filter((item) => item.id !== definition.id), definition]); setCustomDiagnostics([]); setCustomDialogOpen(false); setStatus(`Nodo personalizado ${definition.name} guardado.`)
  }

  async function importCustomNode(file?: File): Promise<void> {
    if (!file) return
    try {
      const definition = await parseCustomNode(file)
      setCustomDefinitions((items) => [...items.filter((item) => item.id !== definition.id), definition])
      setStatus(`Nodo personalizado ${definition.name} importado.`)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'No se pudo importar el nodo personalizado.') }
  }

  function parseCustomDsl(): void {
    const result = parseCustomNodeDsl(customDsl, customName)
    saveCustomNode(result.definition, result.diagnostics.map((diagnostic) => diagnostic.line ? `L${diagnostic.line}: ${diagnostic.message}` : diagnostic.message))
  }

  function buildVisualCustomNode(): void {
    try {
      const definition = createVisualCustomNodeDefinition({ name: customName, inputs: [{ id: 'source', label: 'Source', type: 'surface', direction: 'input', showInNode: true }], outputs: [{ id: 'result', label: 'Result', type: 'surface', direction: 'output', showInNode: true }], operation: customOperation })
      saveCustomNode(definition, [])
    } catch (error) { setCustomDiagnostics([error instanceof Error ? error.message : 'Visual custom node is invalid.']) }
  }

  async function dropAsset(assetId: string | undefined, position: { x: number; y: number }, files: readonly File[]): Promise<void> {
    let selectedAssetId = assetId
    if (!selectedAssetId && files.length) selectedAssetId = (await onImportFiles(files))[0]?.record.id
    if (!selectedAssetId) { setStatus('No hay Asset válido para crear el nodo.'); return }
    remember(); setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), createFlowNode({ ...createDemoNode('asset', 'asset-' + (current.length + 1), position), assetId: selectedAssetId }, true)])
    setStatus('Nodo Asset creado con fuente real.')
  }

  async function savePipeline(): Promise<void> {
    try {
      const graph = createGraphFromFlow(nodes, edges); const document = toPipelineDocument(graph, assets, timelineMode, durationMs, currentTimeMs, loop, keyframes, snapshots, viewport, { timelineVisible, timelineHeight, fps: renderFps, rangeStartMs: renderStartMs, rangeEndMs: renderEndMs, selectedFrameTimesMs }); const used = new Map(assets.filter((asset) => document.assets.some((item) => item.id === asset.record.id)).map((asset) => [asset.record.id, asset.original] as const)); const blob = await createPipelinePackage(document, used, snapshotThumbnails); await savePipelineProject(blob, `Pipeline${PIPELINE_PROJECT_EXTENSION}`); setStatus('Pipeline .mpl guardado con Assets usados.')
    } catch (error) { setStatus(error instanceof Error ? error.message : 'No se pudo guardar el Pipeline.') }
  }

  async function openPipeline(file?: File): Promise<void> {
    if (!file) return
    try {
      const loaded = await loadPipelinePackage(file); const assetIdMap = new Map<string, string>(); const missing = loaded.document.assets.filter((asset) => !assets.some((current) => current.record.sha256 === asset.sha256))
      for (const asset of loaded.document.assets) {
        const existing = assets.find((current) => current.record.sha256 === asset.sha256)
        if (existing) assetIdMap.set(asset.id, existing.record.id)
      }
      if (missing.length) {
        const imported = await onImportFiles(missing.map((asset) => new File([loaded.assets.get(asset.id)!], asset.name, { type: asset.mediaType })))
        missing.forEach((asset, index) => { const importedAsset = imported[index]; if (importedAsset) assetIdMap.set(asset.id, importedAsset.record.id) })
      }
      const graph = fromPipelineDocument(loaded.document, assetIdMap); setNodes(graph.nodes.map((node) => createFlowNode(node, node.id === graph.selectedNodeId))); setEdges(graph.edges.map(createFlowEdge)); setTimelineMode(loaded.document.timeline.mode); setTimelineVisible(loaded.document.timeline.timelineVisible !== false); setTimelineHeight(Math.max(180, Math.min(520, loaded.document.timeline.timelineHeight ?? 220))); setDurationMs(loaded.document.timeline.durationMs); setCurrentTimeMs(loaded.document.timeline.currentTimeMs); setLoop(loaded.document.timeline.loop ?? true); setRenderFps(loaded.document.timeline.render?.fps ?? 12); setRenderStartMs(loaded.document.timeline.render?.rangeStartMs ?? 0); setRenderEndMs(loaded.document.timeline.render?.rangeEndMs ?? loaded.document.timeline.durationMs); setSelectedFrameTimesMs(loaded.document.timeline.render?.selectedFrameTimesMs ?? []); setKeyframes(loaded.document.timeline.keyframes); setSnapshots(loaded.document.timeline.snapshots.map((snapshot) => ({ ...snapshot, hash: 'loaded' }))); setSnapshotThumbnails(loaded.snapshots); setStatus('Pipeline .mpl abierto.')
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Pipeline .mpl inválido.') }
  }

  function updateParameter(node: DemoNode, parameter: DemoParameter, value: string): void {
    const numeric = ['number', 'float', 'range'].includes(parameter.kind)
    const parsed = Number(value)
    if (numeric && (!Number.isFinite(parsed) || (parameter.min !== undefined && parsed < parameter.min) || (parameter.max !== undefined && parsed > parameter.max))) { setStatus(node.title + ': valor fuera de rango.'); return }
    let nextValue: DemoParameter['value']
    if (parameter.kind === 'array') {
      try {
        const candidate: unknown = JSON.parse(value)
        if (!Array.isArray(candidate) || candidate.length > 4096 || candidate.some((item) => !['string', 'number', 'boolean'].includes(typeof item))) throw new Error('invalid array')
        nextValue = candidate as (string | number | boolean)[]
      } catch { setStatus(node.title + ': array inválido.'); return }
    } else nextValue = parameter.kind === 'boolean' ? value === 'true' : numeric ? parsed : value
    const currentKeyframe = keyframesRef.current.find((frame) => frame.nodeId === node.id && frame.parameterId === parameter.id && frame.timeMs === currentTimeMs)
    remember()
    if (currentKeyframe) {
      setKeyframes((items) => items.map((frame) => frame.id === currentKeyframe.id ? { ...frame, value: nextValue as ContractPipelineValue } : frame))
      setStatus(node.title + ': keyframe actualizado.')
      return
    }
    setNodes((current) => current.map((flowNode) => {
      if (flowNode.id !== node.id) return flowNode
      const parameters = flowNode.data.demo.parameters.map((item) => item.id === parameter.id ? { ...item, value: nextValue } : item)
      return { ...flowNode, data: { demo: syncDemoNodePorts(flowNode.data.demo, parameters) } }
    }))
    if (parameter.id === 'data-type') {
      const nextNode = syncDemoNodePorts(node, node.parameters.map((item) => item.id === parameter.id ? { ...item, value: nextValue } : item))
      setEdges((current) => current.filter((edge) => edge.target !== node.id || nextNode.inputs.some((port) => port.id === edge.targetHandle)))
    }
    setStatus(node.title + ': ' + parameter.label + ' actualizado en memoria.')
  }

  const handleDelete = useCallback<OnDelete<FlowNode, FlowEdge>>(() => { remember(); setStatus('Selección eliminada.') }, [remember])
  const handleNodesChange = useCallback<OnNodesChange<FlowNode>>((changes) => { const removed = new Set(changes.filter((change) => change.type === 'remove').map((change) => change.id)); if (removed.size) setKeyframes((items) => items.filter((frame) => !removed.has(frame.nodeId))); if (changes.some((change) => change.type === 'remove' || change.type === 'add' || (change.type === 'position' && !change.dragging))) remember(); onNodesChange(changes) }, [onNodesChange, remember, setKeyframes])
  const handleEdgesChange = useCallback<OnEdgesChange<FlowEdge>>((changes) => { if (changes.some((change) => change.type === 'remove' || change.type === 'add')) remember(); onEdgesChange(changes) }, [onEdgesChange, remember])

  const createNewPipeline = () => {
    if (hasSelection && typeof window !== 'undefined' && !window.confirm('¿Crear Pipeline nuevo y descartar el flow actual?')) return
    remember(); setNodes([]); setEdges([]); setKeyframes([]); setSnapshots([]); setCurrentTimeMs(0); setPlaying(false); setStatus('Pipeline nuevo creado.')
  }
  const clearCanvas = () => { remember(); setNodes([]); setEdges([]); setKeyframes([]); setSnapshots([]); setSelectedFrameTimesMs([]); setSelectedKeyframe(undefined); setSelectedTrack(undefined); setCurrentTimeMs(0); setPlaying(false); setStatus('Canvas limpiado. Puedes deshacer.') }
  const clearDraft = () => { if (typeof localStorage !== 'undefined') localStorage.removeItem(pipelineDraftStorageKey); setStatus('Borrador local eliminado.') }
  const stopTimeline = () => { setPlaying(false); setCurrentTimeMs(0) }
  const updateDuration = (next: number) => { setDurationMs(next); setCurrentTimeMs((value) => Math.min(value, next)); setRenderStartMs((value) => Math.min(value, next)); setRenderEndMs((value) => Math.max(Math.min(value, next), Math.min(next, renderStartMs))); setKeyframes((items) => items.map((item) => item.timeMs > next ? { ...item, timeMs: next } : item)); setSnapshots((items) => items.map((item) => item.timeMs > next ? { ...item, timeMs: next } : item)) }
  const beginTimelineResize = (event: ReactPointerEvent<HTMLDivElement>) => { event.preventDefault(); const start = { startY: event.clientY, startHeight: timelineHeight }; const move = (next: PointerEvent) => setTimelineHeight(Math.max(180, Math.min(520, start.startHeight - (next.clientY - start.startY)))); const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end) }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', end) }
  const importAssets = async (files: readonly File[]) => { const imported = await onImportFiles(files); setStatus(imported.length ? `${imported.length} Asset(s) importado(s).` : 'No se importaron Assets.') }
  const selectedRenderedFrames = renderedFrames.filter((frame) => frame.selected)
  const activeRenderedFrame = renderedFrames.reduce<GeneratedPipelineFrame | undefined>((found, frame) => frame.timeMs <= currentTimeMs ? frame : found, renderedFrames[0])
  const toggleRenderedFrame = (timeMs: number) => { frameSelectionInitializedRef.current = true; setSelectedFrameTimesMs((current) => current.includes(timeMs) ? current.filter((time) => time !== timeMs) : [...current, timeMs].sort((left, right) => left - right)) }
  const selectAllRenderedFrames = () => { frameSelectionInitializedRef.current = true; setSelectedFrameTimesMs(renderedFrames.map((frame) => frame.timeMs)) }
  const clearRenderedFrames = () => { frameSelectionInitializedRef.current = true; setSelectedFrameTimesMs([]) }
  const hasRenderedOutput = renderedFrames.some((frame) => !frame.diagnostics.length && frame.surface.pixels.some((value, index) => index % 4 === 3 && value > 0))
  const transferToEditor = () => { const frames = transferMode === 'current' ? (activeRenderedFrame ? [activeRenderedFrame] : []) : selectedRenderedFrames; if (!frames.length || !hasRenderedOutput) { setStatus('No hay resultado RGBA válido para transferir.'); return } const payload: PipelineTransferPayload = { name: transferName.trim() || 'Pipeline result', width: frames[0]!.surface.width, height: frames[0]!.surface.height, frames: frames.map((frame) => ({ pixels: new Uint8ClampedArray(frame.surface.pixels), durationMs: frame.durationMs })) }; window.dispatchEvent(new CustomEvent('mosaico:pipeline-transfer-request', { detail: payload })); setTransferDialogOpen(false); setStatus('Resultado enviado a Editor.') }
  const exportRenderedFrames = async () => { if (!hasRenderedOutput) { setStatus('No hay resultado RGBA válido para exportar.'); return } try { await exportPipelineFrames(renderedFrames, exportFormat, exportName, activeRenderedFrame); setExportDialogOpen(false); setStatus(`${exportFormat} exportado.`) } catch (error) { setStatus(error instanceof Error ? error.message : 'No se pudo exportar el resultado.') } }
  const menus: Record<string, readonly [string, () => void, boolean?][]> = {
    Archivo: [['Nuevo Pipeline', createNewPipeline], ['Abrir .mpl', () => projectFileRef.current?.click()], ['Guardar .mpl', () => void savePipeline()], ['Limpiar borrador', clearDraft]],
    Editar: [['Deshacer', () => restoreHistory('undo')], ['Rehacer', () => restoreHistory('redo')], ['Eliminar selección', () => actionsRef.current?.deleteSelection()]],
    Nodos: [['Abrir palette', () => setPaletteOpen(true)], ['Crear nodo personalizado', () => setCustomDialogOpen(true)]],
    Timeline: [['Play/Pause', () => setPlaying((value) => !value)], ['Stop', stopTimeline], ['Loop', () => setLoop((value) => !value)], ['Añadir keyframe', () => { void addKeyframe() }]],
    Assets: [['Importar Assets', () => assetFileRef.current?.click()], ['Refrescar catálogo', () => setStatus('Catálogo de Assets actualizado.')]],
    Vista: [['Acercar', () => actionsRef.current?.zoomIn()], ['Alejar', () => actionsRef.current?.zoomOut()], ['Ajustar canvas', () => actionsRef.current?.fitView()]],
    Diagnóstico: [['Mostrar estado', () => setStatus(`${evaluation.diagnostics.length} diagnóstico(s) activo(s).`)], ['Limpiar estado', () => setStatus('Estado limpiado.')]],
  }

  return <main className="pipeline-editor">
    <header className="pipeline-editor-header">
      <div className="pipeline-runtime-state"><span>{nodes.length} nodes - {edges.length} links</span><strong>Evaluacion local</strong><span>empty output = transparent RGBA</span></div>
      <div><p className="eyebrow">Pipelines</p><h2>Compositor procedural por nodos</h2></div>
      <input ref={projectFileRef} hidden type="file" accept=".mpl" onChange={(event) => { void openPipeline(event.target.files?.[0]); event.currentTarget.value = '' }} />
      <input ref={assetFileRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={(event) => { void importAssets([...event.target.files ?? []]); event.currentTarget.value = '' }} />
      <nav className="pipeline-menu-bar" aria-label="Menú de Pipelines">{Object.entries(menus).map(([name, entries]) => <div className="menu-root" key={name}><button type="button" aria-haspopup="menu" aria-expanded={openMenu === name} onClick={() => setOpenMenu((current) => current === name ? undefined : name)}>{name}</button>{openMenu === name && <div className="menu-panel" role="menu">{entries.map(([label, action, disabled]) => <button key={label} type="button" role="menuitem" disabled={disabled} onClick={() => { setOpenMenu(undefined); action() }}>{label}</button>)}</div>}</div>)}</nav>
      <div className="pipeline-prototype-state"><span>{nodes.length} nodos · {edges.length} conexiones</span><strong>Evaluación local</strong><span title={webGpuStatus?.reason ?? 'WebGPU disponible'}>CPU 2D · {webGpuStatus?.available ? 'WebGPU disponible' : 'WebGPU no disponible'}</span></div>
    </header>

    <div className="pipeline-editor-body">
      <aside className="pipeline-left-rail">
        <section className="pipeline-left-preview" aria-label="Preview de Pipeline">
          <div className="pipeline-panel-heading">
            <p className="eyebrow">Preview</p>
            <h3>{selectedNode?.title ?? 'Resultado final'}</h3>
            <span>{selectedNode?.family ?? 'Salida RGBA transparente'}</span>
          </div>
          <div className="pipeline-large-preview-stage">
            <PipelineSurfacePreview surface={displayPreview} />
            <span className="pipeline-preview-state">{previewSurface ? (hasRealPreview ? 'Resultado RGBA real' : 'RGBA transparente') : 'Sin entrada: RGBA transparente'}</span>
          </div>
          <div className="pipeline-preview-readout"><span>{displayPreview.width} × {displayPreview.height}</span><span>RGBA</span><span>{hasRealPreview ? 'Real' : 'Transparente'}</span></div>
        </section>

        <section className="pipeline-library" aria-label="Explorador de Assets">
          <div className="pipeline-library-heading"><p className="eyebrow">Assets</p><h3>Explorador</h3></div>
          <label className="pipeline-search-label" htmlFor="pipeline-asset-search">Buscar Assets</label>
          <input id="pipeline-asset-search" aria-label="Buscar Assets" type="search" value={assetSearch} placeholder="Nombre, tipo o hash" onChange={(event) => setAssetSearch(event.target.value)} />
          <div className="pipeline-library-list pipeline-assets-list">
            {assets.filter((asset) => `${asset.record.name} ${asset.record.mediaType} ${asset.record.sha256}`.toLowerCase().includes(assetSearch.toLowerCase())).map((asset) => <button className="pipeline-asset-item" draggable type="button" key={asset.record.id} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData(PIPELINE_ASSET_DRAG_MIME, asset.record.id); event.dataTransfer.setData('text/plain', asset.record.id) }}><img src={asset.thumbnailUrl} alt="" /><span><strong>{asset.record.name}</strong><small>{asset.record.width}×{asset.record.height}</small></span></button>)}
            {!assets.length && <div className="pipeline-transparent-empty"><span aria-hidden="true" /><p>Sin Assets. La salida permanece transparente.</p></div>}
          </div>
        </section>
      </aside>

      <section className="pipeline-canvas-panel" aria-labelledby="pipeline-canvas-title" style={{ gridTemplateRows: `3.1rem minmax(0, 1fr) ${timelineVisible ? '0.35rem' : '0px'} ${timelineVisible ? `${timelineHeight}px` : '0px'} auto` }}>
        <div className="pipeline-canvas-toolbar">
          <div><p className="eyebrow">Graph 01</p><h3 id="pipeline-canvas-title">Flujo de imagen</h3></div>
          <div className="pipeline-view-controls">
            <button type="button" aria-label="Limpiar canvas" title="Limpiar canvas" onClick={clearCanvas}><Trash2 size={14} /></button>
            <button type="button" aria-label="Enviar resultado a Editor" title="Enviar resultado a Editor" onClick={() => setTransferDialogOpen(true)}><Upload size={14} /></button>
            <button type="button" aria-label="Exportar resultado" title="Exportar resultado" onClick={() => setExportDialogOpen(true)}><Download size={14} /></button>
            <button type="button" aria-label={timelineVisible ? 'Ocultar timeline' : 'Mostrar timeline'} title={timelineVisible ? 'Ocultar timeline' : 'Mostrar timeline'} onClick={() => setTimelineVisible((value) => !value)}><PanelBottom size={14} /></button>
            <button type="button" aria-label="Alejar zoom" title="Alejar zoom" onClick={() => actionsRef.current?.zoomOut()}>−</button>
            <output aria-label="Zoom actual">{Math.round(zoom * 100)}%</output>
            <button type="button" aria-label="Acercar zoom" title="Acercar zoom" onClick={() => actionsRef.current?.zoomIn()}>+</button>
            <button type="button" aria-label="Restablecer vista" title="Restablecer vista" onClick={() => actionsRef.current?.fitView()}>Ajustar</button>
          </div>
        </div>
        <div ref={canvasViewportRef} className="pipeline-canvas-viewport" role="region" aria-label="Canvas de Pipelines" aria-keyshortcuts="Delete Backspace" tabIndex={0} onKeyDown={(event) => { if (event.key === ' ' || event.key === 'F2') { event.preventDefault(); openPaletteAt() } if (event.key === 'Escape') { setPaletteOpen(false); setNodeContextMenu(undefined) } }}>
          <ReactFlowProvider>
            <PipelineFlow
              nodes={nodes}
              edges={edges}
              viewport={viewport}
              compact={zoom < 0.42}
              actionsRef={actionsRef}
              nodeActions={nodeActions}
              nodeOutputs={evaluation.outputs}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleReactFlowConnection}
              onDelete={handleDelete}
              onClearSelection={clearSelection}
              onViewportChange={(next) => { setViewport(next); setZoom(next.zoom) }}
              onDropAsset={(assetId, position, files) => { void dropAsset(assetId, position, files) }}
              onOpenPalette={openPaletteAt}
            />
          </ReactFlowProvider>
          {paletteOpen && <div className="pipeline-node-palette" role="dialog" aria-label="Palette de nodos" style={{ left: palettePosition.x, top: palettePosition.y }}>
            <div className="pipeline-palette-heading" onPointerDown={(event) => { const rect = event.currentTarget.parentElement?.getBoundingClientRect(); if (!rect) return; paletteDragRef.current = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={(event) => { if (!paletteDragRef.current) return; const parent = event.currentTarget.parentElement?.parentElement?.getBoundingClientRect(); if (!parent) return; setPalettePosition({ x: Math.max(0, Math.min(parent.width - 360, event.clientX - parent.left - paletteDragRef.current.offsetX)), y: Math.max(0, Math.min(parent.height - 120, event.clientY - parent.top - paletteDragRef.current.offsetY)) }) }} onPointerUp={() => { paletteDragRef.current = undefined }}><strong>Añadir nodo</strong><button type="button" aria-label="Cerrar palette" onPointerDown={(event) => event.stopPropagation()} onClick={() => setPaletteOpen(false)}>×</button></div>
            <input autoFocus aria-label="Buscar nodos" type="search" value={search} placeholder="Buscar nodo" onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setPaletteOpen(false); if (event.key === 'Enter' && filteredLibrary[0]) addNode(filteredLibrary[0].kind, filteredLibrary[0].label) }} />
            <div className="pipeline-palette-tabs" role="tablist" aria-label="Node families">{paletteFamilies.map((family) => <button type="button" role="tab" aria-selected={familyFilter === family} className={familyFilter === family ? 'active' : ''} key={family} onClick={() => setFamilyFilter(family)}>{family === 'all' ? 'All' : family}</button>)}</div>
            <div className="pipeline-palette-list">{filteredLibrary.map((item) => <button type="button" key={item.kind} onClick={() => addNode(item.kind, item.label)}><span className={'pipeline-kind-mark ' + item.kind} aria-hidden="true" /><span><strong>{item.label}</strong><small>{item.description}</small></span></button>)}{filteredCustomLibrary.map((definition) => <button type="button" key={definition.id} onClick={() => addCustomNode(definition)}><span className="pipeline-kind-mark custom" aria-hidden="true" /><span><strong data-user-content="true">{definition.name}</strong><small>{definition.family} · Custom DSL</small></span></button>)}</div>
          </div>}
          {nodeContextMenu && <div className="pipeline-node-context-menu" role="menu" style={{ left: nodeContextMenu.x, top: nodeContextMenu.y }}><button type="button" role="menuitem" onClick={() => { const id = nodeContextMenu.nodeId; remember(); setNodes((current) => current.map((node) => node.id === id ? { ...node, data: { demo: { ...node.data.demo, previewVisible: node.data.demo.previewVisible === false } } } : node)); setNodeContextMenu(undefined) }}>{nodes.find((node) => node.id === nodeContextMenu.nodeId)?.data.demo.previewVisible === false ? 'Show Preview' : 'Collapse Preview'}</button><button type="button" role="menuitem" onClick={() => { const source = nodes.find((node) => node.id === nodeContextMenu.nodeId); if (!source) return; remember(); const newId = crypto.randomUUID(); setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), { id: newId, type: 'mosaico', position: { x: source.position.x + 48, y: source.position.y + 48 }, selected: true, data: { demo: { ...source.data.demo, id: crypto.randomUUID() } } }]); setNodeContextMenu(undefined); setStatus('Nodo duplicado.') }}>Duplicate Node</button><button type="button" role="menuitem" onClick={() => { const id = nodeContextMenu.nodeId; remember(); setNodes((current) => current.filter((node) => node.id !== id)); setEdges((current) => current.filter((edge) => edge.source !== id && edge.target !== id)); setKeyframes((current) => current.filter((frame) => frame.nodeId !== id)); setSnapshots((current) => current.filter((snapshot) => snapshot.selectedNodeId !== id)); setNodeContextMenu(undefined); setStatus('Nodo eliminado.') }}>Delete Node</button></div>}
          {customDialogOpen && <div className="pipeline-custom-dialog" role="dialog" aria-modal="true" aria-label="Custom node builder">
            <div className="pipeline-palette-heading"><strong>Custom node</strong><button type="button" aria-label="Close custom node builder" onClick={() => setCustomDialogOpen(false)}>×</button></div>
            <div className="pipeline-custom-file-actions"><button type="button" onClick={() => customNodeFileRef.current?.click()}>Import .mnode</button><input ref={customNodeFileRef} className="visually-hidden" type="file" accept=".mnode,application/json" onChange={(event) => { void importCustomNode(event.target.files?.[0]); event.currentTarget.value = '' }} />{customDefinitions[0] && <button type="button" onClick={() => void downloadCustomNode(customDefinitions[0]!) }>Export .mnode</button>}</div>
            <label>Name<input value={customName} onChange={(event) => setCustomName(event.target.value)} /></label>
            <p className="eyebrow">Visual constructor</p>
            <div className="pipeline-custom-visual-row"><label>Operation<select value={customOperation} onChange={(event) => setCustomOperation(event.target.value as typeof customOperation)}><option value="invert">Invert</option><option value="flip">Flip</option><option value="rotate">Rotate</option><option value="zoom">Zoom</option><option value="color">Color</option><option value="gradient">Gradient</option></select></label><button type="button" onClick={buildVisualCustomNode}>Create visual node</button></div>
            <label>Safe DSL<textarea value={customDsl} onChange={(event) => setCustomDsl(event.target.value)} rows={7} spellCheck={false} /></label>
            <p className="pipeline-custom-help">Inputs, params and outputs use typed declarations. Body allows registered operations only.</p>
            <button className="primary" type="button" onClick={parseCustomDsl}>Validate and save DSL</button>
            {customDiagnostics.length > 0 && <ul className="pipeline-custom-diagnostics">{customDiagnostics.map((item) => <li key={item}>{item}</li>)}</ul>}
          </div>}
        </div>
        {false && <section className="pipeline-timeline" aria-label="Timeline de Pipelines">
          <div className="pipeline-timeline-toolbar"><div><p className="eyebrow">Timeline</p><strong>{timelineMode === 'animation' ? 'Animación' : 'Snapshots'}</strong></div><div className="pipeline-timeline-actions"><button type="button" className={timelineMode === 'animation' ? 'active' : ''} onClick={() => setTimelineMode('animation')}>Animación</button><button type="button" className={timelineMode === 'snapshots' ? 'active' : ''} onClick={() => setTimelineMode('snapshots')}>Snapshots</button></div></div>
          {timelineMode === 'animation' ? <><div className="pipeline-timeline-controls"><button type="button" aria-label={playing ? 'Pausar timeline' : 'Reproducir timeline'} onClick={() => setPlaying((value) => !value)}>{playing ? 'Pausa' : 'Play'}</button><input aria-label="Tiempo actual" type="range" min="0" max={durationMs} step="10" value={currentTimeMs} onChange={(event) => setCurrentTimeMs(Number(event.target.value))} /><output>{(currentTimeMs / 1000).toFixed(2)}s</output><label>Duración <input type="number" min="100" max="86400000" step="100" value={durationMs} onChange={(event) => setDurationMs(Math.max(100, Number(event.target.value) || 100))} /></label><button type="button" disabled={!selectedNode || !selectedNode.parameters.some((parameter) => ['number', 'float', 'range'].includes(parameter.kind))} onClick={() => { const parameter = selectedNode?.parameters.find((item) => ['number', 'float', 'range'].includes(item.kind)); if (selectedNode && parameter) setKeyframes((items) => [...items, { id: crypto.randomUUID(), nodeId: selectedNode.id, parameterId: parameter.id, timeMs: currentTimeMs }]) }}>+ Keyframe</button></div><div className="pipeline-keyframe-track" aria-label="Keyframes">{keyframes.map((keyframe) => <button type="button" key={keyframe.id} title={`${keyframe.nodeId} ${keyframe.parameterId}`} style={{ left: `${(keyframe.timeMs / durationMs) * 100}%` }} onClick={() => setCurrentTimeMs(keyframe.timeMs)} />)}{!keyframes.length && <span>Sin keyframes</span>}</div></> : <div className="pipeline-snapshot-row"><button type="button" disabled={!hasRealPreview} onClick={() => { if (hasRealPreview && previewSurface) setSnapshots((items) => [...items, { id: crypto.randomUUID(), label: `Snapshot ${items.length + 1}`, timeMs: currentTimeMs, hash: surfaceHash(previewSurface), selectedNodeId: selectedNode?.id }]) }}>Capturar resultado real</button>{snapshots.map((snapshot) => <button type="button" key={snapshot.id} title={snapshot.hash} onClick={() => { setCurrentTimeMs(snapshot.timeMs); if (snapshot.selectedNodeId) selectNode(snapshot.selectedNodeId) }}>{snapshot.label} · {(snapshot.timeMs / 1000).toFixed(2)}s</button>)}{!snapshots.length && <span>{hasRealPreview ? 'Sin snapshots' : 'No hay resultado real para capturar.'}</span>}</div>}
        </section>}
        <div className={'pipeline-timeline-splitter ' + (timelineVisible ? '' : 'hidden')} role="separator" aria-label="Resize pipeline timeline" onPointerDown={beginTimelineResize} />
        {timelineVisible && <PipelineFrameTimeline mode={timelineMode} frames={renderedFrames} keyframes={keyframes} snapshots={snapshots} durationMs={durationMs} currentTimeMs={currentTimeMs} playing={playing} loop={loop} fps={renderFps} rangeStartMs={renderStartMs} rangeEndMs={renderEndMs} timelineHeight={timelineHeight} hasRealPreview={hasRealPreview} selectedKeyframe={selectedKeyframe} onModeChange={setTimelineMode} onPlayPause={() => setPlaying((value) => !value)} onStop={stopTimeline} onLoop={() => setLoop((value) => !value)} onFps={setRenderFps} onRange={(start, end) => { setRenderStartMs(start); setRenderEndMs(end); setCurrentTimeMs((value) => Math.max(start, Math.min(end, value))) }} onTime={setCurrentTimeMs} onToggleFrame={toggleRenderedFrame} onSelectAll={selectAllRenderedFrames} onClearFrames={clearRenderedFrames} onAddKeyframe={() => { void addKeyframe() }} onSelectKeyframe={setSelectedKeyframe} onRemoveKeyframe={removeKeyframe} onSnapshot={() => { if (hasRealPreview && previewSurface) setSnapshots((items) => [...items, { id: crypto.randomUUID(), label: `Snapshot ${items.length + 1}`, timeMs: currentTimeMs, hash: surfaceHash(previewSurface), selectedNodeId: selectedNode?.id }]) }} onRestoreSnapshot={(snapshot) => { setCurrentTimeMs(snapshot.timeMs); if (snapshot.selectedNodeId) selectNode(snapshot.selectedNodeId) }} />}
        <PipelineTimelineFixed mode={timelineMode} tracks={timelineTracks} keyframes={keyframes} snapshots={snapshots} durationMs={durationMs} currentTimeMs={currentTimeMs} playing={playing} loop={loop} timelineZoom={timelineZoom} selectedTrack={selectedTrack} selectedKeyframe={selectedKeyframe} hasRealPreview={hasRealPreview} previewSurface={previewSurface} onModeChange={setTimelineMode} onPlayPause={() => setPlaying((value) => !value)} onStop={stopTimeline} onLoop={() => setLoop((value) => !value)} onDuration={updateDuration} onZoom={setTimelineZoom} onTime={setCurrentTimeMs} onSelectTrack={setSelectedTrack} onSelectKeyframe={setSelectedKeyframe} onAdd={(trackId) => { void addKeyframe(trackId) }} onMove={updateKeyframeTime} onRemove={removeKeyframe} onDuplicate={duplicateKeyframe} onCurve={updateKeyframeCurve} onSnapshot={() => { if (hasRealPreview && previewSurface) setSnapshots((items) => [...items, { id: crypto.randomUUID(), label: `Snapshot ${items.length + 1}`, timeMs: currentTimeMs, hash: surfaceHash(previewSurface), selectedNodeId: selectedNode?.id }]) }} onRestoreSnapshot={(snapshot) => { setCurrentTimeMs(snapshot.timeMs); if (snapshot.selectedNodeId) selectNode(snapshot.selectedNodeId) }} />
        {transferDialogOpen && <div className="pipeline-result-dialog" role="dialog" aria-modal="true" aria-label="Transfer result to Editor"><header><strong>Send result to Editor</strong><button type="button" aria-label="Close" onClick={() => setTransferDialogOpen(false)}><X size={14} /></button></header><label>Name<input value={transferName} onChange={(event) => setTransferName(event.target.value)} /></label><label><input type="radio" name="pipeline-transfer-mode" checked={transferMode === 'current'} onChange={() => setTransferMode('current')} /> Current frame</label><label><input type="radio" name="pipeline-transfer-mode" checked={transferMode === 'selected'} onChange={() => setTransferMode('selected')} /> Selected frames ({selectedRenderedFrames.length})</label><button className="primary" type="button" onClick={transferToEditor}>Open in Editor</button></div>}
        {exportDialogOpen && <div className="pipeline-result-dialog" role="dialog" aria-modal="true" aria-label="Export pipeline result"><header><strong>Export result</strong><button type="button" aria-label="Close" onClick={() => setExportDialogOpen(false)}><X size={14} /></button></header><label>Name<input value={exportName} onChange={(event) => setExportName(event.target.value)} /></label><label>Format<select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as PipelineExportFormat)}><option value="png-single">PNG single</option><option value="png-spritesheet">PNG spritesheet</option><option value="gif">GIF animated</option></select></label><p>{selectedRenderedFrames.length} selected frames · {renderedFrames.length} rendered frames</p><button className="primary" type="button" disabled={!hasRenderedOutput} onClick={() => void exportRenderedFrames()}>Export</button></div>}
        <div className="pipeline-canvas-footer">
          <p className="pipeline-canvas-help">React Flow: arrastra nodos · rueda para zoom · arrastra fondo para pan · Delete/Backspace elimina la selección</p>
          <p className="pipeline-status" role="status" aria-live="polite">{status}</p>
        </div>
      </section>

      <PipelineInspector selectedNode={selectedNode} selectedEdge={selectedEdge} assets={assets} onUpdateParameter={updateParameter} onAttachAsset={nodeActions.onAttachAsset} onToggleParameterVisibility={nodeActions.onToggleParameterVisibility} />
    </div>
  </main>
}

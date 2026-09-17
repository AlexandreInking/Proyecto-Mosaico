import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import {
  addSpriteFolder, addSpriteLayer, constrainSquareEnd, createSpriteDocument, deserializeSpriteDocument, ellipsePixels, fillPixels, linePixels, rectanglePixels,
  addSpriteFrame, getPixel, removeSpriteFrame, removeSpriteLayer, reorderSpriteLayer, selectSpriteFrame, selectSpriteLayer, setPixels, setSpriteLayerParent, updateSpriteFrame, updateSpriteLayer,
  serializeSpriteDocument, snapLineEnd,
  moveSpritePixels, type GridCoordinate, type RgbaColor, type SpriteDocument, type SpriteLayer,
} from '@mosaico/domain'
import { combineSelection, ellipseMask, invertSelection, magicMask, polygonMask, rectangleMask, selectionBounds, selectionContains, selectionIndexes, selectionOutlinePath, translateSelection, type SelectionMask, type SelectionMode } from './selection-model.js'
import { composeSpriteFrame, createViewport, isPointInsideViewport, panViewport, pickSpritePixel, PixiPixelViewport, resizeViewport, screenToWorld, zoomViewportAt, type Point, type ViewportState } from '@mosaico/canvas'
import { onionSkinDocument, usedPalette } from './pixel-editor-model.js'
import { chooseImageFile, createSpriteDocumentFromFrames, encodeSpriteGif, exportDocument, importImage, saveBlob, saveProject as saveSpriteProject, type ExportFormat, type ExportOptions } from './pixel-media.js'
import type { PipelineTransferPayload } from './pipeline-frames.js'
import { BoxSelect, Circle, CircleDashed, Copy, Diamond, Download, Eraser, Eye, EyeOff, Hand, Hexagon, LassoSelect, Lock, PaintBucket, Pause, Pencil, Pipette, Play, Plus, Redo2, Slash, Square, Trash2, Undo2, Unlock, WandSparkles, X, type LucideIcon } from 'lucide-react'
import { usePanelLayout } from './panel-layout.js'
import { selectionClipboardCommand } from './selection-shortcuts.js'
import { ColorWheel } from './ColorWheel.js'
import { BRUSH_SIZE_MAX, BRUSH_SIZE_MIN, brushShapes, clampBrushSize, expandStroke, type BrushShape } from './brush-model.js'
import { BRUSH_PACK_EXTENSION, createBrushPack, loadBrushPack } from './brush-pack.js'
import { applySpriteFilter, createBrightnessFilter, createContrastFilter, createOutlineFilter, grayscaleFilter, invertFilter, sepiaFilter, type SpriteFilter } from './sprite-filter.js'
import type { BrushPresetContract } from '@mosaico/contracts'

type Tool = 'pencil' | 'eraser' | 'eyedropper' | 'fill' | 'line' | 'rectangle' | 'ellipse' | 'polygon' | 'select' | 'pan'
const plainTools: readonly [Tool, string, LucideIcon][] = [
  ['pencil', 'Lápiz', Pencil], ['eraser', 'Borrador', Eraser], ['fill', 'Relleno', PaintBucket],
  ['eyedropper', 'Selector de color', Pipette], ['pan', 'Mano', Hand],
]
const shapes: readonly [Extract<Tool, 'line' | 'rectangle' | 'ellipse' | 'polygon'>, string, LucideIcon][] = [['line', 'Línea', Slash], ['rectangle', 'Rectángulo', Square], ['ellipse', 'Elipse', Circle], ['polygon', 'Polígono', Hexagon]]
const selections: readonly [SelectionMode, string, LucideIcon][] = [['rectangle', 'Selección rectangular', BoxSelect], ['ellipse', 'Selección elíptica', CircleDashed], ['lasso', 'Lazo', LassoSelect], ['magic', 'Varita mágica', WandSparkles]]
const toolLabel = (tool: Tool, selectionMode: SelectionMode) => tool === 'select' ? selections.find(([id]) => id === selectionMode)![1] : [...plainTools, ...shapes].find(([id]) => id === tool)![1]
const transparent: RgbaColor = { r: 0, g: 0, b: 0, a: 0 }
const storageKey = 'mosaico-pixel-document-v1'
const tabsStorageKey = 'mosaico-pixel-tabs-v1'
const hotkeys: Readonly<Record<string, Tool>> = { p: 'pencil', e: 'eraser', i: 'eyedropper', g: 'fill', l: 'line', r: 'rectangle', o: 'ellipse', m: 'select', h: 'pan' }
const maximumHistoryEntries = 50

type PixelSession = { undo: SpriteDocument[]; redo: SpriteDocument[] }
const createSession = (): PixelSession => ({ undo: [], redo: [] })
function pushHistory(stack: SpriteDocument[], entry: SpriteDocument) { stack.push(entry); if (stack.length > maximumHistoryEntries) stack.splice(0, stack.length - maximumHistoryEntries) }

const brushStorageKey = 'mosaico-pixel-brush-v1'
const brushShapeOptions: readonly [BrushShape, string, LucideIcon][] = [['square', 'Pincel cuadrado', Square], ['circle', 'Pincel circular', Circle], ['diamond', 'Pincel de diamante', Diamond]]
type BrushPreferences = { size?: number; shape?: BrushShape; alpha?: number }
function loadBrushPreferences(): BrushPreferences {
  if (typeof localStorage === 'undefined') return {}
  try {
    const value = JSON.parse(localStorage.getItem(brushStorageKey) ?? '') as BrushPreferences
    if (typeof value !== 'object' || value === null) return {}
    return { size: typeof value.size === 'number' ? value.size : undefined, shape: brushShapes.includes(value.shape as BrushShape) ? (value.shape as BrushShape) : undefined, alpha: typeof value.alpha === 'number' ? value.alpha : undefined }
  } catch { return {} }
}

const brushPresetsStorageKey = 'mosaico-pixel-brush-presets-v1'
const maximumBrushPresets = 64
const brushShapeNames: Record<BrushShape, string> = { square: 'cuadrado', circle: 'circular', diamond: 'diamante' }
function loadBrushPresets(): BrushPresetContract[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const value: unknown = JSON.parse(localStorage.getItem(brushPresetsStorageKey) ?? '')
    if (!Array.isArray(value)) return []
    return value.filter((item): item is BrushPresetContract => {
      if (typeof item !== 'object' || item === null) return false
      const preset = item as BrushPresetContract
      return typeof preset.id === 'string' && typeof preset.label === 'string' && brushShapes.includes(preset.shape) && typeof preset.size === 'number'
    }).slice(0, maximumBrushPresets).map((preset) => ({
      id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(preset.id) ? preset.id : crypto.randomUUID(),
      label: preset.label.trim().slice(0, 64) || `${clampBrushSize(preset.size)}px`,
      shape: preset.shape,
      size: clampBrushSize(preset.size),
    }))
  } catch { return [] }
}

function blank(width = 32, height = 32): SpriteDocument {
  return createSpriteDocument({ id: crypto.randomUUID(), name: 'Sprite sin título', width, height, layerId: crypto.randomUUID(), frameId: crypto.randomUUID() })
}

function initialDocument(): SpriteDocument {
  if (typeof localStorage === 'undefined') return blank()
  try { const saved = localStorage.getItem(storageKey); return saved ? deserializeSpriteDocument(saved) : blank() } catch { return blank() }
}

function initialDocuments(): SpriteDocument[] {
  const current = initialDocument()
  if (typeof localStorage === 'undefined') return [current]
  try {
    const value = JSON.parse(localStorage.getItem(tabsStorageKey) ?? '') as { documents?: string[]; activeId?: string }
    const documents = Array.isArray(value.documents) ? value.documents.flatMap((serialized) => { try { return [deserializeSpriteDocument(serialized)] } catch { return [] } }) : []
    if (!documents.length) return [current]
    const active = documents.find((item) => item.id === value.activeId) ?? documents.find((item) => item.id === current.id) ?? documents[0]!
    return [active, ...documents.filter((item) => item.id !== active.id)]
  } catch { return [current] }
}

function rgba(hex: string): RgbaColor {
  const value = Number.parseInt(hex.slice(1), 16)
  return { r: value >> 16, g: (value >> 8) & 255, b: value & 255, a: 255 }
}

const colorHex = ({ r, g, b }: RgbaColor) => `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`

function paint(document: SpriteDocument, points: readonly GridCoordinate[], color: RgbaColor, mask?: SelectionMask): SpriteDocument {
  const inside = points.filter((point) => point.x >= 0 && point.y >= 0 && point.x < document.width && point.y < document.height && (!mask || selectionContains(mask, point)))
  return inside.length ? setPixels(document, document.activeLayerId, document.activeFrameId, inside, color) : document
}

type SpriteLayerRow = { readonly layer: SpriteLayer; readonly depth: number }
function spriteLayerTree(layers: readonly SpriteLayer[]): SpriteLayerRow[] {
  const rows: SpriteLayerRow[] = []
  const visit = (parentId: string | undefined, depth: number) => {
    for (const layer of [...layers].reverse()) {
      if (layer.parentId !== parentId) continue
      rows.push({ layer, depth }); if (layer.isFolder && !layer.collapsed) visit(layer.id, depth + 1)
    }
  }
  visit(undefined, 0); return rows
}

function seamlessPoints(points: readonly GridCoordinate[], width: number, height: number, mode: 'none' | 'horizontal' | 'vertical' | 'total'): GridCoordinate[] {
  const result = new Map<string, GridCoordinate>(); const horizontal = mode === 'horizontal' || mode === 'total'; const vertical = mode === 'vertical' || mode === 'total'; const modulo = (value: number, size: number) => ((value % size) + size) % size
  for (const point of points) { if ((!horizontal && (point.x < 0 || point.x >= width)) || (!vertical && (point.y < 0 || point.y >= height))) continue; const next = { x: horizontal ? modulo(point.x, width) : point.x, y: vertical ? modulo(point.y, height) : point.y }; result.set(`${next.x},${next.y}`, next) }
  return [...result.values()]
}

function keepMask(before: SpriteDocument, after: SpriteDocument, mask?: SelectionMask): SpriteDocument {
  if (!mask) return after
  let next = before; const colors = new Map<string, { color: RgbaColor; points: GridCoordinate[] }>()
  for (const index of selectionIndexes(mask)) { const point = { x: index % mask.width, y: Math.floor(index / mask.width) }; const color = getPixel(after, after.activeLayerId, after.activeFrameId, point); const id = `${color.r},${color.g},${color.b},${color.a}`; const group = colors.get(id) ?? { color, points: [] }; group.points.push(point); colors.set(id, group) }
  for (const { color, points } of colors.values()) next = setPixels(next, next.activeLayerId, next.activeFrameId, points, color)
  return next
}

export function PixelArtEditor({ active = true }: { readonly active?: boolean } = {}) {
  const hostRef = useRef<HTMLDivElement>(null); const rendererRef = useRef<PixiPixelViewport | undefined>(undefined)
  const activeRef = useRef(active)
  const viewportRef = useRef<ViewportState>(createViewport({ width: 1, height: 1, zoom: 16, offsetX: 48, offsetY: 48 }))
  const [documents, setDocuments] = useState<SpriteDocument[]>(initialDocuments); const [document, setDocument] = useState<SpriteDocument>(() => documents[0]!); const documentRef = useRef(document)
  const panelLayout = usePanelLayout('pixel')
  const [openMenu, setOpenMenu] = useState<string>(); const [newDialog, setNewDialog] = useState(false)
  const [exportDialog, setExportDialog] = useState(false)
  const [saveModeDialog, setSaveModeDialog] = useState(false)
  const [exportOptions, setExportOptions] = useState<ExportOptions>({ format: 'png', scale: 1, transparent: true, quality: 92, name: document.name })
  const fileRef = useRef<HTMLInputElement>(null); const brushFileRef = useRef<HTMLInputElement>(null)
  const [tool, setTool] = useState<Tool>('pencil'); const toolRef = useRef(tool)
  const [color, setColor] = useState('#4bc3b7'); const colorRef = useRef(color)
  const [filled, setFilled] = useState(false); const filledRef = useRef(filled)
  const initialBrush = useMemo(loadBrushPreferences, [])
  const [brushSize, setBrushSize] = useState(clampBrushSize(initialBrush.size ?? 1)); const brushSizeRef = useRef(brushSize)
  const [brushShape, setBrushShape] = useState<BrushShape>(brushShapes.includes(initialBrush.shape ?? 'square') ? initialBrush.shape! : 'square'); const brushShapeRef = useRef(brushShape)
  const [alpha, setAlpha] = useState(Math.max(0, Math.min(100, Math.round(initialBrush.alpha ?? 100)))); const alphaRef = useRef(alpha)
  const [brushPresets, setBrushPresets] = useState<BrushPresetContract[]>(() => loadBrushPresets()); const brushPresetsRef = useRef(brushPresets)
  const [fillTolerance, setFillTolerance] = useState(0); const fillToleranceRef = useRef(fillTolerance)
  const [fillDiagonal, setFillDiagonal] = useState(false); const fillDiagonalRef = useRef(fillDiagonal)
  const polygonDraftRef = useRef<GridCoordinate[]>([])
  const referenceFileRef = useRef<HTMLInputElement>(null)
  const [floaters, setFloaters] = useState<{ id: string; name: string; url: string; x: number; y: number; width: number; height: number }[]>([])
  const floaterDragRef = useRef<{ id: string; mode: 'move' | 'resize'; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number } | undefined>(undefined)
  const [selectionMask, setSelectionMask] = useState<SelectionMask>()
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('rectangle'); const selectionModeRef = useRef<SelectionMode>('rectangle')
  const selectionMaskRef = useRef<SelectionMask | undefined>(undefined); const selectionBaseRef = useRef<SelectionMask | undefined>(undefined); const lassoRef = useRef<GridCoordinate[]>([]); const selectionOperationRef = useRef<'replace' | 'add' | 'subtract'>('replace')
  const [flyout, setFlyout] = useState<'selection' | 'shape'>()
  const holdTimerRef = useRef<number | undefined>(undefined)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number }>()
  const [playing, setPlaying] = useState(false); const playingRef = useRef(playing)
  const [renamingLayerId, setRenamingLayerId] = useState<string>()
  const [renameValue, setRenameValue] = useState('')
  const [draggingLayerId, setDraggingLayerId] = useState<string>()
  const [guides, setGuides] = useState(true); const guidesRef = useRef(guides)
  const [seamless, setSeamless] = useState<'none' | 'horizontal' | 'vertical' | 'total'>('none')
  const seamlessRef = useRef(seamless)
  const [onion, setOnion] = useState(false); const onionRef = useRef(false)
  const [, refreshViewport] = useState(0)
  const [status, setStatus] = useState('Listo para dibujar'); const [size, setSize] = useState({ width: 32, height: 32 })
  const sessionsRef = useRef<Map<string, PixelSession>>(new Map(documents.map((item) => [item.id, createSession()])))
  const undoRef = useRef<SpriteDocument[]>([]); const redoRef = useRef<SpriteDocument[]>([])
  const previewRef = useRef<SpriteDocument | undefined>(undefined)
  const pixelClipboardRef = useRef<{ width: number; height: number; pixels: RgbaColor[] } | undefined>(undefined)
  const gesture = useRef<{ start: GridCoordinate; last: GridCoordinate; before: SpriteDocument; screen: Point; panning: boolean; moving?: SelectionMask } | undefined>(undefined)

  const show = (next: SpriteDocument) => { documentRef.current = next; setDocument(next); setDocuments((items) => items.map((item) => item.id === next.id ? next : item)) }
  const saveSession = () => { sessionsRef.current.set(documentRef.current.id, { undo: undoRef.current, redo: redoRef.current }) }
  const switchDocument = (next: SpriteDocument) => {
    saveSession()
    const session = sessionsRef.current.get(next.id) ?? createSession()
    sessionsRef.current.set(next.id, session); undoRef.current = session.undo; redoRef.current = session.redo
    documentRef.current = next; setDocument(next); selectMask(); selectionBaseRef.current = undefined; lassoRef.current = []; window.requestAnimationFrame(fitCanvas)
  }
  const openDocument = (next: SpriteDocument) => {
    saveSession()
    const incoming = sessionsRef.current.has(next.id) ? { ...next, id: crypto.randomUUID() } : next
    setDocuments((items) => [...items.filter((item) => item.id !== incoming.id), incoming])
    sessionsRef.current.set(incoming.id, createSession()); undoRef.current = []; redoRef.current = []
    documentRef.current = incoming; setDocument(incoming); selectMask(); selectionBaseRef.current = undefined; lassoRef.current = []; window.requestAnimationFrame(fitCanvas)
  }
  const closeDocument = (id: string) => {
    if (documents.length <= 1) { setStatus('El Editor necesita al menos un documento abierto'); return }
    const index = documents.findIndex((item) => item.id === id)
    if (index < 0) return
    const remaining = documents.filter((item) => item.id !== id)
    if (documentRef.current.id === id) switchDocument(remaining[Math.min(index, remaining.length - 1)]!)
    sessionsRef.current.delete(id)
    setDocuments(remaining)
    setStatus('Documento cerrado')
  }
  const commit = (next: SpriteDocument, before = documentRef.current) => {
    if (next === before) return
    pushHistory(undoRef.current, before); redoRef.current = []; show(next)
  }
  const undo = () => { const previous = undoRef.current.pop(); if (!previous) return; redoRef.current.push(documentRef.current); show(previous) }
  const redo = () => { const next = redoRef.current.pop(); if (!next) return; undoRef.current.push(documentRef.current); show(next) }
  const selectMask = (mask?: SelectionMask) => { selectionMaskRef.current = mask; setSelectionMask(mask) }
  const activeColor = (): RgbaColor => { const base = rgba(colorRef.current); return { r: base.r, g: base.g, b: base.b, a: Math.max(0, Math.min(255, Math.round(alphaRef.current * 2.55))) } }
  const polygonOutline = (tail?: GridCoordinate): GridCoordinate[] => {
    const sequence = tail ? [...polygonDraftRef.current, tail] : [...polygonDraftRef.current]
    const width = documentRef.current.width; const height = documentRef.current.height
    const wrapped = seamlessPoints(sequence, width, height, seamlessRef.current)
    const seen = new Set<number>(); const outline: GridCoordinate[] = []
    for (let index = 0; index + 1 < wrapped.length; index += 1) for (const point of seamlessPoints(linePixels(wrapped[index]!, wrapped[index + 1]!), width, height, seamlessRef.current)) { const key = point.y * width + point.x; if (seen.has(key)) continue; seen.add(key); outline.push(point) }
    return outline
  }
  const updatePolygonPreview = (tail?: GridCoordinate) => { previewRef.current = paint(documentRef.current, polygonOutline(tail), activeColor(), selectionMaskRef.current); render() }
  const cancelPolygonStroke = () => { if (!polygonDraftRef.current.length) return; polygonDraftRef.current = []; previewRef.current = undefined; render() }
  const commitPolygonStroke = () => {
    const draft = [...polygonDraftRef.current]
    while (draft.length >= 2 && draft[draft.length - 1]!.x === draft[draft.length - 2]!.x && draft[draft.length - 1]!.y === draft[draft.length - 2]!.y) draft.pop()
    if (draft.length < 3) { setStatus('El polígono necesita al menos 3 vértices'); return }
    try {
      const base = documentRef.current
      const mask = polygonMask(draft, base.width, base.height)
      const filled = seamlessPoints(selectionIndexes(mask).map((index) => ({ x: index % base.width, y: Math.floor(index / base.width) })), base.width, base.height, seamlessRef.current)
      commit(paint(base, filled, activeColor(), selectionMaskRef.current), base)
      polygonDraftRef.current = []; previewRef.current = undefined
    } catch { setStatus('No se pudo aplicar la herramienta') }
  }
  const render = () => {
    const host = hostRef.current; const renderer = rendererRef.current
    if (!host || !renderer) return
    viewportRef.current = resizeViewport(viewportRef.current, Math.max(1, host.clientWidth), Math.max(1, host.clientHeight))
    const source = previewRef.current ?? documentRef.current
    renderer.render(onionRef.current && !playingRef.current ? onionSkinDocument(source) : source, viewportRef.current, guidesRef.current, seamlessRef.current)
  }
  const fitCanvas = () => {
    const host = hostRef.current; if (!host) return
    const zoom = Math.max(1, Math.min(host.clientWidth / documentRef.current.width, host.clientHeight / documentRef.current.height) * 0.85)
    viewportRef.current = { ...viewportRef.current, width: host.clientWidth, height: host.clientHeight, zoom, offsetX: (host.clientWidth - documentRef.current.width * zoom) / 2, offsetY: (host.clientHeight - documentRef.current.height * zoom) / 2 }
    render(); refreshViewport((value) => value + 1); setStatus('Lienzo centrado')
  }

  useEffect(() => { toolRef.current = tool; if (tool !== 'polygon' && polygonDraftRef.current.length) cancelPolygonStroke() }, [tool])
  useEffect(() => { selectionModeRef.current = selectionMode }, [selectionMode])
  useEffect(() => { colorRef.current = color }, [color])
  useEffect(() => { filledRef.current = filled }, [filled])
  useEffect(() => { brushSizeRef.current = brushSize }, [brushSize])
  useEffect(() => { brushShapeRef.current = brushShape }, [brushShape])
  useEffect(() => { alphaRef.current = alpha }, [alpha])
  useEffect(() => { try { localStorage.setItem(brushStorageKey, JSON.stringify({ size: brushSize, shape: brushShape, alpha })) } catch { /* preferencia descartable */ } }, [brushSize, brushShape, alpha])
  useEffect(() => { brushPresetsRef.current = brushPresets; try { localStorage.setItem(brushPresetsStorageKey, JSON.stringify(brushPresets)) } catch { /* preferencia descartable */ } }, [brushPresets])
  useEffect(() => { seamlessRef.current = seamless }, [seamless])
  useEffect(() => { onionRef.current = onion; render() }, [onion])
  useEffect(() => { guidesRef.current = guides }, [guides])
  useEffect(() => { playingRef.current = playing }, [playing])
  useEffect(() => { fillToleranceRef.current = fillTolerance }, [fillTolerance])
  useEffect(() => { fillDiagonalRef.current = fillDiagonal }, [fillDiagonal])
  useEffect(() => {
    const save = () => {
      try {
        const serialized = documents.map((item) => ({ id: item.id, value: serializeSpriteDocument(item) }))
        localStorage.setItem(storageKey, serialized.find((item) => item.id === document.id)?.value ?? serializeSpriteDocument(document))
        localStorage.setItem(tabsStorageKey, JSON.stringify({ activeId: document.id, documents: serialized.map((item) => item.value) }))
      } catch { setStatus('No se pudo guardar localmente') }
    }
    let idle = 0; let fallback: ReturnType<typeof setTimeout> | undefined
    const timer = window.setTimeout(() => {
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(save, { timeout: 2000 })
      else fallback = globalThis.setTimeout(save, 0)
    }, 750)
    return () => { window.clearTimeout(timer); if (idle && 'cancelIdleCallback' in window) window.cancelIdleCallback(idle); if (fallback) globalThis.clearTimeout(fallback) }
  }, [document, documents])
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string; file?: File }>).detail
      if (detail.target !== 'Editor' || !detail.file) return
      void importImage(detail.file).then((next) => { openDocument(next); setStatus('Asset abierto en Editor') }).catch((error: unknown) => setStatus(error instanceof Error ? error.message : 'No se pudo abrir el Asset'))
    }
    window.addEventListener('mosaico:asset-open', receive)
    return () => window.removeEventListener('mosaico:asset-open', receive)
  }, [])
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<PipelineTransferPayload>).detail
      if (!detail?.frames?.length) return
      try { openDocument(createSpriteDocumentFromFrames(detail.name, detail.width, detail.height, detail.frames.map((frame) => ({ pixels: new Uint8ClampedArray(frame.pixels), durationMs: frame.durationMs })))); setStatus('Resultado de Pipeline abierto en Editor') }
      catch (error: unknown) { setStatus(error instanceof Error ? error.message : 'No se pudo abrir el resultado en Editor') }
    }
    window.addEventListener('mosaico:pipeline-transfer-ready', receive)
    return () => window.removeEventListener('mosaico:pipeline-transfer-ready', receive)
  }, [])
  useEffect(() => {
    const closeMenus = (event: PointerEvent) => { if (!(event.target instanceof Element) || !event.target.closest('.menu-root')) setOpenMenu(undefined) }
    const escapeMenus = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const target = event.target; const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)
      if (!typing) { setOpenMenu(undefined); setFlyout(undefined) }
      setExportDialog(false); setNewDialog(false); setSaveModeDialog(false)
    }
    window.addEventListener('pointerdown', closeMenus); window.addEventListener('keydown', escapeMenus)
    return () => { window.removeEventListener('pointerdown', closeMenus); window.removeEventListener('keydown', escapeMenus) }
  }, [])
  useEffect(() => () => { if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current) }, [])
  useEffect(() => { if (active) render() }, [active, document, guides, seamless])
  useEffect(() => {
    activeRef.current = active
    if (!active) setPlaying(false)
    else window.requestAnimationFrame(() => { if (viewportRef.current.width <= 1) fitCanvas(); else render() })
  }, [active])
  useEffect(() => {
    if (!active || !playing) return
    const currentIndex = document.frames.findIndex((frame) => frame.id === document.activeFrameId)
    const current = document.frames[currentIndex] ?? document.frames[0]!
    const timer = window.setTimeout(() => {
      const next = document.frames[(currentIndex + 1) % document.frames.length]!
      show({ ...documentRef.current, activeFrameId: next.id })
    }, current.durationMs)
    return () => window.clearTimeout(timer)
  }, [active, playing, document.activeFrameId, document.frames])

  useEffect(() => {
    const host = hostRef.current; if (!host) return
    let disposed = false
    const point = (event: MouseEvent | PointerEvent | WheelEvent): Point => { const box = host.getBoundingClientRect(); return { x: event.clientX - box.left, y: event.clientY - box.top } }
    const pixel = (event: PointerEvent) => pickSpritePixel(viewportRef.current, point(event), documentRef.current)
    const grid = (event: PointerEvent): GridCoordinate => { const world = screenToWorld(viewportRef.current, point(event)); return { x: Math.floor(world.x), y: Math.floor(world.y) } }
    const seamlessGrid = (event: PointerEvent): GridCoordinate | undefined => { const screen = point(event); if (!isPointInsideViewport(viewportRef.current, screen)) return undefined; const raw = grid(event); const mode = seamlessRef.current; const horizontal = mode === 'horizontal' || mode === 'total'; const vertical = mode === 'vertical' || mode === 'total'; const inX = horizontal || (raw.x >= 0 && raw.x < documentRef.current.width); const inY = vertical || (raw.y >= 0 && raw.y < documentRef.current.height); return inX && inY ? raw : undefined }
    const gesturePixel = (event: PointerEvent) => seamlessRef.current === 'none' ? pixel(event) : seamlessGrid(event)
    const safely = (action: () => void) => { try { action() } catch (error) { setStatus(error instanceof Error && error.message === 'SPRITE_LAYER_LOCKED' ? 'Capa bloqueada' : error instanceof Error && error.message === 'SPRITE_LAYER_HIDDEN' ? 'Capa oculta: muéstrala para editar' : 'No se pudo aplicar la herramienta') } }
    const applyStroke = (from: GridCoordinate, to: GridCoordinate) => safely(() => {
      const base = seamlessPoints(linePixels(from, to), documentRef.current.width, documentRef.current.height, seamlessRef.current)
      const mode = seamlessRef.current; const wrapX = mode === 'horizontal' || mode === 'total'; const wrapY = mode === 'vertical' || mode === 'total'
      const points = expandStroke(base, clampBrushSize(brushSizeRef.current), brushShapeRef.current, documentRef.current.width, documentRef.current.height, wrapX, wrapY)
      show(paint(documentRef.current, points, toolRef.current === 'eraser' ? transparent : activeColor(), selectionMaskRef.current))
    })
    const constrained = (start: GridCoordinate, end: GridCoordinate, shift: boolean) => !shift ? end : toolRef.current === 'line' ? snapLineEnd(start, end) : constrainSquareEnd(start, end)
    const shapePoints = (start: GridCoordinate, end: GridCoordinate) => toolRef.current === 'line' ? linePixels(start, end)
      : toolRef.current === 'rectangle' ? rectanglePixels(start, end, filledRef.current) : ellipsePixels(start, end, filledRef.current)
    const applySelection = (next: SelectionMask) => selectMask(combineSelection(selectionBaseRef.current, next, selectionOperationRef.current))
    const down = (event: PointerEvent) => {
      host.focus({ preventScroll: true })
      const screen = point(event); const picked = gesturePixel(event)
      if (event.button === 1 || toolRef.current === 'pan') {
        event.preventDefault(); host.setPointerCapture(event.pointerId)
        const fallback = picked ?? { x: 0, y: 0 }; gesture.current = { start: fallback, last: fallback, before: documentRef.current, screen, panning: true }; return
      }
      if (event.button !== 0) return
      setContextMenu(undefined)
      // Clic fuera de la rejilla NO descarta la selección existente (comportamiento estándar de editores).
      if (!picked) { setContextMenu(undefined); return }
      const sampleAt = (rawTarget: GridCoordinate): void => {
        // Con mosaico continuo el puntero puede salir de rango: envuelve antes de leer.
        const mode = seamlessRef.current; const wrapX = mode === 'horizontal' || mode === 'total'; const wrapY = mode === 'vertical' || mode === 'total'
        const width = documentRef.current.width; const height = documentRef.current.height
        if (!wrapX && (rawTarget.x < 0 || rawTarget.x >= width)) return
        if (!wrapY && (rawTarget.y < 0 || rawTarget.y >= height)) return
        const target = { x: wrapX ? ((rawTarget.x % width) + width) % width : rawTarget.x, y: wrapY ? ((rawTarget.y % height) + height) % height : rawTarget.y }
        const current = documentRef.current; const pixels = composeSpriteFrame(current, current.activeFrameId); const index = (target.y * width + target.x) * 4
        const sampled = colorHex({ r: pixels[index]!, g: pixels[index + 1]!, b: pixels[index + 2]!, a: pixels[index + 3]! }); setColor(sampled); setAlpha(Math.round((pixels[index + 3] ?? 0) / 2.55)); setStatus(`Color ${sampled}`)
      }
      if (event.altKey) { sampleAt(picked); return }
      if (toolRef.current === 'eyedropper') { sampleAt(picked); return }
      const activeLayer = documentRef.current.layers.find((layer) => layer.id === documentRef.current.activeLayerId)
      if (!activeLayer?.visible && (toolRef.current !== 'select' || (selectionMaskRef.current && selectionContains(selectionMaskRef.current, picked)))) { setStatus('Capa oculta: muéstrala para editar'); return }
      host.setPointerCapture(event.pointerId); gesture.current = { start: picked, last: picked, before: documentRef.current, screen, panning: false }
      if (toolRef.current === 'polygon') {
        const draft = polygonDraftRef.current
        if (draft.length >= 3) { const first = draft[0]!; if (Math.abs(first.x - picked.x) <= 1 && Math.abs(first.y - picked.y) <= 1) { commitPolygonStroke(); return } }
        draft.push(picked); updatePolygonPreview(); return
      }
      if (toolRef.current === 'select') {
        const selected = selectionMaskRef.current
        if (selected && selectionContains(selected, picked) && !event.shiftKey && !event.altKey) { gesture.current.moving = selected; setContextMenu(undefined); return }
        selectionBaseRef.current = selectionMaskRef.current; selectionOperationRef.current = event.altKey ? 'subtract' : event.shiftKey ? 'add' : 'replace'; lassoRef.current = [picked]
        if (selectionModeRef.current === 'magic') { const current = documentRef.current; applySelection(magicMask(picked, current.width, current.height, (point) => JSON.stringify(getPixel(current, current.activeLayerId, current.activeFrameId, point)))) }
        else applySelection(selectionModeRef.current === 'ellipse' ? ellipseMask(picked, picked, documentRef.current.width, documentRef.current.height) : rectangleMask(picked, picked, documentRef.current.width, documentRef.current.height))
      }
      if (toolRef.current === 'fill') safely(() => { const current = documentRef.current; const origin = seamlessPoints([picked], current.width, current.height, seamlessRef.current)[0]; if (origin) commit(keepMask(current, fillPixels(current, current.activeLayerId, current.activeFrameId, origin, activeColor(), { tolerance: fillToleranceRef.current, connectivity: fillDiagonalRef.current ? 8 : 4 }), selectionMaskRef.current)) })
      else if (toolRef.current === 'pencil' || toolRef.current === 'eraser') applyStroke(picked, picked)
    }
    const move = (event: PointerEvent) => {
      const active = gesture.current; const currentScreen = point(event)
      if (active?.panning) { viewportRef.current = panViewport(viewportRef.current, currentScreen.x - active.screen.x, currentScreen.y - active.screen.y); active.screen = currentScreen; render(); refreshViewport((value) => value + 1); return }
      const picked = active && (active.moving || toolRef.current === 'select') ? grid(event) : gesturePixel(event); if (picked) setStatus(`${picked.x}, ${picked.y} · ${documentRef.current.width}×${documentRef.current.height}`)
      if (!active || !picked || (picked.x === active.last.x && picked.y === active.last.y)) return
      if (active.moving) {
        const dx = picked.x - active.start.x; const dy = picked.y - active.start.y
        previewRef.current = moveSpritePixels(active.before, active.before.activeLayerId, active.before.activeFrameId, selectionIndexes(active.moving), dx, dy); selectMask(translateSelection(active.moving, dx, dy)); render()
      } else if (toolRef.current === 'polygon') { updatePolygonPreview(picked); active.last = picked }
      else if (toolRef.current === 'pencil' || toolRef.current === 'eraser') applyStroke(active.last, picked)
      else if (toolRef.current === 'select' && selectionModeRef.current !== 'magic') { lassoRef.current.push(picked); applySelection(selectionModeRef.current === 'ellipse' ? ellipseMask(active.start, picked, documentRef.current.width, documentRef.current.height) : selectionModeRef.current === 'lasso' ? polygonMask(lassoRef.current, documentRef.current.width, documentRef.current.height) : rectangleMask(active.start, picked, documentRef.current.width, documentRef.current.height)) }
      else if (toolRef.current === 'line' || toolRef.current === 'rectangle' || toolRef.current === 'ellipse') safely(() => { previewRef.current = paint(active.before, seamlessPoints(shapePoints(active.start, constrained(active.start, picked, event.shiftKey)), documentRef.current.width, documentRef.current.height, seamlessRef.current), activeColor(), selectionMaskRef.current); render() })
      active.last = picked
    }
    const up = (event: PointerEvent) => {
      const active = gesture.current; if (!active) return
      const picked = constrained(active.start, gesturePixel(event) ?? active.last, event.shiftKey); const activeTool = toolRef.current; const colorValue = activeColor()
      const preview = previewRef.current; previewRef.current = undefined
      if (active.moving && preview) safely(() => commit(preview, active.before))
      else if (!active.panning && (activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'ellipse')) safely(() => commit(paint(active.before, seamlessPoints(shapePoints(active.start, picked), documentRef.current.width, documentRef.current.height, seamlessRef.current), colorValue, selectionMaskRef.current), active.before))
      if ((activeTool === 'pencil' || activeTool === 'eraser') && documentRef.current !== active.before) { pushHistory(undoRef.current, active.before); redoRef.current = [] }
      if (activeTool === 'polygon' && polygonDraftRef.current.length >= 2) updatePolygonPreview()
      gesture.current = undefined; if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId)
    }
    const wheel = (event: WheelEvent) => { event.preventDefault(); viewportRef.current = zoomViewportAt(viewportRef.current, point(event), Math.exp(-event.deltaY * 0.0015)); render(); refreshViewport((value) => value + 1) }
    const auxiliary = (event: MouseEvent) => { if (event.button === 1) event.preventDefault() }
    const doubleClick = () => { if (toolRef.current === 'polygon') commitPolygonStroke() }
    const context = (event: MouseEvent) => { const picked = seamlessRef.current === 'none' ? pickSpritePixel(viewportRef.current, point(event), documentRef.current) : seamlessGrid(event as unknown as PointerEvent); if (picked && selectionMaskRef.current && selectionContains(selectionMaskRef.current, seamlessPoints([picked], documentRef.current.width, documentRef.current.height, seamlessRef.current)[0] ?? picked)) { event.preventDefault(); const screen = point(event); setContextMenu({ x: screen.x, y: screen.y }) } }
    const observer = new ResizeObserver(render); observer.observe(host)
    void PixiPixelViewport.create(host).then((renderer) => { if (disposed) renderer.destroy(); else { rendererRef.current = renderer; fitCanvas() } })
    const cancel = () => { previewRef.current = undefined; gesture.current = undefined; render() }
    host.addEventListener('pointerdown', down); host.addEventListener('pointermove', move); host.addEventListener('pointerup', up); host.addEventListener('pointercancel', cancel); host.addEventListener('lostpointercapture', cancel); host.addEventListener('wheel', wheel, { passive: false }); host.addEventListener('auxclick', auxiliary); host.addEventListener('contextmenu', context); host.addEventListener('dblclick', doubleClick)
    return () => { disposed = true; observer.disconnect(); host.removeEventListener('pointerdown', down); host.removeEventListener('pointermove', move); host.removeEventListener('pointerup', up); host.removeEventListener('pointercancel', cancel); host.removeEventListener('lostpointercapture', cancel); host.removeEventListener('wheel', wheel); host.removeEventListener('auxclick', auxiliary); host.removeEventListener('contextmenu', context); host.removeEventListener('dblclick', doubleClick); rendererRef.current?.destroy(); rendererRef.current = undefined }
  }, [])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!activeRef.current) return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return
      const modifier = event.ctrlKey || event.metaKey
      if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return }
      if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return }
      const clipboardCommand = selectionClipboardCommand(event)
      if (clipboardCommand === 'copy') { event.preventDefault(); copySelection(); return }
      if (clipboardCommand === 'cut') { event.preventDefault(); cutSelection(); return }
      if (clipboardCommand === 'paste') { event.preventDefault(); pasteSelection(); return }
      if (event.altKey && event.shiftKey && event.key === 'Delete') { event.preventDefault(); deleteSelection(); return }
      if (toolRef.current === 'polygon' && (event.key === 'Enter' || event.key === 'Escape')) {
        event.preventDefault(); if (event.key === 'Enter') commitPolygonStroke(); else cancelPolygonStroke(); return
      }
      if (!(event.target instanceof HTMLInputElement) && event.code === 'Digit0') { event.preventDefault(); fitCanvas(); return }
      const selectedTool = hotkeys[event.key.toLowerCase()]
      if (!(event.target instanceof HTMLInputElement) && selectedTool) { event.preventDefault(); setTool(selectedTool); return }
      if ((event.key !== 'PageUp' && event.key !== 'PageDown') || event.target instanceof HTMLInputElement) return
      event.preventDefault(); const current = documentRef.current; const index = current.frames.findIndex((frame) => frame.id === current.activeFrameId)
      const next = Math.max(0, Math.min(current.frames.length - 1, index + (event.key === 'PageUp' ? -1 : 1)))
      setPlaying(false); selectMask(); show(selectSpriteFrame(current, current.frames[next]!.id))
    }
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown)
  }, [])

  const addLayer = () => { const parentId = documentRef.current.layers.find((layer) => layer.id === documentRef.current.activeLayerId)?.isFolder ? documentRef.current.activeLayerId : undefined; commit(addSpriteLayer(documentRef.current, { id: crypto.randomUUID(), name: `Capa ${documentRef.current.layers.length + 1}`, parentId })) }
  const addFolder = () => { try { commit(addSpriteFolder(documentRef.current, { id: crypto.randomUUID(), name: `Carpeta ${documentRef.current.layers.filter((layer) => layer.isFolder).length + 1}` })) } catch { setStatus('No se pudo crear la carpeta') } }
  const removeLayer = () => { try { commit(removeSpriteLayer(documentRef.current, documentRef.current.activeLayerId)) } catch { setStatus('El documento necesita al menos una capa') } }
  const copySelection = () => { const bounds = selectionMaskRef.current && selectionBounds(selectionMaskRef.current); if (!bounds) { setStatus('Selecciona píxeles para copiar'); return } const pixels: RgbaColor[] = []; for (let y = 0; y < bounds.height; y += 1) for (let x = 0; x < bounds.width; x += 1) { const px = bounds.x + x; const py = bounds.y + y; if (px < 0 || py < 0 || px >= documentRef.current.width || py >= documentRef.current.height) { pixels.push(transparent); continue } pixels.push(getPixel(documentRef.current, documentRef.current.activeLayerId, documentRef.current.activeFrameId, { x: px, y: py })) } pixelClipboardRef.current = { width: bounds.width, height: bounds.height, pixels }; setStatus('Selección copiada') }
  const cutSelection = () => { const bounds = selectionMaskRef.current && selectionBounds(selectionMaskRef.current); if (!bounds) { setStatus('Selecciona píxeles para cortar'); return } copySelection(); const points = selectionIndexes(selectionMaskRef.current!); commit(setPixels(documentRef.current, documentRef.current.activeLayerId, documentRef.current.activeFrameId, points.map((index) => ({ x: index % documentRef.current.width, y: Math.floor(index / documentRef.current.width) })), transparent)); setStatus('Selección cortada') }
  const deleteSelection = () => { const mask = selectionMaskRef.current; if (!mask) return; const points = selectionIndexes(mask).map((index) => ({ x: index % documentRef.current.width, y: Math.floor(index / documentRef.current.width) })); commit(setPixels(documentRef.current, documentRef.current.activeLayerId, documentRef.current.activeFrameId, points, transparent)); }
  const pasteSelection = () => { const value = pixelClipboardRef.current; if (!value) { setStatus('El portapapeles del Editor está vacío'); return } const bounds = selectionMaskRef.current ? selectionBounds(selectionMaskRef.current) : undefined; const origin = bounds ? { x: bounds.x, y: bounds.y } : { x: 0, y: 0 }; const points: GridCoordinate[] = []; const colors = new Map<string, { color: RgbaColor; points: GridCoordinate[] }>(); for (let y = 0; y < value.height; y += 1) for (let x = 0; x < value.width; x += 1) { const target = { x: origin.x + x, y: origin.y + y }; if (target.x < 0 || target.y < 0 || target.x >= documentRef.current.width || target.y >= documentRef.current.height) continue; const color = value.pixels[y * value.width + x]!; const id = `${color.r},${color.g},${color.b},${color.a}`; const group = colors.get(id) ?? { color, points: [] }; group.points.push(target); colors.set(id, group); points.push(target) } let next = documentRef.current; for (const group of colors.values()) next = setPixels(next, next.activeLayerId, next.activeFrameId, group.points, group.color); commit(next); selectMask(rectangleMask(origin, { x: origin.x + value.width - 1, y: origin.y + value.height - 1 }, next.width, next.height)); setStatus('Selección pegada') }
  const newCanvas = () => { const dimension = (value: number) => Number.isFinite(value) && value >= 1 ? Math.max(1, Math.min(4096, Math.trunc(value))) : 32; openDocument(blank(dimension(size.width), dimension(size.height))); setNewDialog(false); setStatus('Nuevo lienzo creado') }
  const saveCurrentBrushPreset = () => {
    if (brushPresets.length >= maximumBrushPresets) { setStatus('La biblioteca de pinceles está llena'); return }
    setBrushPresets((items) => [...items, { id: crypto.randomUUID(), label: `${brushSize}px ${brushShapeNames[brushShape]}`, shape: brushShape, size: brushSize }])
    setStatus('Pincel guardado en la biblioteca')
  }
  const applyBrushPreset = (id: string) => {
    const preset = brushPresets.find((item) => item.id === id); if (!preset) return
    setBrushSize(clampBrushSize(preset.size)); setBrushShape(preset.shape); setStatus(`Pincel ${preset.label} aplicado`)
  }
  const exportBrushPack = () => {
    if (!brushPresets.length) { setStatus('No hay pinceles guardados para exportar'); return }
    try {
      const pack = createBrushPack({ format: 'mosaico-brush-pack', formatVersion: 1, name: document.name || 'Pinceles', brushes: brushPresets })
      void saveBlob(pack, `${document.name.replace(/[^a-z0-9_-]+/gi, '-')}-pinceles${BRUSH_PACK_EXTENSION}`).then(() => setStatus('Paquete de pinceles exportado')).catch((error: unknown) => { if (!(error instanceof DOMException) || error.name !== 'AbortError') setStatus('No se pudo guardar el paquete') })
    } catch { setStatus('No se pudo generar el paquete de pinceles') }
  }
  const importBrushPackFile = async (file?: File) => {
    if (!file) return
    try {
      const pack = await loadBrushPack(file)
      const current = brushPresetsRef.current; const existing = new Set(current.map((item) => item.id))
      const merged = [...current]
      let added = 0
      for (const preset of pack.brushes) if (!existing.has(preset.id) && merged.length < maximumBrushPresets) { merged.push(preset); added += 1 }
      setBrushPresets(merged)
      setStatus(`${pack.name}: ${added} pincel/es importados de ${pack.brushes.length}`)
    } catch { setStatus('No se pudo leer el paquete de pinceles') }
  }
  const runSpriteFilter = (filter: SpriteFilter) => {
    try {
      const mask = selectionMaskRef.current
      const scope = mask ? { points: selectionIndexes(mask).map((index) => ({ x: index % documentRef.current.width, y: Math.floor(index / documentRef.current.width) })) } : undefined
      const result = applySpriteFilter(documentRef.current, filter, scope)
      if (!result.changed) { setStatus('El filtro no produjo cambios'); return }
      commit(result.next); setStatus('Filtro aplicado')
    } catch { setStatus('No se pudo aplicar el filtro') }
  }
  const runNumericSpriteFilter = (label: string, minimum: number, maximum: number, fallback: string, build: (value: number) => SpriteFilter) => {
    const value = window.prompt(`${label} (${minimum} a ${maximum})`, fallback); if (value === null) return
    runSpriteFilter(build(Number(value)))
  }
  const addReferenceFloater = (file?: File) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const naturalWidth = image.naturalWidth || 320; const naturalHeight = image.naturalHeight || 240
      const scale = Math.min(1, 440 / naturalWidth, 360 / naturalHeight)
      setFloaters((items) => [...items, { id: crypto.randomUUID(), name: file.name, url, x: 24 + (items.length % 6) * 28, y: 20 + (items.length % 5) * 24, width: Math.max(96, Math.round(naturalWidth * scale)), height: Math.max(72, Math.round(naturalHeight * scale)) }])
      setStatus('Referencia insertada: arrastrala por la barra y escalala desde la esquina')
    }
    image.onerror = () => { URL.revokeObjectURL(url); setStatus('No se pudo cargar la referencia') }
    image.src = url
  }
  const startFloaterDrag = (event: ReactPointerEvent, id: string, mode: 'move' | 'resize', floater: { x: number; y: number; width: number; height: number }) => {
    event.preventDefault(); event.stopPropagation()
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    floaterDragRef.current = { id, mode, startX: event.clientX, startY: event.clientY, origX: floater.x, origY: floater.y, origW: floater.width, origH: floater.height }
  }
  const dragFloater = (event: ReactPointerEvent) => {
    const drag = floaterDragRef.current; if (!drag) return
    const deltaX = event.clientX - drag.startX; const deltaY = event.clientY - drag.startY
    setFloaters((items) => items.map((item) => {
      if (item.id !== drag.id) return item
      return drag.mode === 'move'
        ? { ...item, x: Math.max(-item.width + 48, drag.origX + deltaX), y: Math.max(0, drag.origY + deltaY) }
        : { ...item, width: Math.max(96, drag.origW + deltaX), height: Math.max(72, drag.origH + deltaY) }
    }))
  }
  const endFloaterDrag = () => { floaterDragRef.current = undefined }
  const bringFloaterToFront = (id: string) => setFloaters((items) => { const target = items.find((item) => item.id === id); return target && items[items.length - 1]!.id !== id ? [...items.filter((item) => item.id !== id), target] : items })
  const closeFloater = (id: string) => setFloaters((items) => { const target = items.find((item) => item.id === id); if (target) URL.revokeObjectURL(target.url); return items.filter((item) => item.id !== id) })
  const addFrame = (duplicate: boolean) => { setPlaying(false); selectMask(); commit(addSpriteFrame(documentRef.current, { id: crypto.randomUUID(), duplicateFromFrameId: duplicate ? document.activeFrameId : undefined })) }
  const removeFrame = () => { try { setPlaying(false); selectMask(); commit(removeSpriteFrame(documentRef.current, document.activeFrameId)) } catch { setStatus('La animación necesita al menos un frame') } }
  const chooseFrame = (frameId: string) => { setPlaying(false); selectMask(); show(selectSpriteFrame(documentRef.current, frameId)) }
  const activeFrame = document.frames.find((frame) => frame.id === document.activeFrameId)!
  const layerTree = useMemo(() => spriteLayerTree(document.layers), [document.layers])
  const dropLayer = (sourceId: string, targetId?: string) => {
    if (!sourceId || sourceId === targetId) return
    try {
      const source = documentRef.current.layers.find((layer) => layer.id === sourceId)
      const target = targetId ? documentRef.current.layers.find((layer) => layer.id === targetId) : undefined
      const parentId = target?.isFolder ? target.id : target?.parentId
      let next = source?.parentId === parentId ? documentRef.current : setSpriteLayerParent(documentRef.current, sourceId, parentId)
      if (target && !target.isFolder) next = reorderSpriteLayer(next, sourceId, next.layers.findIndex((layer) => layer.id === target.id))
      commit(next)
    } catch { setStatus('No se pudo mover la capa') }
  }
  const removeLayerById = (layerId: string) => { try { commit(removeSpriteLayer(documentRef.current, layerId)) } catch { setStatus('El documento necesita al menos una capa') } }
  const beginLayerRename = (layer: SpriteLayer) => { setRenamingLayerId(layer.id); setRenameValue(layer.name) }
  const finishLayerRename = () => {
    const id = renamingLayerId; const value = renameValue.trim(); setRenamingLayerId(undefined)
    if (!id || !value) return
    try { commit(updateSpriteLayer(documentRef.current, id, { name: value })) } catch { setStatus('Nombre no válido') }
  }
  const beginExport = (format: ExportFormat = 'png') => { setExportOptions({ format, scale: 1, transparent: format !== 'jpeg', quality: 92, name: document.name }); setExportDialog(true) }
  const importFile = async (file?: File) => {
    if (!file) return
    try {
      const next = file.name.endsWith('.mpe') || file.name.endsWith('.mosaico') || file.type === 'application/json' || file.type === 'application/vnd.mosaico.editor+json' ? deserializeSpriteDocument(await file.text()) : await importImage(file)
      openDocument(next); setStatus(`${file.name} importado`)
    } catch { setStatus('No se pudo importar el archivo') }
  }
  const openFile = async () => {
    try { const file = await chooseImageFile(); if (file) await importFile(file); else fileRef.current?.click() }
    catch (error) { if (!(error instanceof DOMException) || error.name !== 'AbortError') setStatus('No se pudo abrir el explorador') }
  }
  const saveProject = async () => {
    try { await saveSpriteProject(document, serializeSpriteDocument(document)); setStatus('Proyecto guardado') }
    catch (error) { if (!(error instanceof DOMException) || error.name !== 'AbortError') setStatus('No se pudo guardar') }
  }
  const confirmExport = async () => {
    try { await exportDocument(document, exportOptions); setExportDialog(false); setStatus(`${exportOptions.format.toUpperCase()} exportado`) }
    catch (error) { if (!(error instanceof DOMException) || error.name !== 'AbortError') setStatus('No se pudo exportar') }
  }
  const exportSheet = () => {
    const width = document.width * document.frames.length
    if (width > 16_384 || width * document.height > 67_108_864) { setStatus('Sprite sheet excede límite seguro del navegador'); return }
    const canvas = window.document.createElement('canvas'); canvas.width = width; canvas.height = document.height; const context = canvas.getContext('2d'); if (!context) return
    document.frames.forEach((frame, index) => context.putImageData(new ImageData(new Uint8ClampedArray(composeSpriteFrame(document, frame.id)), document.width, document.height), index * document.width, 0))
    canvas.toBlob((blob) => { if (blob) void saveBlob(blob, `${document.name.replace(/[^a-z0-9_-]+/gi, '-')}-sheet.png`).then(() => setStatus('Sprite sheet exportado')) }, 'image/png')
  }
  const transferToMaps = async () => {
    const canvas = window.document.createElement('canvas'); canvas.width = document.width * document.frames.length; canvas.height = document.height; const context = canvas.getContext('2d'); if (!context) return
    document.frames.forEach((frame, index) => context.putImageData(new ImageData(new Uint8ClampedArray(composeSpriteFrame(document, frame.id)), document.width, document.height), index * document.width, 0))
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png')); if (!blob) return
    window.dispatchEvent(new CustomEvent('mosaico:map-import', { detail: { file: new File([blob], `${document.name}-tilesheet.png`, { type: 'image/png' }), tileWidth: document.width, tileHeight: document.height, name: `${document.name} tileset` } })); setStatus('Tilesheet enviado a Mapas')
  }
  const createSpriteBlob = async (frameId: string = document.activeFrameId): Promise<Blob | undefined> => {
    const blob = await new Promise<Blob | null>((resolve) => { const canvas = window.document.createElement('canvas'); canvas.width = document.width; canvas.height = document.height; const context = canvas.getContext('2d'); if (!context) return resolve(null); context.putImageData(new ImageData(new Uint8ClampedArray(composeSpriteFrame(document, frameId)), document.width, document.height), 0, 0); canvas.toBlob(resolve, 'image/png') }); if (!blob) return
    return blob
  }
  const transferToAssets = async () => {
    const blob = await createSpriteBlob(); if (!blob) return
    window.dispatchEvent(new CustomEvent('mosaico:asset-import', { detail: { file: new File([blob], `${document.name}.png`, { type: 'image/png' }), kind: 'sprite', sourceName: document.name } })); setStatus('Sprite enviado a Assets')
  }
  const transferAnimationToAssets = async () => {
    const blob = encodeSpriteGif(document)
    window.dispatchEvent(new CustomEvent('mosaico:asset-import', { detail: { file: new File([blob], `${document.name}.gif`, { type: 'image/gif' }), kind: 'animation', sourceName: document.name } })); setStatus('Animación enviada a Assets')
  }
  const transferTilesheetToAssets = async () => {
    const width = document.width * document.frames.length; const canvas = window.document.createElement('canvas'); canvas.width = width; canvas.height = document.height; const context = canvas.getContext('2d'); if (!context) return
    document.frames.forEach((frame, index) => context.putImageData(new ImageData(new Uint8ClampedArray(composeSpriteFrame(document, frame.id)), document.width, document.height), index * document.width, 0))
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png')); if (!blob) return
    window.dispatchEvent(new CustomEvent('mosaico:asset-import', { detail: { file: new File([blob], `${document.name}-tilesheet.png`, { type: 'image/png' }), kind: 'tilesheet', sourceName: document.name } })); setStatus('Tilesheet enviado a Assets')
  }
  const startHold = (group: 'shape' | 'selection', event: ReactPointerEvent) => { if (event.button === 0) holdTimerRef.current = window.setTimeout(() => setFlyout(group), 450) }
  const stopHold = () => { if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current); holdTimerRef.current = undefined }
  const shapeTool = shapes.find(([id]) => id === tool) ?? shapes[0]!
  const selectionTool = selections.find(([id]) => id === selectionMode)!
  const ShapeIcon = shapeTool[2]; const SelectionIcon = selectionTool[2]
  // ponytail: SVG stays simplest at current 512² limit; move mask into Pixi only if profiling shows lag.
  const selectionPath = selectionMask ? selectionOutlinePath(selectionMask) : ''
  const selectionStyle = { left: viewportRef.current.offsetX, top: viewportRef.current.offsetY, width: document.width * viewportRef.current.zoom, height: document.height * viewportRef.current.zoom }
  const palette = useMemo(() => [...new Set([color, ...usedPalette(document)])].slice(0, 32), [color, document])
  const maximumScale = Math.max(1, Math.min(32, Math.floor(16_384 / document.width), Math.floor(16_384 / document.height), Math.floor(Math.sqrt(67_108_864 / (document.width * document.height)))))
  type MenuAction = readonly [string, () => void, boolean?]
  type MenuEntries = readonly (MenuAction | readonly [string, readonly MenuAction[]])[]
  const menus: Record<string, MenuEntries> & { Archivo: MenuEntries; Editar: MenuEntries; Capa: MenuEntries; Vista: MenuEntries; Ventana: MenuEntries } = {
    Archivo: [['Nuevo…', () => setNewDialog(true)], ['Abrir…', () => void openFile()], ['Guardar proyecto', () => void saveProject()], ['Exportar…', () => beginExport('png')]],
    Editar: [['Deshacer', undo], ['Rehacer', redo]],
    Imagen: [['Centrar y ajustar', fitCanvas], ['Exportar…', () => beginExport('png')]],
    Capa: [['Nueva capa', addLayer], ['Eliminar capa', removeLayer]],
    Seleccionar: [['Seleccionar todo', () => selectMask(rectangleMask({ x: 0, y: 0 }, { x: document.width - 1, y: document.height - 1 }, document.width, document.height))], ['Invertir selección', () => selectionMaskRef.current && selectMask(invertSelection(selectionMaskRef.current))], ['Deseleccionar', () => selectMask()]],
    Filtro: [['Invertir', () => runSpriteFilter(invertFilter)], ['Escala de grises', () => runSpriteFilter(grayscaleFilter)], ['Sepia', () => runSpriteFilter(sepiaFilter)], ['Contorno (color actual)', () => runSpriteFilter(createOutlineFilter(activeColor()))], ['Brillo…', () => runNumericSpriteFilter('Brillo', -255, 255, '32', createBrightnessFilter)], ['Contraste…', () => runNumericSpriteFilter('Contraste', -100, 100, '25', createContrastFilter)]], Vista: [['Centrar lienzo', fitCanvas], ['Onion skin', () => setOnion((value) => !value)]], Ventana: [['Restablecer espacio', fitCanvas]], Otro: [['Mosaico Pixel Art', () => setStatus('Editor compartido Web + Desktop')]],
  }

  if (!menus.Editar.some(([label]) => label === 'Copiar selección')) menus.Editar = [...menus.Editar, ['Copiar selección', copySelection], ['Cortar selección', cutSelection], ['Pegar selección', pasteSelection], ['Eliminar selección', deleteSelection]]
  if (!menus.Capa.some(([label]) => label === 'Nueva carpeta')) menus.Capa = [...menus.Capa, ['Nueva carpeta', addFolder]]
  if (!menus.Vista.some(([label]) => label === 'Seamless')) menus.Vista = [...menus.Vista, ['Guías entre celdas', () => setGuides((value) => !value)], ['No Seamless', () => setSeamless('none')], ['Seamless', [['Horizontal', () => setSeamless('horizontal')], ['Vertical', () => setSeamless('vertical')], ['Total', () => setSeamless('total')]]]]
  if (!menus.Vista.some(([label]) => label === 'Timeline')) menus.Vista = [...menus.Vista, ['Timeline', () => panelLayout.update({ timelineVisible: !panelLayout.layout.timelineVisible })], ['Panel de capas', () => panelLayout.update({ layersVisible: !panelLayout.layout.layersVisible })]]
  if (!menus.Ventana.some(([label]) => label === 'Guardar layout')) menus.Ventana = [...menus.Ventana, ['Guardar layout', () => { const name = window.prompt('Nombre layout'); if (name) panelLayout.saveLayout(name) }], ['Aplicar layout', () => { const names = Object.keys(panelLayout.saved); const name = window.prompt(`Layout (${names.join(', ')})`); if (name) panelLayout.applyLayout(name) }], ['Eliminar layout', () => { const name = window.prompt('Layout a eliminar'); if (name) panelLayout.deleteLayout(name) }], ['Restablecer layout', panelLayout.reset]]
  if (!menus.Archivo.some(([label]) => label === 'Guardar modo…')) menus.Archivo = [...menus.Archivo, ['Guardar modo…', () => setSaveModeDialog(true)], ['Enviar tilesheet a Mapas', () => void transferToMaps()], ['Enviar sprite a Assets', () => void transferToAssets()], ['Enviar animación a Assets', () => void transferAnimationToAssets()], ['Enviar tilesheet a Assets', () => void transferTilesheetToAssets()]]
  if (!menus.Archivo.some(([label]) => label === 'Importar pinceles…')) menus.Archivo = [...menus.Archivo, ['Importar pinceles…', () => brushFileRef.current?.click()], ['Exportar pinceles…', exportBrushPack], ['Insertar referencia…', () => referenceFileRef.current?.click()]]
  const layerTreeContent = <>
    <div className="panel-title"><strong>Capas</strong><div className="layer-actions"><button title="Nueva carpeta" onPointerDown={(event) => event.stopPropagation()} onClick={addFolder}>+F</button><button title="Nueva capa" onPointerDown={(event) => event.stopPropagation()} onClick={addLayer}>+</button></div></div>
    <div className="layer-tree" role="tree" onPointerUp={(event) => { if (!draggingLayerId) return; const target = (event.target as Element).closest<HTMLElement>('[data-layer-id]'); dropLayer(draggingLayerId, target?.dataset.layerId); setDraggingLayerId(undefined) }}>
      {layerTree.map(({ layer, depth }) => <div data-layer-id={layer.id} key={layer.id} className={`tree-row ${layer.id === document.activeLayerId ? 'selected' : ''} ${layer.id === draggingLayerId ? 'layer-dragging' : ''}`} role="treeitem">
        <button className="tree-toggle" disabled={!layer.isFolder} aria-label={layer.isFolder ? (layer.collapsed ? 'Expandir carpeta' : 'Contraer carpeta') : 'Capa'} onClick={() => layer.isFolder && commit(updateSpriteLayer(documentRef.current, layer.id, { collapsed: !layer.collapsed }))}>{layer.isFolder ? (layer.collapsed ? '▶' : '▼') : '·'}</button>
        {renamingLayerId === layer.id ? <input className="tree-rename" autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') finishLayerRename(); if (event.key === 'Escape') setRenamingLayerId(undefined) }} onBlur={finishLayerRename} /> : <button className="tree-name" style={{ paddingLeft: `${0.15 + depth * 0.75}rem` }} onPointerDown={(event) => { if (event.button === 0) setDraggingLayerId(layer.id) }} onDoubleClick={() => beginLayerRename(layer)} onClick={() => commit(selectSpriteLayer(documentRef.current, layer.id))}><strong>{layer.name}</strong></button>}
        <button title={layer.visible ? 'Ocultar' : 'Mostrar'} onPointerDown={(event) => event.stopPropagation()} onClick={() => commit(updateSpriteLayer(documentRef.current, layer.id, { visible: !layer.visible }))}>{layer.visible ? <Eye /> : <EyeOff />}</button>
        <button title={layer.locked ? 'Desbloquear' : 'Bloquear'} onPointerDown={(event) => event.stopPropagation()} onClick={() => commit(updateSpriteLayer(documentRef.current, layer.id, { locked: !layer.locked }))}>{layer.locked ? <Lock /> : <Unlock />}</button>
        <button title="Eliminar" onPointerDown={(event) => event.stopPropagation()} onClick={() => removeLayerById(layer.id)}><Trash2 /></button>
      </div>)}
    </div>
    {(() => { const activeLayerForOpacity = document.layers.find((layer) => layer.id === document.activeLayerId && !layer.isFolder); return activeLayerForOpacity ? <div className="layer-opacity"><span title={`Opacidad de ${activeLayerForOpacity.name}`}>Opacidad</span><input type="range" min="0" max="100" step="5" value={Math.round(activeLayerForOpacity.opacity * 100)} aria-label={`Opacidad de ${activeLayerForOpacity.name}`} onChange={(event) => show(updateSpriteLayer(documentRef.current, activeLayerForOpacity.id, { opacity: Number(event.target.value) / 100 }))} /><output>{Math.round(activeLayerForOpacity.opacity * 100)}%</output></div> : null })()}
  </>
  const layoutStyle = { '--inspector-w': `${panelLayout.layout.inspectorWidth}px`, '--timeline-w': `${panelLayout.layout.timelineWidth}px`, '--timeline-h': `${panelLayout.layout.timelineHeight}px`, '--layers-h': `${panelLayout.layout.layersHeight}px`, gridTemplateRows: `1.8rem 2rem 2.5rem minmax(0, 1fr) ${panelLayout.layout.timelineVisible ? `${panelLayout.layout.timelineHeight}px` : '0px'} 1.65rem` } as CSSProperties
  return <main className={`pixel-editor ${panelLayout.layout.timelineVisible ? '' : 'timeline-collapsed'}`} style={layoutStyle} onContextMenu={(event) => event.preventDefault()}>
    <nav className="pixel-menubar" aria-label="Menú principal">{Object.keys(menus).map((menu) => <div className="menu-root" key={menu}><button onClick={() => setOpenMenu(openMenu === menu ? undefined : menu)}>{menu}</button>{openMenu === menu && <div className="menu-dropdown" role="menu">{(menus[menu] ?? []).map((entry) => { const action = entry[1]; return typeof action === 'function' ? <button key={entry[0]} role="menuitem" disabled={entry[2]} onClick={() => { action(); setOpenMenu(undefined) }}>{entry[0]}</button> : <details className="menu-submenu-root" key={entry[0]}><summary role="menuitem">{entry[0]} <span>▶</span></summary><div className="menu-submenu" role="menu">{action.map(([label, childAction, disabled]) => <button key={label} role="menuitem" disabled={disabled} onClick={() => { childAction(); setOpenMenu(undefined) }}>{label}</button>)}</div></details> })}</div>}</div>)}</nav>
    <div className="document-tabs">{documents.map((item) => <div key={item.id} className={item.id === document.id ? 'active' : ''}><button className="document-tab-title" onClick={() => { const next = documents.find((candidate) => candidate.id === item.id); if (next && next.id !== documentRef.current.id) switchDocument(next) }}>{item.name}</button><button className="document-tab-close" aria-label={`Cerrar ${item.name}`} title="Cerrar documento" onClick={(event) => { event.stopPropagation(); closeDocument(item.id) }}><X size={12} /></button></div>)}</div>
    <input ref={fileRef} hidden type="file" accept=".mpe,.mosaico,.json,image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { void importFile(event.target.files?.[0]); event.currentTarget.value = '' }} />
    <input ref={brushFileRef} hidden type="file" accept=".brushpack" onChange={(event) => { void importBrushPackFile(event.target.files?.[0]); event.currentTarget.value = '' }} />
    <input ref={referenceFileRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { addReferenceFloater(event.target.files?.[0]); event.currentTarget.value = '' }} />
    <header className="pixel-optionsbar">
      <strong>{toolLabel(tool, selectionMode)}</strong><span className="option-divider" />
      <label className="color-control">Color<ColorWheel label="Color principal" value={color} onChange={setColor} /></label>
      <label className="fill-control"><input type="checkbox" checked={filled} onChange={(event) => setFilled(event.target.checked)} /> Relleno de formas</label>
      {(tool === 'pencil' || tool === 'eraser') && <label className="map-inline-field">Pincel <input type="range" min={BRUSH_SIZE_MIN} max={BRUSH_SIZE_MAX} step="1" value={brushSize} onChange={(event) => setBrushSize(clampBrushSize(Number(event.target.value)))} /><output aria-label="Tamaño de pincel">{brushSize}px</output></label>}
      {(tool === 'pencil' || tool === 'eraser') && <div className="brush-shapes" role="group" aria-label="Forma del pincel">{brushShapeOptions.map(([shape, label, Icon]) => <button key={shape} aria-label={label} title={label} className={brushShape === shape ? 'active' : ''} onClick={() => setBrushShape(shape)}><Icon /></button>)}</div>}
      {(tool === 'pencil' || tool === 'eraser') && <button className="brush-save" aria-label="Guardar pincel actual" title="Guardar pincel actual" onClick={saveCurrentBrushPreset}><Plus /></button>}
      {(tool === 'pencil' || tool === 'eraser') && brushPresets.length > 0 && <select aria-label="Biblioteca de pinceles" value="" onChange={(event) => { const id = event.target.value; if (id) applyBrushPreset(id) }}><option value="">Biblioteca…</option>{brushPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select>}
      {(tool === 'pencil' || tool === 'fill' || tool === 'line' || tool === 'rectangle' || tool === 'ellipse' || tool === 'polygon') && <label className="map-inline-field">Alfa <input type="range" min="0" max="100" step="5" value={alpha} onChange={(event) => setAlpha(Math.max(0, Math.min(100, Math.trunc(Number(event.target.value)) || 0)))} /><output aria-label="Alfa del trazo">{alpha}%</output></label>}
      {tool === 'fill' && <label className="map-inline-field">Tolerancia <input type="number" min="0" max="255" step="1" value={fillTolerance} onChange={(event) => setFillTolerance(Math.max(0, Math.min(255, Math.trunc(Number(event.target.value)) || 0)))} /><output aria-label="Tolerancia de relleno">{fillTolerance}</output></label>}
      {tool === 'fill' && <label className="fill-control"><input type="checkbox" checked={fillDiagonal} onChange={(event) => setFillDiagonal(event.target.checked)} /> Conectar diagonales</label>}
      <span className="option-hint">Shift: restringir ángulo/proporción · Clic medio: mover lienzo{tool === 'polygon' ? ' · Polígono: clic vértices, Enter/doble clic cierra, Escape cancela' : ''}</span>
      <div className="history-tools"><button aria-label="Deshacer" title="Deshacer (Ctrl+Z)" onClick={undo}><Undo2 /></button><button aria-label="Rehacer" title="Rehacer (Ctrl+Y)" onClick={redo}><Redo2 /></button></div>
    </header>
    <section className="pixel-body"><div className="panel-splitter inspector-splitter" role="separator" aria-label="Redimensionar inspector" onPointerDown={(event) => panelLayout.resize('inspector', 'width', event)} /><div className="pixel-folder-float" aria-label="Carpetas"><button className="folder-create" onClick={addFolder}>+ Carpeta</button>{document.layers.filter((layer) => layer.isFolder).map((folder) => <button data-folder-id={folder.id} key={folder.id} onClick={() => commit(updateSpriteLayer(documentRef.current, folder.id, { collapsed: !folder.collapsed }))}>{folder.collapsed ? '▶' : '▼'} {folder.name}</button>)}</div>
      <aside className="pixel-tool-rail" aria-label="Herramientas">
        {plainTools.slice(0, 3).map(([id, label, Icon]) => <button key={id} aria-label={label} title={`${label} (${Object.entries(hotkeys).find(([, value]) => value === id)?.[0]?.toUpperCase()})`} className={tool === id ? 'active' : ''} onClick={() => { setTool(id); setFlyout(undefined) }}><Icon /></button>)}
        <div className="tool-group has-flyout"><button aria-label={shapeTool[1]} title={`${shapeTool[1]} · mantener o clic derecho: formas`} className={shapes.some(([id]) => id === tool) ? 'active' : ''} onPointerDown={(event) => startHold('shape', event)} onPointerUp={stopHold} onPointerLeave={stopHold} onClick={() => setTool(shapeTool[0])} onContextMenu={(event) => { event.preventDefault(); setFlyout(flyout === 'shape' ? undefined : 'shape') }}><ShapeIcon /></button>{flyout === 'shape' && <div className="tool-flyout">{shapes.map(([id, label, Icon]) => <button key={id} aria-label={label} className={tool === id ? 'active' : ''} onClick={() => { setTool(id); setFlyout(undefined) }}><Icon /></button>)}</div>}</div>
        <div className="tool-group has-flyout"><button aria-label={selectionTool[1]} title={`${selectionTool[1]} · mantener o clic derecho: selecciones`} className={tool === 'select' ? 'active' : ''} onPointerDown={(event) => startHold('selection', event)} onPointerUp={stopHold} onPointerLeave={stopHold} onClick={() => setTool('select')} onContextMenu={(event) => { event.preventDefault(); setFlyout(flyout === 'selection' ? undefined : 'selection') }}><SelectionIcon /></button>{flyout === 'selection' && <div className="tool-flyout">{selections.map(([id, label, Icon]) => <button key={id} aria-label={label} className={selectionMode === id ? 'active' : ''} onClick={() => { setSelectionMode(id); setTool('select'); setFlyout(undefined) }}><Icon /></button>)}</div>}</div>
        {plainTools.slice(3).map(([id, label, Icon]) => <button key={id} aria-label={label} title={`${label} (${Object.entries(hotkeys).find(([, value]) => value === id)?.[0]?.toUpperCase()})`} className={tool === id ? 'active' : ''} onClick={() => { setTool(id); setFlyout(undefined) }}><Icon /></button>)}
      </aside>
      <div className="canvas-shell"><div ref={hostRef} className={`authoring-canvas tool-${tool}`} tabIndex={0} aria-label="Canvas Pixel Art editable" aria-keyshortcuts="Control+C Control+X Control+V Meta+C Meta+X Meta+V" />{seamless !== 'none' && <div className="seamless-canvas-boundary" style={selectionStyle} aria-hidden="true" />}{selectionPath && <svg className="selection-mask-overlay" style={selectionStyle} viewBox={`0 0 ${document.width} ${document.height}`} preserveAspectRatio="none"><path d={selectionPath} /></svg>}{contextMenu && <div className="selection-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} role="menu"><button role="menuitem" onClick={() => { if (selectionMaskRef.current) selectMask(invertSelection(selectionMaskRef.current)); setContextMenu(undefined) }}>Invertir selección</button><button role="menuitem" onClick={() => { selectMask(); setContextMenu(undefined) }}>Deseleccionar</button></div>}{floaters.map((floater, index) => <div key={floater.id} className="pixel-floater" style={{ left: floater.x, top: floater.y, width: floater.width, height: floater.height, zIndex: 20 + index }} onPointerDown={() => bringFloaterToFront(floater.id)}><div className="pixel-floater-bar" onPointerDown={(event) => startFloaterDrag(event, floater.id, 'move', floater)} onPointerMove={dragFloater} onPointerUp={endFloaterDrag} onPointerCancel={endFloaterDrag}><span>{floater.name}</span><button aria-label={`Cerrar ${floater.name}`} title="Cerrar referencia" onPointerDown={(event) => event.stopPropagation()} onClick={() => closeFloater(floater.id)}><X size={12} /></button></div><img src={floater.url} alt={floater.name} draggable={false} /><div className="pixel-floater-resize" title="Escalar" onPointerDown={(event) => startFloaterDrag(event, floater.id, 'resize', floater)} onPointerMove={dragFloater} onPointerUp={endFloaterDrag} onPointerCancel={endFloaterDrag} /></div>)}</div>
      <aside className="pixel-inspector"><section><div className="panel-title"><div><p className="eyebrow">Documento</p><h2>Lienzo</h2></div><button aria-label="Exportar imagen" title="Exportar imagen" onClick={() => beginExport('png')}><Download /></button></div><p className="document-meta">{document.name} · {document.width}×{document.height} · rev. {document.revision}</p><h3 className="palette-title">Colores usados</h3><div className="pixel-palette">{palette.map((swatch) => <button key={swatch} aria-label={`Color ${swatch}`} style={{ backgroundColor: swatch }} onClick={() => setColor(swatch)} />)}</div></section>{panelLayout.layout.layersVisible && <><section className="layer-tree-panel layer-tree-sidebar">{layerTreeContent}</section><div className="sidebar-layers-splitter" role="separator" aria-label="Redimensionar capas" onPointerDown={(event) => panelLayout.resize('layers', 'height', event)} /></>}</aside>
    </section>
    <section className="pixel-timeline"><div className="timeline-controls"><strong>Timeline</strong><button aria-label={playing ? 'Pausar animación' : 'Reproducir animación'} title={playing ? 'Pausar' : 'Reproducir'} onClick={() => setPlaying(!playing)}>{playing ? <Pause /> : <Play />}</button><button aria-label="Añadir frame" title="Añadir frame" onClick={() => addFrame(false)}><Plus /></button><button aria-label="Duplicar frame" title="Duplicar frame" onClick={() => addFrame(true)}><Copy /></button><button aria-label="Eliminar frame" title="Eliminar frame" onClick={removeFrame}><Trash2 /></button><button aria-label="Onion skin" title="Onion skin" className={onion ? 'active' : ''} onClick={() => setOnion(!onion)}><Eye /></button><button aria-label="Exportar sprite sheet" title="Exportar sprite sheet" onClick={exportSheet}><Download /></button><label>Duración <input aria-label="Duración del frame" type="number" min="10" max="60000" step="10" value={activeFrame.durationMs} onChange={(event) => { const durationMs = Number(event.target.value); if (Number.isInteger(durationMs) && durationMs >= 10 && durationMs <= 60_000) commit(updateSpriteFrame(documentRef.current, document.activeFrameId, { durationMs })) }} /> ms</label></div><div className="timeline-frames">{document.frames.map((frame, index) => <button key={frame.id} className={document.activeFrameId === frame.id ? 'active' : ''} aria-label={`Seleccionar frame ${index + 1}`} onClick={() => chooseFrame(frame.id)}><span>{index + 1}</span><small>{frame.durationMs} ms</small></button>)}</div></section>
    <div className="panel-splitter timeline-splitter" role="separator" aria-label="Redimensionar timeline" onPointerDown={(event) => panelLayout.resize('timeline', 'height', event)} />
    <div className="panel-splitter timeline-width-splitter" role="separator" aria-label="Redimensionar controles de timeline" onPointerDown={(event) => panelLayout.resize('timeline', 'width', event)} />
    <footer className="authoring-help"><span>{status}</span><span>0: ajustar · P/E/G/L/R/O/M/H: herramientas · PageUp/Down: frames</span></footer>
    {exportDialog && <div className="pixel-modal" role="dialog" aria-modal="true" aria-label="Opciones de exportación"><div className="export-dialog"><header><h2>Exportar imagen</h2><button aria-label="Cerrar" onClick={() => setExportDialog(false)}><X /></button></header><div className="export-fields"><label>Nombre<input value={exportOptions.name} onChange={(event) => setExportOptions({ ...exportOptions, name: event.target.value })} /></label><label>Formato<select value={exportOptions.format} onChange={(event) => { const format = event.target.value as ExportFormat; setExportOptions({ ...exportOptions, format, transparent: format !== 'jpeg' && exportOptions.transparent }) }}><option value="png">PNG</option><option value="jpeg">JPG</option><option value="webp">WebP</option><option value="gif">GIF animado</option></select></label><label>Escala entera<input type="number" min="1" max={maximumScale} step="1" value={exportOptions.scale} onChange={(event) => setExportOptions({ ...exportOptions, scale: Number(event.target.value) })} /></label><output>{document.width * exportOptions.scale} × {document.height * exportOptions.scale} px</output></div><label className="export-check"><input type="checkbox" disabled={exportOptions.format === 'jpeg'} checked={exportOptions.transparent && exportOptions.format !== 'jpeg'} onChange={(event) => setExportOptions({ ...exportOptions, transparent: event.target.checked })} /> Conservar transparencia</label>{(exportOptions.format === 'jpeg' || exportOptions.format === 'webp') && <label className="export-quality">Calidad {exportOptions.quality}%<input type="range" min="1" max="100" value={exportOptions.quality} onChange={(event) => setExportOptions({ ...exportOptions, quality: Number(event.target.value) })} /></label>}<button className="panel-action" disabled={!exportOptions.name.trim() || !Number.isInteger(exportOptions.scale) || exportOptions.scale < 1 || exportOptions.scale > maximumScale} onClick={() => void confirmExport()}>Elegir ubicación y exportar</button></div></div>}
    {saveModeDialog && <div className="pixel-modal" role="dialog" aria-modal="true" aria-label="Guardar modo"><div><header><h2>Guardar modo</h2><button aria-label="Cerrar" onClick={() => setSaveModeDialog(false)}><X /></button></header><p className="document-meta">Elige formato de salida.</p><button className="panel-action" onClick={() => { setSaveModeDialog(false); void saveProject() }}>Normal (.mpe)</button><button className="panel-action" onClick={() => { setSaveModeDialog(false); exportSheet() }}>Spritesheet (PNG)</button><button className="panel-action" onClick={() => { setSaveModeDialog(false); exportSheet() }}>Tilesheet (PNG)</button></div></div>}
    {newDialog && <div className="pixel-modal" role="dialog" aria-modal="true" aria-label="Nuevo lienzo"><div><header><h2>Nuevo lienzo</h2><button aria-label="Cerrar" onClick={() => setNewDialog(false)}><X /></button></header><div className="size-fields"><label>Ancho<input type="number" min="1" max="4096" value={size.width} onChange={(event) => setSize({ ...size, width: Number(event.target.value) })} /></label><label>Alto<input type="number" min="1" max="4096" value={size.height} onChange={(event) => setSize({ ...size, height: Number(event.target.value) })} /></label></div><button className="panel-action" onClick={newCanvas}>Crear</button></div></div>}
  </main>
}

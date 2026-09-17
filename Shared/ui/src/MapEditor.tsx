import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent } from 'react'
import {
  BLOB_CLASSES, addAutotileSet, addMapFolder, addMapLayer, addTileset, applyAutotileCells, applyMapCells, applyMapRulePass, applyWfcToRegion, autotileDiagnostics, connectedTileRegionAsync, createMapDocument, duplicateMapLayer,
  ellipsePixels, eraseAutotileCells, fillTilesAsync, linePixels, mapRuleDiagnostics, rectanglePixels, removeAutotileSet, removeMapLayer, removeTileset, reorderMapLayer, ruleNeighbors,
  applyMapDocumentDelta, createMapDocumentDelta, deserializeMapDocument, orphanTileDiagnostics, resizeMapDocument, selectMapLayer, serializeMapDocument, setMapLayerParent, sliceTileset, updateAutotileSet, updateMapLayer, updateTileset,
  type AutotileLayout, type AutotileProfile, type AutotileSet, type GridCoordinate, type MapDocument, type MapDocumentDelta, type MapLayer, type MapPatternRule, type MapRuleGroup, type ResizeAnchor, type RuleCellPredicate, type RuleNeighborKey, type TerrainRole, type TileReference,
} from '@mosaico/domain'
import { createViewport, OrthogonalPixiViewport, panViewport, pickOrthogonalCell, resizeViewport, screenToWorld, zoomViewportAt, type Point, type ViewportState } from '@mosaico/canvas'
import { importImage, loadImages, saveImage } from '@mosaico/pipeline'
import { Rectangle as PixiRectangle, Texture } from 'pixi.js'
import {
  ArrowDown, ArrowUp, BoxSelect, Circle, Copy, Crosshair, Eraser, Eye, EyeOff, FlipHorizontal2, FlipVertical2, FolderPlus, Hand,
  Lock, PaintBucket, Pencil, Pipette, Play, Plus, Redo2, RotateCw, Save, Shapes, Slash, SlidersHorizontal, Square, SquarePlus, Trash2, Undo2, Unlock, Upload, Wand2, X,
  type LucideIcon,
} from 'lucide-react'
import { saveBlob } from './pixel-media.js'
import { createNeutralMapPackage, loadMapProject, neutralMapJson, renderMapPng, saveMapBlob, saveMapPackage } from './map-media.js'
import { loadMapImage } from './map-textures.js'
import { usePanelLayout } from './panel-layout.js'
import { selectionClipboardCommand } from './selection-shortcuts.js'
import { ColorWheel } from './ColorWheel.js'
import type { VisibleAsset } from './asset-catalog.js'
import {
  captureSelection, deleteSelection, moveSelection, pastePattern, patternChanges, prepareClipboardPaste, selectionBetween, transformPattern, visibleSliceIndexes,
  type TilePattern, type TileSelection,
} from './map-editor-model.js'

type Tool = 'pencil' | 'eraser' | 'eyedropper' | 'fill' | 'line' | 'rectangle' | 'ellipse' | 'select' | 'pan'
type Asset = { readonly blob: Blob; readonly url: string; readonly name?: string; readonly mediaType?: string; readonly sha256?: string }
type ImportDraft = { name: string; tileWidth: number; tileHeight: number; marginX: number; marginY: number; spacingX: number; spacingY: number; offsetX: number; offsetY: number; zoom: number }
type MapSession = { undo: MapDocumentDelta[]; redo: MapDocumentDelta[]; viewport: ViewportState; selection?: TileSelection; activeTilesetId?: string; pattern?: TilePattern; tileStart: number; tileEnd: number }
const tools: readonly [Tool, string, LucideIcon, string][] = [
  ['pencil', 'Lápiz', Pencil, 'P'], ['eraser', 'Borrador', Eraser, 'E'], ['eyedropper', 'Selector de tile', Pipette, 'I'],
  ['fill', 'Balde', PaintBucket, 'G'], ['line', 'Línea', Slash, 'L'], ['rectangle', 'Rectángulo', Square, 'R'],
  ['ellipse', 'Elipse', Circle, 'O'], ['select', 'Selección', BoxSelect, 'M'], ['pan', 'Mano', Hand, 'H'],
]
const hotkeys = Object.fromEntries(tools.map(([id, , , key]) => [key.toLowerCase(), id])) as Record<string, Tool>
const blank = (name = 'Mapa sin título', width = 64, height = 40, tileWidth = 16, tileHeight = 16): MapDocument =>
  createMapDocument({ id: crypto.randomUUID(), name, width, height, cellWidth: tileWidth, cellHeight: tileHeight, layerId: crypto.randomUUID() })
const initialDraft = (): ImportDraft => ({ name: 'Tileset', tileWidth: 16, tileHeight: 16, marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, offsetX: 0, offsetY: 0, zoom: 2 })
const fitImportZoom = (width: number, height: number) => Math.max(0.01, Math.min(2, 720 / width, 480 / height))
const createMapViewport = () => createViewport({ width: 1, height: 1, zoom: 1, offsetX: 32, offsetY: 32, minZoom: 0.01 })
const pointKey = ({ x, y }: GridCoordinate) => `${x},${y}`
const safeName = (name: string) => name.replace(/[^a-z0-9_-]+/gi, '-') || 'map'
const terrainRoles: readonly TerrainRole[] = ['center', 'top', 'right', 'bottom', 'left', 'outerTopLeft', 'outerTopRight', 'outerBottomRight', 'outerBottomLeft', 'innerTopLeft', 'innerTopRight', 'innerBottomRight', 'innerBottomLeft']
const terrainRoleLabels: Record<TerrainRole, string> = {
  center: 'Centro',
  top: 'Borde arriba', right: 'Borde derecha', bottom: 'Borde abajo', left: 'Borde izquierda',
  outerTopLeft: 'Esquina ext. ↖', outerTopRight: 'Esquina ext. ↗', outerBottomRight: 'Esquina ext. ↘', outerBottomLeft: 'Esquina ext. ↙',
  innerTopLeft: 'Esquina int. ↖', innerTopRight: 'Esquina int. ↗', innerBottomRight: 'Esquina int. ↘', innerBottomLeft: 'Esquina int. ↙',
}
const maskArrows = (mask: number) => (((mask & 1) ? '↑' : '') + ((mask & 2) ? '→' : '') + ((mask & 4) ? '↓' : '') + ((mask & 8) ? '←' : '')) || '·'
type AutotileTarget = { readonly kind: 'center' } | { readonly kind: 'terrain'; readonly role: TerrainRole } | { readonly kind: 'contour'; readonly mask: number } | { readonly kind: 'blob'; readonly cls: number } | { readonly kind: 'extra' }
const autotileTargetKey = (target: AutotileTarget): string => target.kind === 'center' ? 'center' : target.kind === 'terrain' ? `terrain:${target.role}` : target.kind === 'contour' ? `contour:${target.mask}` : target.kind === 'blob' ? `blob:${target.cls}` : 'extra'
const autotileLayoutLabels: Record<AutotileLayout, string> = { tiles5: '5 piezas', tiles16: '16 piezas', tiles47: '47 piezas', tiles48: '48 piezas' }
const profileForLayout = (layout?: AutotileLayout): 'terrain' | 'contour' | 'blob' => layout === 'tiles16' ? 'contour' : layout === 'tiles47' || layout === 'tiles48' ? 'blob' : 'terrain'
const autotileTargetsForLayout = (layout?: AutotileLayout): AutotileTarget[] => {
  if (!layout) return [...terrainRoles.filter((role) => role !== 'center').map((role) => ({ kind: 'terrain' as const, role })), ...Array.from({ length: 16 }, (_, mask) => ({ kind: 'contour' as const, mask }))]
  if (layout === 'tiles5') return [{ kind: 'terrain', role: 'top' }, { kind: 'terrain', role: 'right' }, { kind: 'terrain', role: 'bottom' }, { kind: 'terrain', role: 'left' }]
  if (layout === 'tiles16') return Array.from({ length: 16 }, (_, mask) => ({ kind: 'contour' as const, mask }))
  const blobTargets: AutotileTarget[] = BLOB_CLASSES.map((cls) => ({ kind: 'blob' as const, cls }))
  return layout === 'tiles48' ? [...blobTargets, { kind: 'extra' }] : blobTargets
}
// Diagrama de pieza en una grilla 3×3 (índices 0-2 / 3-5 / 6-8): true = relleno, false = vacío.
function pieceCells(target: AutotileTarget): readonly boolean[] {
  const cells = new Array<boolean>(9).fill(false)
  const fill = (...indexes: number[]) => indexes.forEach((index) => { cells[index] = true })
  if (target.kind === 'center') return new Array<boolean>(9).fill(true)
  if (target.kind === 'extra') { fill(4); return cells }
  if (target.kind === 'contour') {
    const m = target.mask; fill(4)
    if (m & 1) fill(1); if (m & 2) fill(5); if (m & 4) fill(7); if (m & 8) fill(3)
    if ((m & 1) && (m & 8)) fill(0); if ((m & 1) && (m & 2)) fill(2); if ((m & 4) && (m & 2)) fill(8); if ((m & 4) && (m & 8)) fill(6)
    return cells
  }
  if (target.kind === 'blob') {
    const m = target.cls; fill(4)
    if (m & 1) fill(1); if (m & 2) fill(2); if (m & 4) fill(5); if (m & 8) fill(8)
    if (m & 16) fill(7); if (m & 32) fill(6); if (m & 64) fill(3); if (m & 128) fill(0)
    return cells
  }
  switch (target.role) {
    case 'top': return [false, false, false, true, true, true, true, true, true]
    case 'bottom': return [true, true, true, true, true, true, false, false, false]
    case 'left': return [false, true, true, false, true, true, false, true, true]
    case 'right': return [true, true, false, true, true, false, true, true, false]
    case 'outerTopLeft': fill(4, 5, 7, 8); break
    case 'outerTopRight': fill(3, 4, 6, 7); break
    case 'outerBottomRight': fill(0, 1, 3, 4); break
    case 'outerBottomLeft': fill(1, 2, 4, 5); break
    case 'innerTopLeft': fill(2, 4, 5, 6, 7, 8); break
    case 'innerTopRight': fill(0, 3, 4, 6, 7, 8); break
    case 'innerBottomRight': fill(0, 1, 2, 3, 4, 6); break
    case 'innerBottomLeft': fill(0, 1, 2, 4, 5, 8); break
    default: return new Array<boolean>(9).fill(true)
  }
  return cells
}
function PieceDiagram({ cells }: { readonly cells: readonly boolean[] }) {
  return <span className="piece-diagram" aria-hidden="true">{cells.map((filled, index) => <i key={index} className={filled ? 'filled' : 'empty'} />)}</span>
}

// ── Reglas de patrón: arrastre de tiles entre paneles ──
const TILE_DND_MIME = 'application/x-mosaico-tile'
const setTileDrag = (event: ReactDragEvent<HTMLElement>, tile: { readonly tilesetId: string; readonly tileId: number }): void => {
  event.dataTransfer.setData(TILE_DND_MIME, JSON.stringify(tile))
  event.dataTransfer.effectAllowed = 'copy'
}
const getTileDrag = (event: ReactDragEvent<HTMLElement>): { tilesetId: string; tileId: number } | undefined => {
  try {
    const parsed = JSON.parse(event.dataTransfer.getData(TILE_DND_MIME)) as { tilesetId?: string; tileId?: number }
    return typeof parsed?.tileId === 'number' && typeof parsed?.tilesetId === 'string' ? { tilesetId: parsed.tilesetId, tileId: parsed.tileId } : undefined
  } catch { return undefined }
}

// ── Reglas de patrón: almacenamiento local por documento (v2 con grupos de similitud) ──
const mapRulesStorageKey = (documentId: string): string => `mosaico-map-rules-v1:${documentId}`
const sortedPatternRules = (rules: readonly MapPatternRule[]): readonly MapPatternRule[] => [...rules].sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))
const RULE_GROUP_COLORS = ['#46d4a0', '#4fa3d4', '#d4a24f', '#c76fd4', '#d46f6f', '#8fd44f', '#d4d14f', '#6f9ed4'] as const
const RULE_GRID_RADIUS = 2
const ruleGridKeys: readonly RuleNeighborKey[] = (() => {
  const keys: RuleNeighborKey[] = []
  for (let y = -RULE_GRID_RADIUS; y <= RULE_GRID_RADIUS; y += 1) for (let x = -RULE_GRID_RADIUS; x <= RULE_GRID_RADIUS; x += 1) if (x !== 0 || y !== 0) keys.push(`${x},${y}`)
  return keys
})()
interface StoredMapRules { version: number; seed: number; rules: MapPatternRule[]; groups?: MapRuleGroup[] }
function migrateRuleNeighbors(neighbors?: Readonly<Record<string, RuleCellPredicate>>): Record<RuleNeighborKey, RuleCellPredicate> | undefined {
  if (!neighbors) return undefined
  return ruleNeighbors(neighbors as Partial<Record<string, RuleCellPredicate>>)
}
function loadStoredMapRules(documentId: string): { seed: number; rules: MapPatternRule[]; groups: MapRuleGroup[] } {
  if (typeof localStorage === 'undefined') return { seed: 1, rules: [], groups: [] }
  try {
    const parsed = JSON.parse(localStorage.getItem(mapRulesStorageKey(documentId)) ?? '') as StoredMapRules | undefined
    if (!parsed || !Array.isArray(parsed.rules)) return { seed: 1, rules: [], groups: [] }
    // v1 guardaba claves brújula ('north'); v2 usa offsets ('0,-1'). Migra al cargar.
    const rules = parsed.rules.map((rule) => ({ ...rule, condition: { ...rule.condition, neighbors: migrateRuleNeighbors(rule.condition.neighbors) } }))
    return { seed: Number.isFinite(parsed.seed) ? parsed.seed! : 1, rules, groups: Array.isArray(parsed.groups) ? parsed.groups : [] }
  } catch { return { seed: 1, rules: [], groups: [] } }
}
const importFieldLabels: Record<keyof Omit<ImportDraft, 'zoom'>, string> = { name: 'Nombre', tileWidth: 'Ancho tile', tileHeight: 'Alto tile', marginX: 'Margen X', marginY: 'Margen Y', spacingX: 'Separación X', spacingY: 'Separación Y', offsetX: 'Offset X', offsetY: 'Offset Y' }
const tabsStorageKey = 'mosaico-map-tabs-v3'

function initialDocuments(): { documents: MapDocument[]; activeId: string; deferred: string[] } {
  if (typeof localStorage !== 'undefined') try {
    const stored = JSON.parse(localStorage.getItem(tabsStorageKey) ?? '') as { activeId?: string; documents?: string[] }
    const serialized = stored.documents ?? []
    const activeIndex = stored.activeId ? serialized.findIndex((value) => value.includes(stored.activeId!)) : 0
    const selectedIndex = activeIndex >= 0 ? activeIndex : 0
    const candidates = [selectedIndex, ...serialized.map((_, index) => index).filter((index) => index !== selectedIndex)]
    for (const index of candidates) {
      if (!serialized[index]) continue
      try {
        const document = deserializeMapDocument(serialized[index])
        return { documents: [document], activeId: document.id, deferred: serialized.filter((_, candidate) => candidate !== index) }
      } catch { /* intenta recuperar otra pestaña */ }
    }
  } catch { /* autosave inválido usa documento limpio */ }
  const document = blank()
  return { documents: [document], activeId: document.id, deferred: [] }
}

function brushPoints(center: GridCoordinate, size: number): GridCoordinate[] {
  const start = -Math.floor((size - 1) / 2); const points: GridCoordinate[] = []
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) points.push({ x: center.x + start + x, y: center.y + start + y })
  return points
}

function selectionContains(selection: TileSelection, point: GridCoordinate): boolean {
  return point.x >= selection.left && point.y >= selection.top && point.x < selection.left + selection.width && point.y < selection.top + selection.height
}

type MapLayerRow = { readonly layer: MapLayer; readonly depth: number }
function mapLayerTree(layers: readonly MapLayer[]): MapLayerRow[] {
  const rows: MapLayerRow[] = []
  const children = new Map<string | undefined, MapLayer[]>()
  for (const layer of [...layers].reverse()) children.set(layer.parentId, [...(children.get(layer.parentId) ?? []), layer])
  const visit = (parentId: string | undefined, depth: number) => {
    for (const layer of children.get(parentId) ?? []) {
      rows.push({ layer, depth })
      if (layer.isFolder && !layer.collapsed) visit(layer.id, depth + 1)
    }
  }
  visit(undefined, 0)
  return rows
}

export function MapEditor({ active = true, sharedAssets }: { readonly active?: boolean; readonly sharedAssets?: readonly VisibleAsset[] } = {}) {
  const [initial] = useState(initialDocuments)
  const first = initial.documents.find((item) => item.id === initial.activeId) ?? initial.documents[0]!
  const hostRef = useRef<HTMLDivElement>(null); const rendererRef = useRef<OrthogonalPixiViewport | undefined>(undefined); const viewportRef = useRef<ViewportState>(createMapViewport())
  const [document, setDocument] = useState(first); const documentRef = useRef(document); const [documents, setDocuments] = useState<MapDocument[]>(initial.documents)
  const [restoringDocuments, setRestoringDocuments] = useState(initial.deferred.length > 0)
  const deferredDocumentsRef = useRef([...initial.deferred])
  const panelLayout = usePanelLayout('map')
  const [assets, setAssets] = useState<Map<string, Asset>>(new Map()); const assetsRef = useRef(assets); const texturesRef = useRef(new Map<string, Texture>()); const baseTexturesRef = useRef(new Map<string, Texture>()); const textureGenerationRef = useRef(0)
  const baseTextureUrlsRef = useRef(new Map<string, string>()); const tilesetSignaturesRef = useRef(new Map<string, string>()); const loadingAssetsRef = useRef(new Set<string>()); const activeRef = useRef(active)
  const tilesetsByIdRef = useRef(new Map(first.tilesets.map((tileset) => [tileset.id, tileset] as const)))
  const animationFramesRef = useRef(new Map<string, TileReference[]>())
  const [tool, setTool] = useState<Tool>('pencil'); const toolRef = useRef(tool); const [status, setStatus] = useState('Crea o importa un tileset')
  const toolBeforeSpaceRef = useRef<Tool | undefined>(undefined)
  const [filled, setFilled] = useState(false); const filledRef = useRef(filled); const [eraserSize, setEraserSize] = useState(1); const eraserSizeRef = useRef(eraserSize)
  const [activeTilesetId, setActiveTilesetId] = useState<string | undefined>(first.tilesets[0]?.id)
  const [pattern, setPattern] = useState<TilePattern>(); const patternRef = useRef<TilePattern | undefined>(pattern); const [tileStart, setTileStart] = useState(0); const [tileEnd, setTileEnd] = useState(0); const [thumbZoom, setThumbZoomState] = useState(() => {
    if (typeof localStorage === 'undefined') return 0.5
    const stored = Number(localStorage.getItem('mosaico-map-thumb-zoom'))
    return Number.isFinite(stored) && stored >= 0.5 && stored <= 5 ? stored : 0.5
  }); const setThumbZoom = (next: number): void => { setThumbZoomState(next); try { localStorage.setItem('mosaico-map-thumb-zoom', String(next)) } catch { /* almacenamiento no disponible */ } }; const [tileScrollTop, setTileScrollTop] = useState(0)
  const [selection, setSelection] = useState<TileSelection>(); const selectionRef = useRef<TileSelection | undefined>(selection); const clipboardRef = useRef<{ pattern: TilePattern; tilesets: MapDocument['tilesets'] } | undefined>(undefined); const [hoverCell, setHoverCell] = useState<GridCoordinate>()
  const [renamingLayerId, setRenamingLayerId] = useState<string>(); const [renameValue, setRenameValue] = useState('')
  const [draggingLayerId, setDraggingLayerId] = useState<string>()
  const [autotile, setAutotile] = useState(false); const autotileRef = useRef(autotile); const [autotileSetId, setAutotileSetId] = useState<string>(); const autotileSetRef = useRef<string | undefined>(autotileSetId)
  const [autotileProfile, setAutotileProfile] = useState<AutotileProfile>('terrain'); const autotileProfileRef = useRef(autotileProfile)
  const [newDialog, setNewDialog] = useState(false); const [resizeDialog, setResizeDialog] = useState(false); const [importDialog, setImportDialog] = useState(false)
  const [autotileDialog, setAutotileDialog] = useState(false); const [autotileDraft, setAutotileDraft] = useState<AutotileSet>()
  const [autotileTarget, setAutotileTarget] = useState<AutotileTarget>(); const [autotilePickerScroll, setAutotilePickerScroll] = useState(0)
  const [autotileChoosingType, setAutotileChoosingType] = useState(false)
  const [autotileManagerOpen, setAutotileManagerOpen] = useState(false); const [autotileDeleteTarget, setAutotileDeleteTarget] = useState<AutotileSet>()
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false)
  const [rulesSourceLayerId, setRulesSourceLayerId] = useState<string>()
  const [rulesTargetLayerId, setRulesTargetLayerId] = useState<string>()
  const [intentView, setIntentView] = useState(false)
  const [wfcDialogOpen, setWfcDialogOpen] = useState(false); const [wfcSeed, setWfcSeed] = useState(1); const [wfcSize, setWfcSize] = useState(2); const [wfcKeepExisting, setWfcKeepExisting] = useState(true)
  const intentViewRef = useRef(false); const intentTintRef = useRef<ReadonlyMap<string, number>>(new Map()); const intentLayerRef = useRef<string | undefined>(undefined)
  const [animationDialog, setAnimationDialog] = useState(false); const [animationFps, setAnimationFps] = useState(8)
  const [newForm, setNewForm] = useState({ name: 'Mapa sin título', width: 64, height: 40, tileWidth: 16, tileHeight: 16, transparent: true, color: '#1a2024', grid: true })
  const [resizeForm, setResizeForm] = useState<{ width: number; height: number; anchor: ResizeAnchor }>({ width: document.width, height: document.height, anchor: 'center' })
  const [importDraft, setImportDraft] = useState(initialDraft); const [importFile, setImportFile] = useState<File>(); const [importUrl, setImportUrl] = useState<string>(); const [importSize, setImportSize] = useState({ width: 0, height: 0 }); const [importScroll, setImportScroll] = useState({ left: 0, top: 0 })
  const [openMenu, setOpenMenu] = useState<string>(); const [cursor, setCursor] = useState<GridCoordinate>(); const [, refreshViewport] = useState(0)
  const [consoleOpen, setConsoleOpen] = useState(true)
  const [operation, setOperation] = useState<{ label: string; progress: number }>(); const operationAbortRef = useRef<AbortController | undefined>(undefined)
  const importPreviewRef = useRef<HTMLDivElement>(null); const importPanRef = useRef<{ x: number; y: number; left: number; top: number } | undefined>(undefined)
  const undoRef = useRef<MapDocumentDelta[]>([]); const redoRef = useRef<MapDocumentDelta[]>([]); const previewRef = useRef<MapDocument | undefined>(undefined)
  const sessionsRef = useRef<Map<string, MapSession>>(new Map(initial.documents.map((item) => [item.id, { undo: [], redo: [], viewport: createMapViewport(), tileStart: 0, tileEnd: 0 }])))
  const savedRevisionRef = useRef(new Map(initial.documents.map((item) => [item.id, item === first && item.revision === 0 ? 0 : -1])))
  const tilesetSelectionsRef = useRef(new Map<string, { start: number; end: number; pattern: TilePattern }>())
  const gestureRef = useRef<{ start: GridCoordinate; last: GridCoordinate; before: MapDocument; screen: Point; panning: boolean; moving?: TileSelection } | undefined>(undefined)

  const show = (next: MapDocument) => { documentRef.current = next; setDocument(next); setDocuments((items) => items.map((item) => item.id === next.id ? next : item)) }
  const selectTiles = (next?: TileSelection) => { selectionRef.current = next; setSelection(next) }
  const commit = (next: MapDocument, before = documentRef.current) => { if (next === before) return; undoRef.current.push(createMapDocumentDelta(before, next)); redoRef.current = []; show(next) }
  const undo = () => { const value = undoRef.current.pop(); if (!value) return; redoRef.current.push(value); show(applyMapDocumentDelta(documentRef.current, value, 'undo')) }
  const redo = () => { const value = redoRef.current.pop(); if (!value) return; undoRef.current.push(value); show(applyMapDocumentDelta(documentRef.current, value, 'redo')) }
  const saveSession = () => {
    sessionsRef.current.set(documentRef.current.id, { undo: undoRef.current, redo: redoRef.current, viewport: viewportRef.current, selection: selectionRef.current, activeTilesetId, pattern: patternRef.current, tileStart, tileEnd })
  }
  const switchDocument = (next: MapDocument) => {
    saveSession()
    const session: MapSession = sessionsRef.current.get(next.id) ?? { undo: [], redo: [], viewport: createMapViewport(), tileStart: 0, tileEnd: 0 }
    sessionsRef.current.set(next.id, session); undoRef.current = session.undo; redoRef.current = session.redo; viewportRef.current = session.viewport
    documentRef.current = next; setDocument(next); selectTiles(session.selection); setActiveTilesetId(session.activeTilesetId ?? next.tilesets[0]?.id); setPattern(session.pattern); setTileStart(session.tileStart); setTileEnd(session.tileEnd)
    requestAnimationFrame(() => { session.viewport.width <= 1 ? fitMap() : render() })
  }
  const openDocument = (next: MapDocument, saved = false) => {
    setDocuments((items) => [...items.filter((item) => item.id !== next.id), next])
    sessionsRef.current.set(next.id, { undo: [], redo: [], viewport: createMapViewport(), tileStart: 0, tileEnd: 0 })
    savedRevisionRef.current.set(next.id, saved ? next.revision : 0); switchDocument(next)
  }
  const closeDocument = (item: MapDocument) => {
    if (item.revision !== (savedRevisionRef.current.get(item.id) ?? -1) && !window.confirm(`Cerrar ${item.name} y descartar cambios sin guardar?`)) return
    const remaining = documents.filter((candidate) => candidate.id !== item.id)
    sessionsRef.current.delete(item.id); savedRevisionRef.current.delete(item.id)
    if (!remaining.length) { const next = blank(); setDocuments([next]); sessionsRef.current.set(next.id, { undo: [], redo: [], viewport: createMapViewport(), tileStart: 0, tileEnd: 0 }); savedRevisionRef.current.set(next.id, 0); switchDocument(next); return }
    setDocuments(remaining)
    if (item.id === documentRef.current.id) switchDocument(remaining[Math.max(0, documents.indexOf(item) - 1)]!)
  }
  const safely = (action: () => void) => { try { action() } catch (error) { const code = error instanceof Error ? error.message : ''; setStatus(code === 'MAP_LAYER_LOCKED' ? 'Capa bloqueada' : code === 'MAP_LAYER_HIDDEN' ? 'Capa oculta: muéstrala para editar' : code === 'MAP_AUTOTILE_LAYER_REQUIRES_SET_TILE' ? 'Esta capa de autotile solo acepta tiles de un sistema de autotiles' : code.replaceAll('_', ' ') || 'Operación fallida') } }
  const autotileModeFor = (base: MapDocument): { setId: string; profile: 'terrain' | 'contour' | 'blob' } | undefined => {
    const layer = base.layers.find((item) => item.id === base.activeLayerId)
    const resolveProfile = (setId: string) => {
      const set = base.autotileSets.find((candidate) => candidate.id === setId)
      return set?.layout ? profileForLayout(set.layout) : autotileProfileRef.current
    }
    if (layer?.kind === 'autotile') return layer.autotileSetId ? { setId: layer.autotileSetId, profile: resolveProfile(layer.autotileSetId) } : undefined
    return autotileRef.current && autotileSetRef.current ? { setId: autotileSetRef.current, profile: resolveProfile(autotileSetRef.current) } : undefined
  }
  const resolveAutotileMode = (): { setId: string; profile: 'terrain' | 'contour' | 'blob' } | undefined => autotileModeFor(documentRef.current)
  const isAutotileLayerActive = (): boolean => documentRef.current.layers.find((item) => item.id === documentRef.current.activeLayerId)?.kind === 'autotile'
  const runFill = async (origin: GridCoordinate) => {
    if (operationAbortRef.current) return
    if (isAutotileLayerActive() && !resolveAutotileMode()) { setStatus('La capa de autotile necesita un set vinculado: usa Configurar'); return }
    const selected = patternRef.current?.cells[0]
    if (!selected && !resolveAutotileMode()) return
    const before = documentRef.current; const controller = new AbortController(); operationAbortRef.current = controller; setOperation({ label: 'Rellenando', progress: 0 })
    try {
      const options = { signal: controller.signal, onProgress: (progress: number) => setOperation({ label: 'Rellenando', progress }) }
      const mode = resolveAutotileMode()
      const next = mode
        ? applyAutotileCells(before, before.activeLayerId, await connectedTileRegionAsync(before, before.activeLayerId, origin, options), mode.setId, mode.profile)
        : await fillTilesAsync(before, before.activeLayerId, origin, selected!, options)
      if (controller.signal.aborted) throw new DOMException('Operación cancelada', 'AbortError')
      commit(next, before); setStatus('Relleno aplicado')
    } catch (error) { setStatus(error instanceof DOMException && error.name === 'AbortError' ? 'Relleno cancelado' : error instanceof Error ? error.message : 'Relleno falló') }
    finally { operationAbortRef.current = undefined; setOperation(undefined) }
  }

  const render = () => {
    if (!activeRef.current) return
    const host = hostRef.current; const renderer = rendererRef.current; if (!host || !renderer) return
    viewportRef.current = resizeViewport(viewportRef.current, Math.max(1, host.clientWidth), Math.max(1, host.clientHeight))
    const intentOptions = intentViewRef.current
      ? { tintByTile: intentTintRef.current, dimUntinted: true, onlyLayerId: intentLayerRef.current }
      : undefined
    renderer.render(previewRef.current ?? documentRef.current, viewportRef.current, intentOptions)
  }
  const markReady = () => {
    performance.mark('mosaico:Mapas:ready')
    if (performance.getEntriesByName('mosaico:Mapas:activate').length) performance.measure('mosaico:Mapas:activation', 'mosaico:Mapas:activate', 'mosaico:Mapas:ready')
  }
  function fitMap() {
    const host = hostRef.current; if (!host) return
    const map = documentRef.current; const zoom = Math.max(viewportRef.current.minZoom, Math.min(16, Math.min(host.clientWidth / (map.width * map.cellWidth), host.clientHeight / (map.height * map.cellHeight)) * 0.9))
    viewportRef.current = { ...viewportRef.current, width: host.clientWidth, height: host.clientHeight, zoom, offsetX: (host.clientWidth - map.width * map.cellWidth * zoom) / 2, offsetY: (host.clientHeight - map.height * map.cellHeight * zoom) / 2 }
    render(); refreshViewport((value) => value + 1)
  }
  const zoomCenter = (factor: number) => {
    const host = hostRef.current; if (!host) return
    viewportRef.current = zoomViewportAt(viewportRef.current, { x: host.clientWidth / 2, y: host.clientHeight / 2 }, factor); render(); refreshViewport((value) => value + 1)
  }

  const rebuildTextures = () => {
    const generation = textureGenerationRef.current
    const requiredAssets = new Set(documentRef.current.tilesets.map((tileset) => tileset.assetId))
    const currentTilesets = new Set(documentRef.current.tilesets.map((tileset) => tileset.id))
    for (const [id, signature] of tilesetSignaturesRef.current) {
      const tileset = documentRef.current.tilesets.find((candidate) => candidate.id === id)
      const next = tileset ? JSON.stringify([tileset.assetId, tileset.imageWidth, tileset.imageHeight, tileset.tileWidth, tileset.tileHeight, tileset.marginX, tileset.marginY, tileset.spacingX, tileset.spacingY, tileset.offsetX, tileset.offsetY]) : ''
      if (currentTilesets.has(id) && signature === next) continue
      for (const [key, texture] of texturesRef.current) if (key.startsWith(`${id}:`)) { texture.destroy(false); texturesRef.current.delete(key) }
      tilesetSignaturesRef.current.delete(id)
    }
    for (const tileset of documentRef.current.tilesets) tilesetSignaturesRef.current.set(tileset.id, JSON.stringify([tileset.assetId, tileset.imageWidth, tileset.imageHeight, tileset.tileWidth, tileset.tileHeight, tileset.marginX, tileset.marginY, tileset.spacingX, tileset.spacingY, tileset.offsetX, tileset.offsetY]))
    for (const [assetId, texture] of baseTexturesRef.current) {
      const asset = assetsRef.current.get(assetId)
      if (requiredAssets.has(assetId) && asset?.url === baseTextureUrlsRef.current.get(assetId)) continue
      texture.destroy(false); baseTexturesRef.current.delete(assetId); baseTextureUrlsRef.current.delete(assetId)
      for (const [key, child] of texturesRef.current) {
        const tilesetId = key.slice(0, key.indexOf(':'))
        if (tilesetsByIdRef.current.get(tilesetId)?.assetId === assetId) { child.destroy(false); texturesRef.current.delete(key) }
      }
    }
    const pending: Promise<void>[] = []
    for (const tileset of documentRef.current.tilesets) {
      const asset = assetsRef.current.get(tileset.assetId); const loadingKey = asset ? `${tileset.assetId}:${asset.url}` : ''
      if (!asset || baseTexturesRef.current.has(tileset.assetId) || loadingAssetsRef.current.has(loadingKey)) continue
      loadingAssetsRef.current.add(loadingKey)
      pending.push(loadMapImage(asset.url).then((image) => {
        if (image.naturalWidth <= 0 || image.naturalHeight <= 0) return
        const base = Texture.from(image as unknown as HTMLImageElement)
        const source = base.source
        if (!source || source.width <= 0 || source.height <= 0) { base.destroy(false); return }
        source.scaleMode = 'nearest'
        if (generation !== textureGenerationRef.current || assetsRef.current.get(tileset.assetId)?.url !== asset.url || !documentRef.current.tilesets.some((candidate) => candidate.assetId === tileset.assetId)) { base.destroy(false); return }
        baseTexturesRef.current.set(tileset.assetId, base)
        baseTextureUrlsRef.current.set(tileset.assetId, asset.url)
      }).catch(() => { if (assetsRef.current.get(tileset.assetId)?.url === asset.url) setStatus('No se pudo cargar el tileset') }).finally(() => {
        loadingAssetsRef.current.delete(loadingKey)
        if (assetsRef.current.get(tileset.assetId)?.url !== asset.url) window.setTimeout(rebuildTextures, 0)
      }))
    }
    render()
    if (pending.length) void Promise.allSettled(pending).then(() => { if (generation === textureGenerationRef.current) render() })
  }
  const resolveTileTexture = (tile: TileReference): Texture | undefined => {
    let tileId = tile.tileId
    if (tile.animationId) {
      const frames = animationFramesRef.current.get(tile.animationId) ?? []
      if (frames.length > 1) tileId = frames[Math.floor(Date.now() / (tile.animationDurationMs ?? 125)) % frames.length]!.tileId
    }
    const key = `${tile.tilesetId}:${tileId}`; const cached = texturesRef.current.get(key); if (cached?.source && cached.source.width > 0 && cached.source.height > 0) return cached
    const tileset = tilesetsByIdRef.current.get(tile.tilesetId); const base = tileset ? baseTexturesRef.current.get(tileset.assetId) : undefined
    const source = base?.source
    if (!tileset || !source || source.width <= 0 || source.height <= 0 || tileset.tileWidth <= 0 || tileset.tileHeight <= 0) return undefined
    const columns = Math.max(1, Math.floor((tileset.imageWidth - (tileset.offsetX ?? 0) - tileset.marginX * 2 + tileset.spacingX) / (tileset.tileWidth + tileset.spacingX)))
    const x = (tileset.offsetX ?? 0) + tileset.marginX + (tileId % columns) * (tileset.tileWidth + tileset.spacingX)
    const y = (tileset.offsetY ?? 0) + tileset.marginY + Math.floor(tileId / columns) * (tileset.tileHeight + tileset.spacingY)
    if (x < 0 || y < 0 || x + tileset.tileWidth > source.width || y + tileset.tileHeight > source.height) return undefined
    const texture = new Texture({ source, frame: new PixiRectangle(x, y, tileset.tileWidth, tileset.tileHeight) }); texturesRef.current.set(key, texture); return texture
  }

  useEffect(() => {
    documentRef.current = document
    tilesetsByIdRef.current = new Map(document.tilesets.map((tileset) => [tileset.id, tileset] as const))
    const animations = new Map<string, TileReference[]>()
    for (const layer of document.layers) for (const tile of layer.cells.values()) if (tile.animationId) animations.set(tile.animationId, [...(animations.get(tile.animationId) ?? []), tile])
    for (const frames of animations.values()) frames.sort((left, right) => (left.animationFrame ?? 0) - (right.animationFrame ?? 0))
    animationFramesRef.current = animations
    render()
  }, [document])
  useEffect(() => {
    let cancelled = false; let idle = 0; let timer: ReturnType<typeof setTimeout> | undefined
    const restoreNext = () => {
      if (cancelled) return
      const serialized = deferredDocumentsRef.current.shift()
      if (!serialized) { setRestoringDocuments(false); return }
      try {
        const restored = deserializeMapDocument(serialized)
        sessionsRef.current.set(restored.id, { undo: [], redo: [], viewport: createMapViewport(), tileStart: 0, tileEnd: 0 })
        savedRevisionRef.current.set(restored.id, restored.revision)
        setDocuments((items) => items.some((item) => item.id === restored.id) ? items : [...items, restored])
      } catch { setStatus('Un mapa guardado no pudo restaurarse') }
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(restoreNext, { timeout: 1000 })
      else timer = globalThis.setTimeout(restoreNext, 0)
    }
    if (deferredDocumentsRef.current.length) {
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(restoreNext, { timeout: 1000 })
      else timer = globalThis.setTimeout(restoreNext, 0)
    }
    return () => { cancelled = true; if (idle && 'cancelIdleCallback' in window) window.cancelIdleCallback(idle); if (timer) globalThis.clearTimeout(timer) }
  }, [])
  useEffect(() => {
    if (!active) return
    const animated = document.layers.some((layer) => [...layer.cells.values()].some((tile) => tile.animationId))
    if (!animated) return
    const timer = window.setInterval(render, 100)
    return () => window.clearInterval(timer)
  }, [active, document])
  useEffect(() => {
    if (restoringDocuments) return
    const save = () => { try { localStorage.setItem(tabsStorageKey, JSON.stringify({ activeId: document.id, documents: documents.map(serializeMapDocument) })) } catch { setStatus('Autosave local no disponible') } }
    let idle = 0
    const timer = window.setTimeout(() => {
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(save, { timeout: 2000 })
      else save()
    }, 750)
    return () => { window.clearTimeout(timer); if (idle && 'cancelIdleCallback' in window) window.cancelIdleCallback(idle) }
  }, [documents, document.id, restoringDocuments])
  useEffect(() => {
    if (sharedAssets) return
    let active = true
    void loadImages().then((stored) => {
      if (!active) return
      setAssets((current) => {
        const next = new Map(current)
        for (const image of stored) if (!next.has(image.record.id)) next.set(image.record.id, { blob: image.original, url: URL.createObjectURL(image.original), name: image.record.name, mediaType: image.record.mediaType })
        return next
      })
    }).catch(() => setStatus('Repositorio interno no disponible'))
    return () => { active = false }
  }, [sharedAssets])
  useEffect(() => {
    if (!sharedAssets) return
    setAssets((current) => {
      const next = new Map(current)
      const incoming = new Set(sharedAssets.map((image) => image.record.id))
      for (const [id, previous] of next) if (!incoming.has(id)) { URL.revokeObjectURL(previous.url); next.delete(id) }
      for (const image of sharedAssets) {
        const previous = next.get(image.record.id)
        if (previous?.sha256 === image.record.sha256) continue
        if (previous) URL.revokeObjectURL(previous.url)
        next.set(image.record.id, { blob: image.original, url: URL.createObjectURL(image.original), name: image.record.name, mediaType: image.record.mediaType, sha256: image.record.sha256 })
      }
      return next
    })
  }, [sharedAssets])
  useEffect(() => { assetsRef.current = assets; rebuildTextures() }, [assets, document.tilesets])
  useEffect(() => {
    activeRef.current = active
    if (active) window.requestAnimationFrame(() => { const viewport = viewportRef.current; viewport.width <= 1 ? fitMap() : render(); markReady() })
  }, [active])
  useEffect(() => { toolRef.current = tool }, [tool]); useEffect(() => { patternRef.current = pattern }, [pattern])
  useEffect(() => { selectionRef.current = selection }, [selection])
  useEffect(() => { filledRef.current = filled }, [filled]); useEffect(() => { eraserSizeRef.current = eraserSize }, [eraserSize])
  useEffect(() => { autotileRef.current = autotile }, [autotile]); useEffect(() => { autotileSetRef.current = autotileSetId }, [autotileSetId]); useEffect(() => { autotileProfileRef.current = autotileProfile }, [autotileProfile])
  useEffect(() => () => {
    textureGenerationRef.current += 1
    for (const texture of texturesRef.current.values()) texture.destroy(false)
    for (const texture of baseTexturesRef.current.values()) texture.destroy(false)
    texturesRef.current.clear(); baseTexturesRef.current.clear()
    for (const asset of assetsRef.current.values()) URL.revokeObjectURL(asset.url)
  }, [])

  useEffect(() => {
    const host = hostRef.current; if (!host) return
    let disposed = false
    const screenPoint = (event: PointerEvent | WheelEvent): Point => { const box = host.getBoundingClientRect(); return { x: event.clientX - box.left, y: event.clientY - box.top } }
    const cell = (event: PointerEvent) => pickOrthogonalCell(viewportRef.current, screenPoint(event), documentRef.current) as GridCoordinate | undefined
    const shapePoints = (start: GridCoordinate, end: GridCoordinate) => toolRef.current === 'line' ? linePixels(start, end) : toolRef.current === 'rectangle' ? rectanglePixels(start, end, filledRef.current) : ellipsePixels(start, end, filledRef.current)
    const applyPoints = (base: MapDocument, points: readonly GridCoordinate[]): MapDocument => {
      const bounded = points.filter((p) => p.x >= 0 && p.y >= 0 && p.x < base.width && p.y < base.height)
      if (!bounded.length) return base
      const mode = autotileModeFor(base)
      if (mode) return applyAutotileCells(base, base.activeLayerId, bounded, mode.setId, mode.profile)
      const selected = patternRef.current; return selected ? applyMapCells(base, base.activeLayerId, patternChanges(base, bounded, selected).filter((change) => change.tile)) : base
    }
    const stroke = (from: GridCoordinate, to: GridCoordinate) => safely(() => {
      const line = linePixels(from, to)
      if (toolRef.current === 'eraser') {
        const points = new Map<string, GridCoordinate>(); for (const item of line) for (const p of brushPoints(item, eraserSizeRef.current)) if (p.x >= 0 && p.y >= 0 && p.x < documentRef.current.width && p.y < documentRef.current.height) points.set(pointKey(p), p)
        const changes = [...points.values()].map((point) => ({ ...point }))
        show(isAutotileLayerActive() || autotileRef.current
          ? eraseAutotileCells(documentRef.current, documentRef.current.activeLayerId, changes)
          : applyMapCells(documentRef.current, documentRef.current.activeLayerId, changes))
      } else show(applyPoints(documentRef.current, line))
    })
    const down = (event: PointerEvent) => {
      host.focus({ preventScroll: true })
      const picked = cell(event); const screen = screenPoint(event)
      if (event.button === 1 || toolRef.current === 'pan') { event.preventDefault(); host.setPointerCapture(event.pointerId); gestureRef.current = { start: picked ?? { x: 0, y: 0 }, last: picked ?? { x: 0, y: 0 }, before: documentRef.current, screen, panning: true }; return }
      if (event.button !== 0 || !picked) return
      if (toolRef.current === 'eyedropper') {
        const tile = [...documentRef.current.layers].reverse().flatMap((layer) => layer.visible ? [layer.cells.get(pointKey(picked))] : []).find(Boolean); if (!tile) return
        activateTileset(tile.tilesetId); setTileStart(tile.tileId); setTileEnd(tile.tileId); setPattern({ width: 1, height: 1, cells: [tile] }); setStatus(`Tile ${tile.tileId}`); return
      }
      if (toolRef.current === 'fill') {
        void runFill(picked); return
      }
      host.setPointerCapture(event.pointerId)
      const moving = toolRef.current === 'select' && selectionRef.current && selectionContains(selectionRef.current, picked) ? selectionRef.current : undefined
      gestureRef.current = { start: picked, last: picked, before: documentRef.current, screen, panning: false, moving }
      if (toolRef.current === 'pencil' || toolRef.current === 'eraser') stroke(picked, picked)
      if (toolRef.current === 'select' && !moving) selectTiles(selectionBetween(picked, picked))
    }
    const move = (event: PointerEvent) => {
      const picked = cell(event); const gesture = gestureRef.current; if (!gesture || !host.hasPointerCapture(event.pointerId)) { setCursor(picked); setHoverCell(picked); return }
      const screen = screenPoint(event)
      if (gesture.panning) { viewportRef.current = panViewport(viewportRef.current, screen.x - gesture.screen.x, screen.y - gesture.screen.y); gesture.screen = screen; render(); return }
      const world = screenToWorld(viewportRef.current, screen)
      const rawCell = { x: Math.floor(world.x / documentRef.current.cellWidth), y: Math.floor(world.y / documentRef.current.cellHeight) }
      const gestureCell = gesture.moving ? rawCell : picked ?? (toolRef.current === 'select' ? { x: Math.max(0, Math.min(documentRef.current.width - 1, rawCell.x)), y: Math.max(0, Math.min(documentRef.current.height - 1, rawCell.y)) } : undefined)
      if (!gestureCell || pointKey(gestureCell) === pointKey(gesture.last)) return
      setCursor(gestureCell); setHoverCell(gestureCell)
      if (toolRef.current === 'pencil' || toolRef.current === 'eraser') stroke(gesture.last, gestureCell)
      else if (toolRef.current === 'select') {
        if (gesture.moving) {
          const origin = { x: gesture.moving.left + gestureCell.x - gesture.start.x, y: gesture.moving.top + gestureCell.y - gesture.start.y }
          safely(() => { previewRef.current = moveSelection(gesture.before, gesture.before.activeLayerId, gesture.moving!, origin); render() })
        }
        else selectTiles(selectionBetween(gesture.start, gestureCell))
      } else if (toolRef.current === 'line' || toolRef.current === 'rectangle' || toolRef.current === 'ellipse') safely(() => { previewRef.current = applyPoints(gesture.before, shapePoints(gesture.start, gestureCell)); render() })
      gesture.last = gestureCell
    }
    const up = (event: PointerEvent) => {
      const gesture = gestureRef.current; if (!gesture) return
      const previewCommitted = !!previewRef.current
      if (!gesture.panning) {
        if (previewRef.current) { const next = previewRef.current; previewRef.current = undefined; commit(next, gesture.before) }
        else if ((toolRef.current === 'pencil' || toolRef.current === 'eraser') && documentRef.current !== gesture.before) { undoRef.current.push(createMapDocumentDelta(gesture.before, documentRef.current)); redoRef.current = [] }
        else if (toolRef.current === 'line' || toolRef.current === 'rectangle' || toolRef.current === 'ellipse') safely(() => commit(applyPoints(gesture.before, shapePoints(gesture.start, gesture.last)), gesture.before))
        if (gesture.moving && previewCommitted) selectTiles({ ...gesture.moving, left: gesture.moving.left + gesture.last.x - gesture.start.x, top: gesture.moving.top + gesture.last.y - gesture.start.y })
      }
      gestureRef.current = undefined; if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId); render()
    }
    const wheel = (event: WheelEvent) => { event.preventDefault(); viewportRef.current = zoomViewportAt(viewportRef.current, screenPoint(event), Math.exp(-event.deltaY * 0.0015)); render(); refreshViewport((v) => v + 1) }
    const observer = new ResizeObserver(render); observer.observe(host)
    void OrthogonalPixiViewport.create({ host, resolveTexture: resolveTileTexture }).then((renderer) => { if (disposed) renderer.destroy(); else { rendererRef.current = renderer; fitMap(); markReady() } }).catch((error: unknown) => { if (!disposed) setStatus(error instanceof Error ? `Canvas no disponible: ${error.message}` : 'Canvas no disponible') })
    const leave = () => { if (!gestureRef.current) setHoverCell(undefined) }
    host.addEventListener('pointerdown', down); host.addEventListener('pointermove', move); host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up); host.addEventListener('pointerleave', leave); host.addEventListener('wheel', wheel, { passive: false })
    return () => { disposed = true; observer.disconnect(); host.removeEventListener('pointerdown', down); host.removeEventListener('pointermove', move); host.removeEventListener('pointerup', up); host.removeEventListener('pointercancel', up); host.removeEventListener('pointerleave', leave); host.removeEventListener('wheel', wheel); rendererRef.current?.destroy(); rendererRef.current = undefined }
  }, [])

  const copy = () => { if (!selectionRef.current) { setStatus('Selecciona tiles para copiar'); return } const pattern = captureSelection(documentRef.current, documentRef.current.activeLayerId, selectionRef.current); const referenced = new Set(pattern.cells.flatMap((tile) => tile ? [tile.tilesetId] : [])); clipboardRef.current = { pattern, tilesets: documentRef.current.tilesets.filter((tileset) => referenced.has(tileset.id)) }; setStatus('Selección copiada') }
  const cut = () => { if (!selectionRef.current) { setStatus('Selecciona tiles para cortar'); return } copy(); safely(() => { commit(deleteSelection(documentRef.current, documentRef.current.activeLayerId, selectionRef.current!)); setStatus('Selección cortada') }) }
  const paste = () => {
    const value = clipboardRef.current; if (!value) { setStatus('El portapapeles de Mapas está vacío'); return }
    const origin = cursor ?? { x: 0, y: 0 }
    if (origin.x + value.pattern.width > documentRef.current.width || origin.y + value.pattern.height > documentRef.current.height) { setStatus('Pegado debe quedar dentro del mapa'); return }
    safely(() => { const prepared = prepareClipboardPaste(documentRef.current, value.pattern, value.tilesets); const next = pastePattern(prepared.document, prepared.document.activeLayerId, origin, prepared.pattern); commit(next); selectTiles({ left: origin.x, top: origin.y, width: prepared.pattern.width, height: prepared.pattern.height }); setStatus('Selección pegada') })
  }
  const deleteSelected = () => { if (selectionRef.current) safely(() => commit(deleteSelection(documentRef.current, documentRef.current.activeLayerId, selectionRef.current!))) }
  const duplicateSelected = () => {
    const selected = selectionRef.current; if (!selected) return
    copy(); const value = clipboardRef.current; if (!value) return
    const origin = { x: Math.min(documentRef.current.width - value.pattern.width, selected.left + 1), y: Math.min(documentRef.current.height - value.pattern.height, selected.top + 1) }
    safely(() => { commit(pastePattern(documentRef.current, documentRef.current.activeLayerId, origin, value.pattern)); selectTiles({ left: origin.x, top: origin.y, width: value.pattern.width, height: value.pattern.height }) })
  }
  const transformSelected = (operation: 'flipX' | 'flipY' | 'rotate90' | 'rotate180' | 'rotate270') => {
    const value = selectionRef.current ? captureSelection(documentRef.current, documentRef.current.activeLayerId, selectionRef.current) : patternRef.current
    if (!value) return
    if ((operation === 'rotate90' || operation === 'rotate270') && value.cells.some((tile) => { const set = documentRef.current.tilesets.find((item) => item.id === tile?.tilesetId); return set && set.tileWidth !== set.tileHeight })) { setStatus('Rotación 90°/270° requiere tiles cuadrados'); return }
    const transformed = transformPattern(value, operation)
    if (selectionRef.current) {
      const selected = selectionRef.current
      if (selected.left + transformed.width > documentRef.current.width || selected.top + transformed.height > documentRef.current.height) { setStatus('Transformación debe quedar dentro del mapa'); return }
      safely(() => { let next = deleteSelection(documentRef.current, documentRef.current.activeLayerId, selected); next = pastePattern(next, next.activeLayerId, { x: selected.left, y: selected.top }, transformed); commit(next); selectTiles({ ...selected, width: transformed.width, height: transformed.height }) })
    }
    else { setPattern(transformed); setStatus('Transformación aplicada al stamp') }
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!activeRef.current) return
      const key = event.key.toLowerCase()
      if (event.key === 'Escape') {
        operationAbortRef.current?.abort()
        setOpenMenu(undefined); setNewDialog(false); setResizeDialog(false); if (importDialog) closeImportDialog(); else setImportDialog(false); setAutotileDialog(false); setAutotileManagerOpen(false); setAutotileDeleteTarget(undefined); setRulesDialogOpen(false); setWfcDialogOpen(false); selectTiles()
        const gesture = gestureRef.current; if (gesture && !gesture.panning) show(gesture.before)
        previewRef.current = undefined; gestureRef.current = undefined; render(); return
      }
      if (newDialog || resizeDialog || importDialog || autotileDialog || autotileManagerOpen || rulesDialogOpen || wfcDialogOpen) return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || (event.target instanceof HTMLElement && event.target.closest('[role="dialog"]'))) return
      const modifier = event.ctrlKey || event.metaKey
      if (modifier && key === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return }
      if (modifier && key === 'y') { event.preventDefault(); redo(); return }
      const clipboardCommand = selectionClipboardCommand(event)
      if (clipboardCommand === 'copy') { event.preventDefault(); copy(); return }
      if (clipboardCommand === 'cut') { event.preventDefault(); cut(); return }
      if (clipboardCommand === 'paste') { event.preventDefault(); paste(); return }
      if (event.altKey && event.shiftKey && event.key === 'Delete') { event.preventDefault(); deleteSelected(); return }
      if (event.code === 'Digit0') { event.preventDefault(); fitMap(); return }
      if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomCenter(1.25); return }
      if (event.key === '-') { event.preventDefault(); zoomCenter(0.8); return }
      if (event.code === 'Space') { event.preventDefault(); if (!event.repeat && !toolBeforeSpaceRef.current) toolBeforeSpaceRef.current = toolRef.current; setTool('pan'); return }
      const next = hotkeys[key]; if (next) { event.preventDefault(); setTool(next) }
    }
    const keyup = (event: KeyboardEvent) => { if (activeRef.current && event.code === 'Space' && toolBeforeSpaceRef.current) { setTool(toolBeforeSpaceRef.current); toolBeforeSpaceRef.current = undefined } }
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup) }
  }, [cursor, newDialog, resizeDialog, importDialog, autotileDialog, autotileManagerOpen, rulesDialogOpen, wfcDialogOpen])

  const selectTileRange = (end: number, start = tileStart) => {
    const tileset = document.tilesets.find((item) => item.id === activeTilesetId); if (!tileset) return
    const columns = Math.max(1, Math.floor((tileset.imageWidth - (tileset.offsetX ?? 0) - tileset.marginX * 2 + tileset.spacingX) / (tileset.tileWidth + tileset.spacingX)))
    const left = Math.min(start % columns, end % columns); const right = Math.max(start % columns, end % columns)
    const top = Math.min(Math.floor(start / columns), Math.floor(end / columns)); const bottom = Math.max(Math.floor(start / columns), Math.floor(end / columns))
    const cells: (TileReference | undefined)[] = []; for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1) { const tileId = y * columns + x; cells.push(tileId < tileset.tileCount ? { tilesetId: tileset.id, tileId } : undefined) }
    const nextPattern = { width: right - left + 1, height: bottom - top + 1, cells }
    setTileStart(start)
    setTileEnd(end); setPattern(nextPattern); tilesetSelectionsRef.current.set(tileset.id, { start, end, pattern: nextPattern })
  }
  const activateTileset = (tilesetId: string) => {
    setActiveTilesetId(tilesetId)
    if (!tilesetId) { setPattern(undefined); setTileStart(0); setTileEnd(0); return }
    const stored = tilesetSelectionsRef.current.get(tilesetId)
    if (stored) { setTileStart(stored.start); setTileEnd(stored.end); setPattern(stored.pattern); return }
    const nextPattern: TilePattern = { width: 1, height: 1, cells: [{ tilesetId, tileId: 0 }] }
    setTileStart(0); setTileEnd(0); setPattern(nextPattern); tilesetSelectionsRef.current.set(tilesetId, { start: 0, end: 0, pattern: nextPattern })
  }

  const loadImportFile = async (file?: File) => {
    if (!file) return
    try {
      const bitmap = await createImageBitmap(file)
      const zoom = fitImportZoom(bitmap.width, bitmap.height)
      setImportSize({ width: bitmap.width, height: bitmap.height }); setImportScroll({ left: 0, top: 0 }); bitmap.close()
      if (importUrl) URL.revokeObjectURL(importUrl); setImportUrl(URL.createObjectURL(file)); setImportFile(file); setImportDraft({ ...initialDraft(), zoom, name: file.name.replace(/\.[^.]+$/, '') })
    } catch { setStatus('Imagen inválida') }
  }
  const closeImportDialog = () => {
    if (importUrl) URL.revokeObjectURL(importUrl)
    setImportDialog(false); setImportFile(undefined); setImportUrl(undefined); setImportSize({ width: 0, height: 0 }); setImportScroll({ left: 0, top: 0 }); setImportDraft(initialDraft())
  }
  const { slicing, slicingError } = useMemo(() => {
    if (!importFile) return { slicing: undefined, slicingError: '' }
    try { return { slicing: sliceTileset({ imageWidth: importSize.width, imageHeight: importSize.height, ...importDraft }), slicingError: '' } }
    catch (error) { return { slicing: undefined, slicingError: error instanceof Error ? error.message : 'Configuración inválida' } }
  }, [importDraft, importFile, importSize.height, importSize.width])
  const confirmImport = async () => {
    if (!importFile || !slicing) return
    try {
      const imported = await importImage(importFile); const id = crypto.randomUUID()
      const tileset = { id, name: importDraft.name.trim(), assetId: imported.record.id, imageWidth: importSize.width, imageHeight: importSize.height, tileWidth: importDraft.tileWidth, tileHeight: importDraft.tileHeight, marginX: importDraft.marginX, marginY: importDraft.marginY, spacingX: importDraft.spacingX, spacingY: importDraft.spacingY, offsetX: importDraft.offsetX, offsetY: importDraft.offsetY, tileCount: slicing.rectangles.length, sha256: imported.record.sha256, byteSize: imported.record.byteSize, mediaType: imported.record.mediaType }
      await saveImage(imported)
      const url = URL.createObjectURL(imported.original); setAssets((current) => new Map(current).set(imported.record.id, { blob: imported.original, url, name: imported.record.name, mediaType: imported.record.mediaType }))
      commit(addTileset(documentRef.current, tileset)); activateTileset(id); closeImportDialog(); setStatus(`${tileset.name}: ${tileset.tileCount} tiles`)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Importación fallida') }
  }
  useEffect(() => {
    const receive = (event: Event) => { const detail = (event as CustomEvent<{ file?: File; tileWidth?: number; tileHeight?: number; name?: string }>).detail; if (!detail?.file) return; void loadImportFile(detail.file).then(() => { setImportDraft((draft) => ({ ...draft, tileWidth: detail.tileWidth ?? draft.tileWidth, tileHeight: detail.tileHeight ?? draft.tileHeight, name: detail.name ?? draft.name })); setImportDialog(true) }) }
    window.addEventListener('mosaico:map-import-ready', receive); return () => window.removeEventListener('mosaico:map-import-ready', receive)
  }, [])
  const deleteTileset = () => {
    if (!activeTileset) return
    const references = document.layers.reduce((count, layer) => count + [...layer.cells.values()].filter((tile) => tile.tilesetId === activeTileset.id).length, 0)
    if (!window.confirm(`Eliminar ${activeTileset.name}? ${references} referencias quedarán huérfanas.`)) return
    const next = removeTileset(documentRef.current, activeTileset.id)
    commit(next)
    if (autotileSetId && !next.autotileSets.some((set) => set.id === autotileSetId)) setAutotileSetId(undefined)
    if (activeTilesetId === activeTileset.id) activateTileset(next.tilesets[0]?.id ?? '')
  }

  const createNew = () => {
    safely(() => { const next = createMapDocument({ id: crypto.randomUUID(), layerId: crypto.randomUUID(), name: newForm.name, width: newForm.width, height: newForm.height, cellWidth: newForm.tileWidth, cellHeight: newForm.tileHeight, background: newForm.transparent ? { kind: 'transparent' } : { kind: 'color', color: `${newForm.color}ff` }, grid: { visible: newForm.grid, color: '#41505899' } }); openDocument(next); setNewDialog(false) })
  }
  const createFolder = () => safely(() => commit(addMapFolder(documentRef.current, { id: crypto.randomUUID(), name: `Carpeta ${documentRef.current.layers.filter((layer) => layer.isFolder).length + 1}` })))
  const createLayer = () => {
    const current = documentRef.current
    safely(() => commit(addMapLayer(current, { id: crypto.randomUUID(), name: `Capa ${current.layers.filter((layer) => !layer.isFolder).length + 1}`, parentId: current.layers.find((layer) => layer.id === current.activeLayerId)?.isFolder ? current.activeLayerId : undefined })))
  }
  const createAutotileLayer = () => {
    const current = documentRef.current
    safely(() => {
      const setId = autotileSetRef.current ?? current.autotileSets[0]?.id
      commit(addMapLayer(current, {
        id: crypto.randomUUID(),
        name: `Capa autotile ${current.layers.filter((layer) => layer.kind === 'autotile').length + 1}`,
        parentId: current.layers.find((layer) => layer.id === current.activeLayerId)?.isFolder ? current.activeLayerId : undefined,
        kind: 'autotile',
        ...(setId ? { autotileSetId: setId } : {}),
      }))
      setStatus(setId ? 'Capa de autotile creada y vinculada al set.' : 'Capa de autotile creada sin set: configura uno con Configurar.')
    })
  }
  const bindActiveAutotileLayerSet = (setId: string | undefined) => {
    const current = documentRef.current
    const layer = current.layers.find((item) => item.id === current.activeLayerId)
    if (layer?.kind !== 'autotile') return
    safely(() => { commit(updateMapLayer(current, layer.id, { autotileSetId: setId }), current); setStatus(setId ? 'Set vinculado a la capa.' : 'Vínculo del set eliminado.') })
  }
  const dropLayer = (sourceId: string, targetId?: string) => {
    if (!sourceId || sourceId === targetId) return
    safely(() => {
      const source = documentRef.current.layers.find((layer) => layer.id === sourceId)
      const target = targetId ? documentRef.current.layers.find((layer) => layer.id === targetId) : undefined
      const parentId = target?.isFolder ? target.id : target?.parentId
      let next = source?.parentId === parentId ? documentRef.current : setMapLayerParent(documentRef.current, sourceId, parentId)
      if (target && !target.isFolder) next = reorderMapLayer(next, sourceId, next.layers.findIndex((layer) => layer.id === target.id))
      commit(next)
    })
  }
  const removeLayerById = (layerId: string) => safely(() => commit(removeMapLayer(documentRef.current, layerId)))
  const beginLayerRename = (layer: MapLayer) => { setRenamingLayerId(layer.id); setRenameValue(layer.name) }
  const finishLayerRename = () => {
    const id = renamingLayerId; const value = renameValue.trim(); setRenamingLayerId(undefined)
    if (!id || !value) return
    safely(() => commit(updateMapLayer(documentRef.current, id, { name: value })))
  }
  const confirmResize = () => {
    safely(() => { const result = resizeMapDocument(documentRef.current, resizeForm.width, resizeForm.height, resizeForm.anchor); if (result.croppedCells && !window.confirm(`Se recortarán ${result.croppedCells} tiles. ¿Continuar?`)) return; commit(result.document); setResizeDialog(false); requestAnimationFrame(fitMap) })
  }
  const chooseAutotileType = (layout: AutotileLayout) => {
    if (!autotileDraft) return
    setAutotileDraft({ ...autotileDraft, layout, terrain: {}, contour: {}, blob: {} })
    setAutotileProfile(profileForLayout(layout))
    setAutotileTarget(undefined); setAutotilePickerScroll(0); setAutotileChoosingType(false)
  }
  const saveAutotile = () => {
    if (!autotileDraft) return
    safely(() => {
      let next = documentRef.current.autotileSets.some((set) => set.id === autotileDraft.id) ? updateAutotileSet(documentRef.current, autotileDraft) : addAutotileSet(documentRef.current, autotileDraft)
      const layer = next.layers.find((item) => item.id === next.activeLayerId)
      if (layer?.kind === 'autotile' && (!layer.autotileSetId || layer.autotileSetId === autotileDraft.id)) next = updateMapLayer(next, layer.id, { autotileSetId: autotileDraft.id })
      commit(next); setAutotileSetId(autotileDraft.id); setAutotileDialog(false)
    })
  }
  const assignAutotileTile = (tileId: number) => {
    if (!autotileDraft || !autotileTarget) { setStatus('Selecciona primero una parte del autotile'); return }
    let next: AutotileSet
    if (autotileTarget.kind === 'center') next = { ...autotileDraft, centerTileId: tileId }
    else if (autotileTarget.kind === 'terrain') { const terrain = { ...autotileDraft.terrain }; terrain[autotileTarget.role] = tileId; next = { ...autotileDraft, terrain } }
    else if (autotileTarget.kind === 'contour') { const contour = { ...autotileDraft.contour }; contour[String(autotileTarget.mask)] = tileId; next = { ...autotileDraft, contour } }
    else { const blob = { ...autotileDraft.blob }; blob[autotileTarget.kind === 'extra' ? 'extra' : String(autotileTarget.cls)] = tileId; next = { ...autotileDraft, blob } }
    setAutotileDraft(next)
    const assigned = (target: AutotileTarget): boolean => {
      if (target.kind === 'center') return true
      if (target.kind === 'terrain') return next.terrain[target.role] !== undefined
      if (target.kind === 'contour') return next.contour[String(target.mask)] !== undefined
      return target.kind === 'extra' ? next.blob?.extra !== undefined : next.blob?.[String(target.cls)] !== undefined
    }
    const currentKey = autotileTargetKey(autotileTarget)
    const following = autotileTargetsForLayout(autotileDraft.layout)
    const currentIndex = following.findIndex((candidate) => autotileTargetKey(candidate) === currentKey)
    const nextTarget = following.slice(currentIndex + 1).find((candidate) => !assigned(candidate))
    setAutotileTarget(nextTarget)
  }
  const clearAutotileTarget = () => {
    if (!autotileDraft || !autotileTarget || autotileTarget.kind === 'center') return
    if (autotileTarget.kind === 'terrain') { const terrain = { ...autotileDraft.terrain }; delete terrain[autotileTarget.role]; setAutotileDraft({ ...autotileDraft, terrain }) }
    else if (autotileTarget.kind === 'contour') { const contour = { ...autotileDraft.contour }; delete contour[String(autotileTarget.mask)]; setAutotileDraft({ ...autotileDraft, contour }) }
    else { const blob = { ...autotileDraft.blob }; delete blob[autotileTarget.kind === 'extra' ? 'extra' : String(autotileTarget.cls)]; setAutotileDraft({ ...autotileDraft, blob }) }
  }
  const useSelectedTileForAutotile = () => {
    const tile = patternRef.current?.cells.find(Boolean)
    if (!tile) { setStatus('Selecciona un tile en el panel Tilesets'); return }
    if (autotileDraft && tile.tilesetId !== autotileDraft.tilesetId) { setStatus('El tile seleccionado pertenece a otro tileset'); return }
    if (!autotileTarget && autotileDraft) { setAutotileDraft({ ...autotileDraft, centerTileId: tile.tileId }); setStatus(`Centro asignado: tile ${tile.tileId}`); return }
    assignAutotileTile(tile.tileId)
  }
  const openAutotileManager = () => { setAutotileDeleteTarget(undefined); setAutotileManagerOpen(true) }
  const beginNewAutotile = () => {
    const current = documentRef.current
    const tileset = activeTileset ?? current.tilesets[0]
    if (!tileset) { setStatus('Importa tileset primero'); return }
    setAutotileTarget(undefined); setAutotilePickerScroll(0)
    setAutotileDraft({ id: crypto.randomUUID(), name: 'Autotile', tilesetId: tileset.id, centerTileId: pattern?.cells[0]?.tileId ?? 0, terrain: {}, contour: {} })
    setAutotileChoosingType(true); setAutotileManagerOpen(false); setAutotileDialog(true)
  }
  const beginEditAutotile = (existing: AutotileSet) => {
    setAutotileTarget(undefined); setAutotilePickerScroll(0)
    setAutotileDraft({ ...existing, terrain: { ...existing.terrain }, contour: { ...existing.contour }, blob: { ...existing.blob } })
    setAutotileChoosingType(false); setAutotileManagerOpen(false); setAutotileDialog(true)
  }
  const requestDeleteAutotile = (target: AutotileSet) => setAutotileDeleteTarget(target)
  const confirmDeleteAutotile = () => {
    const target = autotileDeleteTarget; if (!target) return
    safely(() => {
      const next = removeAutotileSet(documentRef.current, target.id)
      commit(next); setStatus(`Autotile «${target.name}» eliminado.`)
      if (autotileSetId === target.id) setAutotileSetId(undefined)
      setAutotileDeleteTarget(undefined)
    })
  }
  const autotilePaintedCellCount = (setId: string): number => document.layers.reduce((total, layer) => total + [...layer.cells.values()].filter((tile) => tile.autotileSetId === setId).length, 0)

  // ── Reglas de patrón (TRN-401 · estilo TileKit: lista ordenada, chance, variantes y grupos) ──
  const [rulesState, setRulesState] = useState<{ seed: number; rules: MapPatternRule[]; groups: MapRuleGroup[] }>({ seed: 1, rules: [], groups: [] })
  const [selectedRuleId, setSelectedRuleId] = useState<string>()
  const openRulesDialog = () => {
    const stored = loadStoredMapRules(document.id)
    setRulesState(stored); setSelectedRuleId(stored.rules[0]?.id)
    const paintable = document.layers.filter((layer) => !layer.isFolder)
    const defaultLayerId = paintable[0]?.id ?? document.activeLayerId
    setRulesSourceLayerId(defaultLayerId); setRulesTargetLayerId(defaultLayerId)
    setRulesDialogOpen(true)
  }
  const persistRules = (next: { seed: number; rules: MapPatternRule[]; groups: MapRuleGroup[] }) => {
    setRulesState(next); try { localStorage.setItem(mapRulesStorageKey(documentRef.current.id), JSON.stringify({ version: 2, ...next })) } catch { /* almacenamiento no disponible */ }
  }
  const updateSelectedRule = (patch: Partial<MapPatternRule>) => {
    persistRules({ ...rulesState, rules: rulesState.rules.map((rule) => rule.id === selectedRuleId ? { ...rule, ...patch } : rule) })
  }
  const addPatternRule = () => {
    const targetTileset = activeTileset ?? document.tilesets[0]
    if (!targetTileset) { setStatus('Importa tileset primero'); return }
    const id = crypto.randomUUID()
    const priority = rulesState.rules.reduce((max, rule) => Math.max(max, rule.priority), 0) + 1
    const rule: MapPatternRule = { id, name: `Regla ${rulesState.rules.length + 1}`, priority, phase: 0, weight: 1, condition: {}, outputs: [{ tilesetId: targetTileset.id, tileId: pattern?.cells.find(Boolean)?.tileId ?? 0 }] }
    persistRules({ ...rulesState, rules: [...rulesState.rules, rule] }); setSelectedRuleId(id)
  }
  const duplicatePatternRule = (id: string) => {
    const source = rulesState.rules.find((rule) => rule.id === id); if (!source) return
    const copy: MapPatternRule = { ...source, id: crypto.randomUUID(), name: `${source.name} copia`, priority: source.priority + 0.5 }
    persistRules({ ...rulesState, rules: [...rulesState.rules, copy] }); setSelectedRuleId(copy.id)
  }
  const deletePatternRule = (id: string) => {
    persistRules({ ...rulesState, rules: rulesState.rules.filter((rule) => rule.id !== id) })
    if (selectedRuleId === id) setSelectedRuleId(undefined)
  }
  const movePatternRule = (id: string, direction: -1 | 1) => {
    const ordered = sortedPatternRules(rulesState.rules)
    const index = ordered.findIndex((rule) => rule.id === id); const neighborIndex = index + direction
    if (index < 0 || neighborIndex < 0 || neighborIndex >= ordered.length) return
    const a = ordered[index]!; const b = ordered[neighborIndex]!
    const swapped = new Map([[a.id, b.priority], [b.id, a.priority]])
    persistRules({ ...rulesState, rules: rulesState.rules.map((rule) => swapped.has(rule.id) ? { ...rule, priority: swapped.get(rule.id)! } : rule) })
  }
  // Grupos de similitud: creación desde la selección actual del panel Tilesets.
  const selectionTiles = (): readonly { tilesetId: string; tileId: number }[] =>
    (patternRef.current?.cells.filter((tile): tile is TileReference => !!tile) ?? []).map(({ tilesetId, tileId }) => ({ tilesetId, tileId }))
  const addGroupFromSelection = () => {
    const members = selectionTiles()
    if (!members.length) { setStatus('Selecciona tiles en el panel Tilesets primero'); return }
    const id = crypto.randomUUID()
    const group: MapRuleGroup = { id, name: `Grupo ${rulesState.groups.length + 1}`, color: RULE_GROUP_COLORS[rulesState.groups.length % RULE_GROUP_COLORS.length]!, members }
    persistRules({ ...rulesState, groups: [...rulesState.groups, group] })
  }
  const paintWithGroup = (group: MapRuleGroup) => {
    const member = group.members[0]
    if (!member) { setStatus('El grupo no tiene tiles.'); return }
    activateTileset(member.tilesetId); setTileStart(member.tileId); setTileEnd(member.tileId)
    setPattern({ width: 1, height: 1, cells: [{ tilesetId: member.tilesetId, tileId: member.tileId }] })
    setStatus(`Pintando intención «${group.name}» con tile ${member.tileId}. Activa la vista Intención para verlo como color.`)
  }
  const [anchorGroupId, setAnchorGroupId] = useState<string>()
  const [floorGroupId, setFloorGroupId] = useState<string>()
  const createAnchorRule = () => {
    const anchor = rulesState.groups.find((group) => group.id === anchorGroupId)
    const floor = rulesState.groups.find((group) => group.id === floorGroupId)
    const representative = anchor?.members[0]; const floorTile = floor?.members[0]
    if (!anchor || !floor || !representative || !floorTile) { setStatus('Elige grupo a anclar y grupo de suelo (ambos con tiles).'); return }
    const id = crypto.randomUUID()
    const priority = rulesState.rules.reduce((max, rule) => Math.max(max, rule.priority), 0) + 1
    const rule: MapPatternRule = {
      id, name: `Anclar ${anchor.name} sobre ${floor.name}`, priority, phase: 0, weight: 1,
      condition: { tileId: representative.tileId, neighbors: ruleNeighbors({ south: { kind: 'group', groupId: floor.id, negated: true } }) },
      outputs: [{ tilesetId: floorTile.tilesetId, tileId: floorTile.tileId }],
    }
    persistRules({ ...rulesState, rules: [...rulesState.rules, rule] }); setSelectedRuleId(id); setRulesDialogOpen(true)
    setStatus(`Regla de anclaje creada: ${anchor.name} sin suelo debajo se convierte en ${floor.name}.`)
  }
  const appendSelectionToGroup = (groupId: string) => {
    const members = selectionTiles()
    if (!members.length) { setStatus('Selecciona tiles en el panel Tilesets primero'); return }
    persistRules({ ...rulesState, groups: rulesState.groups.map((group) => {
      if (group.id !== groupId) return group
      const known = new Set(group.members.map((member) => `${member.tilesetId}:${member.tileId}`))
      return { ...group, members: [...group.members, ...members.filter((member) => !known.has(`${member.tilesetId}:${member.tileId}`))] }
    }) })
  }
  const deleteGroup = (groupId: string) => {
    // Limpia predicados que referencian el grupo eliminado para no dejar diagnósticos huérfanos.
    persistRules({
      ...rulesState,
      groups: rulesState.groups.filter((group) => group.id !== groupId),
      rules: rulesState.rules.map((rule) => {
        const neighbors = rule.condition.neighbors
        if (!neighbors) return rule
        const cleaned = Object.fromEntries(Object.entries(neighbors).filter(([, predicate]) => !(typeof predicate === 'object' && predicate.kind === 'group' && predicate.groupId === groupId)))
        return { ...rule, condition: { ...rule.condition, neighbors: cleaned } }
      }),
    })
  }
  // ── WFC (TRN-403): muestra = selección o capa origen; destino = selección o mapa entero ──
  const openWfcDialog = () => { setWfcDialogOpen(true); setStatus('WFC: la muestra y el destino usan la selección activa si la hay.') }
  const generateWfc = () => safely(() => {
    const before = documentRef.current
    const selection = selectionRef.current
    const sampleRegion = selection ?? { left: 0, top: 0, width: before.width, height: before.height }
    const targetRegion = selection ?? { left: 0, top: 0, width: before.width, height: before.height }
    const { document: next, result } = applyWfcToRegion(before, before.activeLayerId, before.activeLayerId, sampleRegion, targetRegion, { seed: wfcSeed, keepExisting: wfcKeepExisting, size: wfcSize })
    const changed = next !== before
    if (changed) commit(next, before)
    setWfcDialogOpen(false)
    setStatus(result.solved
      ? `WFC: generado ${targetRegion.width}×${targetRegion.height} con patrón ${wfcSize}×${wfcSize} (${result.backtracks} retrocesos).${changed ? '' : ' (sin cambios: desactiva "Conservar tiles" o selecciona área vacía)'}`
      : `WFC: incompleto tras ${result.backtracks} retrocesos; prueba otra semilla o una muestra más rica.`)
  })
  const applyPatternRules = () => safely(() => {    if (!rulesState.rules.length) { setStatus('No hay reglas que aplicar.'); return }
    const before = documentRef.current
    const sourceLayerId = rulesSourceLayerId ?? before.activeLayerId
    const targetLayerId = rulesTargetLayerId ?? sourceLayerId
    const sourceLayer = before.layers.find((layer) => layer.id === sourceLayerId)
    const targetLayer = before.layers.find((layer) => layer.id === targetLayerId)
    if (!sourceLayer || !targetLayer || sourceLayer.isFolder || targetLayer.isFolder) { setStatus('Elige capas origen y destino válidas (no carpetas).'); return }
    const next = applyMapRulePass(before, sourceLayerId, rulesState.rules, { seed: rulesState.seed, groups: rulesState.groups, targetLayerId })
    const beforeCells = before.layers.find((layer) => layer.id === targetLayerId)?.cells
    const afterCells = next.layers.find((layer) => layer.id === targetLayerId)?.cells
    let changed = 0
    for (const [key, tile] of afterCells ?? []) { const previous = beforeCells?.get(key); if (!previous || previous.tilesetId !== tile.tilesetId || previous.tileId !== tile.tileId) changed += 1 }
    commit(next, before); setStatus(`Reglas aplicadas (${before.layers.find((l) => l.id === sourceLayerId)?.name} → ${next.layers.find((l) => l.id === targetLayerId)?.name}): ${changed} celda(s).`)
  })
  const selectedRule = rulesState.rules.find((rule) => rule.id === selectedRuleId)
  const ruleDiagnosticsById = useMemo(() => {
    const map = new Map<string, number>()
    for (const diagnostic of mapRuleDiagnostics(documentRef.current, rulesState.rules, rulesState.groups)) map.set(diagnostic.ruleId, (map.get(diagnostic.ruleId) ?? 0) + 1)
    return map
  }, [rulesState.rules, rulesState.groups, document.revision])
  const useSelectionAsConditionTile = () => {
    const tile = patternRef.current?.cells.find(Boolean)
    if (!tile || !selectedRule) return
    updateSelectedRule({ condition: { ...selectedRule.condition, tileId: tile.tileId } })
  }
  const addOutputFromSelection = () => {
    const tile = patternRef.current?.cells.find(Boolean)
    if (!tile || !selectedRule) { setStatus('Selecciona un tile primero'); return }
    updateSelectedRule({ outputs: [...selectedRule.outputs, { tilesetId: tile.tilesetId, tileId: tile.tileId }] })
  }
  // ── Drag & drop del editor de reglas ──
  const [dropHot, setDropHot] = useState<string>()
  const [dragRuleId, setDragRuleId] = useState<string>()
  const [ruleInsertBelow, setRuleInsertBelow] = useState<string>()
  const [rulePickerScroll, setRulePickerScroll] = useState(0)
  const appendTileToGroup = (groupId: string, tile: { tilesetId: string; tileId: number }) => {
    persistRules({ ...rulesState, groups: rulesState.groups.map((group) => {
      if (group.id !== groupId) return group
      const known = new Set(group.members.map((member) => `${member.tilesetId}:${member.tileId}`))
      return known.has(`${tile.tilesetId}:${tile.tileId}`) ? group : { ...group, members: [...group.members, tile] }
    }) })
  }
  const setConditionTile = (tile: { tilesetId: string; tileId: number }) => {
    if (!selectedRule) { setStatus('Selecciona una regla primero'); return }
    updateSelectedRule({ condition: { ...selectedRule.condition, tileId: tile.tileId } })
  }
  const addOutputVariant = (tile: { tilesetId: string; tileId: number }) => {
    if (!selectedRule) { setStatus('Selecciona una regla primero'); return }
    updateSelectedRule({ outputs: [...selectedRule.outputs, tile] })
  }
  const moveRuleTo = (id: string, targetId: string, below: boolean) => {
    if (id === targetId) return
    const ordered = [...sortedPatternRules(rulesState.rules)]
    const from = ordered.findIndex((rule) => rule.id === id); if (from < 0) return
    const [item] = ordered.splice(from, 1)
    let to = ordered.findIndex((rule) => rule.id === targetId); if (to < 0) return
    if (below) to += 1
    ordered.splice(to, 0, item!)
    const resequenced = new Map(ordered.map((rule, index) => [rule.id, index + 1] as const))
    persistRules({ ...rulesState, rules: rulesState.rules.map((rule) => ({ ...rule, priority: resequenced.get(rule.id) ?? rule.priority })) })
  }
  const openAnimation = () => { if (!patternRef.current?.cells.some(Boolean)) { setStatus('Selecciona tiles primero'); return } setAnimationDialog(true) }
  const applyAnimation = () => {
    const current = patternRef.current; if (!current) return
    const animationId = crypto.randomUUID(); const duration = Math.max(10, Math.round(1000 / Math.max(1, Number.isFinite(animationFps) ? animationFps : 8)))
    setPattern({ ...current, cells: current.cells.map((tile, index) => tile ? { ...tile, animationId, animationFrame: index, animationDurationMs: duration } : undefined) }); setAnimationDialog(false); setStatus('Animación configurada')
  }
  const save = async () => { try { await saveMapPackage(document, assets); savedRevisionRef.current.set(document.id, document.revision); setStatus('Proyecto autocontenido guardado') } catch { setStatus('Guardado cancelado') } }
  const load = async (file?: File) => {
    if (!file) return
    try {
      const loaded = await loadMapProject(file); setAssets((current) => { const next = new Map(current); for (const [id, asset] of loaded.assets) next.set(id, asset); return next })
      openDocument(loaded.document, true); setActiveTilesetId(loaded.document.tilesets[0]?.id); setStatus('Proyecto abierto')
    } catch { setStatus('Proyecto inválido') }
  }
  const exportJson = async () => { try { await saveMapBlob(new Blob([neutralMapJson(document)], { type: 'application/json' }), `${safeName(document.name)}.json`, 'Tilemap JSON', 'application/json', '.json'); setStatus('JSON exportado') } catch (error) { setStatus(error instanceof Error ? error.message : 'Export falló') } }
  const exportPng = async () => { try { await saveBlob(await renderMapPng(document, assets), `${safeName(document.name)}.png`, 'png'); setStatus('PNG exportado') } catch (error) { setStatus(error instanceof Error ? error.message : 'Export falló') } }
  const exportZip = async () => { try { await saveMapBlob(await createNeutralMapPackage(document, assets), `${safeName(document.name)}-export.zip`, 'Tilemap + assets', 'application/zip', '.zip'); setStatus('ZIP exportado') } catch { setStatus('Export cancelado') } }

  const activeTileset = document.tilesets.find((item) => item.id === activeTilesetId) ?? document.tilesets[0]
  const activeAsset = activeTileset ? assets.get(activeTileset.assetId) : undefined
  const activeLayer = document.layers.find((layer) => layer.id === document.activeLayerId && !layer.isFolder)
  const activeLayerIsAutotile = activeLayer?.kind === 'autotile'
  const activeAutotileSet = activeLayerIsAutotile && activeLayer.autotileSetId ? document.autotileSets.find((set) => set.id === activeLayer.autotileSetId) : undefined
  const autotileMemberTileIds = useMemo(() => {
    if (!activeAutotileSet) return undefined
    return new Set<number>([activeAutotileSet.centerTileId, ...Object.values(activeAutotileSet.terrain), ...Object.values(activeAutotileSet.contour), ...Object.values(activeAutotileSet.blob ?? {})])
  }, [activeAutotileSet])
  const autotileDraftTileset = autotileDraft ? document.tilesets.find((item) => item.id === autotileDraft.tilesetId) : undefined
  const autotileDraftAssetUrl = autotileDraftTileset ? assets.get(autotileDraftTileset.assetId)?.url : undefined
  const autotilePickerZoom = 2
  const autotilePickerColumns = 6
  const autotilePickerColumnsInSheet = autotileDraftTileset ? Math.max(1, Math.floor((autotileDraftTileset.imageWidth - (autotileDraftTileset.offsetX ?? 0) - autotileDraftTileset.marginX * 2 + autotileDraftTileset.spacingX) / (autotileDraftTileset.tileWidth + autotileDraftTileset.spacingX))) : 1
  const autotilePickerCellW = (autotileDraftTileset?.tileWidth ?? 16) * autotilePickerZoom + 2
  const autotilePickerCellH = (autotileDraftTileset?.tileHeight ?? 16) * autotilePickerZoom + 2
  const autotilePickerRows = autotileDraftTileset ? Math.ceil(autotileDraftTileset.tileCount / autotilePickerColumns) : 0
  const autotilePickerFirstRow = Math.max(0, Math.floor(autotilePickerScroll / autotilePickerCellH) - 2)
  const autotilePickerLastRow = Math.min(autotilePickerRows, autotilePickerFirstRow + 18)
  const autotilePickerTileIds = autotileDraftTileset ? Array.from({ length: Math.max(0, (autotilePickerLastRow - autotilePickerFirstRow) * autotilePickerColumns) }, (_, index) => autotilePickerFirstRow * autotilePickerColumns + index).filter((id) => id < autotileDraftTileset.tileCount) : []
  const autotileSlotSourceRect = (tileId: number) => {
    const tileset = autotileDraftTileset; if (!tileset) return { x: 0, y: 0 }
    const x = (tileset.offsetX ?? 0) + tileset.marginX + (tileId % autotilePickerColumnsInSheet) * (tileset.tileWidth + tileset.spacingX)
    const y = (tileset.offsetY ?? 0) + tileset.marginY + Math.floor(tileId / autotilePickerColumnsInSheet) * (tileset.tileHeight + tileset.spacingY)
    return { x: -x * autotilePickerZoom, y: -y * autotilePickerZoom }
  }
  // Paleta compacta del editor de reglas (fuente de arrastre hacia condición/salidas/grupos).
  const rulePaletteTileset = activeTileset
  const rulePaletteUrl = rulePaletteTileset ? assets.get(rulePaletteTileset.assetId)?.url : undefined
  const rulePaletteColumns = 6
  const RULE_PALETTE_ZOOM = 1
  const rulePaletteCellW = (rulePaletteTileset?.tileWidth ?? 16) * RULE_PALETTE_ZOOM + 2
  const rulePaletteCellH = (rulePaletteTileset?.tileHeight ?? 16) * RULE_PALETTE_ZOOM + 2
  const rulePaletteRows = rulePaletteTileset ? Math.ceil(rulePaletteTileset.tileCount / rulePaletteColumns) : 0
  const rulePaletteFirstRow = Math.max(0, Math.floor(rulePickerScroll / rulePaletteCellH) - 1)
  const rulePaletteLastRow = Math.min(rulePaletteRows, rulePaletteFirstRow + 12)
  const rulePaletteTileIds = rulePaletteTileset ? Array.from({ length: Math.max(0, (rulePaletteLastRow - rulePaletteFirstRow) * rulePaletteColumns) }, (_, index) => rulePaletteFirstRow * rulePaletteColumns + index).filter((id) => id < rulePaletteTileset.tileCount) : []
  const columns = activeTileset ? Math.max(1, Math.floor((activeTileset.imageWidth - (activeTileset.offsetX ?? 0) - activeTileset.marginX * 2 + activeTileset.spacingX) / (activeTileset.tileWidth + activeTileset.spacingX))) : 1
  const tileDisplayColumns = Math.min(columns, 8)
  const tileRowHeight = activeTileset ? activeTileset.tileHeight * thumbZoom + 2 : 34
  const tileRows = activeTileset ? Math.ceil(activeTileset.tileCount / tileDisplayColumns) : 0
  const tileFirstRow = Math.max(0, Math.floor(tileScrollTop / tileRowHeight) - 3)
  const tileLastRow = Math.min(tileRows, tileFirstRow + 43)
  const visibleTileIds = activeTileset ? Array.from({ length: Math.max(0, (tileLastRow - tileFirstRow) * tileDisplayColumns) }, (_, index) => tileFirstRow * tileDisplayColumns + index).filter((id) => id < activeTileset.tileCount) : []
  const diagnostics = useMemo(() => [...orphanTileDiagnostics(document), ...autotileDiagnostics(document)], [document])
  const intentTintByTile = useMemo(() => {
    const map = new Map<string, number>()
    for (const group of rulesState.groups) {
      const value = Number.parseInt((group.color ?? '#888888').slice(1), 16)
      if (!Number.isFinite(value)) continue
      for (const member of group.members) map.set(`${member.tilesetId}:${member.tileId}`, value)
    }
    return map
  }, [rulesState.groups])
  // Al cambiar de documento: recarga sus reglas/grupos y apaga la vista intención del documento anterior.
  useEffect(() => {
    const stored = loadStoredMapRules(document.id)
    setRulesState(stored); setSelectedRuleId(stored.rules[0]?.id); setIntentView(false)
  }, [document.id])
  useEffect(() => {
    intentViewRef.current = intentView
    intentTintRef.current = intentTintByTile
    intentLayerRef.current = rulesSourceLayerId ?? document.layers.find((layer) => layer.id === document.activeLayerId && !layer.isFolder)?.id
    render()
  }, [intentView, intentTintByTile, rulesSourceLayerId, document])
  const layerTree = useMemo(() => mapLayerTree(document.layers), [document.layers])
  const visibleImportIndexes = importUrl && slicing ? visibleSliceIndexes({
    columns: slicing.columns, rows: slicing.rows, tileWidth: importDraft.tileWidth, tileHeight: importDraft.tileHeight,
    spacingX: importDraft.spacingX, spacingY: importDraft.spacingY, originX: importDraft.marginX + importDraft.offsetX, originY: importDraft.marginY + importDraft.offsetY,
    zoom: importDraft.zoom, scrollLeft: importScroll.left, scrollTop: importScroll.top,
    viewportWidth: importPreviewRef.current?.clientWidth ?? 720, viewportHeight: importPreviewRef.current?.clientHeight ?? 420,
  }) : []
  useEffect(() => { setTileScrollTop(0) }, [activeTilesetId])
  useEffect(() => { setRulePickerScroll(0); setDropHot(undefined) }, [activeTilesetId])
  const movingSelection = gestureRef.current?.moving
  const overlaySelection = movingSelection && cursor && gestureRef.current ? { ...movingSelection, left: movingSelection.left + cursor.x - gestureRef.current.start.x, top: movingSelection.top + cursor.y - gestureRef.current.start.y } : selection
  const selectionStyle = overlaySelection ? { left: viewportRef.current.offsetX + overlaySelection.left * document.cellWidth * viewportRef.current.zoom, top: viewportRef.current.offsetY + overlaySelection.top * document.cellHeight * viewportRef.current.zoom, width: overlaySelection.width * document.cellWidth * viewportRef.current.zoom, height: overlaySelection.height * document.cellHeight * viewportRef.current.zoom } : undefined
  type MapMenuEntries = readonly [string, () => void, boolean?][]
  const menu: Record<string, MapMenuEntries> & { Mapa: MapMenuEntries; Tileset: MapMenuEntries; Vista: MapMenuEntries } = {
    Archivo: [['Nuevo mapa…', () => setNewDialog(true)], ['Abrir…', () => window.document.getElementById('map-open')?.click()], ['Guardar proyecto', () => void save()], ['Exportar JSON neutral', () => void exportJson()], ['Exportar PNG', () => void exportPng()], ['Exportar JSON + assets ZIP', () => void exportZip()]],
    Editar: [['Deshacer', undo], ['Rehacer', redo], ['Copiar', copy], ['Cortar', cut], ['Pegar', paste], ['Duplicar selección', duplicateSelected], ['Eliminar selección', deleteSelected]],
    Mapa: [['Redimensionar…', () => { setResizeForm({ width: document.width, height: document.height, anchor: 'center' }); setResizeDialog(true) }], ['Ajustar mapa', fitMap], ['Reglas de patrón…', openRulesDialog], ['Generar con WFC…', openWfcDialog]],
    Tileset: [['Importar tilesheet…', () => setImportDialog(true)], ['Configurar autotiles…', openAutotileManager]],
    Vista: [['Ajustar mapa', fitMap], ['Zoom 100%', () => zoomCenter(1 / viewportRef.current.zoom)], ['Acercar', () => zoomCenter(1.25)], ['Alejar', () => zoomCenter(0.8)], ['Alternar grid', () => commit({ ...documentRef.current, revision: documentRef.current.revision + 1, grid: { ...documentRef.current.grid, visible: !documentRef.current.grid.visible } })]],
  }

  if (!menu.Mapa.some(([label]) => label === 'Nueva carpeta')) menu.Mapa = [...menu.Mapa, ['Nueva carpeta', createFolder], ['Nueva capa', createLayer], ['Nueva capa de autotile', createAutotileLayer]]
  if (!menu.Tileset.some(([label]) => label === 'Animar selección')) menu.Tileset = [...menu.Tileset, ['Animar selección', openAnimation]]
  if (!menu.Vista.some(([label]) => label === 'Guardar layout')) menu.Vista = [...menu.Vista, ['Panel de capas', () => panelLayout.update({ layersVisible: !panelLayout.layout.layersVisible })], ['Guardar layout', () => { const name = window.prompt('Nombre layout'); if (name) panelLayout.saveLayout(name) }], ['Aplicar layout', () => { const names = Object.keys(panelLayout.saved); const name = window.prompt(`Layout (${names.join(', ')})`); if (name) panelLayout.applyLayout(name) }], ['Eliminar layout', () => { const name = window.prompt('Layout a eliminar'); if (name) panelLayout.deleteLayout(name) }], ['Restablecer layout', panelLayout.reset]]
  const mapLayerTreeContent = <>
    <div className="panel-title"><div><p className="eyebrow">Capas</p><h2>Árbol <span>{document.layers.length}</span></h2></div><div className="layer-actions"><button title="Nueva carpeta" onPointerDown={(event) => event.stopPropagation()} onClick={createFolder}><FolderPlus /></button><button title="Nueva capa de autotile" onPointerDown={(event) => event.stopPropagation()} onClick={createAutotileLayer}><Wand2 /></button><button title="Nueva capa" onPointerDown={(event) => event.stopPropagation()} onClick={createLayer}><Plus /></button><button title="Reglas de patrón" onPointerDown={(event) => event.stopPropagation()} onClick={openRulesDialog}><SlidersHorizontal /></button></div></div>
    <div className="layer-tree" role="tree" onPointerUp={(event) => { if (!draggingLayerId) return; const target = (event.target as Element).closest<HTMLElement>('[data-layer-id]'); dropLayer(draggingLayerId, target?.dataset.layerId); setDraggingLayerId(undefined) }}>{layerTree.map(({ layer, depth }) => <div data-layer-id={layer.id} key={layer.id} className={`tree-row ${layer.id === document.activeLayerId ? 'selected' : ''} ${layer.id === draggingLayerId ? 'layer-dragging' : ''}`} role="treeitem"><button className="tree-toggle" disabled={!layer.isFolder} aria-label={layer.isFolder ? (layer.collapsed ? 'Expandir carpeta' : 'Contraer carpeta') : 'Capa'} onClick={() => layer.isFolder && commit(updateMapLayer(documentRef.current, layer.id, { collapsed: !layer.collapsed }))}>{layer.isFolder ? (layer.collapsed ? '▶' : '▼') : '·'}</button>{renamingLayerId === layer.id ? <input className="tree-rename" autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') finishLayerRename(); if (event.key === 'Escape') setRenamingLayerId(undefined) }} onBlur={finishLayerRename} /> : <button className="tree-name" style={{ paddingLeft: `${0.15 + depth * 0.75}rem` }} onPointerDown={(event) => { if (event.button === 0) setDraggingLayerId(layer.id) }} onDoubleClick={() => beginLayerRename(layer)} onClick={() => show(selectMapLayer(documentRef.current, layer.id))}><strong>{layer.name}</strong>{layer.kind === 'autotile' && !layer.isFolder && <span className="layer-kind-badge" title="Capa de autotile">AT</span>}</button>}<button title={layer.visible ? 'Ocultar' : 'Mostrar'} onPointerDown={(event) => event.stopPropagation()} onClick={() => commit(updateMapLayer(documentRef.current, layer.id, { visible: !layer.visible }))}>{layer.visible ? <Eye /> : <EyeOff />}</button><button title={layer.locked ? 'Desbloquear' : 'Bloquear'} onPointerDown={(event) => event.stopPropagation()} onClick={() => commit(updateMapLayer(documentRef.current, layer.id, { locked: !layer.locked }))}>{layer.locked ? <Lock /> : <Unlock />}</button><button title="Duplicar capa" onPointerDown={(event) => event.stopPropagation()} onClick={() => safely(() => commit(duplicateMapLayer(documentRef.current, layer.id, crypto.randomUUID())))}><Copy /></button><button title="Eliminar" onPointerDown={(event) => event.stopPropagation()} onClick={() => removeLayerById(layer.id)}><Trash2 /></button></div>)}</div>
  </>
  const activeLayerForOpacity = document.layers.find((layer) => layer.id === document.activeLayerId && !layer.isFolder)
  const mapLayerTreeWithOpacity = <>{mapLayerTreeContent}{activeLayerForOpacity && <div className="layer-opacity">
    <span title={`Opacidad de ${activeLayerForOpacity.name}`}>Opacidad</span>
    <input type="range" min="0" max="100" step="5" value={Math.round(activeLayerForOpacity.opacity * 100)} aria-label={`Opacidad de ${activeLayerForOpacity.name}`} onChange={(event) => show(updateMapLayer(documentRef.current, activeLayerForOpacity.id, { opacity: Number(event.target.value) / 100 }))} />
    <output>{Math.round(activeLayerForOpacity.opacity * 100)}%</output>
  </div>}</>
  const layoutStyle = { '--inspector-w': `${panelLayout.layout.inspectorWidth}px`, '--tileset-h': `${panelLayout.layout.tilesetHeight}px`, '--layers-h': `${panelLayout.layout.layersHeight}px` } as CSSProperties
  return <main className="pixel-editor map-editor" style={layoutStyle} onPointerDown={() => setOpenMenu(undefined)} onContextMenu={(event) => event.preventDefault()}>
    <nav className="pixel-menubar" onPointerDown={(event) => event.stopPropagation()}>{Object.entries(menu).map(([name, items]) => <div className="menu-root" key={name}><button onClick={() => setOpenMenu(openMenu === name ? undefined : name)}>{name}</button>{openMenu === name && <div className="menu-dropdown">{items.map(([label, action, disabled]) => <button key={label} disabled={disabled} onClick={() => { action(); setOpenMenu(undefined) }}>{label}</button>)}</div>}</div>)}</nav>
    <div className="document-tabs">{documents.map((item) => <div key={item.id} className={item.id === document.id ? 'active' : ''}><button onClick={() => switchDocument(item)}>{item.name}{item.revision !== (savedRevisionRef.current.get(item.id) ?? -1) ? ' •' : ''}</button><button aria-label={`Cerrar ${item.name}`} title="Cerrar mapa" onClick={() => closeDocument(item)}><X /></button></div>)}</div>
    <input id="map-open" hidden type="file" accept=".mtm,.mosaico,.json" onChange={(event) => { void load(event.target.files?.[0]); event.currentTarget.value = '' }} />
    <header className="pixel-optionsbar"><strong>{tools.find(([id]) => id === tool)?.[1]}</strong><span className="option-divider" />
      {(tool === 'rectangle' || tool === 'ellipse') && <label className="fill-control"><input type="checkbox" checked={filled} onChange={(e) => setFilled(e.target.checked)} /> Relleno</label>}
      {tool === 'eraser' && <label className="map-inline-field">Tamaño <input type="number" min="1" max="32" value={eraserSize} onChange={(e) => setEraserSize(Math.max(1, Math.min(32, Number(e.target.value))))} /></label>}
      {(tool === 'fill' || tool === 'rectangle' || tool === 'ellipse' || activeLayerIsAutotile) && <>
        <label className="fill-control" title={activeLayerIsAutotile ? 'Las capas de autotile siempre pintan con autotile' : undefined}>
          <input type="checkbox" checked={activeLayerIsAutotile ? true : autotile} disabled={activeLayerIsAutotile} onChange={(e) => setAutotile(e.target.checked)} /> Autotile{activeLayerIsAutotile ? ' · capa' : ''}
        </label>
        {activeLayerIsAutotile
          ? <select aria-label="Set de la capa" value={activeLayer?.autotileSetId ?? ''} onChange={(e) => bindActiveAutotileLayerSet(e.target.value || undefined)}>
              <option value="">Sin set…</option>
              {document.autotileSets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}
            </select>
          : autotile && <select value={autotileSetId ?? ''} onChange={(e) => setAutotileSetId(e.target.value || undefined)}><option value="">Set…</option>{document.autotileSets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}</select>}
        {(activeLayerIsAutotile || (autotile && autotileSetId)) && (() => {
          const barSet = activeLayerIsAutotile ? activeAutotileSet : document.autotileSets.find((set) => set.id === autotileSetId)
          const layoutProfile = barSet?.layout ? profileForLayout(barSet.layout) : undefined
          const profileLabels = { terrain: 'Terreno', contour: 'Contorno', blob: 'Blob' } as const
          return layoutProfile
            ? <span className="option-hint">Perfil: {profileLabels[layoutProfile]}</span>
            : <select aria-label="Perfil de autotile" value={autotileProfile} onChange={(e) => setAutotileProfile(e.target.value as 'terrain' | 'contour')}><option value="terrain">Terreno</option><option value="contour">Contorno</option></select>
        })()}
        <button className="compact-option" disabled={!rulesState.groups.length} title={intentView ? 'Vista intención activa: los grupos se muestran con su color' : 'Ver la capa origen como mapa de intención (colores de grupo)'} onClick={() => setIntentView((value) => !value)}><Shapes size={12} /> {intentView ? 'Intención ✓' : 'Intención'}</button>
        <button className="compact-option" disabled={!document.autotileSets.length && !document.tilesets.length} title={activeAutotileSet ? `Gestor de autotiles (${document.autotileSets.length})` : 'Crea o gestiona autotiles'} onClick={openAutotileManager}><Wand2 size={12} /> Autotiles…</button>
      </>}
      <span className="option-hint">Clic medio: pan · rueda: zoom al cursor · 0: ajustar</span>
      <div className="history-tools"><button title="Flip X" onClick={() => transformSelected('flipX')}><FlipHorizontal2 /></button><button title="Flip Y" onClick={() => transformSelected('flipY')}><FlipVertical2 /></button><button title="Rotar 90°" onClick={() => transformSelected('rotate90')}><RotateCw /></button><button title="Rotar 180°" className="rotation-label" onClick={() => transformSelected('rotate180')}>180°</button><button title="Rotar 270°" className="rotation-label" onClick={() => transformSelected('rotate270')}>270°</button><button title="Deshacer" onClick={undo}><Undo2 /></button><button title="Rehacer" onClick={redo}><Redo2 /></button></div>
    </header>
    <section className="pixel-body map-body"><div className="panel-splitter inspector-splitter" role="separator" aria-label="Redimensionar inspector" onPointerDown={(event) => panelLayout.resize('inspector', 'width', event)} /><div className="map-folder-float" aria-label="Carpetas"><button className="folder-create" onClick={() => commit(addMapFolder(documentRef.current, { id: crypto.randomUUID(), name: `Carpeta ${document.layers.filter((layer) => layer.isFolder).length + 1}` }))}>+ Carpeta</button>{document.layers.filter((layer) => layer.isFolder).map((folder) => <button data-folder-id={folder.id} key={folder.id} onClick={() => commit(updateMapLayer(documentRef.current, folder.id, { collapsed: !folder.collapsed }))}>{folder.collapsed ? '▶' : '▼'} {folder.name}</button>)}</div>
      <aside className="pixel-tool-rail">{tools.map(([id, label, Icon, key]) => <button key={id} className={tool === id ? 'active' : ''} aria-label={label} title={`${label} (${key})`} onClick={() => setTool(id)}><Icon /></button>)}</aside>
      <div className="canvas-shell"><div ref={hostRef} className={`authoring-canvas tool-${tool}`} tabIndex={0} aria-label="Canvas de mapa editable" aria-keyshortcuts="Control+C Control+X Control+V Meta+C Meta+X Meta+V" />{tool !== 'select' && hoverCell && pattern && <div className="map-hover-cell" aria-hidden="true" style={{ left: viewportRef.current.offsetX + hoverCell.x * document.cellWidth * viewportRef.current.zoom, top: viewportRef.current.offsetY + hoverCell.y * document.cellHeight * viewportRef.current.zoom, width: pattern.width * document.cellWidth * viewportRef.current.zoom, height: pattern.height * document.cellHeight * viewportRef.current.zoom, opacity: 0.5, backgroundImage: activeAsset && pattern.cells[0] ? `url(${activeAsset.url})` : undefined, backgroundRepeat: 'no-repeat', backgroundSize: activeAsset && pattern.cells[0] ? `${activeTileset!.imageWidth * viewportRef.current.zoom}px ${activeTileset!.imageHeight * viewportRef.current.zoom}px` : undefined, backgroundPosition: activeAsset && pattern.cells[0] ? `${-((activeTileset!.offsetX ?? 0) + activeTileset!.marginX + (pattern.cells[0]!.tileId % columns) * (activeTileset!.tileWidth + activeTileset!.spacingX)) * viewportRef.current.zoom}px ${-((activeTileset!.offsetY ?? 0) + activeTileset!.marginY + Math.floor(pattern.cells[0]!.tileId / columns) * (activeTileset!.tileHeight + activeTileset!.spacingY)) * viewportRef.current.zoom}px` : undefined }} />}{selectionStyle && <div className="map-selection-overlay" style={selectionStyle} />}</div>
      <aside className="pixel-inspector map-inspector"><div className="panel-splitter horizontal tileset-splitter" role="separator" aria-label="Redimensionar tilesets" onPointerDown={(event) => panelLayout.resize('tileset', 'height', event)} />{panelLayout.layout.layersVisible && <div className="panel-splitter horizontal layers-splitter" role="separator" aria-label="Redimensionar capas" onPointerDown={(event) => panelLayout.resize('layers', 'height', event)} />}
        {document.layers.some((layer) => layer.isFolder) && <section className="folder-summary"><div className="panel-title"><h3>Carpetas</h3><span>{document.layers.filter((layer) => layer.isFolder).length}</span></div>{document.layers.filter((layer) => layer.isFolder).map((folder) => <button className="panel-action" data-folder-id={folder.id} key={folder.id} onClick={() => commit(updateMapLayer(documentRef.current, folder.id, { collapsed: !folder.collapsed }))}>{folder.collapsed ? 'Mostrar' : 'Ocultar'} · {folder.name}</button>)}</section>}
        <section className="tileset-panel"><div className="panel-title"><div><p className="eyebrow">Biblioteca</p><h2>Tilesets <span>{document.tilesets.length}</span></h2></div><div className="layer-actions"><button title="Importar" onClick={() => setImportDialog(true)}><Upload /></button>{activeTileset && <button title="Eliminar tileset" onClick={deleteTileset}><Trash2 /></button>}</div></div>
          <select className="tileset-select" value={activeTileset?.id ?? ''} onChange={(e) => activateTileset(e.target.value)}><option value="">Sin tilesets</option>{document.tilesets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}</select>
          {activeTileset && <div className="tileset-actions"><button title="Renombrar tileset" onClick={() => { const name = window.prompt('Nombre', activeTileset.name); if (name) commit(updateTileset(documentRef.current, activeTileset.id, { name })) }}><Pencil /> Renombrar</button><label>Zoom <input type="range" min="0.5" max="5" step="0.5" value={thumbZoom} onChange={(e) => setThumbZoom(Number(e.target.value))} /></label></div>}
          <div className="tile-grid" onScroll={(event) => setTileScrollTop(event.currentTarget.scrollTop)}>{activeTileset && activeAsset && <div style={{ position: 'relative', width: tileDisplayColumns * (activeTileset.tileWidth * thumbZoom + 2), height: tileRows * tileRowHeight }}>
            {visibleTileIds.map((id) => {
              const sourceColumns = columns
              const x = (activeTileset.offsetX ?? 0) + activeTileset.marginX + (id % sourceColumns) * (activeTileset.tileWidth + activeTileset.spacingX); const y = (activeTileset.offsetY ?? 0) + activeTileset.marginY + Math.floor(id / sourceColumns) * (activeTileset.tileHeight + activeTileset.spacingY)
              const startColumn = tileStart % sourceColumns; const endColumn = tileEnd % sourceColumns; const startRow = Math.floor(tileStart / sourceColumns); const endRow = Math.floor(tileEnd / sourceColumns)
              const selected = id % sourceColumns >= Math.min(startColumn, endColumn) && id % sourceColumns <= Math.max(startColumn, endColumn) && Math.floor(id / sourceColumns) >= Math.min(startRow, endRow) && Math.floor(id / sourceColumns) <= Math.max(startRow, endRow)
              return <button key={id} className={`${selected ? 'selected' : ''}${autotileMemberTileIds && activeAutotileSet?.tilesetId === activeTileset.id ? (autotileMemberTileIds.has(id) ? ' autotile-member' : ' autotile-outside') : ''}`} title={`Tile ${id}`} style={{ position: 'absolute', left: (id % tileDisplayColumns) * (activeTileset.tileWidth * thumbZoom + 2), top: Math.floor(id / tileDisplayColumns) * tileRowHeight, width: activeTileset.tileWidth * thumbZoom, height: activeTileset.tileHeight * thumbZoom, backgroundImage: `url(${activeAsset.url})`, backgroundSize: `${activeTileset.imageWidth * thumbZoom}px ${activeTileset.imageHeight * thumbZoom}px`, backgroundPosition: `${-x * thumbZoom}px ${-y * thumbZoom}px` }} onClick={(e) => selectTileRange(id, e.shiftKey ? tileStart : id)} />
            })}
          </div>}
          {activeLayerIsAutotile && <p className="document-meta">Capa de autotile{activeAutotileSet ? `: solo pinta con tiles del set «${activeAutotileSet.name}»` : ': sin set vinculado, usa Configurar'}.</p>}</div>
          {pattern && <p className="document-meta">Stamp {pattern.width}×{pattern.height} · tile {tileStart}{tileStart !== tileEnd ? `–${tileEnd}` : ''}</p>}
        </section>
    <section><div className="panel-title"><div><p className="eyebrow">Mapa</p><h2>{document.name}</h2></div><button title="Guardar" onClick={() => void save()}><Save /></button></div><p className="document-meta">{document.width}×{document.height} tiles · {document.cellWidth}×{document.cellHeight}px · rev. {document.revision}</p><label className="fill-control map-grid-control"><input type="checkbox" checked={document.grid.visible} onChange={(e) => commit({ ...documentRef.current, revision: documentRef.current.revision + 1, grid: { ...documentRef.current.grid, visible: e.target.checked } })} /> Grid <ColorWheel label="Color del grid" value={document.grid.color.slice(0, 7)} onChange={(value) => show({ ...documentRef.current, grid: { ...documentRef.current.grid, color: `${value}99` } })} onChangeEnd={(value, initial) => { if (value === initial) return; const current = documentRef.current; commit({ ...current, revision: current.revision + 1, grid: { ...current.grid, color: `${value}99` } }, { ...current, grid: { ...current.grid, color: `${initial}99` } }) }} /></label><button className="panel-action" onClick={() => { setResizeForm({ width: document.width, height: document.height, anchor: 'center' }); setResizeDialog(true) }}>Redimensionar mapa</button></section>
        <section className="console-panel"><button className="console-heading" onClick={() => setConsoleOpen((value) => !value)}><span>Diagnósticos</span><strong>{diagnostics.length}</strong></button>{consoleOpen && <div className="console-body">{diagnostics.length ? diagnostics.map((diagnostic) => <div className={`diagnostic ${diagnostic.severity}`} key={diagnostic.groupKey}><code>{diagnostic.code}</code><span>{diagnostic.message}</span><strong>{diagnostic.count}</strong></div>) : <p>Sin errores</p>}</div>}</section>
        {panelLayout.layout.layersVisible && <section className="layer-panel layer-tree-panel layer-tree-sidebar map-tree-runtime">{mapLayerTreeWithOpacity}</section>}
      </aside>
    </section>
    <footer className="authoring-help"><span>{operation ? `${operation.label} ${Math.round(operation.progress * 100)}%` : status}{operation && <button className="operation-cancel" onClick={() => operationAbortRef.current?.abort()}>Cancelar</button>}</span><span>{cursor ? `${cursor.x}, ${cursor.y}` : '—'} · {Math.round(viewportRef.current.zoom * 100)}% · P/E/I/G/L/R/O/M/H · Ctrl+Z/Y/C/X/V</span></footer>

    {newDialog && <div className="pixel-modal"><div><header><h2>Nuevo mapa</h2><button onClick={() => setNewDialog(false)}><X /></button></header><div className="map-form">{(['name', 'width', 'height', 'tileWidth', 'tileHeight'] as const).map((key) => <label key={key}>{({ name: 'Nombre', width: 'Ancho tiles', height: 'Alto tiles', tileWidth: 'Tile width', tileHeight: 'Tile height' })[key]}<input type={key === 'name' ? 'text' : 'number'} min="1" max="4096" value={newForm[key]} onChange={(e) => setNewForm({ ...newForm, [key]: key === 'name' ? e.target.value : Number(e.target.value) })} /></label>)}</div><label className="export-check"><input type="checkbox" checked={newForm.transparent} onChange={(e) => setNewForm({ ...newForm, transparent: e.target.checked })} /> Fondo transparente</label>{!newForm.transparent && <ColorWheel label="Color de fondo" value={newForm.color} onChange={(color) => setNewForm({ ...newForm, color })} />}<label className="export-check"><input type="checkbox" checked={newForm.grid} onChange={(e) => setNewForm({ ...newForm, grid: e.target.checked })} /> Grid visible</label><button className="panel-action" onClick={createNew}>Crear mapa</button></div></div>}
    {resizeDialog && <div className="pixel-modal"><div><header><h2>Redimensionar mapa</h2><button onClick={() => setResizeDialog(false)}><X /></button></header><div className="size-fields"><label>Ancho<input type="number" min="1" max="4096" value={resizeForm.width} onChange={(e) => setResizeForm({ ...resizeForm, width: Number(e.target.value) })} /></label><label>Alto<input type="number" min="1" max="4096" value={resizeForm.height} onChange={(e) => setResizeForm({ ...resizeForm, height: Number(e.target.value) })} /></label></div><label className="field">Ancla<select value={resizeForm.anchor} onChange={(e) => setResizeForm({ ...resizeForm, anchor: e.target.value as ResizeAnchor })}>{['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'].map((value) => <option key={value}>{value}</option>)}</select></label><button className="panel-action" onClick={confirmResize}>Aplicar</button></div></div>}
    {importDialog && <div className="pixel-modal tileset-modal" role="dialog" aria-modal="true" aria-label="Importar tilesheet"><div>
      <header><h2>Importar tilesheet</h2><button aria-label="Cerrar" onClick={closeImportDialog}><X /></button></header>
      <div className="import-source"><label>Asset interno<select defaultValue="" onChange={(e) => { const asset = assets.get(e.target.value); if (asset) void loadImportFile(new File([asset.blob], asset.name ?? `${e.target.value}.png`, { type: asset.mediaType ?? asset.blob.type })) }}><option value="">Seleccionar…</option>{[...assets].map(([id, asset]) => <option key={id} value={id}>{asset.name ?? id}</option>)}</select></label><label>Archivo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void loadImportFile(e.target.files?.[0])} /></label></div>
      <div className="tileset-import-body">
        <div ref={importPreviewRef} className="tileset-preview" onScroll={(e) => setImportScroll({ left: e.currentTarget.scrollLeft, top: e.currentTarget.scrollTop })} onPointerDown={(e) => { const host = importPreviewRef.current; if (!host) return; host.setPointerCapture(e.pointerId); importPanRef.current = { x: e.clientX, y: e.clientY, left: host.scrollLeft, top: host.scrollTop } }} onPointerMove={(e) => { const host = importPreviewRef.current; const pan = importPanRef.current; if (!host || !pan || !host.hasPointerCapture(e.pointerId)) return; host.scrollLeft = pan.left - e.clientX + pan.x; host.scrollTop = pan.top - e.clientY + pan.y }} onPointerUp={() => { importPanRef.current = undefined }} onWheel={(e) => { e.preventDefault(); const host = importPreviewRef.current; if (!host) return; const before = importDraft.zoom; const next = Math.max(0.01, Math.min(6, before * Math.exp(-e.deltaY * 0.0015))); const rect = host.getBoundingClientRect(); const x = e.clientX - rect.left + host.scrollLeft; const y = e.clientY - rect.top + host.scrollTop; setImportDraft({ ...importDraft, zoom: next }); requestAnimationFrame(() => { host.scrollLeft = x * next / before - (e.clientX - rect.left); host.scrollTop = y * next / before - (e.clientY - rect.top) }) }}>
          {importUrl ? <div className="tileset-preview-image" style={{ width: importSize.width * importDraft.zoom, height: importSize.height * importDraft.zoom }}>
            <img src={importUrl} draggable={false} style={{ width: '100%', height: '100%' }} />
            {(importDraft.marginX + importDraft.offsetX) > 0 && <span className="slice-margin slice-left" style={{ width: (importDraft.marginX + importDraft.offsetX) * importDraft.zoom }} />}
            {(importDraft.marginY + importDraft.offsetY) > 0 && <span className="slice-margin slice-top" style={{ height: (importDraft.marginY + importDraft.offsetY) * importDraft.zoom }} />}
            {importDraft.marginX > 0 && <span className="slice-margin slice-right" style={{ width: importDraft.marginX * importDraft.zoom }} />}
            {importDraft.marginY > 0 && <span className="slice-margin slice-bottom" style={{ height: importDraft.marginY * importDraft.zoom }} />}
            {slicing && <><span className="slice-unused slice-unused-right" style={{ left: (importDraft.marginX + importDraft.offsetX + slicing.columns * importDraft.tileWidth + (slicing.columns - 1) * importDraft.spacingX) * importDraft.zoom, top: (importDraft.marginY + importDraft.offsetY) * importDraft.zoom, width: Math.max(0, importSize.width - importDraft.marginX - importDraft.offsetX - slicing.columns * importDraft.tileWidth - (slicing.columns - 1) * importDraft.spacingX) * importDraft.zoom, height: (slicing.rows * importDraft.tileHeight + (slicing.rows - 1) * importDraft.spacingY) * importDraft.zoom }} /><span className="slice-unused slice-unused-bottom" style={{ left: (importDraft.marginX + importDraft.offsetX) * importDraft.zoom, top: (importDraft.marginY + importDraft.offsetY + slicing.rows * importDraft.tileHeight + (slicing.rows - 1) * importDraft.spacingY) * importDraft.zoom, width: (slicing.columns * importDraft.tileWidth + (slicing.columns - 1) * importDraft.spacingX) * importDraft.zoom, height: Math.max(0, importSize.height - importDraft.marginY - importDraft.offsetY - slicing.rows * importDraft.tileHeight - (slicing.rows - 1) * importDraft.spacingY - importDraft.marginY) * importDraft.zoom }} /></>}
            {slicing && (importDraft.spacingX > 0 || importDraft.spacingY > 0) && <span className="slice-spacing" style={{
              left: (importDraft.marginX + importDraft.offsetX) * importDraft.zoom,
              top: (importDraft.marginY + importDraft.offsetY) * importDraft.zoom,
              width: (slicing.columns * importDraft.tileWidth + (slicing.columns - 1) * importDraft.spacingX) * importDraft.zoom,
              height: (slicing.rows * importDraft.tileHeight + (slicing.rows - 1) * importDraft.spacingY) * importDraft.zoom,
              backgroundImage: `${importDraft.spacingX > 0 ? `repeating-linear-gradient(90deg, transparent 0 ${importDraft.tileWidth * importDraft.zoom}px, #ff405955 ${importDraft.tileWidth * importDraft.zoom}px ${(importDraft.tileWidth + importDraft.spacingX) * importDraft.zoom}px)` : 'none'}, ${importDraft.spacingY > 0 ? `repeating-linear-gradient(0deg, transparent 0 ${importDraft.tileHeight * importDraft.zoom}px, #ff405955 ${importDraft.tileHeight * importDraft.zoom}px ${(importDraft.tileHeight + importDraft.spacingY) * importDraft.zoom}px)` : 'none'}`,
            }} />}
            {visibleImportIndexes.map((index) => { const rect = slicing!.rectangles[index]!; return <i key={index} style={{ left: rect.x * importDraft.zoom, top: rect.y * importDraft.zoom, width: rect.width * importDraft.zoom, height: rect.height * importDraft.zoom }} /> })}
          </div> : <p>Selecciona imagen</p>}
        </div>
        <div className="map-form">{(['name', 'tileWidth', 'tileHeight', 'marginX', 'marginY', 'spacingX', 'spacingY', 'offsetX', 'offsetY'] as const).map((key) => <label key={key}>{importFieldLabels[key]}<input type={key === 'name' ? 'text' : 'number'} min={key === 'tileWidth' || key === 'tileHeight' ? 1 : 0} value={importDraft[key]} onChange={(e) => setImportDraft({ ...importDraft, [key]: key === 'name' ? e.target.value : Number(e.target.value) })} /></label>)}<label>Zoom {Math.round(importDraft.zoom * 100)}%<input type="range" min=".01" max="6" step=".01" value={importDraft.zoom} onChange={(e) => setImportDraft({ ...importDraft, zoom: Number(e.target.value) })} /></label></div>
      </div>
      <p className={slicingError ? 'import-error' : 'document-meta'}>{slicingError || `${slicing?.columns ?? 0}×${slicing?.rows ?? 0} · ${slicing?.rectangles.length ?? 0} tiles completos · rojo: cortes, márgenes y spacing`}</p>
      <div className="modal-actions"><button onClick={() => { setImportScroll({ left: 0, top: 0 }); setImportDraft({ ...initialDraft(), zoom: fitImportZoom(importSize.width || 1, importSize.height || 1) }) }}>Reset</button><button onClick={closeImportDialog}>Cancelar</button><button className="primary" disabled={!slicing || !importDraft.name.trim()} onClick={() => void confirmImport()}>Importar</button></div>
    </div></div>}
    {autotileDialog && autotileDraft && (autotileChoosingType ? (() => {
      const typeDescriptions: Record<AutotileLayout, string> = {
        tiles5: 'Centro + 4 bordes · transición simple',
        tiles16: 'Máscaras cardinales 4-bit · bordes y esquinas externas',
        tiles47: 'Blob completo de 8 vecinos con esquinas internas',
        tiles48: 'Blob completo + pieza aislada dedicada',
      }
      return <div className="pixel-modal autotile-modal"><div><header><h2>Nuevo autotile · elige el tipo</h2><button onClick={() => setAutotileDialog(false)} aria-label="Cerrar"><X /></button></header>
        <p className="document-meta">Tipo de paleta según número de piezas. Después elegirás el tile de cada parte.</p>
        <div className="autotile-type-grid">
          {(['tiles5', 'tiles16', 'tiles47', 'tiles48'] as const).map((layout) => <button type="button" key={layout} className="autotile-type-card" onClick={() => chooseAutotileType(layout)}>
            <strong>{autotileLayoutLabels[layout]}</strong>
            <PieceDiagram cells={layout === 'tiles5' ? pieceCells({ kind: 'terrain', role: 'top' }) : layout === 'tiles16' ? pieceCells({ kind: 'contour', mask: 5 }) : pieceCells({ kind: 'blob', cls: 23 })} />
            <small>{typeDescriptions[layout]}</small>
          </button>)}
        </div>
        <div className="modal-actions"><button onClick={() => setAutotileDialog(false)}>Cancelar</button></div>
      </div></div>
    })() : (() => {
      const slotCaption = (target: AutotileTarget, tileId: number | undefined): string => {
        if (target.kind === 'contour') return `${target.mask.toString(2).padStart(4, '0')} ${maskArrows(target.mask)} · ${tileId === undefined ? `centro (${autotileDraft.centerTileId})` : `#${tileId}`}`
        return tileId === undefined ? `centro (${autotileDraft.centerTileId})` : `#${tileId}`
      }
      const slotTitle = (target: AutotileTarget): string => target.kind === 'center' ? terrainRoleLabels.center
        : target.kind === 'terrain' ? terrainRoleLabels[target.role]
        : target.kind === 'contour' ? `Máscara ${target.mask}`
        : target.kind === 'blob' ? `Clase blob ${target.cls} (${target.cls.toString(2).padStart(8, '0')})`
        : 'Pieza aislada (48.ª)'
      const slotTileId = (target: AutotileTarget): number | undefined => target.kind === 'center' ? autotileDraft.centerTileId : target.kind === 'terrain' ? autotileDraft.terrain[target.role] : target.kind === 'contour' ? autotileDraft.contour[String(target.mask)] : target.kind === 'extra' ? autotileDraft.blob?.extra : autotileDraft.blob?.[String(target.cls)]
      const renderSlot = (target: AutotileTarget) => {
        const key = autotileTargetKey(target); const tileId = slotTileId(target); const pending = autotileTarget && autotileTargetKey(autotileTarget) === key
        const source = autotileSlotSourceRect(tileId ?? autotileDraft.centerTileId)
        return <button type="button" key={key} className={'autotile-slot' + (pending ? ' pending' : '') + (tileId === undefined ? ' empty' : '')}
          title={pending ? `${slotTitle(target)}: haz clic en un tile →` : `${slotTitle(target)}: clic para asignar`}
          onClick={() => setAutotileTarget(pending ? undefined : target)}>
          <PieceDiagram cells={pieceCells(target)} />
          <span className="autotile-slot-thumb" style={{ backgroundImage: autotileDraftAssetUrl ? `url(${autotileDraftAssetUrl})` : undefined, backgroundSize: autotileDraftTileset ? `${autotileDraftTileset.imageWidth * autotilePickerZoom}px ${autotileDraftTileset.imageHeight * autotilePickerZoom}px` : undefined, backgroundPosition: `${source.x}px ${source.y}px` }}>{!autotileDraftAssetUrl ? '?' : ''}</span>
          <small>{slotCaption(target, tileId)}</small>
        </button>
      }
      const layout = autotileDraft.layout
      const targets = autotileTargetsForLayout(layout)
      const terrainTargets = targets.filter((target): target is Extract<AutotileTarget, { kind: 'terrain' }> => target.kind === 'terrain')
      const contourTargets = targets.filter((target): target is Extract<AutotileTarget, { kind: 'contour' }> => target.kind === 'contour')
      const blobTargets = targets.filter((target) => target.kind === 'blob' || target.kind === 'extra')
      const activeLabel = autotileTarget ? slotTitle(autotileTarget) : undefined
      return <div className="pixel-modal autotile-modal"><div><header><h2>Autotile · {autotileDraft.name || 'nuevo set'}{layout ? ` · ${autotileLayoutLabels[layout]}` : ''}</h2><button onClick={() => setAutotileDialog(false)} aria-label="Cerrar"><X /></button></header>
        <div className="map-form">
          <label>Nombre<input value={autotileDraft.name} onChange={(e) => setAutotileDraft({ ...autotileDraft, name: e.target.value })} /></label>
          <label>Tileset<select value={autotileDraft.tilesetId} onChange={(e) => { setAutotileDraft({ ...autotileDraft, tilesetId: e.target.value }); setAutotileTarget(undefined); setAutotilePickerScroll(0) }}>{document.tilesets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}</select></label>
          <label>{layout ? 'Tipo' : 'Centro'}{layout
            ? <input readOnly value={`${autotileLayoutLabels[layout]} · perfil ${profileForLayout(layout)}`} />
            : <input type="number" min="0" value={autotileDraft.centerTileId} onChange={(e) => setAutotileDraft({ ...autotileDraft, centerTileId: Math.max(0, Number(e.target.value) || 0) })} />}</label>
        </div>
        <p className="document-meta">{activeLabel ? `Parte activa: ${activeLabel} — haz clic en un tile del panel derecho.` : 'Haz clic en una parte y luego en un tile para asignarla. Se avanza sola al siguiente hueco libre.'}</p>
        <div className="autotile-layout">
          <div className="autotile-slots-column">
            {!layout && <>
              <h3>Partes del terreno</h3>
              <div className="autotile-slots">{terrainTargets.map((target) => renderSlot(target))}</div>
              <h3>Contorno · máscaras cardinales</h3>
              <div className="autotile-slots">{contourTargets.map((target) => renderSlot(target))}</div>
            </>}
            {layout === 'tiles5' && <>
              <h3>Piezas · bordes (el centro se define arriba)</h3>
              <div className="autotile-slots">{targets.map((target) => renderSlot(target))}</div>
            </>}
            {layout === 'tiles16' && <>
              <h3>Máscaras cardinales · 4 bits</h3>
              <div className="autotile-slots">{targets.map((target) => renderSlot(target))}</div>
            </>}
            {(layout === 'tiles47' || layout === 'tiles48') && <>
              <h3>Clases blob{layout === 'tiles48' ? ' · + pieza aislada' : ''}</h3>
              <div className="autotile-slots">{blobTargets.map((target) => renderSlot(target))}</div>
            </>}
          </div>
          <div className="autotile-picker-column">
            <h3>Tiles de {autotileDraftTileset?.name ?? '—'}</h3>
            <div className="autotile-picker" onScroll={(event) => setAutotilePickerScroll(event.currentTarget.scrollTop)}>
              {autotileDraftAssetUrl && autotileDraftTileset && <div style={{ position: 'relative', width: autotilePickerColumns * autotilePickerCellW, height: autotilePickerRows * autotilePickerCellH }}>
                {autotilePickerTileIds.map((id) => {
                  const x = (autotileDraftTileset.offsetX ?? 0) + autotileDraftTileset.marginX + (id % autotilePickerColumnsInSheet) * (autotileDraftTileset.tileWidth + autotileDraftTileset.spacingX)
                  const y = (autotileDraftTileset.offsetY ?? 0) + autotileDraftTileset.marginY + Math.floor(id / autotilePickerColumnsInSheet) * (autotileDraftTileset.tileHeight + autotileDraftTileset.spacingY)
                  return <button type="button" key={id} title={`Asignar tile ${id}`} style={{ left: (id % autotilePickerColumns) * autotilePickerCellW, top: Math.floor(id / autotilePickerColumns) * autotilePickerCellH, width: autotileDraftTileset.tileWidth * autotilePickerZoom, height: autotileDraftTileset.tileHeight * autotilePickerZoom, backgroundImage: `url(${autotileDraftAssetUrl})`, backgroundSize: `${autotileDraftTileset.imageWidth * autotilePickerZoom}px ${autotileDraftTileset.imageHeight * autotilePickerZoom}px`, backgroundPosition: `${-x * autotilePickerZoom}px ${-y * autotilePickerZoom}px` }} onClick={() => assignAutotileTile(id)} />
                })}
              </div>}
            </div>
            <div className="autotile-toolbar">
              <button type="button" onClick={useSelectedTileForAutotile}>Usar tile seleccionado</button>
              <button type="button" disabled={!autotileTarget || autotileTarget.kind === 'center'} onClick={clearAutotileTarget}>Quitar asignación</button>
              <button type="button" onClick={() => setAutotileTarget(undefined)}>Cancelar selección</button>
            </div>
          </div>
        </div>
        <div className="modal-actions"><button onClick={() => setAutotileDialog(false)}>Cancelar</button><button className="primary" onClick={saveAutotile}>Guardar set</button></div>
      </div></div>
    })())}
    {autotileManagerOpen && <div className="pixel-modal autotile-modal"><div>
      {autotileDeleteTarget ? (() => {
        const target = autotileDeleteTarget
        const tileset = document.tilesets.find((item) => item.id === target.tilesetId)
        const url = tileset ? assets.get(tileset.assetId)?.url : undefined
        const paintedCells = autotilePaintedCellCount(target.id)
        const pieces = Object.keys(target.terrain).length + Object.keys(target.contour).length + Object.keys(target.blob ?? {}).length
        const cols = tileset ? Math.max(1, Math.floor((tileset.imageWidth - (tileset.offsetX ?? 0) - tileset.marginX * 2 + tileset.spacingX) / (tileset.tileWidth + tileset.spacingX))) : 1
        const x = (tileset?.offsetX ?? 0) + (tileset?.marginX ?? 0) + (target.centerTileId % cols) * ((tileset?.tileWidth ?? 16) + (tileset?.spacingX ?? 0))
        const y = (tileset?.offsetY ?? 0) + (tileset?.marginY ?? 0) + Math.floor(target.centerTileId / cols) * ((tileset?.tileHeight ?? 16) + (tileset?.spacingY ?? 0))
        return <>
          <header><h2>¿Eliminar «{target.name}»?</h2><button onClick={() => setAutotileDeleteTarget(undefined)} aria-label="Volver"><X /></button></header>
          <div className="autotile-delete-preview">
            <span className="autotile-delete-thumb" style={{ backgroundImage: url ? `url(${url})` : undefined, backgroundSize: tileset ? `${tileset.imageWidth * 4}px ${tileset.imageHeight * 4}px` : undefined, backgroundPosition: `${-x * 4}px ${-y * 4}px` }} />
            <div>
              <p><strong>{target.name}</strong> · {target.layout ? autotileLayoutLabels[target.layout] : 'Libre (legado)'}</p>
              <p>Tileset: {tileset?.name ?? '—'} · centro #{target.centerTileId}</p>
              <p>{pieces} parte(s) configurada(s) · <strong>{paintedCells}</strong> celda(s) pintadas con este set</p>
              <p className="document-meta">{paintedCells ? 'Las celdas pintadas conservarán sus tiles pero perderán la etiqueta del set.' : 'Este set no tiene celdas pintadas.'}</p>
            </div>
          </div>
          <div className="modal-actions"><button onClick={() => setAutotileDeleteTarget(undefined)}>No, cancelar</button><button className="primary danger" onClick={confirmDeleteAutotile}>Sí, eliminar</button></div>
        </>
      })() : <>
        <header><h2>Autotiles · {document.autotileSets.length}</h2><button onClick={() => setAutotileManagerOpen(false)} aria-label="Cerrar"><X /></button></header>
        <p className="document-meta">Edita, elimina o crea sistemas de autotile. Cada capa de autotile se vincula a uno de estos sets.</p>
        <table className="autotile-manager-table">
          <thead><tr><th>Preview</th><th>Nombre</th><th>Tipo</th><th>Tileset</th><th>Piezas</th><th>Celdas</th><th>Acciones</th></tr></thead>
          <tbody>
            {document.autotileSets.map((set) => {
              const tileset = document.tilesets.find((item) => item.id === set.tilesetId)
              const url = tileset ? assets.get(tileset.assetId)?.url : undefined
              const cols = tileset ? Math.max(1, Math.floor((tileset.imageWidth - (tileset.offsetX ?? 0) - tileset.marginX * 2 + tileset.spacingX) / (tileset.tileWidth + tileset.spacingX))) : 1
              const x = (tileset?.offsetX ?? 0) + (tileset?.marginX ?? 0) + (set.centerTileId % cols) * ((tileset?.tileWidth ?? 16) + (tileset?.spacingX ?? 0))
              const y = (tileset?.offsetY ?? 0) + (tileset?.marginY ?? 0) + Math.floor(set.centerTileId / cols) * ((tileset?.tileHeight ?? 16) + (tileset?.spacingY ?? 0))
              const pieces = Object.keys(set.terrain).length + Object.keys(set.contour).length + Object.keys(set.blob ?? {}).length
              const boundLayers = document.layers.filter((layer) => layer.autotileSetId === set.id).length
              return <tr key={set.id} className={autotileSetId === set.id ? 'active' : ''}>
                <td><span className="autotile-delete-thumb small" style={{ backgroundImage: url ? `url(${url})` : undefined, backgroundSize: tileset ? `${tileset.imageWidth * 3}px ${tileset.imageHeight * 3}px` : undefined, backgroundPosition: `${-x * 3}px ${-y * 3}px` }} /></td>
                <td>{set.name}{boundLayers > 0 && <small> · {boundLayers} capa(s)</small>}</td>
                <td>{set.layout ? autotileLayoutLabels[set.layout] : 'Libre'}</td>
                <td>{tileset?.name ?? '—'}</td>
                <td>{pieces}</td>
                <td>{autotilePaintedCellCount(set.id)}</td>
                <td className="autotile-manager-actions">
                  <button onClick={() => beginEditAutotile(set)}><Pencil size={11} /> Editar</button>
                  <button className="danger" onClick={() => requestDeleteAutotile(set)}><Trash2 size={11} /> Eliminar</button>
                </td>
              </tr>
            })}
            {!document.autotileSets.length && <tr><td colSpan={7} className="document-meta">Todavía no hay autotiles. Crea el primero.</td></tr>}
          </tbody>
        </table>
        <div className="modal-actions"><button onClick={() => setAutotileManagerOpen(false)}>Cerrar</button><button className="primary" disabled={!document.tilesets.length} onClick={beginNewAutotile}><Plus size={12} /> Nuevo autotile…</button></div>
      </>}
    </div></div>}
    {rulesDialogOpen && (() => {
      const orderedRules = sortedPatternRules(rulesState.rules)
      const groupById = new Map(rulesState.groups.map((group) => [group.id, group] as const))
      const predicateCycle = (): RuleCellPredicate[] => ['same', 'different', ...rulesState.groups.flatMap((group) => [{ kind: 'group' as const, groupId: group.id }, { kind: 'group' as const, groupId: group.id, negated: true }])]
      const canonicalPredicate = (predicate: RuleCellPredicate | undefined): string => {
        if (predicate === undefined) return 'undefined'
        if (typeof predicate === 'string') return predicate
        return JSON.stringify({ kind: predicate.kind, groupId: predicate.groupId, negated: !!predicate.negated })
      }
      const cycle: readonly (RuleCellPredicate | undefined)[] = [undefined, ...predicateCycle()]
      const cycleNeighbor = (key: RuleNeighborKey) => {
        if (!selectedRule) return
        const neighbors = { ...(selectedRule.condition.neighbors ?? {}) }
        const current = neighbors[key]
        // Comparación canónica; un valor no reconocido (forma legada) avanza a 'mismo' en vez de borrarse.
        const index = cycle.findIndex((candidate) => canonicalPredicate(candidate) === canonicalPredicate(current))
        const next = index <= 0 ? cycle[1] : cycle[(index + 1) % cycle.length]
        if (!next) delete neighbors[key]
        else neighbors[key] = next
        updateSelectedRule({ condition: { ...selectedRule.condition, neighbors } })
      }
      const predicateClass = (predicate: RuleCellPredicate | undefined): string => {
        if (!predicate) return 'ignore'
        if (typeof predicate === 'string') return predicate
        return predicate.negated ? 'group-negated' : 'group'
      }
      const predicateStyle = (predicate: RuleCellPredicate | undefined): CSSProperties | undefined => {
        if (!predicate || typeof predicate === 'string') return undefined
        const color = groupById.get(predicate.groupId)?.color ?? '#888'
        return { background: color, opacity: predicate.negated ? 0.45 : 1 }
      }
      const predicateTitle = (key: RuleNeighborKey, predicate: RuleCellPredicate | undefined): string => {
        const dx = Number(key.slice(0, key.indexOf(','))); const dy = Number(key.slice(key.indexOf(',') + 1))
        const where = `${dx > 0 ? `${dx}→` : dx < 0 ? `${-dx}←` : ''}${dy > 0 ? `${dy}↓` : dy < 0 ? `${-dy}↑` : '·'}`
        if (!predicate) return `${where}: ignorar`
        if (predicate === 'same') return `${where}: mismo tile`
        if (predicate === 'different') return `${where}: distinto/vacío`
        const name = groupById.get(predicate.groupId)?.name ?? '?'
        return `${where}: ${predicate.negated ? 'NO ' : ''}∈ ${name}`
      }
      const tileThumbStyle = (tileRef: { tilesetId: string; tileId: number }, zoom: number): CSSProperties => {
        const ts = document.tilesets.find((item) => item.id === tileRef.tilesetId)
        const url = ts ? assets.get(ts.assetId)?.url : undefined
        const cols = ts ? Math.max(1, Math.floor((ts.imageWidth - (ts.offsetX ?? 0) - ts.marginX * 2 + ts.spacingX) / (ts.tileWidth + ts.spacingX))) : 1
        const x = (ts?.offsetX ?? 0) + (ts?.marginX ?? 0) + (tileRef.tileId % cols) * ((ts?.tileWidth ?? 16) + (ts?.spacingX ?? 0))
        const y = (ts?.offsetY ?? 0) + (ts?.marginY ?? 0) + Math.floor(tileRef.tileId / cols) * ((ts?.tileHeight ?? 16) + (ts?.spacingY ?? 0))
        return { backgroundImage: url ? `url(${url})` : undefined, backgroundSize: ts ? `${ts.imageWidth * zoom}px ${ts.imageHeight * zoom}px` : undefined, backgroundPosition: `${-x * zoom}px ${-y * zoom}px`, width: (ts?.tileWidth ?? 16) * zoom, height: (ts?.tileHeight ?? 16) * zoom }
      }
      const diagnosticCount = ruleDiagnosticsById.get(selectedRule?.id ?? '') ?? 0
      return <div className="pixel-modal rules-modal"><div>
        <header><h2>Reglas de patrón</h2><button onClick={() => setRulesDialogOpen(false)} aria-label="Cerrar"><X /></button></header>
        <p className="document-meta">Flujo TileKit: pinta bocetos con tiles básicos en la capa origen y las reglas generan el detalle en la capa destino. Se guardan junto a este mapa.</p>
        <div className="rules-layout">
          <div className="rules-list-column">
            <div className="rules-list">
              {orderedRules.map((rule, index) => <button type="button" key={rule.id} draggable
                className={'rules-row' + (rule.id === selectedRuleId ? ' selected' : '') + (dragRuleId && dragRuleId !== rule.id ? (ruleInsertBelow === `b:${rule.id}` ? ' insert-bottom' : ruleInsertBelow === `t:${rule.id}` ? ' insert-top' : '') : '')}
                onClick={() => setSelectedRuleId(rule.id)}
                onDragStart={(event) => { event.dataTransfer.setData('text/mosaico-rule', rule.id); event.dataTransfer.effectAllowed = 'move'; setDragRuleId(rule.id) }}
                onDragEnd={() => { setDragRuleId(undefined); setRuleInsertBelow(undefined) }}
                onDragOver={(event) => {
                  if (!event.dataTransfer.types.includes('text/mosaico-rule')) return
                  event.preventDefault(); event.dataTransfer.dropEffect = 'move'
                  const rect = event.currentTarget.getBoundingClientRect()
                  setRuleInsertBelow(event.clientY > rect.top + rect.height / 2 ? `b:${rule.id}` : `t:${rule.id}`)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  const id = event.dataTransfer.getData('text/mosaico-rule') || dragRuleId
                  if (!id) return
                  const rect = event.currentTarget.getBoundingClientRect()
                  const below = event.clientY > rect.top + rect.height / 2
                  moveRuleTo(id, rule.id, below); setDragRuleId(undefined); setRuleInsertBelow(undefined)
                }}>
                <span className="rules-order">{index + 1}</span>
                <span className="rules-name">{rule.name}</span>
                <small>F{rule.phase}</small>
                {(ruleDiagnosticsById.get(rule.id) ?? 0) > 0 && <em title="Regla inválida">⚠</em>}
              </button>)}
              {!orderedRules.length && <p className="document-meta">Sin reglas.</p>}
            </div>
            <div className="rules-toolbar">
              <button type="button" onClick={addPatternRule}><Plus size={11} /> Nueva</button>
              <button type="button" disabled={!selectedRule} onClick={() => selectedRule && duplicatePatternRule(selectedRule.id)}><Copy size={11} /> Duplicar</button>
              <button type="button" disabled={!selectedRule} title="Subir prioridad" onClick={() => selectedRule && movePatternRule(selectedRule.id, -1)}><ArrowUp size={11} /></button>
              <button type="button" disabled={!selectedRule} title="Bajar prioridad" onClick={() => selectedRule && movePatternRule(selectedRule.id, 1)}><ArrowDown size={11} /></button>
              <button type="button" disabled={!selectedRule} onClick={() => selectedRule && deletePatternRule(selectedRule.id)}><Trash2 size={11} /> Eliminar</button>
            </div>
            <h3>Grupos de similitud</h3>
            <div className="rule-groups"
              onDragOver={(e) => { if (e.dataTransfer.types.includes(TILE_DND_MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }}
              onDrop={(e) => { e.preventDefault(); const tile = getTileDrag(e); if (!tile) return; const groupId = (e.target as Element).closest('[data-drop-group]')?.getAttribute('data-drop-group'); if (groupId) appendTileToGroup(groupId, tile) }}>
              {rulesState.groups.map((group) => <div className={'rule-group-row' + (dropHot === `group:${group.id}` ? ' drop-hot' : '')}
                key={group.id}
                data-drop-group={group.id}
                onDragOver={(e) => { if (e.dataTransfer.types.includes(TILE_DND_MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDropHot(`group:${group.id}`) } }}
                onDragLeave={() => setDropHot((current) => current === `group:${group.id}` ? undefined : current)}
                onDrop={(e) => {
                  e.preventDefault()
                  const tile = getTileDrag(e); const groupId = (e.target as Element).closest('[data-drop-group]')?.getAttribute('data-drop-group')
                  if (!tile || !groupId) return
                  appendTileToGroup(groupId, tile); setDropHot(undefined)
                }}>
                <span className="group-dot" style={{ background: group.color }} />
                <strong title={`${group.members.length} tile(s)`}>{group.name}</strong>
                <small>{group.members.length}</small>
                <button type="button" title="Pintar con este grupo (tile representante)" onClick={() => paintWithGroup(group)}><PaintBucket size={11} /></button>
                <button type="button" title="Añadir selección actual al grupo" onClick={() => appendSelectionToGroup(group.id)}><SquarePlus size={11} /></button>
                <button type="button" aria-label={`Eliminar ${group.name}`} onClick={() => deleteGroup(group.id)}><Trash2 size={11} /></button>
              </div>)}
              {!rulesState.groups.length && <p className="document-meta">Sin grupos: arrastra tiles aquí o crea uno desde la selección.</p>}
            </div>
            <button type="button" onClick={addGroupFromSelection}><Shapes size={11} /> Grupo desde selección</button>
            <div className="rule-anchor-row">
              <select aria-label="Grupo a anclar" value={anchorGroupId ?? ''} onChange={(e) => setAnchorGroupId(e.target.value || undefined)}><option value="">Anclar…</option>{rulesState.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
              <select aria-label="Grupo de suelo" value={floorGroupId ?? ''} onChange={(e) => setFloorGroupId(e.target.value || undefined)}><option value="">sobre…</option>{rulesState.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
              <button type="button" title="Crea una regla: si el tile del grupo ancla no tiene suelo debajo, se reemplaza por suelo" disabled={!anchorGroupId || !floorGroupId} onClick={createAnchorRule}><ArrowDown size={11} /> Anclar</button>
            </div>
            <label className="field">Semilla<input type="number" value={rulesState.seed} onChange={(e) => persistRules({ ...rulesState, seed: Number(e.target.value) || 0 })} /></label>
            <label className="field">Capa origen<select value={rulesSourceLayerId ?? document.activeLayerId} onChange={(e) => setRulesSourceLayerId(e.target.value)}>{document.layers.filter((layer) => !layer.isFolder).map((layer) => <option key={layer.id} value={layer.id}>{layer.name}{layer.kind === 'autotile' ? ' (AT)' : ''}</option>)}</select></label>
            <label className="field">Capa destino<select value={rulesTargetLayerId ?? document.activeLayerId} onChange={(e) => setRulesTargetLayerId(e.target.value)}>{document.layers.filter((layer) => !layer.isFolder).map((layer) => <option key={layer.id} value={layer.id}>{layer.name}{layer.kind === 'autotile' ? ' (AT)' : ''}</option>)}</select></label>
            <button type="button" className="primary" disabled={!rulesState.rules.length || ruleDiagnosticsById.size > 0} title={ruleDiagnosticsById.size ? 'Corrige las reglas inválidas (⚠)' : 'Evalúa la capa origen y escribe el resultado en la destino'} onClick={applyPatternRules}><Play size={11} /> Aplicar reglas</button>
            {ruleDiagnosticsById.size > 0 && <p className="import-error">{ruleDiagnosticsById.size} regla(s) inválida(s).</p>}
          </div>
          <div className="rules-editor">
            {!selectedRule ? <p className="document-meta">Selecciona o crea una regla.</p> : <>
              <div className="map-form">
                <label>Nombre<input value={selectedRule.name} onChange={(e) => updateSelectedRule({ name: e.target.value })} /></label>
                <label>Fase<input type="number" min="0" value={selectedRule.phase} onChange={(e) => updateSelectedRule({ phase: Math.max(0, Number(e.target.value) || 0) })} /></label>
                <label>Prioridad<input type="number" value={selectedRule.priority} onChange={(e) => updateSelectedRule({ priority: Number(e.target.value) || 0 })} /></label>
                <label>Prob. %<input type="number" min="0" max="100" value={Math.round((selectedRule.chance ?? 1) * 100)} onChange={(e) => updateSelectedRule({ chance: Math.max(0, Math.min(100, Number(e.target.value))) / 100 })} /></label>
              </div>
              <label className="fill-control"><input type="checkbox" checked={!!selectedRule.allowRotations} onChange={(e) => updateSelectedRule({ allowRotations: e.target.checked })} /> Rotar condición (90°/180°/270°)</label>
              <h3>Condición</h3>
              <div className="rule-condition-row">
                <div className="rule-condition-grid r5" role="group" aria-label="Vecindario 5×5 de la condición">
                  {ruleGridKeys.map((key, index) => <Fragment key={key}>
                    {index === RULE_GRID_RADIUS * (RULE_GRID_RADIUS * 2 + 1) + RULE_GRID_RADIUS && <span className="rule-cell center-spacer" title="Tile central (se define a la derecha)" />}
                    {(() => {
                      const predicate = selectedRule.condition.neighbors?.[key]
                      return <button type="button" className={'rule-cell ' + predicateClass(predicate)} style={predicateStyle(predicate)} title={predicateTitle(key, predicate)} onClick={() => cycleNeighbor(key)} />
                    })()}
                  </Fragment>)}
                </div>
                <div className={'rule-condition-center' + (dropHot === 'condition' ? ' drop-hot' : '')}
                  onDragOver={(e) => { if (e.dataTransfer.types.includes(TILE_DND_MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDropHot('condition') } }}
                  onDragLeave={() => setDropHot((current) => current === 'condition' ? undefined : current)}
                  onDrop={(e) => { e.preventDefault(); const tile = getTileDrag(e); setDropHot(undefined); if (!tile) return; setConditionTile(tile) }}>
                  <span className="mini-tile" style={selectedRule.condition.tileId !== undefined && document.tilesets.length ? tileThumbStyle({ tilesetId: activeTileset?.id ?? document.tilesets[0]!.id, tileId: selectedRule.condition.tileId }, 2) : undefined}>{selectedRule.condition.tileId === undefined ? '?' : ''}</span>
                  <small>{selectedRule.condition.tileId === undefined ? 'Cualquier tile · suelta aquí' : `Tile ${selectedRule.condition.tileId}`}</small>
                  <button type="button" onClick={useSelectionAsConditionTile}><Crosshair size={11} /> Usar selección</button>
                  {selectedRule.condition.tileId !== undefined && <button type="button" onClick={() => updateSelectedRule({ condition: { ...selectedRule.condition, tileId: undefined } })}>Cualquiera</button>}
                </div>
                <div className="legend">
                  <span><i className="rule-cell same" /> mismo</span>
                  <span><i className="rule-cell different" /> distinto/vacío</span>
                  {rulesState.groups.map((group) => <span key={group.id}><i className="rule-cell group" style={predicateStyle({ kind: 'group', groupId: group.id })} />∈ {group.name}</span>)}
                  {rulesState.groups.map((group) => <span key={`neg-${group.id}`}><i className="rule-cell group-negated" style={predicateStyle({ kind: 'group', groupId: group.id, negated: true })} />∉ {group.name}</span>)}
                  <span><i className="rule-cell ignore" /> ignorar</span>
                </div>
                <p className="document-meta">Clic en una celda: ignorar → mismo → distinto → ∈ grupo → ∉ grupo → ignorar.</p>
              </div>
              <h3>Salidas ({selectedRule.outputs.length} variantes)</h3>
              <div className={'rule-outputs' + (dropHot === 'outputs' ? ' drop-hot' : '')}
                onDragOver={(e) => { if (e.dataTransfer.types.includes(TILE_DND_MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDropHot('outputs') } }}
                onDragLeave={() => setDropHot((current) => current === 'outputs' ? undefined : current)}
                onDrop={(e) => { e.preventDefault(); const tile = getTileDrag(e); setDropHot(undefined); if (!tile) return; addOutputVariant(tile) }}>
                {selectedRule.outputs.map((output, index) => <div className="rule-output" key={index}>
                  <span className="mini-tile" style={tileThumbStyle(output, 2)} title={`#${output.tileId}`} />
                  <label>#{output.tileId}<input type="number" min="0" value={output.weight ?? 1} onChange={(e) => updateSelectedRule({ outputs: selectedRule.outputs.map((item, position) => position === index ? { ...item, weight: Math.max(0, Number(e.target.value) || 0) } : item) })} /></label>
                  <button type="button" aria-label="Quitar variante" onClick={() => updateSelectedRule({ outputs: selectedRule.outputs.filter((_, position) => position !== index) })}><X /></button>
                </div>)}
                <button type="button" onClick={addOutputFromSelection}><SquarePlus size={11} /> Variante (selección)</button>
              </div>
              {diagnosticCount > 0 && <p className="import-error">Esta regla tiene {diagnosticCount} problema(s): revisa pesos, salidas y referencias.</p>}
            </>}
          </div>
          <div className="rules-picker-column">
            <h3>Tiles</h3>
            <div className="rule-tile-palette" onScroll={(event) => setRulePickerScroll(event.currentTarget.scrollTop)}>
              {rulePaletteUrl && rulePaletteTileset && <div style={{ position: 'relative', width: rulePaletteColumns * rulePaletteCellW, height: rulePaletteRows * rulePaletteCellH }}>
                {rulePaletteTileIds.map((id) => {
                  const ts = rulePaletteTileset
                  const x = (ts.offsetX ?? 0) + ts.marginX + (id % columns) * (ts.tileWidth + ts.spacingX)
                  const y = (ts.offsetY ?? 0) + ts.marginY + Math.floor(id / columns) * (ts.tileHeight + ts.spacingY)
                  return <button type="button" key={id} draggable title={`Arrastrar tile ${id}`} className="tile-draggable"
                    style={{ left: (id % rulePaletteColumns) * rulePaletteCellW, top: Math.floor(id / rulePaletteColumns) * rulePaletteCellH, width: ts.tileWidth * RULE_PALETTE_ZOOM, height: ts.tileHeight * RULE_PALETTE_ZOOM, backgroundImage: `url(${rulePaletteUrl})`, backgroundSize: `${ts.imageWidth * RULE_PALETTE_ZOOM}px ${ts.imageHeight * RULE_PALETTE_ZOOM}px`, backgroundPosition: `${-x * RULE_PALETTE_ZOOM}px ${-y * RULE_PALETTE_ZOOM}px` }}
                    onDragStart={(event) => setTileDrag(event, { tilesetId: ts.id, tileId: id })}
                    onDragEnd={() => setDropHot(undefined)}
                    onClick={() => setConditionTile({ tilesetId: ts.id, tileId: id })} />
                })}
              </div>}
              {!rulePaletteUrl && <p className="document-meta">Importa un tileset.</p>}
            </div>
            <p className="document-meta">Arrastra a la condición, a las salidas o sobre un grupo. Clic fija el tile central.</p>
          </div>
        </div>
        <div className="modal-actions"><button onClick={() => setRulesDialogOpen(false)}>Cerrar</button></div>
      </div></div>
    })()}
    {wfcDialogOpen && <div className="pixel-modal wfc-modal"><div>
      <header><h2>Generar con WFC</h2><button onClick={() => setWfcDialogOpen(false)} aria-label="Cerrar"><X /></button></header>
      <p className="document-meta">Modelo Overlapping: extrae patrones de la <strong>muestra</strong> (selección activa o capa completa) y colapsa la región destino con la semilla. Sin selección usa el mapa entero.</p>
      <div className="map-form">
        <label>Patrón<select value={wfcSize} onChange={(e) => setWfcSize(Number(e.target.value))}><option value={2}>2×2</option><option value={3}>3×3</option><option value={4}>4×4</option></select></label>
        <label>Semilla<input type="number" value={wfcSeed} onChange={(e) => setWfcSeed(Number(e.target.value) || 0)} /></label>
        <label className="fill-control"><input type="checkbox" checked={wfcKeepExisting} onChange={(e) => setWfcKeepExisting(e.target.checked)} /> Conservar tiles ya pintados en el destino</label>
      </div>
      <p className="document-meta">{selection ? `Selección activa: ${selection.width}×${selection.height} en (${selection.left}, ${selection.top}).` : 'Sin selección: muestra y destino = mapa completo.'}</p>
      <div className="modal-actions"><button onClick={() => setWfcDialogOpen(false)}>Cancelar</button><button className="primary" onClick={generateWfc}><Play size={12} /> Generar</button></div>
    </div></div>}
    {animationDialog && <div className="pixel-modal" role="dialog" aria-modal="true" aria-label="Configurar animación"><div><header><h2>Animación de tiles</h2><button onClick={() => setAnimationDialog(false)}><X /></button></header><label className="field">FPS<input type="number" min="1" max="60" value={animationFps} onChange={(event) => setAnimationFps(Number(event.target.value))} /></label><p className="document-meta">Los tiles del stamp se reproducen en loop al pintarlos.</p><div className="modal-actions"><button onClick={() => setAnimationDialog(false)}>Cancelar</button><button className="primary" onClick={applyAnimation}>Aplicar</button></div></div></div>}
  </main>
}

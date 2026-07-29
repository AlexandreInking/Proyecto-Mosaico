import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  addAutotileSet, addMapFolder, addMapLayer, addTileset, applyAutotileCells, applyMapCells, autotileDiagnostics, connectedTileRegionAsync, createMapDocument, duplicateMapLayer,
  ellipsePixels, eraseAutotileCells, fillTilesAsync, linePixels, rectanglePixels, removeMapLayer, removeTileset, reorderMapLayer,
  applyMapDocumentDelta, createMapDocumentDelta, deserializeMapDocument, orphanTileDiagnostics, resizeMapDocument, selectMapLayer, serializeMapDocument, setMapLayerParent, sliceTileset, updateAutotileSet, updateMapLayer, updateTileset,
  type AutotileSet, type GridCoordinate, type MapDocument, type MapDocumentDelta, type MapLayer, type ResizeAnchor, type TerrainRole, type TileReference,
} from '@mosaico/domain'
import { createViewport, OrthogonalPixiViewport, panViewport, pickOrthogonalCell, resizeViewport, screenToWorld, zoomViewportAt, type Point, type ViewportState } from '@mosaico/canvas'
import { importImage, loadImages, saveImage } from '@mosaico/pipeline'
import { Rectangle as PixiRectangle, Texture } from 'pixi.js'
import {
  BoxSelect, Circle, Copy, Eraser, Eye, EyeOff, FlipHorizontal2, FlipVertical2, Grid3X3, Hand,
  Lock, PaintBucket, Pencil, Pipette, Plus, Redo2, RotateCw, Save, Slash, Square, Trash2, Undo2, Unlock, Upload, X,
  type LucideIcon,
} from 'lucide-react'
import { saveBlob } from './pixel-media.js'
import { createNeutralMapPackage, loadMapProject, neutralMapJson, renderMapPng, saveMapBlob, saveMapPackage } from './map-media.js'
import { loadMapImage } from './map-textures.js'
import { usePanelLayout } from './panel-layout.js'
import {
  captureSelection, deleteSelection, moveSelection, pastePattern, patternChanges, prepareClipboardPaste, selectionBetween, transformPattern, visibleSliceIndexes,
  type TilePattern, type TileSelection,
} from './map-editor-model.js'

type Tool = 'pencil' | 'eraser' | 'eyedropper' | 'fill' | 'line' | 'rectangle' | 'ellipse' | 'select' | 'pan'
type Asset = { readonly blob: Blob; readonly url: string; readonly name?: string; readonly mediaType?: string }
type ImportDraft = { name: string; tileWidth: number; tileHeight: number; marginX: number; marginY: number; spacingX: number; spacingY: number; offsetX: number; offsetY: number; zoom: number }
type MapSession = { undo: MapDocumentDelta[]; redo: MapDocumentDelta[]; viewport: ViewportState; selection?: TileSelection; activeTilesetId?: string; pattern?: TilePattern; tileStart: number; tileEnd: number }
const tools: readonly [Tool, string, LucideIcon, string][] = [
  ['pencil', 'Lápiz', Pencil, 'P'], ['eraser', 'Borrador', Eraser, 'E'], ['eyedropper', 'Cuentagotas', Pipette, 'I'],
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
const importFieldLabels: Record<keyof Omit<ImportDraft, 'zoom'>, string> = { name: 'Nombre', tileWidth: 'Ancho tile', tileHeight: 'Alto tile', marginX: 'Margen X', marginY: 'Margen Y', spacingX: 'Separación X', spacingY: 'Separación Y', offsetX: 'Offset X', offsetY: 'Offset Y' }
const tabsStorageKey = 'mosaico-map-tabs-v3'

function initialDocuments(): { documents: MapDocument[]; activeId: string } {
  if (typeof localStorage !== 'undefined') try {
    const stored = JSON.parse(localStorage.getItem(tabsStorageKey) ?? '') as { activeId?: string; documents?: string[] }
    const documents = stored.documents?.map(deserializeMapDocument) ?? []
    if (documents.length) return { documents, activeId: documents.some((item) => item.id === stored.activeId) ? stored.activeId! : documents[0]!.id }
  } catch { /* autosave inválido usa documento limpio */ }
  const document = blank()
  return { documents: [document], activeId: document.id }
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
  const visit = (parentId: string | undefined, depth: number) => {
    for (const layer of [...layers].reverse()) {
      if (layer.parentId !== parentId) continue
      rows.push({ layer, depth })
      if (layer.isFolder && !layer.collapsed) visit(layer.id, depth + 1)
    }
  }
  visit(undefined, 0)
  return rows
}

export function MapEditor() {
  const [initial] = useState(initialDocuments)
  const first = initial.documents.find((item) => item.id === initial.activeId) ?? initial.documents[0]!
  const hostRef = useRef<HTMLDivElement>(null); const rendererRef = useRef<OrthogonalPixiViewport | undefined>(undefined); const viewportRef = useRef<ViewportState>(createMapViewport())
  const [document, setDocument] = useState(first); const documentRef = useRef(document); const [documents, setDocuments] = useState<MapDocument[]>(initial.documents)
  const panelLayout = usePanelLayout('map')
  const [assets, setAssets] = useState<Map<string, Asset>>(new Map()); const assetsRef = useRef(assets); const texturesRef = useRef(new Map<string, Texture>()); const baseTexturesRef = useRef(new Map<string, Texture>()); const textureGenerationRef = useRef(0)
  const [tool, setTool] = useState<Tool>('pencil'); const toolRef = useRef(tool); const [status, setStatus] = useState('Crea o importa un tileset')
  const toolBeforeSpaceRef = useRef<Tool | undefined>(undefined)
  const [filled, setFilled] = useState(false); const filledRef = useRef(filled); const [eraserSize, setEraserSize] = useState(1); const eraserSizeRef = useRef(eraserSize)
  const [activeTilesetId, setActiveTilesetId] = useState<string | undefined>(first.tilesets[0]?.id)
  const [pattern, setPattern] = useState<TilePattern>(); const patternRef = useRef<TilePattern | undefined>(pattern); const [tileStart, setTileStart] = useState(0); const [tileEnd, setTileEnd] = useState(0); const [thumbZoom, setThumbZoom] = useState(2); const [tileScrollTop, setTileScrollTop] = useState(0)
  const [selection, setSelection] = useState<TileSelection>(); const selectionRef = useRef<TileSelection | undefined>(selection); const clipboardRef = useRef<{ pattern: TilePattern; tilesets: MapDocument['tilesets'] } | undefined>(undefined); const [hoverCell, setHoverCell] = useState<GridCoordinate>()
  const [renamingLayerId, setRenamingLayerId] = useState<string>(); const [renameValue, setRenameValue] = useState('')
  const [autotile, setAutotile] = useState(false); const autotileRef = useRef(autotile); const [autotileSetId, setAutotileSetId] = useState<string>(); const autotileSetRef = useRef<string | undefined>(autotileSetId)
  const [autotileProfile, setAutotileProfile] = useState<'terrain' | 'contour'>('terrain'); const autotileProfileRef = useRef(autotileProfile)
  const [newDialog, setNewDialog] = useState(false); const [resizeDialog, setResizeDialog] = useState(false); const [importDialog, setImportDialog] = useState(false)
  const [autotileDialog, setAutotileDialog] = useState(false); const [autotileDraft, setAutotileDraft] = useState<AutotileSet>()
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
  const controlBeforeRef = useRef<MapDocument | undefined>(undefined)
  const gestureRef = useRef<{ start: GridCoordinate; last: GridCoordinate; before: MapDocument; screen: Point; panning: boolean; moving?: TileSelection } | undefined>(undefined)

  const show = (next: MapDocument) => { documentRef.current = next; setDocument(next); setDocuments((items) => items.map((item) => item.id === next.id ? next : item)) }
  const commit = (next: MapDocument, before = documentRef.current) => { if (next === before) return; undoRef.current.push(createMapDocumentDelta(before, next)); redoRef.current = []; show(next) }
  const undo = () => { const value = undoRef.current.pop(); if (!value) return; redoRef.current.push(value); show(applyMapDocumentDelta(documentRef.current, value, 'undo')) }
  const redo = () => { const value = redoRef.current.pop(); if (!value) return; undoRef.current.push(value); show(applyMapDocumentDelta(documentRef.current, value, 'redo')) }
  const beginControl = () => { controlBeforeRef.current ??= documentRef.current }
  const endControl = () => { const before = controlBeforeRef.current; controlBeforeRef.current = undefined; if (before && before !== documentRef.current) { undoRef.current.push(createMapDocumentDelta(before, documentRef.current)); redoRef.current = [] } }
  const saveSession = () => {
    sessionsRef.current.set(documentRef.current.id, { undo: undoRef.current, redo: redoRef.current, viewport: viewportRef.current, selection: selectionRef.current, activeTilesetId, pattern: patternRef.current, tileStart, tileEnd })
  }
  const switchDocument = (next: MapDocument) => {
    saveSession()
    const session: MapSession = sessionsRef.current.get(next.id) ?? { undo: [], redo: [], viewport: createMapViewport(), tileStart: 0, tileEnd: 0 }
    sessionsRef.current.set(next.id, session); undoRef.current = session.undo; redoRef.current = session.redo; viewportRef.current = session.viewport
    documentRef.current = next; setDocument(next); setSelection(session.selection); setActiveTilesetId(session.activeTilesetId ?? next.tilesets[0]?.id); setPattern(session.pattern); setTileStart(session.tileStart); setTileEnd(session.tileEnd)
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
  const safely = (action: () => void) => { try { action() } catch (error) { const code = error instanceof Error ? error.message : ''; setStatus(code === 'MAP_LAYER_LOCKED' ? 'Capa bloqueada' : code === 'MAP_LAYER_HIDDEN' ? 'Capa oculta: muéstrala para editar' : code.replaceAll('_', ' ') || 'Operación fallida') } }
  const runFill = async (origin: GridCoordinate) => {
    const selected = patternRef.current?.cells[0]; if (!selected || operationAbortRef.current) return
    const before = documentRef.current; const controller = new AbortController(); operationAbortRef.current = controller; setOperation({ label: 'Rellenando', progress: 0 })
    try {
      const options = { signal: controller.signal, onProgress: (progress: number) => setOperation({ label: 'Rellenando', progress }) }
      const next = autotileRef.current && autotileSetRef.current
        ? applyAutotileCells(before, before.activeLayerId, await connectedTileRegionAsync(before, before.activeLayerId, origin, options), autotileSetRef.current, autotileProfileRef.current)
        : await fillTilesAsync(before, before.activeLayerId, origin, selected, options)
      if (controller.signal.aborted) throw new DOMException('Operación cancelada', 'AbortError')
      commit(next, before); setStatus('Relleno aplicado')
    } catch (error) { setStatus(error instanceof DOMException && error.name === 'AbortError' ? 'Relleno cancelado' : error instanceof Error ? error.message : 'Relleno falló') }
    finally { operationAbortRef.current = undefined; setOperation(undefined) }
  }

  const render = () => {
    const host = hostRef.current; const renderer = rendererRef.current; if (!host || !renderer) return
    viewportRef.current = resizeViewport(viewportRef.current, Math.max(1, host.clientWidth), Math.max(1, host.clientHeight))
    renderer.render(previewRef.current ?? documentRef.current, viewportRef.current)
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
    const generation = textureGenerationRef.current + 1
    textureGenerationRef.current = generation
    for (const texture of texturesRef.current.values()) texture.destroy(false)
    for (const texture of baseTexturesRef.current.values()) texture.destroy(false)
    texturesRef.current.clear(); baseTexturesRef.current.clear()
    const seenAssets = new Set<string>()
    for (const tileset of documentRef.current.tilesets) {
      const asset = assetsRef.current.get(tileset.assetId); if (!asset || seenAssets.has(tileset.assetId)) continue
      seenAssets.add(tileset.assetId)
      void loadMapImage(asset.url).then((image) => {
        if (image.naturalWidth <= 0 || image.naturalHeight <= 0) return
        const base = Texture.from(image as unknown as HTMLImageElement)
        const source = base.source
        if (!source || source.width <= 0 || source.height <= 0) { base.destroy(false); return }
        source.scaleMode = 'nearest'
        if (generation !== textureGenerationRef.current) { base.destroy(false); return }
        baseTexturesRef.current.set(tileset.assetId, base)
        render()
      }).catch(() => { if (generation === textureGenerationRef.current) setStatus('No se pudo cargar el tileset') })
    }
    render()
  }
  const resolveTileTexture = (tile: TileReference): Texture | undefined => {
    let tileId = tile.tileId
    if (tile.animationId) {
      const frames = documentRef.current.layers.flatMap((layer) => [...layer.cells.values()]).filter((candidate) => candidate.animationId === tile.animationId).sort((left, right) => (left.animationFrame ?? 0) - (right.animationFrame ?? 0))
      if (frames.length > 1) tileId = frames[Math.floor(Date.now() / (tile.animationDurationMs ?? 125)) % frames.length]!.tileId
    }
    const key = `${tile.tilesetId}:${tileId}`; const cached = texturesRef.current.get(key); if (cached?.source && cached.source.width > 0 && cached.source.height > 0) return cached
    const tileset = documentRef.current.tilesets.find((candidate) => candidate.id === tile.tilesetId); const base = tileset ? baseTexturesRef.current.get(tileset.assetId) : undefined
    const source = base?.source
    if (!tileset || !source || source.width <= 0 || source.height <= 0 || tileset.tileWidth <= 0 || tileset.tileHeight <= 0) return undefined
    const columns = Math.max(1, Math.floor((tileset.imageWidth - (tileset.offsetX ?? 0) - tileset.marginX * 2 + tileset.spacingX) / (tileset.tileWidth + tileset.spacingX)))
    const x = (tileset.offsetX ?? 0) + tileset.marginX + (tileId % columns) * (tileset.tileWidth + tileset.spacingX)
    const y = (tileset.offsetY ?? 0) + tileset.marginY + Math.floor(tileId / columns) * (tileset.tileHeight + tileset.spacingY)
    if (x < 0 || y < 0 || x + tileset.tileWidth > source.width || y + tileset.tileHeight > source.height) return undefined
    const texture = new Texture({ source, frame: new PixiRectangle(x, y, tileset.tileWidth, tileset.tileHeight) }); texturesRef.current.set(key, texture); return texture
  }

  useEffect(() => { documentRef.current = document; render() }, [document])
  useEffect(() => {
    const animated = document.layers.some((layer) => [...layer.cells.values()].some((tile) => tile.animationId))
    if (!animated) return
    const timer = window.setInterval(render, 100)
    return () => window.clearInterval(timer)
  }, [document])
  useEffect(() => {
    try { localStorage.setItem(tabsStorageKey, JSON.stringify({ activeId: document.id, documents: documents.map(serializeMapDocument) })) } catch { setStatus('Autosave local no disponible') }
  }, [documents, document.id])
  useEffect(() => {
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
  }, [])
  useEffect(() => { assetsRef.current = assets; rebuildTextures() }, [assets, document.tilesets])
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
      const autoTool = toolRef.current === 'rectangle' || toolRef.current === 'ellipse'
      if (autoTool && autotileRef.current && autotileSetRef.current) return applyAutotileCells(base, base.activeLayerId, bounded, autotileSetRef.current, autotileProfileRef.current)
      const selected = patternRef.current; return selected ? applyMapCells(base, base.activeLayerId, patternChanges(base, bounded, selected).filter((change) => change.tile)) : base
    }
    const stroke = (from: GridCoordinate, to: GridCoordinate) => safely(() => {
      const line = linePixels(from, to)
      if (toolRef.current === 'eraser') {
        const points = new Map<string, GridCoordinate>(); for (const item of line) for (const p of brushPoints(item, eraserSizeRef.current)) if (p.x >= 0 && p.y >= 0 && p.x < documentRef.current.width && p.y < documentRef.current.height) points.set(pointKey(p), p)
        const changes = [...points.values()].map((point) => ({ ...point }))
        show(autotileRef.current
          ? eraseAutotileCells(documentRef.current, documentRef.current.activeLayerId, changes)
          : applyMapCells(documentRef.current, documentRef.current.activeLayerId, changes))
      } else show(applyPoints(documentRef.current, line))
    })
    const down = (event: PointerEvent) => {
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
      if (toolRef.current === 'select' && !moving) setSelection(selectionBetween(picked, picked))
    }
    const move = (event: PointerEvent) => {
      const picked = cell(event); setCursor(picked); const gesture = gestureRef.current; if (!gesture || !host.hasPointerCapture(event.pointerId)) { setHoverCell(picked); return }
      const screen = screenPoint(event)
      if (gesture.panning) { viewportRef.current = panViewport(viewportRef.current, screen.x - gesture.screen.x, screen.y - gesture.screen.y); gesture.screen = screen; render(); return }
      const world = screenToWorld(viewportRef.current, screen)
      const rawCell = { x: Math.floor(world.x / documentRef.current.cellWidth), y: Math.floor(world.y / documentRef.current.cellHeight) }
      const gestureCell = gesture.moving ? rawCell : picked ?? (toolRef.current === 'select' ? { x: Math.max(0, Math.min(documentRef.current.width - 1, rawCell.x)), y: Math.max(0, Math.min(documentRef.current.height - 1, rawCell.y)) } : undefined)
      if (!gestureCell || pointKey(gestureCell) === pointKey(gesture.last)) return
      setHoverCell(gestureCell)
      if (toolRef.current === 'pencil' || toolRef.current === 'eraser') stroke(gesture.last, gestureCell)
      else if (toolRef.current === 'select') {
        if (gesture.moving) {
          const origin = { x: gesture.moving.left + gestureCell.x - gesture.start.x, y: gesture.moving.top + gestureCell.y - gesture.start.y }
          if (origin.x < 0 || origin.y < 0 || origin.x + gesture.moving.width > gesture.before.width || origin.y + gesture.moving.height > gesture.before.height) { previewRef.current = undefined; setStatus('Selección debe quedar dentro del mapa'); render() }
          else safely(() => { previewRef.current = moveSelection(gesture.before, gesture.before.activeLayerId, gesture.moving!, origin); render() })
        }
        else setSelection(selectionBetween(gesture.start, gestureCell))
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
        if (gesture.moving && previewCommitted) setSelection({ ...gesture.moving, left: gesture.moving.left + gesture.last.x - gesture.start.x, top: gesture.moving.top + gesture.last.y - gesture.start.y })
      }
      gestureRef.current = undefined; if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId); render()
    }
    const wheel = (event: WheelEvent) => { event.preventDefault(); viewportRef.current = zoomViewportAt(viewportRef.current, screenPoint(event), Math.exp(-event.deltaY * 0.0015)); render(); refreshViewport((v) => v + 1) }
    const observer = new ResizeObserver(render); observer.observe(host)
    void OrthogonalPixiViewport.create({ host, resolveTexture: resolveTileTexture }).then((renderer) => { if (disposed) renderer.destroy(); else { rendererRef.current = renderer; fitMap() } }).catch((error: unknown) => { if (!disposed) setStatus(error instanceof Error ? `Canvas no disponible: ${error.message}` : 'Canvas no disponible') })
    const outside = (event: PointerEvent) => { if (!host.contains(event.target as Node)) setSelection(undefined) }
    const leave = () => { if (!gestureRef.current) setHoverCell(undefined) }
    host.addEventListener('pointerdown', down); host.addEventListener('pointermove', move); host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up); host.addEventListener('pointerleave', leave); host.addEventListener('wheel', wheel, { passive: false }); window.addEventListener('pointerdown', outside)
    return () => { disposed = true; observer.disconnect(); host.removeEventListener('pointerdown', down); host.removeEventListener('pointermove', move); host.removeEventListener('pointerup', up); host.removeEventListener('pointercancel', up); host.removeEventListener('pointerleave', leave); host.removeEventListener('wheel', wheel); window.removeEventListener('pointerdown', outside); rendererRef.current?.destroy(); rendererRef.current = undefined }
  }, [])

  const copy = () => { if (selectionRef.current) { const pattern = captureSelection(documentRef.current, documentRef.current.activeLayerId, selectionRef.current); const referenced = new Set(pattern.cells.flatMap((tile) => tile ? [tile.tilesetId] : [])); clipboardRef.current = { pattern, tilesets: documentRef.current.tilesets.filter((tileset) => referenced.has(tileset.id)) }; setStatus('Selección copiada') } }
  const cut = () => { if (!selectionRef.current) return; copy(); safely(() => commit(deleteSelection(documentRef.current, documentRef.current.activeLayerId, selectionRef.current!))) }
  const paste = () => {
    const value = clipboardRef.current; if (!value) return
    const origin = cursor ?? { x: 0, y: 0 }
    if (origin.x + value.pattern.width > documentRef.current.width || origin.y + value.pattern.height > documentRef.current.height) { setStatus('Pegado debe quedar dentro del mapa'); return }
    safely(() => { const prepared = prepareClipboardPaste(documentRef.current, value.pattern, value.tilesets); const next = pastePattern(prepared.document, prepared.document.activeLayerId, origin, prepared.pattern); commit(next); setSelection({ left: origin.x, top: origin.y, width: prepared.pattern.width, height: prepared.pattern.height }) })
  }
  const deleteSelected = () => { if (selectionRef.current) safely(() => commit(deleteSelection(documentRef.current, documentRef.current.activeLayerId, selectionRef.current!))) }
  const duplicateSelected = () => {
    const selected = selectionRef.current; if (!selected) return
    copy(); const value = clipboardRef.current; if (!value) return
    const origin = { x: Math.min(documentRef.current.width - value.pattern.width, selected.left + 1), y: Math.min(documentRef.current.height - value.pattern.height, selected.top + 1) }
    safely(() => { commit(pastePattern(documentRef.current, documentRef.current.activeLayerId, origin, value.pattern)); setSelection({ left: origin.x, top: origin.y, width: value.pattern.width, height: value.pattern.height }) })
  }
  const transformSelected = (operation: 'flipX' | 'flipY' | 'rotate90' | 'rotate180' | 'rotate270') => {
    const value = selectionRef.current ? captureSelection(documentRef.current, documentRef.current.activeLayerId, selectionRef.current) : patternRef.current
    if (!value) return
    if ((operation === 'rotate90' || operation === 'rotate270') && value.cells.some((tile) => { const set = documentRef.current.tilesets.find((item) => item.id === tile?.tilesetId); return set && set.tileWidth !== set.tileHeight })) { setStatus('Rotación 90°/270° requiere tiles cuadrados'); return }
    const transformed = transformPattern(value, operation)
    if (selectionRef.current) {
      const selected = selectionRef.current
      if (selected.left + transformed.width > documentRef.current.width || selected.top + transformed.height > documentRef.current.height) { setStatus('Transformación debe quedar dentro del mapa'); return }
      safely(() => { let next = deleteSelection(documentRef.current, documentRef.current.activeLayerId, selected); next = pastePattern(next, next.activeLayerId, { x: selected.left, y: selected.top }, transformed); commit(next); setSelection({ ...selected, width: transformed.width, height: transformed.height }) })
    }
    else { setPattern(transformed); setStatus('Transformación aplicada al stamp') }
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (event.key === 'Escape') {
        operationAbortRef.current?.abort()
        setOpenMenu(undefined); setNewDialog(false); setResizeDialog(false); if (importDialog) closeImportDialog(); else setImportDialog(false); setAutotileDialog(false); setSelection(undefined)
        const gesture = gestureRef.current; if (gesture && !gesture.panning) show(gesture.before)
        previewRef.current = undefined; gestureRef.current = undefined; render(); return
      }
      if (newDialog || resizeDialog || importDialog || autotileDialog) return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || (event.target instanceof HTMLElement && event.target.closest('[role="dialog"]'))) return
      if (event.ctrlKey && key === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return }
      if (event.ctrlKey && key === 'y') { event.preventDefault(); redo(); return }
      if (event.altKey && event.shiftKey && key === 'c') { event.preventDefault(); copy(); return }
      if (event.altKey && event.shiftKey && key === 'x') { event.preventDefault(); cut(); return }
      if (event.altKey && event.shiftKey && key === 'v') { event.preventDefault(); paste(); return }
      if (event.altKey && event.shiftKey && event.key === 'Delete') { event.preventDefault(); deleteSelected(); return }
      if (event.code === 'Digit0') { event.preventDefault(); fitMap(); return }
      if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomCenter(1.25); return }
      if (event.key === '-') { event.preventDefault(); zoomCenter(0.8); return }
      if (event.code === 'Space') { event.preventDefault(); if (!event.repeat && !toolBeforeSpaceRef.current) toolBeforeSpaceRef.current = toolRef.current; setTool('pan'); return }
      const next = hotkeys[key]; if (next) { event.preventDefault(); setTool(next) }
    }
    const keyup = (event: KeyboardEvent) => { if (event.code === 'Space' && toolBeforeSpaceRef.current) { setTool(toolBeforeSpaceRef.current); toolBeforeSpaceRef.current = undefined } }
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup) }
  }, [cursor, newDialog, resizeDialog, importDialog, autotileDialog])

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
  let slicing: ReturnType<typeof sliceTileset> | undefined; let slicingError = ''
  if (importFile) try { slicing = sliceTileset({ imageWidth: importSize.width, imageHeight: importSize.height, ...importDraft }) } catch (error) { slicingError = error instanceof Error ? error.message : 'Configuración inválida' }
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
  const dropLayer = (sourceId: string, targetId?: string) => {
    if (!sourceId || sourceId === targetId) return
    safely(() => {
      const target = targetId ? documentRef.current.layers.find((layer) => layer.id === targetId) : undefined
      commit(target?.isFolder
        ? setMapLayerParent(documentRef.current, sourceId, targetId)
        : target
          ? reorderMapLayer(documentRef.current, sourceId, documentRef.current.layers.findIndex((layer) => layer.id === targetId))
          : setMapLayerParent(documentRef.current, sourceId))
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
  const openAutotile = () => {
    const existing = document.autotileSets.find((set) => set.id === autotileSetId)
    const tileset = activeTileset ?? document.tilesets[0]
    if (!existing && !tileset) { setStatus('Importa tileset primero'); return }
    setAutotileDraft(existing ? { ...existing, terrain: { ...existing.terrain }, contour: { ...existing.contour } } : {
      id: crypto.randomUUID(), name: 'Autotile', tilesetId: tileset!.id, centerTileId: pattern?.cells[0]?.tileId ?? 0,
      terrain: {}, contour: {},
    }); setAutotileDialog(true)
  }
  const saveAutotile = () => {
    if (!autotileDraft) return
    safely(() => {
      const next = documentRef.current.autotileSets.some((set) => set.id === autotileDraft.id) ? updateAutotileSet(documentRef.current, autotileDraft) : addAutotileSet(documentRef.current, autotileDraft)
      commit(next); setAutotileSetId(autotileDraft.id); setAutotileDialog(false)
    })
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
  const columns = activeTileset ? Math.max(1, Math.floor((activeTileset.imageWidth - (activeTileset.offsetX ?? 0) - activeTileset.marginX * 2 + activeTileset.spacingX) / (activeTileset.tileWidth + activeTileset.spacingX))) : 1
  const tileDisplayColumns = Math.min(columns, 8)
  const tileRowHeight = activeTileset ? activeTileset.tileHeight * thumbZoom + 2 : 34
  const tileRows = activeTileset ? Math.ceil(activeTileset.tileCount / tileDisplayColumns) : 0
  const tileFirstRow = Math.max(0, Math.floor(tileScrollTop / tileRowHeight) - 3)
  const tileLastRow = Math.min(tileRows, tileFirstRow + 43)
  const visibleTileIds = activeTileset ? Array.from({ length: Math.max(0, (tileLastRow - tileFirstRow) * tileDisplayColumns) }, (_, index) => tileFirstRow * tileDisplayColumns + index).filter((id) => id < activeTileset.tileCount) : []
  const diagnostics = [...orphanTileDiagnostics(document), ...autotileDiagnostics(document)]
  const layerTree = useMemo(() => mapLayerTree(document.layers), [document.layers])
  const visibleImportIndexes = importUrl && slicing ? visibleSliceIndexes({
    columns: slicing.columns, rows: slicing.rows, tileWidth: importDraft.tileWidth, tileHeight: importDraft.tileHeight,
    spacingX: importDraft.spacingX, spacingY: importDraft.spacingY, originX: importDraft.marginX + importDraft.offsetX, originY: importDraft.marginY + importDraft.offsetY,
    zoom: importDraft.zoom, scrollLeft: importScroll.left, scrollTop: importScroll.top,
    viewportWidth: importPreviewRef.current?.clientWidth ?? 720, viewportHeight: importPreviewRef.current?.clientHeight ?? 420,
  }) : []
  useEffect(() => { setTileScrollTop(0) }, [activeTilesetId])
  const movingSelection = gestureRef.current?.moving
  const overlaySelection = movingSelection && cursor && gestureRef.current ? { ...movingSelection, left: movingSelection.left + cursor.x - gestureRef.current.start.x, top: movingSelection.top + cursor.y - gestureRef.current.start.y } : selection
  const selectionStyle = overlaySelection ? { left: viewportRef.current.offsetX + overlaySelection.left * document.cellWidth * viewportRef.current.zoom, top: viewportRef.current.offsetY + overlaySelection.top * document.cellHeight * viewportRef.current.zoom, width: overlaySelection.width * document.cellWidth * viewportRef.current.zoom, height: overlaySelection.height * document.cellHeight * viewportRef.current.zoom } : undefined
  type MapMenuEntries = readonly [string, () => void][]
  const menu: Record<string, MapMenuEntries> & { Mapa: MapMenuEntries; Tileset: MapMenuEntries; Vista: MapMenuEntries } = {
    Archivo: [['Nuevo mapa…', () => setNewDialog(true)], ['Abrir…', () => window.document.getElementById('map-open')?.click()], ['Guardar proyecto', () => void save()], ['Exportar JSON neutral', () => void exportJson()], ['Exportar PNG', () => void exportPng()], ['Exportar JSON + assets ZIP', () => void exportZip()]],
    Editar: [['Deshacer', undo], ['Rehacer', redo], ['Copiar', copy], ['Cortar', cut], ['Pegar', paste], ['Duplicar selección', duplicateSelected], ['Eliminar selección', deleteSelected]],
    Mapa: [['Redimensionar…', () => { setResizeForm({ width: document.width, height: document.height, anchor: 'center' }); setResizeDialog(true) }], ['Ajustar mapa', fitMap]],
    Tileset: [['Importar tilesheet…', () => setImportDialog(true)], ['Configurar autotile…', openAutotile]],
    Vista: [['Ajustar mapa', fitMap], ['Zoom 100%', () => zoomCenter(1 / viewportRef.current.zoom)], ['Acercar', () => zoomCenter(1.25)], ['Alejar', () => zoomCenter(0.8)], ['Alternar grid', () => commit({ ...documentRef.current, revision: documentRef.current.revision + 1, grid: { ...documentRef.current.grid, visible: !documentRef.current.grid.visible } })]],
  }

  if (!menu.Mapa.some(([label]) => label === 'Nueva carpeta')) menu.Mapa = [...menu.Mapa, ['Nueva carpeta', createFolder]]
  if (!menu.Tileset.some(([label]) => label === 'Animar selección')) menu.Tileset = [...menu.Tileset, ['Animar selección', openAnimation]]
  if (!menu.Vista.some(([label]) => label === 'Guardar layout')) menu.Vista = [...menu.Vista, ['Panel de capas flotante', () => panelLayout.update({ floatingTree: !panelLayout.layout.floatingTree })], ['Guardar layout', () => { const name = window.prompt('Nombre layout'); if (name) panelLayout.saveLayout(name) }], ['Aplicar layout', () => { const names = Object.keys(panelLayout.saved); const name = window.prompt(`Layout (${names.join(', ')})`); if (name) panelLayout.applyLayout(name) }], ['Eliminar layout', () => { const name = window.prompt('Layout a eliminar'); if (name) panelLayout.deleteLayout(name) }], ['Restablecer layout', panelLayout.reset]]
  const mapLayerTreeContent = <>
    <div className="panel-title" onPointerDown={(event) => panelLayout.dragTree(event)}><div><p className="eyebrow">Capas</p><h2>Árbol <span>{document.layers.length}</span></h2></div><div className="layer-actions"><button title="Nueva carpeta" onPointerDown={(event) => event.stopPropagation()} onClick={createFolder}>+F</button><button title="Nueva capa" onPointerDown={(event) => event.stopPropagation()} onClick={() => safely(() => commit(addMapLayer(documentRef.current, { id: crypto.randomUUID(), name: `Capa ${document.layers.length + 1}`, parentId: document.layers.find((layer) => layer.id === document.activeLayerId)?.isFolder ? document.activeLayerId : undefined })))}>+</button></div></div>
    <div className="layer-tree" role="tree" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const source = event.dataTransfer.getData('text/layer'); if (source) dropLayer(source) }}>{layerTree.map(({ layer, depth }) => <div key={layer.id} className={`tree-row ${layer.id === document.activeLayerId ? 'selected' : ''}`} role="treeitem" draggable onDragStart={(event) => { event.dataTransfer.setData('text/layer', layer.id); event.dataTransfer.effectAllowed = 'move' }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const source = event.dataTransfer.getData('text/layer'); if (source) dropLayer(source, layer.id) }}><button className="tree-toggle" disabled={!layer.isFolder} aria-label={layer.isFolder ? (layer.collapsed ? 'Expandir carpeta' : 'Contraer carpeta') : 'Capa'} onClick={() => layer.isFolder && commit(updateMapLayer(documentRef.current, layer.id, { collapsed: !layer.collapsed }))}>{layer.isFolder ? (layer.collapsed ? '▶' : '▼') : '·'}</button>{renamingLayerId === layer.id ? <input className="tree-rename" autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') finishLayerRename(); if (event.key === 'Escape') setRenamingLayerId(undefined) }} onBlur={finishLayerRename} /> : <button className="tree-name" style={{ paddingLeft: `${0.15 + depth * 0.75}rem` }} onDoubleClick={() => beginLayerRename(layer)} onClick={() => show(selectMapLayer(documentRef.current, layer.id))}><strong>{layer.name}</strong></button>}<button title={layer.visible ? 'Ocultar' : 'Mostrar'} onPointerDown={(event) => event.stopPropagation()} onClick={() => commit(updateMapLayer(documentRef.current, layer.id, { visible: !layer.visible }))}>{layer.visible ? <Eye /> : <EyeOff />}</button><button title={layer.locked ? 'Desbloquear' : 'Bloquear'} onPointerDown={(event) => event.stopPropagation()} onClick={() => commit(updateMapLayer(documentRef.current, layer.id, { locked: !layer.locked }))}>{layer.locked ? <Lock /> : <Unlock />}</button><button title="Eliminar" onPointerDown={(event) => event.stopPropagation()} onClick={() => removeLayerById(layer.id)}><Trash2 /></button></div>)}</div>
  </>
  const layoutStyle = { '--inspector-w': `${panelLayout.layout.inspectorWidth}px`, '--tree-w': `${panelLayout.layout.treeWidth}px`, '--tileset-h': `${panelLayout.layout.tilesetHeight}px`, '--layers-h': `${panelLayout.layout.layersHeight}px`, '--tree-x': `${panelLayout.layout.treeX}px`, '--tree-y': `${panelLayout.layout.treeY}px` } as CSSProperties
  return <main className={`pixel-editor map-editor ${panelLayout.layout.floatingTree ? 'floating-tree' : ''}`} style={layoutStyle} onContextMenu={(event) => event.preventDefault()}>
    <nav className="pixel-menubar">{Object.entries(menu).map(([name, items]) => <div className="menu-root" key={name}><button onClick={() => setOpenMenu(openMenu === name ? undefined : name)}>{name}</button>{openMenu === name && <div className="menu-dropdown">{items.map(([label, action]) => <button key={label} onClick={() => { action(); setOpenMenu(undefined) }}>{label}</button>)}</div>}</div>)}</nav>
    <div className="document-tabs">{documents.map((item) => <div key={item.id} className={item.id === document.id ? 'active' : ''}><button onClick={() => switchDocument(item)}>{item.name}{item.revision !== (savedRevisionRef.current.get(item.id) ?? -1) ? ' â€¢' : ''}</button><button aria-label={`Cerrar ${item.name}`} title="Cerrar mapa" onClick={() => closeDocument(item)}><X /></button></div>)}</div>
    <input id="map-open" hidden type="file" accept=".mosaico,.json" onChange={(event) => { void load(event.target.files?.[0]); event.currentTarget.value = '' }} />
    <header className="pixel-optionsbar"><strong>{tools.find(([id]) => id === tool)?.[1]}</strong><span className="option-divider" />
      {(tool === 'rectangle' || tool === 'ellipse') && <label className="fill-control"><input type="checkbox" checked={filled} onChange={(e) => setFilled(e.target.checked)} /> Relleno</label>}
      {tool === 'eraser' && <label className="map-inline-field">Tamaño <input type="number" min="1" max="32" value={eraserSize} onChange={(e) => setEraserSize(Math.max(1, Math.min(32, Number(e.target.value))))} /></label>}
      {(tool === 'fill' || tool === 'rectangle' || tool === 'ellipse') && <><label className="fill-control"><input type="checkbox" checked={autotile} onChange={(e) => setAutotile(e.target.checked)} /> Autotile</label>{autotile && <select value={autotileSetId ?? ''} onChange={(e) => setAutotileSetId(e.target.value || undefined)}><option value="">Set…</option>{document.autotileSets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}</select>} {autotile && <select value={autotileProfile} onChange={(e) => setAutotileProfile(e.target.value as 'terrain' | 'contour')}><option value="terrain">Terreno</option><option value="contour">Contorno</option></select>}{autotile && <button className="compact-option" onClick={openAutotile}>Configurar</button>}</>}
      <span className="option-hint">Clic medio: pan · rueda: zoom al cursor · 0: ajustar</span>
      <div className="history-tools"><button title="Flip X" onClick={() => transformSelected('flipX')}><FlipHorizontal2 /></button><button title="Flip Y" onClick={() => transformSelected('flipY')}><FlipVertical2 /></button><button title="Rotar 90°" onClick={() => transformSelected('rotate90')}><RotateCw /></button><button title="Rotar 180°" className="rotation-label" onClick={() => transformSelected('rotate180')}>180°</button><button title="Rotar 270°" className="rotation-label" onClick={() => transformSelected('rotate270')}>270°</button><button title="Deshacer" onClick={undo}><Undo2 /></button><button title="Rehacer" onClick={redo}><Redo2 /></button></div>
    </header>
    <section className="pixel-body map-body"><div className="panel-splitter inspector-splitter" role="separator" aria-label="Redimensionar inspector" onPointerDown={(event) => panelLayout.resize('inspector', 'width', event)} /><div className="map-folder-float" aria-label="Carpetas"><button className="folder-create" onClick={() => commit(addMapFolder(documentRef.current, { id: crypto.randomUUID(), name: `Carpeta ${document.layers.filter((layer) => layer.isFolder).length + 1}` }))}>+ Carpeta</button>{document.layers.filter((layer) => layer.isFolder).map((folder) => <button data-folder-id={folder.id} key={folder.id} onClick={() => commit(updateMapLayer(documentRef.current, folder.id, { collapsed: !folder.collapsed }))}>{folder.collapsed ? '▶' : '▼'} {folder.name}</button>)}</div>
      <aside className="pixel-tool-rail">{tools.map(([id, label, Icon, key]) => <button key={id} className={tool === id ? 'active' : ''} aria-label={label} title={`${label} (${key})`} onClick={() => setTool(id)}><Icon /></button>)}</aside>
      <div className="canvas-shell"><div ref={hostRef} className={`authoring-canvas tool-${tool}`} aria-label="Canvas de mapa editable" />{hoverCell && pattern && <div className="map-hover-cell" aria-hidden="true" style={{ left: viewportRef.current.offsetX + hoverCell.x * document.cellWidth * viewportRef.current.zoom, top: viewportRef.current.offsetY + hoverCell.y * document.cellHeight * viewportRef.current.zoom, width: pattern.width * document.cellWidth * viewportRef.current.zoom, height: pattern.height * document.cellHeight * viewportRef.current.zoom, opacity: 0.5, backgroundImage: activeAsset && pattern.cells[0] ? `url(${activeAsset.url})` : undefined, backgroundRepeat: 'no-repeat', backgroundSize: activeAsset && pattern.cells[0] ? `${activeTileset!.imageWidth * viewportRef.current.zoom}px ${activeTileset!.imageHeight * viewportRef.current.zoom}px` : undefined, backgroundPosition: activeAsset && pattern.cells[0] ? `${-((activeTileset!.offsetX ?? 0) + activeTileset!.marginX + (pattern.cells[0]!.tileId % columns) * (activeTileset!.tileWidth + activeTileset!.spacingX)) * viewportRef.current.zoom}px ${-((activeTileset!.offsetY ?? 0) + activeTileset!.marginY + Math.floor(pattern.cells[0]!.tileId / columns) * (activeTileset!.tileHeight + activeTileset!.spacingY)) * viewportRef.current.zoom}px` : undefined }} />}{selectionStyle && <div className="map-selection-overlay" style={selectionStyle} />}</div>
      <aside className="pixel-inspector map-inspector"><div className="panel-splitter horizontal tileset-splitter" role="separator" aria-label="Redimensionar tilesets" onPointerDown={(event) => panelLayout.resize('tileset', 'height', event)} /><div className="panel-splitter horizontal layers-splitter" role="separator" aria-label="Redimensionar capas" onPointerDown={(event) => panelLayout.resize('layers', 'height', event)} />
        {document.layers.some((layer) => layer.isFolder) && <section className="folder-summary"><div className="panel-title"><h3>Carpetas</h3><span>{document.layers.filter((layer) => layer.isFolder).length}</span></div>{document.layers.filter((layer) => layer.isFolder).map((folder) => <button className="panel-action" data-folder-id={folder.id} key={folder.id} onClick={() => commit(updateMapLayer(documentRef.current, folder.id, { collapsed: !folder.collapsed }))}>{folder.collapsed ? 'Mostrar' : 'Ocultar'} · {folder.name}</button>)}</section>}
        <section className="tileset-panel"><div className="panel-title"><div><p className="eyebrow">Biblioteca</p><h2>Tilesets <span>{document.tilesets.length}</span></h2></div><div className="layer-actions"><button title="Importar" onClick={() => setImportDialog(true)}><Upload /></button>{activeTileset && <button title="Eliminar tileset" onClick={deleteTileset}><Trash2 /></button>}</div></div>
          <select className="tileset-select" value={activeTileset?.id ?? ''} onChange={(e) => activateTileset(e.target.value)}><option value="">Sin tilesets</option>{document.tilesets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}</select>
          {activeTileset && <div className="tileset-actions"><button onClick={() => { const name = window.prompt('Nombre', activeTileset.name); if (name) commit(updateTileset(documentRef.current, activeTileset.id, { name })) }}>Renombrar</button><label>Zoom <input type="range" min="0.5" max="5" step="0.5" value={thumbZoom} onChange={(e) => setThumbZoom(Number(e.target.value))} /></label></div>}
          <div className="tile-grid" onScroll={(event) => setTileScrollTop(event.currentTarget.scrollTop)}>{activeTileset && activeAsset && <div style={{ position: 'relative', width: tileDisplayColumns * (activeTileset.tileWidth * thumbZoom + 2), height: tileRows * tileRowHeight }}>
            {visibleTileIds.map((id) => {
              const sourceColumns = columns
              const x = (activeTileset.offsetX ?? 0) + activeTileset.marginX + (id % sourceColumns) * (activeTileset.tileWidth + activeTileset.spacingX); const y = (activeTileset.offsetY ?? 0) + activeTileset.marginY + Math.floor(id / sourceColumns) * (activeTileset.tileHeight + activeTileset.spacingY)
              const startColumn = tileStart % sourceColumns; const endColumn = tileEnd % sourceColumns; const startRow = Math.floor(tileStart / sourceColumns); const endRow = Math.floor(tileEnd / sourceColumns)
              const selected = id % sourceColumns >= Math.min(startColumn, endColumn) && id % sourceColumns <= Math.max(startColumn, endColumn) && Math.floor(id / sourceColumns) >= Math.min(startRow, endRow) && Math.floor(id / sourceColumns) <= Math.max(startRow, endRow)
              return <button key={id} className={selected ? 'selected' : ''} title={`Tile ${id}`} style={{ position: 'absolute', left: (id % tileDisplayColumns) * (activeTileset.tileWidth * thumbZoom + 2), top: Math.floor(id / tileDisplayColumns) * tileRowHeight, width: activeTileset.tileWidth * thumbZoom, height: activeTileset.tileHeight * thumbZoom, backgroundImage: `url(${activeAsset.url})`, backgroundSize: `${activeTileset.imageWidth * thumbZoom}px ${activeTileset.imageHeight * thumbZoom}px`, backgroundPosition: `${-x * thumbZoom}px ${-y * thumbZoom}px` }} onClick={(e) => selectTileRange(id, e.shiftKey ? tileStart : id)} />
            })}
          </div>}</div>
          {pattern && <p className="document-meta">Stamp {pattern.width}×{pattern.height} · tile {tileStart}{tileStart !== tileEnd ? `–${tileEnd}` : ''}</p>}
        </section>
        <section className="layer-panel"><div className="panel-title"><div><p className="eyebrow">Inspector</p><h2>Capas <span>{document.layers.length}</span></h2></div><div className="layer-actions"><button title="Nueva capa" onClick={() => commit(addMapLayer(documentRef.current, { id: crypto.randomUUID(), name: `Capa ${document.layers.length + 1}` }))}><Plus /></button><button title="Duplicar capa" onClick={() => commit(duplicateMapLayer(documentRef.current, document.activeLayerId, crypto.randomUUID()))}><Copy /></button><button title="Eliminar capa" onClick={() => safely(() => commit(removeMapLayer(documentRef.current, document.activeLayerId)))}><Trash2 /></button></div></div>
          <div className="layer-list">{[...document.layers].reverse().map((layer) => <div key={layer.id} className={`layer-row map-layer-row ${layer.id === document.activeLayerId ? 'selected' : ''}`}><button className="layer-select" onDoubleClick={() => { const name = window.prompt('Nombre', layer.name); if (name) commit(updateMapLayer(documentRef.current, layer.id, { name })) }} onClick={() => show(selectMapLayer(documentRef.current, layer.id))}><span className="layer-thumb"><Grid3X3 /></span><strong>{layer.name}</strong></button><button title={layer.visible ? 'Ocultar' : 'Mostrar'} onClick={() => commit(updateMapLayer(documentRef.current, layer.id, { visible: !layer.visible }))}>{layer.visible ? <Eye /> : <EyeOff />}</button><button title={layer.locked ? 'Desbloquear' : 'Bloquear'} onClick={() => commit(updateMapLayer(documentRef.current, layer.id, { locked: !layer.locked }))}>{layer.locked ? <Lock /> : <Unlock />}</button><div className="layer-extra"><input aria-label={`Opacidad ${layer.name}`} type="range" min="0" max="1" step=".05" value={layer.opacity} onPointerDown={beginControl} onKeyDown={beginControl} onChange={(e) => show(updateMapLayer(documentRef.current, layer.id, { opacity: Number(e.target.value) }))} onPointerUp={endControl} onKeyUp={endControl} onBlur={endControl} /><button disabled={document.layers.indexOf(layer) === document.layers.length - 1} onClick={() => commit(reorderMapLayer(documentRef.current, layer.id, document.layers.indexOf(layer) + 1))}>↑</button><button disabled={document.layers.indexOf(layer) === 0} onClick={() => commit(reorderMapLayer(documentRef.current, layer.id, document.layers.indexOf(layer) - 1))}>↓</button></div></div>)}</div>
        </section>
        <section><div className="panel-title"><div><p className="eyebrow">Mapa</p><h2>{document.name}</h2></div><button title="Guardar" onClick={() => void save()}><Save /></button></div><p className="document-meta">{document.width}×{document.height} tiles · {document.cellWidth}×{document.cellHeight}px · rev. {document.revision}</p><label className="fill-control map-grid-control"><input type="checkbox" checked={document.grid.visible} onChange={(e) => commit({ ...documentRef.current, revision: documentRef.current.revision + 1, grid: { ...documentRef.current.grid, visible: e.target.checked } })} /> Grid <input type="color" value={document.grid.color.slice(0, 7)} onChange={(e) => commit({ ...documentRef.current, revision: documentRef.current.revision + 1, grid: { ...documentRef.current.grid, color: `${e.target.value}99` } })} /></label><button className="panel-action" onClick={() => { setResizeForm({ width: document.width, height: document.height, anchor: 'center' }); setResizeDialog(true) }}>Redimensionar mapa</button></section>
        <section className="console-panel"><button className="console-heading" onClick={() => setConsoleOpen((value) => !value)}><span>Diagnósticos</span><strong>{diagnostics.length}</strong></button>{consoleOpen && <div className="console-body">{diagnostics.length ? diagnostics.map((diagnostic) => <div className={`diagnostic ${diagnostic.severity}`} key={diagnostic.groupKey}><code>{diagnostic.code}</code><span>{diagnostic.message}</span><strong>{diagnostic.count}</strong></div>) : <p>Sin errores</p>}</div>}</section>
        <section className="layer-panel layer-tree-panel"><div className="panel-title" onPointerDown={(event) => panelLayout.dragTree(event)}><div><p className="eyebrow">Capas</p><h2>Árbol <span>{document.layers.length}</span></h2></div><div className="layer-actions"><button title="Nueva carpeta" onPointerDown={(event) => event.stopPropagation()} onClick={createFolder}>+F</button><button title="Nueva capa" onPointerDown={(event) => event.stopPropagation()} onClick={() => { const parentId = document.layers.find((layer) => layer.id === document.activeLayerId)?.isFolder ? document.activeLayerId : undefined; commit(addMapLayer(documentRef.current, { id: crypto.randomUUID(), name: `Capa ${document.layers.length + 1}`, parentId })) }}>+</button></div></div><div className="layer-tree" role="tree" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const source = event.dataTransfer.getData('text/layer'); if (source) dropLayer(source) }}>{layerTree.map(({ layer, depth }) => <div key={layer.id} className={`tree-row ${layer.id === document.activeLayerId ? 'selected' : ''}`} role="treeitem" draggable onDragStart={(event) => { event.dataTransfer.setData('text/layer', layer.id); event.dataTransfer.effectAllowed = 'move' }} onDragOver={(event) => { if (layer.isFolder) event.preventDefault() }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const source = event.dataTransfer.getData('text/layer'); if (source && layer.isFolder) dropLayer(source, layer.id) }}><button className="tree-name" style={{ paddingLeft: `${0.35 + depth * 0.9}rem` }} onDoubleClick={() => { const name = window.prompt('Nombre', layer.name); if (name?.trim()) commit(updateMapLayer(documentRef.current, layer.id, { name })) }} onClick={() => layer.isFolder ? commit(updateMapLayer(documentRef.current, layer.id, { collapsed: !layer.collapsed })) : show(selectMapLayer(documentRef.current, layer.id))}>{layer.isFolder ? (layer.collapsed ? '▶' : '▼') : '▦'} <strong>{layer.name}</strong></button><button title={layer.visible ? 'Ocultar' : 'Mostrar'} onPointerDown={(event) => event.stopPropagation()} onClick={() => commit(updateMapLayer(documentRef.current, layer.id, { visible: !layer.visible }))}>{layer.visible ? <Eye /> : <EyeOff />}</button><button title={layer.locked ? 'Desbloquear' : 'Bloquear'} onPointerDown={(event) => event.stopPropagation()} onClick={() => commit(updateMapLayer(documentRef.current, layer.id, { locked: !layer.locked }))}>{layer.locked ? <Lock /> : <Unlock />}</button></div>)}</div></section>
        <section className={`layer-panel layer-tree-panel map-tree-runtime ${panelLayout.layout.floatingTree ? 'map-tree-runtime-floating' : ''}`}>{mapLayerTreeContent}</section>
      </aside>
    </section>
    <footer className="authoring-help"><span>{operation ? `${operation.label} ${Math.round(operation.progress * 100)}%` : status}{operation && <button className="operation-cancel" onClick={() => operationAbortRef.current?.abort()}>Cancelar</button>}</span><span>{cursor ? `${cursor.x}, ${cursor.y}` : '—'} · {Math.round(viewportRef.current.zoom * 100)}% · P/E/I/G/L/R/O/M/H · Ctrl+Z/Y · Alt+Shift+C/X/V/Del</span></footer>

    {newDialog && <div className="pixel-modal"><div><header><h2>Nuevo mapa</h2><button onClick={() => setNewDialog(false)}><X /></button></header><div className="map-form">{(['name', 'width', 'height', 'tileWidth', 'tileHeight'] as const).map((key) => <label key={key}>{({ name: 'Nombre', width: 'Ancho tiles', height: 'Alto tiles', tileWidth: 'Tile width', tileHeight: 'Tile height' })[key]}<input type={key === 'name' ? 'text' : 'number'} min="1" max="4096" value={newForm[key]} onChange={(e) => setNewForm({ ...newForm, [key]: key === 'name' ? e.target.value : Number(e.target.value) })} /></label>)}</div><label className="export-check"><input type="checkbox" checked={newForm.transparent} onChange={(e) => setNewForm({ ...newForm, transparent: e.target.checked })} /> Fondo transparente</label>{!newForm.transparent && <input type="color" value={newForm.color} onChange={(e) => setNewForm({ ...newForm, color: e.target.value })} />}<label className="export-check"><input type="checkbox" checked={newForm.grid} onChange={(e) => setNewForm({ ...newForm, grid: e.target.checked })} /> Grid visible</label><button className="panel-action" onClick={createNew}>Crear mapa</button></div></div>}
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
    {autotileDialog && autotileDraft && <div className="pixel-modal autotile-modal"><div><header><h2>Autotile básico</h2><button onClick={() => setAutotileDialog(false)}><X /></button></header><div className="map-form"><label>Nombre<input value={autotileDraft.name} onChange={(e) => setAutotileDraft({ ...autotileDraft, name: e.target.value })} /></label><label>Tileset<select value={autotileDraft.tilesetId} onChange={(e) => setAutotileDraft({ ...autotileDraft, tilesetId: e.target.value })}>{document.tilesets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}</select></label><label>Centro<input type="number" min="0" value={autotileDraft.centerTileId} onChange={(e) => setAutotileDraft({ ...autotileDraft, centerTileId: Number(e.target.value) })} /></label></div><h3>Terreno · 13 roles</h3><div className="autotile-grid">{terrainRoles.filter((role) => role !== 'center').map((role) => <label key={role}>{role}<input type="number" min="0" placeholder={`${autotileDraft.centerTileId}`} value={autotileDraft.terrain[role] ?? ''} onChange={(e) => { const terrain = { ...autotileDraft.terrain }; if (e.target.value === '') delete terrain[role]; else terrain[role] = Number(e.target.value); setAutotileDraft({ ...autotileDraft, terrain }) }} /></label>)}</div><h3>Contorno · máscaras cardinales 0–15</h3><div className="autotile-grid contour-grid">{Array.from({ length: 16 }, (_, mask) => <label key={mask}>{mask.toString(2).padStart(4, '0')}<input type="number" min="0" placeholder={`${autotileDraft.centerTileId}`} value={autotileDraft.contour[mask] ?? ''} onChange={(e) => { const contour = { ...autotileDraft.contour }; if (e.target.value === '') delete contour[mask]; else contour[mask] = Number(e.target.value); setAutotileDraft({ ...autotileDraft, contour }) }} /></label>)}</div><div className="modal-actions"><button onClick={() => setAutotileDialog(false)}>Cancelar</button><button className="primary" onClick={saveAutotile}>Guardar set</button></div></div></div>}
    {animationDialog && <div className="pixel-modal" role="dialog" aria-modal="true" aria-label="Configurar animación"><div><header><h2>Animación de tiles</h2><button onClick={() => setAnimationDialog(false)}><X /></button></header><label className="field">FPS<input type="number" min="1" max="60" value={animationFps} onChange={(event) => setAnimationFps(Number(event.target.value))} /></label><p className="document-meta">Los tiles del stamp se reproducen en loop al pintarlos.</p><div className="modal-actions"><button onClick={() => setAnimationDialog(false)}>Cancelar</button><button className="primary" onClick={applyAnimation}>Aplicar</button></div></div></div>}
  </main>
}

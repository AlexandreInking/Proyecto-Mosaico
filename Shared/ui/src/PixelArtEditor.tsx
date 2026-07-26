import { useEffect, useRef, useState } from 'react'
import {
  addSpriteLayer, constrainSquareEnd, createSpriteDocument, deserializeSpriteDocument, ellipsePixels, fillPixels, linePixels, rectanglePixels,
  addSpriteFrame, getPixel, removeSpriteFrame, removeSpriteLayer, selectSpriteFrame, selectSpriteLayer, setPixels, updateSpriteFrame, updateSpriteLayer,
  serializeSpriteDocument, snapLineEnd,
  moveSpritePixels, type GridCoordinate, type RgbaColor, type SpriteDocument,
} from '@mosaico/domain'
import { combineSelection, ellipseMask, invertSelection, magicMask, polygonMask, rectangleMask, selectionBounds, translateSelection, type SelectionMask, type SelectionMode } from './selection-model.js'
import { composeSpriteFrame, createViewport, panViewport, pickSpritePixel, PixiPixelViewport, resizeViewport, zoomViewportAt, type Point, type ViewportState } from '@mosaico/canvas'
import { BoxSelect, Circle, CircleDashed, Copy, Download, Eraser, Eye, EyeOff, FilePlus2, Grid3X3, Hand, LassoSelect, Lock, PaintBucket, Pause, Pencil, Play, Plus, Redo2, Slash, Square, Trash2, Undo2, Unlock, WandSparkles, type LucideIcon } from 'lucide-react'

type Tool = 'pencil' | 'eraser' | 'fill' | 'line' | 'rectangle' | 'ellipse' | 'select' | 'pan'
const plainTools: readonly [Tool, string, LucideIcon][] = [
  ['pencil', 'Lápiz', Pencil], ['eraser', 'Borrador', Eraser], ['fill', 'Relleno', PaintBucket],
  ['pan', 'Mano', Hand],
]
const shapes: readonly [Extract<Tool, 'line' | 'rectangle' | 'ellipse'>, string, LucideIcon][] = [['line', 'Línea', Slash], ['rectangle', 'Rectángulo', Square], ['ellipse', 'Elipse', Circle]]
const selections: readonly [SelectionMode, string, LucideIcon][] = [['rectangle', 'Selección rectangular', BoxSelect], ['ellipse', 'Selección elíptica', CircleDashed], ['lasso', 'Lazo', LassoSelect], ['magic', 'Varita mágica', WandSparkles]]
const toolLabel = (tool: Tool, selectionMode: SelectionMode) => tool === 'select' ? selections.find(([id]) => id === selectionMode)![1] : [...plainTools, ...shapes].find(([id]) => id === tool)![1]
const transparent: RgbaColor = { r: 0, g: 0, b: 0, a: 0 }
const storageKey = 'mosaico-pixel-document-v1'
const hotkeys: Readonly<Record<string, Tool>> = { p: 'pencil', e: 'eraser', g: 'fill', l: 'line', r: 'rectangle', o: 'ellipse', m: 'select', h: 'pan' }

function blank(width = 32, height = 32): SpriteDocument {
  return createSpriteDocument({ id: crypto.randomUUID(), name: 'Sprite sin título', width, height, layerId: crypto.randomUUID(), frameId: crypto.randomUUID() })
}

function initialDocument(): SpriteDocument {
  if (typeof localStorage === 'undefined') return blank()
  try { const saved = localStorage.getItem(storageKey); return saved ? deserializeSpriteDocument(saved) : blank() } catch { return blank() }
}

function rgba(hex: string): RgbaColor {
  const value = Number.parseInt(hex.slice(1), 16)
  return { r: value >> 16, g: (value >> 8) & 255, b: value & 255, a: 255 }
}

function paint(document: SpriteDocument, points: readonly GridCoordinate[], color: RgbaColor, mask?: SelectionMask): SpriteDocument {
  const inside = points.filter((point) => point.x >= 0 && point.y >= 0 && point.x < document.width && point.y < document.height && (!mask || mask.pixels.has(point.y * document.width + point.x)))
  return inside.length ? setPixels(document, document.activeLayerId, document.activeFrameId, inside, color) : document
}

function keepMask(before: SpriteDocument, after: SpriteDocument, mask?: SelectionMask): SpriteDocument {
  if (!mask) return after
  let next = before; const colors = new Map<string, { color: RgbaColor; points: GridCoordinate[] }>()
  for (const index of mask.pixels) { const point = { x: index % mask.width, y: Math.floor(index / mask.width) }; const color = getPixel(after, after.activeLayerId, after.activeFrameId, point); const id = `${color.r},${color.g},${color.b},${color.a}`; const group = colors.get(id) ?? { color, points: [] }; group.points.push(point); colors.set(id, group) }
  for (const { color, points } of colors.values()) next = setPixels(next, next.activeLayerId, next.activeFrameId, points, color)
  return next
}

function withOnionSkin(document: SpriteDocument): SpriteDocument {
  const index = document.frames.findIndex((frame) => frame.id === document.activeFrameId)
  if (index < 1) return document
  const previousId = document.frames[index - 1]!.id
  const previous = document.layers.flatMap((layer) => {
    const cel = layer.cels.get(previousId)
    return cel ? [{ ...layer, id: `onion-${layer.id}`, opacity: layer.opacity * 0.25, cels: new Map([[document.activeFrameId, { ...cel, frameId: document.activeFrameId }]]) }] : []
  })
  return { ...document, layers: [...previous, ...document.layers] }
}

function downloadCanvas(canvas: HTMLCanvasElement, name: string): void {
  canvas.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob); const link = window.document.createElement('a'); link.href = url; link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0) }, 'image/png')
}

export function PixelArtEditor() {
  const hostRef = useRef<HTMLDivElement>(null); const rendererRef = useRef<PixiPixelViewport | undefined>(undefined)
  const viewportRef = useRef<ViewportState>(createViewport({ width: 1, height: 1, zoom: 16, offsetX: 48, offsetY: 48 }))
  const [document, setDocument] = useState(initialDocument); const documentRef = useRef(document)
  const [tool, setTool] = useState<Tool>('pencil'); const toolRef = useRef(tool)
  const [color, setColor] = useState('#4bc3b7'); const colorRef = useRef(color)
  const [filled, setFilled] = useState(false); const filledRef = useRef(filled)
  const [selectionMask, setSelectionMask] = useState<SelectionMask>(); const [palette, setPalette] = useState(['#4bc3b7', '#ffffff', '#111111', '#e85d68', '#e8bb6b', '#76a8df'])
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('rectangle'); const selectionModeRef = useRef<SelectionMode>('rectangle')
  const selectionMaskRef = useRef<SelectionMask | undefined>(undefined); const selectionBaseRef = useRef<SelectionMask | undefined>(undefined); const lassoRef = useRef<GridCoordinate[]>([]); const selectionOperationRef = useRef<'replace' | 'add' | 'subtract'>('replace')
  const [flyout, setFlyout] = useState<'selection' | 'shape'>()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number }>()
  const [playing, setPlaying] = useState(false); const [playbackFrameId, setPlaybackFrameId] = useState<string>(); const playbackFrameRef = useRef<string | undefined>(undefined)
  const [onion, setOnion] = useState(false); const onionRef = useRef(false)
  const [, refreshViewport] = useState(0)
  const [status, setStatus] = useState('Listo para dibujar'); const [size, setSize] = useState({ width: 32, height: 32 })
  const undoRef = useRef<SpriteDocument[]>([]); const redoRef = useRef<SpriteDocument[]>([])
  const previewRef = useRef<SpriteDocument | undefined>(undefined)
  const gesture = useRef<{ start: GridCoordinate; last: GridCoordinate; before: SpriteDocument; screen: Point; panning: boolean; moving?: SelectionMask } | undefined>(undefined)

  const show = (next: SpriteDocument) => { documentRef.current = next; setDocument(next) }
  const commit = (next: SpriteDocument, before = documentRef.current) => {
    if (next === before) return
    undoRef.current.push(before); redoRef.current = []; show(next)
  }
  const undo = () => { const previous = undoRef.current.pop(); if (!previous) return; redoRef.current.push(documentRef.current); show(previous) }
  const redo = () => { const next = redoRef.current.pop(); if (!next) return; undoRef.current.push(documentRef.current); show(next) }
  const selectMask = (mask?: SelectionMask) => { selectionMaskRef.current = mask; setSelectionMask(mask) }
  const render = () => {
    const host = hostRef.current; const renderer = rendererRef.current
    if (!host || !renderer) return
    viewportRef.current = resizeViewport(viewportRef.current, Math.max(1, host.clientWidth), Math.max(1, host.clientHeight))
    const source = previewRef.current ?? documentRef.current
    const frame = playbackFrameRef.current ? { ...source, activeFrameId: playbackFrameRef.current } : source
    renderer.render(onionRef.current && !playbackFrameRef.current ? withOnionSkin(frame) : frame, viewportRef.current)
  }
  const fitCanvas = () => {
    const host = hostRef.current; if (!host) return
    const zoom = Math.max(1, Math.min(host.clientWidth / documentRef.current.width, host.clientHeight / documentRef.current.height) * 0.85)
    viewportRef.current = { ...viewportRef.current, width: host.clientWidth, height: host.clientHeight, zoom, offsetX: (host.clientWidth - documentRef.current.width * zoom) / 2, offsetY: (host.clientHeight - documentRef.current.height * zoom) / 2 }
    render(); refreshViewport((value) => value + 1); setStatus('Lienzo centrado')
  }

  useEffect(() => { toolRef.current = tool }, [tool])
  useEffect(() => { selectionModeRef.current = selectionMode }, [selectionMode])
  useEffect(() => { colorRef.current = color }, [color])
  useEffect(() => { filledRef.current = filled }, [filled])
  useEffect(() => { onionRef.current = onion; render() }, [onion])
  useEffect(() => { try { localStorage.setItem(storageKey, serializeSpriteDocument(document)) } catch { setStatus('No se pudo guardar localmente') } }, [document])
  useEffect(render, [document])
  useEffect(() => {
    if (!playing) { playbackFrameRef.current = undefined; setPlaybackFrameId(undefined); render(); return }
    const currentId = playbackFrameId ?? document.activeFrameId
    const currentIndex = document.frames.findIndex((frame) => frame.id === currentId)
    const current = document.frames[currentIndex] ?? document.frames[0]!
    playbackFrameRef.current = current.id; render()
    const timer = window.setTimeout(() => {
      const next = document.frames[(currentIndex + 1) % document.frames.length]!
      playbackFrameRef.current = next.id; setPlaybackFrameId(next.id); render()
    }, current.durationMs)
    return () => window.clearTimeout(timer)
  }, [playing, playbackFrameId, document])

  useEffect(() => {
    const host = hostRef.current; if (!host) return
    let disposed = false
    const point = (event: MouseEvent | PointerEvent | WheelEvent): Point => { const box = host.getBoundingClientRect(); return { x: event.clientX - box.left, y: event.clientY - box.top } }
    const pixel = (event: PointerEvent) => pickSpritePixel(viewportRef.current, point(event), documentRef.current)
    const safely = (action: () => void) => { try { action() } catch (error) { setStatus(error instanceof Error && error.message === 'SPRITE_LAYER_LOCKED' ? 'Capa bloqueada' : 'No se pudo aplicar la herramienta') } }
    const applyStroke = (from: GridCoordinate, to: GridCoordinate) => safely(() => show(paint(documentRef.current, linePixels(from, to), toolRef.current === 'eraser' ? transparent : rgba(colorRef.current), selectionMaskRef.current)))
    const constrained = (start: GridCoordinate, end: GridCoordinate, shift: boolean) => !shift ? end : toolRef.current === 'line' ? snapLineEnd(start, end) : constrainSquareEnd(start, end)
    const shapePoints = (start: GridCoordinate, end: GridCoordinate) => toolRef.current === 'line' ? linePixels(start, end)
      : toolRef.current === 'rectangle' ? rectanglePixels(start, end, filledRef.current) : ellipsePixels(start, end, filledRef.current)
    const applySelection = (next: SelectionMask) => selectMask(combineSelection(selectionBaseRef.current, next, selectionOperationRef.current))
    const down = (event: PointerEvent) => {
      const screen = point(event); const picked = pixel(event)
      if (event.button === 1 || toolRef.current === 'pan') {
        event.preventDefault(); host.setPointerCapture(event.pointerId)
        const fallback = picked ?? { x: 0, y: 0 }; gesture.current = { start: fallback, last: fallback, before: documentRef.current, screen, panning: true }; return
      }
      if (event.button !== 0) return
      setContextMenu(undefined)
      if (!picked) { selectMask(); setContextMenu(undefined); return }
      host.setPointerCapture(event.pointerId); gesture.current = { start: picked, last: picked, before: documentRef.current, screen, panning: false }
      if (toolRef.current === 'select') {
        const selected = selectionMaskRef.current
        if (selected?.pixels.has(picked.y * selected.width + picked.x) && !event.shiftKey && !event.altKey) { gesture.current.moving = selected; setContextMenu(undefined); return }
        selectionBaseRef.current = selectionMaskRef.current; selectionOperationRef.current = event.altKey ? 'subtract' : event.shiftKey ? 'add' : 'replace'; lassoRef.current = [picked]
        if (selectionModeRef.current === 'magic') { const current = documentRef.current; applySelection(magicMask(picked, current.width, current.height, (point) => JSON.stringify(getPixel(current, current.activeLayerId, current.activeFrameId, point)))) }
        else applySelection(selectionModeRef.current === 'ellipse' ? ellipseMask(picked, picked, documentRef.current.width, documentRef.current.height) : rectangleMask(picked, picked, documentRef.current.width, documentRef.current.height))
      }
      if (toolRef.current === 'fill') safely(() => { const current = documentRef.current; commit(keepMask(current, fillPixels(current, current.activeLayerId, current.activeFrameId, picked, rgba(colorRef.current)), selectionMaskRef.current)) })
      else if (toolRef.current === 'pencil' || toolRef.current === 'eraser') applyStroke(picked, picked)
    }
    const move = (event: PointerEvent) => {
      const active = gesture.current; const currentScreen = point(event)
      if (active?.panning) { viewportRef.current = panViewport(viewportRef.current, currentScreen.x - active.screen.x, currentScreen.y - active.screen.y); active.screen = currentScreen; render(); refreshViewport((value) => value + 1); return }
      const picked = pixel(event); if (picked) setStatus(`${picked.x}, ${picked.y} · ${documentRef.current.width}×${documentRef.current.height}`)
      if (!active || !picked || (picked.x === active.last.x && picked.y === active.last.y)) return
      if (active.moving) {
        const bounds = selectionBounds(active.moving); if (!bounds) return
        const dx = Math.max(-bounds.x, Math.min(picked.x - active.start.x, documentRef.current.width - bounds.x - bounds.width)); const dy = Math.max(-bounds.y, Math.min(picked.y - active.start.y, documentRef.current.height - bounds.y - bounds.height))
        previewRef.current = moveSpritePixels(active.before, active.before.activeLayerId, active.before.activeFrameId, [...active.moving.pixels], dx, dy); selectMask(translateSelection(active.moving, dx, dy)); render()
      } else if (toolRef.current === 'pencil' || toolRef.current === 'eraser') applyStroke(active.last, picked)
      else if (toolRef.current === 'select' && selectionModeRef.current !== 'magic') { lassoRef.current.push(picked); applySelection(selectionModeRef.current === 'ellipse' ? ellipseMask(active.start, picked, documentRef.current.width, documentRef.current.height) : selectionModeRef.current === 'lasso' ? polygonMask(lassoRef.current, documentRef.current.width, documentRef.current.height) : rectangleMask(active.start, picked, documentRef.current.width, documentRef.current.height)) }
      else if (toolRef.current === 'line' || toolRef.current === 'rectangle' || toolRef.current === 'ellipse') safely(() => { previewRef.current = paint(active.before, shapePoints(active.start, constrained(active.start, picked, event.shiftKey)), rgba(colorRef.current), selectionMaskRef.current); render() })
      active.last = picked
    }
    const up = (event: PointerEvent) => {
      const active = gesture.current; if (!active) return
      const picked = constrained(active.start, pixel(event) ?? active.last, event.shiftKey); const activeTool = toolRef.current; const colorValue = rgba(colorRef.current)
      const preview = previewRef.current; previewRef.current = undefined
      if (active.moving && preview) safely(() => commit(preview, active.before))
      else if (!active.panning && (activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'ellipse')) safely(() => commit(paint(active.before, shapePoints(active.start, picked), colorValue, selectionMaskRef.current), active.before))
      if ((activeTool === 'pencil' || activeTool === 'eraser') && documentRef.current !== active.before) { undoRef.current.push(active.before); redoRef.current = [] }
      gesture.current = undefined; if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId)
    }
    const wheel = (event: WheelEvent) => { event.preventDefault(); viewportRef.current = zoomViewportAt(viewportRef.current, point(event), Math.exp(-event.deltaY * 0.0015)); render(); refreshViewport((value) => value + 1) }
    const auxiliary = (event: MouseEvent) => { if (event.button === 1) event.preventDefault() }
    const context = (event: MouseEvent) => { const picked = pickSpritePixel(viewportRef.current, point(event), documentRef.current); if (picked && selectionMaskRef.current?.pixels.has(picked.y * documentRef.current.width + picked.x)) { event.preventDefault(); const screen = point(event); setContextMenu({ x: screen.x, y: screen.y }) } }
    const observer = new ResizeObserver(render); observer.observe(host)
    void PixiPixelViewport.create(host).then((renderer) => { if (disposed) renderer.destroy(); else { rendererRef.current = renderer; render() } })
    host.addEventListener('pointerdown', down); host.addEventListener('pointermove', move); host.addEventListener('pointerup', up); host.addEventListener('wheel', wheel, { passive: false }); host.addEventListener('auxclick', auxiliary); host.addEventListener('contextmenu', context)
    return () => { disposed = true; observer.disconnect(); host.removeEventListener('pointerdown', down); host.removeEventListener('pointermove', move); host.removeEventListener('pointerup', up); host.removeEventListener('wheel', wheel); host.removeEventListener('auxclick', auxiliary); host.removeEventListener('contextmenu', context); rendererRef.current?.destroy(); rendererRef.current = undefined }
  }, [])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return }
      if (event.ctrlKey && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return }
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

  const addLayer = () => commit(addSpriteLayer(documentRef.current, { id: crypto.randomUUID(), name: `Capa ${documentRef.current.layers.length + 1}` }))
  const removeLayer = () => { try { commit(removeSpriteLayer(documentRef.current, documentRef.current.activeLayerId)) } catch { setStatus('El documento necesita al menos una capa') } }
  const newCanvas = () => { const next = blank(Math.max(1, Math.min(512, size.width)), Math.max(1, Math.min(512, size.height))); undoRef.current = []; redoRef.current = []; selectMask(); show(next); setStatus('Nuevo lienzo creado') }
  const addFrame = (duplicate: boolean) => { setPlaying(false); selectMask(); commit(addSpriteFrame(documentRef.current, { id: crypto.randomUUID(), duplicateFromFrameId: duplicate ? document.activeFrameId : undefined })) }
  const removeFrame = () => { try { setPlaying(false); selectMask(); commit(removeSpriteFrame(documentRef.current, document.activeFrameId)) } catch { setStatus('La animación necesita al menos un frame') } }
  const chooseFrame = (frameId: string) => { setPlaying(false); selectMask(); show(selectSpriteFrame(documentRef.current, frameId)) }
  const activeFrame = document.frames.find((frame) => frame.id === document.activeFrameId)!
  const exportPng = () => {
    const canvas = window.document.createElement('canvas'); canvas.width = document.width; canvas.height = document.height
    canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(composeSpriteFrame(document, document.activeFrameId)), document.width, document.height), 0, 0)
    downloadCanvas(canvas, `${document.name.replace(/[^a-z0-9_-]+/gi, '-')}.png`); setStatus('PNG exportado pixel-perfect')
  }
  const exportSheet = () => {
    const width = document.width * document.frames.length
    if (width > 16_384 || width * document.height > 67_108_864) { setStatus('Sprite sheet excede límite seguro del navegador'); return }
    const canvas = window.document.createElement('canvas'); canvas.width = width; canvas.height = document.height; const context = canvas.getContext('2d'); if (!context) return
    document.frames.forEach((frame, index) => context.putImageData(new ImageData(new Uint8ClampedArray(composeSpriteFrame(document, frame.id)), document.width, document.height), index * document.width, 0))
    downloadCanvas(canvas, `${document.name.replace(/[^a-z0-9_-]+/gi, '-')}-sheet.png`); setStatus('Sprite sheet exportado')
  }
  const shapeTool = shapes.find(([id]) => id === tool) ?? shapes[0]!
  const selectionTool = selections.find(([id]) => id === selectionMode)!
  const ShapeIcon = shapeTool[2]; const SelectionIcon = selectionTool[2]
  // ponytail: SVG stays simplest at current 512² limit; move mask into Pixi only if profiling shows lag.
  const selectionPath = selectionMask ? [...selectionMask.pixels].map((index) => { const x = index % selectionMask.width; const y = Math.floor(index / selectionMask.width); return `M${x} ${y}h1v1h-1z` }).join('') : ''
  const selectionStyle = { left: viewportRef.current.offsetX, top: viewportRef.current.offsetY, width: document.width * viewportRef.current.zoom, height: document.height * viewportRef.current.zoom }

  return <main className="pixel-editor">
    <header className="pixel-optionsbar">
      <strong>{toolLabel(tool, selectionMode)}</strong><span className="option-divider" />
      <label className="color-control">Color<input aria-label="Color principal" type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
      <label className="fill-control"><input type="checkbox" checked={filled} onChange={(event) => setFilled(event.target.checked)} /> Relleno de formas</label>
      <span className="option-hint">Shift: restringir ángulo/proporción · Clic medio: mover lienzo</span>
      <div className="history-tools"><button aria-label="Deshacer" title="Deshacer (Ctrl+Z)" onClick={undo}><Undo2 /></button><button aria-label="Rehacer" title="Rehacer (Ctrl+Y)" onClick={redo}><Redo2 /></button></div>
    </header>
    <section className="pixel-body">
      <aside className="pixel-tool-rail" aria-label="Herramientas">
        {plainTools.slice(0, 3).map(([id, label, Icon]) => <button key={id} aria-label={label} title={`${label} (${Object.entries(hotkeys).find(([, value]) => value === id)?.[0]?.toUpperCase()})`} className={tool === id ? 'active' : ''} onClick={() => { setTool(id); setFlyout(undefined) }}><Icon /></button>)}
        <div className="tool-group"><button aria-label={shapeTool[1]} title={`${shapeTool[1]} · clic derecho: formas`} className={shapes.some(([id]) => id === tool) ? 'active' : ''} onClick={() => setTool(shapeTool[0])} onContextMenu={(event) => { event.preventDefault(); setFlyout(flyout === 'shape' ? undefined : 'shape') }}><ShapeIcon /></button>{flyout === 'shape' && <div className="tool-flyout">{shapes.map(([id, label, Icon]) => <button key={id} aria-label={label} className={tool === id ? 'active' : ''} onClick={() => { setTool(id); setFlyout(undefined) }}><Icon /></button>)}</div>}</div>
        <div className="tool-group"><button aria-label={selectionTool[1]} title={`${selectionTool[1]} · clic derecho: selecciones`} className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')} onContextMenu={(event) => { event.preventDefault(); setFlyout(flyout === 'selection' ? undefined : 'selection') }}><SelectionIcon /></button>{flyout === 'selection' && <div className="tool-flyout">{selections.map(([id, label, Icon]) => <button key={id} aria-label={label} className={selectionMode === id ? 'active' : ''} onClick={() => { setSelectionMode(id); setTool('select'); setFlyout(undefined) }}><Icon /></button>)}</div>}</div>
        {plainTools.slice(3).map(([id, label, Icon]) => <button key={id} aria-label={label} title={`${label} (${Object.entries(hotkeys).find(([, value]) => value === id)?.[0]?.toUpperCase()})`} className={tool === id ? 'active' : ''} onClick={() => { setTool(id); setFlyout(undefined) }}><Icon /></button>)}
      </aside>
      <div className="canvas-shell"><div ref={hostRef} className={`authoring-canvas tool-${tool}`} aria-label="Canvas Pixel Art editable" />{selectionPath && <svg className="selection-mask-overlay" style={selectionStyle} viewBox={`0 0 ${document.width} ${document.height}`} preserveAspectRatio="none"><path d={selectionPath} /></svg>}{contextMenu && <div className="selection-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} role="menu"><button role="menuitem" onClick={() => { if (selectionMaskRef.current) selectMask(invertSelection(selectionMaskRef.current)); setContextMenu(undefined) }}>Invertir selección</button><button role="menuitem" onClick={() => { selectMask(); setContextMenu(undefined) }}>Deseleccionar</button></div>}</div>
      <aside className="pixel-inspector"><section><div className="panel-title"><div><p className="eyebrow">Documento</p><h2>Lienzo</h2></div><button aria-label="Exportar PNG" title="Exportar PNG" onClick={exportPng}><Download /></button></div><div className="size-fields"><label>Ancho<input type="number" min="1" max="512" value={size.width} onChange={(event) => setSize({ ...size, width: Number(event.target.value) })} /></label><label>Alto<input type="number" min="1" max="512" value={size.height} onChange={(event) => setSize({ ...size, height: Number(event.target.value) })} /></label></div><button className="panel-action" onClick={newCanvas}><FilePlus2 />Crear lienzo</button><p className="document-meta">{document.name} · {document.width}×{document.height} · rev. {document.revision}</p><h3 className="palette-title">Paleta</h3><div className="pixel-palette">{palette.map((swatch) => <button key={swatch} aria-label={`Color ${swatch}`} style={{ backgroundColor: swatch }} onClick={() => setColor(swatch)} />)}<button aria-label="Guardar color en paleta" onClick={() => setPalette([color, ...palette.filter((item) => item !== color)].slice(0, 8))}><Plus /></button></div></section><section className="layer-panel"><div className="panel-title"><div><p className="eyebrow">Inspector</p><h2>Capas <span>{document.layers.length}</span></h2></div><div className="layer-actions"><button aria-label="Añadir capa" title="Añadir capa" onClick={addLayer}><Plus /></button><button aria-label="Eliminar capa" title="Eliminar capa" onClick={removeLayer}><Trash2 /></button></div></div><div className="layer-list">{[...document.layers].reverse().map((layer) => <div key={layer.id} className={`layer-row ${layer.id === document.activeLayerId ? 'selected' : ''}`}><button className="layer-select" onClick={() => commit(selectSpriteLayer(documentRef.current, layer.id))}><span className="layer-thumb"><Grid3X3 /></span><strong>{layer.name}</strong></button><button aria-label={`${layer.visible ? 'Ocultar' : 'Mostrar'} ${layer.name}`} onClick={() => commit(updateSpriteLayer(documentRef.current, layer.id, { visible: !layer.visible }))}>{layer.visible ? <Eye /> : <EyeOff />}</button><button aria-label={`${layer.locked ? 'Desbloquear' : 'Bloquear'} ${layer.name}`} onClick={() => commit(updateSpriteLayer(documentRef.current, layer.id, { locked: !layer.locked }))}>{layer.locked ? <Lock /> : <Unlock />}</button></div>)}</div></section></aside>
    </section>
    <section className="pixel-timeline"><div className="timeline-controls"><strong>Timeline</strong><button aria-label={playing ? 'Pausar animación' : 'Reproducir animación'} title={playing ? 'Pausar' : 'Reproducir'} onClick={() => setPlaying(!playing)}>{playing ? <Pause /> : <Play />}</button><button aria-label="Añadir frame" title="Añadir frame" onClick={() => addFrame(false)}><Plus /></button><button aria-label="Duplicar frame" title="Duplicar frame" onClick={() => addFrame(true)}><Copy /></button><button aria-label="Eliminar frame" title="Eliminar frame" onClick={removeFrame}><Trash2 /></button><button aria-label="Onion skin" title="Onion skin" className={onion ? 'active' : ''} onClick={() => setOnion(!onion)}><Eye /></button><button aria-label="Exportar sprite sheet" title="Exportar sprite sheet" onClick={exportSheet}><Download /></button><label>Duración <input aria-label="Duración del frame" type="number" min="10" max="60000" step="10" value={activeFrame.durationMs} onChange={(event) => { const durationMs = Number(event.target.value); if (Number.isInteger(durationMs) && durationMs >= 10 && durationMs <= 60_000) commit(updateSpriteFrame(documentRef.current, document.activeFrameId, { durationMs })) }} /> ms</label></div><div className="timeline-frames">{document.frames.map((frame, index) => <button key={frame.id} className={(playbackFrameId ?? document.activeFrameId) === frame.id ? 'active' : ''} aria-label={`Seleccionar frame ${index + 1}`} onClick={() => chooseFrame(frame.id)}><span>{index + 1}</span><small>{frame.durationMs} ms</small></button>)}</div></section>
    <footer className="authoring-help"><span>{status}</span><span>0: ajustar · P/E/G/L/R/O/M/H: herramientas · PageUp/Down: frames</span></footer>
  </main>
}

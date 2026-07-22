import { useEffect, useRef, useState } from 'react'
import {
  addSpriteLayer, constrainSquareEnd, createSpriteDocument, deserializeSpriteDocument, ellipsePixels, fillPixels, linePixels, rectanglePixels,
  addSpriteFrame, removeSpriteFrame, removeSpriteLayer, selectSpriteFrame, selectSpriteLayer, setPixels, updateSpriteFrame, updateSpriteLayer,
  serializeSpriteDocument, snapLineEnd,
  flipSpriteRegion, moveSpriteRegion, type GridCoordinate, type RgbaColor, type SpriteDocument, type SpriteRegion,
} from '@mosaico/domain'
import { composeSpriteFrame, createViewport, panViewport, pickSpritePixel, PixiPixelViewport, resizeViewport, zoomViewportAt, type Point, type ViewportState } from '@mosaico/canvas'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BoxSelect, Circle, Copy, Download, Eraser, Eye, EyeOff, FilePlus2, FlipHorizontal2, FlipVertical2, Grid3X3, Hand, Lock, PaintBucket, Pause, Pencil, Play, Plus, Redo2, Slash, Square, Trash2, Undo2, Unlock, type LucideIcon } from 'lucide-react'

type Tool = 'pencil' | 'eraser' | 'fill' | 'line' | 'rectangle' | 'ellipse' | 'select' | 'pan'
const tools: readonly [Tool, string, LucideIcon][] = [
  ['pencil', 'Lápiz', Pencil], ['eraser', 'Borrador', Eraser], ['fill', 'Relleno', PaintBucket],
  ['line', 'Línea', Slash], ['rectangle', 'Rectángulo', Square], ['ellipse', 'Elipse', Circle], ['select', 'Selección', BoxSelect], ['pan', 'Mano', Hand],
]
const transparent: RgbaColor = { r: 0, g: 0, b: 0, a: 0 }
const storageKey = 'mosaico-pixel-document-v1'

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

function paint(document: SpriteDocument, points: readonly GridCoordinate[], color: RgbaColor): SpriteDocument {
  const inside = points.filter((point) => point.x >= 0 && point.y >= 0 && point.x < document.width && point.y < document.height)
  return inside.length ? setPixels(document, document.activeLayerId, document.activeFrameId, inside, color) : document
}

function regionBetween(start: GridCoordinate, end: GridCoordinate): SpriteRegion {
  const x = Math.min(start.x, end.x); const y = Math.min(start.y, end.y)
  return { x, y, width: Math.abs(end.x - start.x) + 1, height: Math.abs(end.y - start.y) + 1 }
}

export function PixelArtEditor() {
  const hostRef = useRef<HTMLDivElement>(null); const rendererRef = useRef<PixiPixelViewport | undefined>(undefined)
  const viewportRef = useRef<ViewportState>(createViewport({ width: 1, height: 1, zoom: 16, offsetX: 48, offsetY: 48 }))
  const [document, setDocument] = useState(initialDocument); const documentRef = useRef(document)
  const [tool, setTool] = useState<Tool>('pencil'); const toolRef = useRef(tool)
  const [color, setColor] = useState('#4bc3b7'); const colorRef = useRef(color)
  const [filled, setFilled] = useState(false); const filledRef = useRef(filled)
  const [selection, setSelection] = useState<SpriteRegion>(); const [palette, setPalette] = useState(['#4bc3b7', '#ffffff', '#111111', '#e85d68', '#e8bb6b', '#76a8df'])
  const [playing, setPlaying] = useState(false); const [playbackFrameId, setPlaybackFrameId] = useState<string>(); const playbackFrameRef = useRef<string | undefined>(undefined)
  const [, refreshViewport] = useState(0)
  const [status, setStatus] = useState('Listo para dibujar'); const [size, setSize] = useState({ width: 32, height: 32 })
  const undoRef = useRef<SpriteDocument[]>([]); const redoRef = useRef<SpriteDocument[]>([])
  const previewRef = useRef<SpriteDocument | undefined>(undefined)
  const gesture = useRef<{ start: GridCoordinate; last: GridCoordinate; before: SpriteDocument; screen: Point; panning: boolean } | undefined>(undefined)

  const show = (next: SpriteDocument) => { documentRef.current = next; setDocument(next) }
  const commit = (next: SpriteDocument, before = documentRef.current) => {
    if (next === before) return
    undoRef.current.push(before); redoRef.current = []; show(next)
  }
  const undo = () => { const previous = undoRef.current.pop(); if (!previous) return; redoRef.current.push(documentRef.current); show(previous) }
  const redo = () => { const next = redoRef.current.pop(); if (!next) return; undoRef.current.push(documentRef.current); show(next) }
  const render = () => {
    const host = hostRef.current; const renderer = rendererRef.current
    if (!host || !renderer) return
    viewportRef.current = resizeViewport(viewportRef.current, Math.max(1, host.clientWidth), Math.max(1, host.clientHeight))
    const source = previewRef.current ?? documentRef.current
    renderer.render(playbackFrameRef.current ? { ...source, activeFrameId: playbackFrameRef.current } : source, viewportRef.current)
  }

  useEffect(() => { toolRef.current = tool }, [tool])
  useEffect(() => { colorRef.current = color }, [color])
  useEffect(() => { filledRef.current = filled }, [filled])
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
    const point = (event: PointerEvent | WheelEvent): Point => { const box = host.getBoundingClientRect(); return { x: event.clientX - box.left, y: event.clientY - box.top } }
    const pixel = (event: PointerEvent) => pickSpritePixel(viewportRef.current, point(event), documentRef.current)
    const safely = (action: () => void) => { try { action() } catch (error) { setStatus(error instanceof Error && error.message === 'SPRITE_LAYER_LOCKED' ? 'Capa bloqueada' : 'No se pudo aplicar la herramienta') } }
    const applyStroke = (from: GridCoordinate, to: GridCoordinate) => safely(() => show(paint(documentRef.current, linePixels(from, to), toolRef.current === 'eraser' ? transparent : rgba(colorRef.current))))
    const constrained = (start: GridCoordinate, end: GridCoordinate, shift: boolean) => !shift ? end : toolRef.current === 'line' ? snapLineEnd(start, end) : constrainSquareEnd(start, end)
    const shapePoints = (start: GridCoordinate, end: GridCoordinate) => toolRef.current === 'line' ? linePixels(start, end)
      : toolRef.current === 'rectangle' ? rectanglePixels(start, end, filledRef.current) : ellipsePixels(start, end, filledRef.current)
    const down = (event: PointerEvent) => {
      const screen = point(event); const picked = pixel(event)
      if (event.button === 1 || toolRef.current === 'pan') {
        event.preventDefault(); host.setPointerCapture(event.pointerId)
        const fallback = picked ?? { x: 0, y: 0 }; gesture.current = { start: fallback, last: fallback, before: documentRef.current, screen, panning: true }; return
      }
      if (event.button !== 0 || !picked) return
      host.setPointerCapture(event.pointerId); gesture.current = { start: picked, last: picked, before: documentRef.current, screen, panning: false }
      if (toolRef.current === 'select') setSelection(regionBetween(picked, picked))
      if (toolRef.current === 'fill') safely(() => commit(fillPixels(documentRef.current, documentRef.current.activeLayerId, documentRef.current.activeFrameId, picked, rgba(colorRef.current))))
      else if (toolRef.current === 'pencil' || toolRef.current === 'eraser') applyStroke(picked, picked)
    }
    const move = (event: PointerEvent) => {
      const active = gesture.current; const currentScreen = point(event)
      if (active?.panning) { viewportRef.current = panViewport(viewportRef.current, currentScreen.x - active.screen.x, currentScreen.y - active.screen.y); active.screen = currentScreen; render(); refreshViewport((value) => value + 1); return }
      const picked = pixel(event); if (picked) setStatus(`${picked.x}, ${picked.y} · ${documentRef.current.width}×${documentRef.current.height}`)
      if (!active || !picked || (picked.x === active.last.x && picked.y === active.last.y)) return
      if (toolRef.current === 'pencil' || toolRef.current === 'eraser') applyStroke(active.last, picked)
      else if (toolRef.current === 'select') setSelection(regionBetween(active.start, picked))
      else if (toolRef.current === 'line' || toolRef.current === 'rectangle' || toolRef.current === 'ellipse') safely(() => { previewRef.current = paint(active.before, shapePoints(active.start, constrained(active.start, picked, event.shiftKey)), rgba(colorRef.current)); render() })
      active.last = picked
    }
    const up = (event: PointerEvent) => {
      const active = gesture.current; if (!active) return
      const picked = constrained(active.start, pixel(event) ?? active.last, event.shiftKey); const activeTool = toolRef.current; const colorValue = rgba(colorRef.current)
      previewRef.current = undefined
      if (!active.panning && (activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'ellipse')) safely(() => commit(paint(active.before, shapePoints(active.start, picked), colorValue), active.before))
      if ((activeTool === 'pencil' || activeTool === 'eraser') && documentRef.current !== active.before) { undoRef.current.push(active.before); redoRef.current = [] }
      gesture.current = undefined; if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId)
    }
    const wheel = (event: WheelEvent) => { event.preventDefault(); viewportRef.current = zoomViewportAt(viewportRef.current, point(event), Math.exp(-event.deltaY * 0.0015)); render(); refreshViewport((value) => value + 1) }
    const auxiliary = (event: MouseEvent) => { if (event.button === 1) event.preventDefault() }
    const observer = new ResizeObserver(render); observer.observe(host)
    void PixiPixelViewport.create(host).then((renderer) => { if (disposed) renderer.destroy(); else { rendererRef.current = renderer; render() } })
    host.addEventListener('pointerdown', down); host.addEventListener('pointermove', move); host.addEventListener('pointerup', up); host.addEventListener('wheel', wheel, { passive: false }); host.addEventListener('auxclick', auxiliary)
    return () => { disposed = true; observer.disconnect(); host.removeEventListener('pointerdown', down); host.removeEventListener('pointermove', move); host.removeEventListener('pointerup', up); host.removeEventListener('wheel', wheel); host.removeEventListener('auxclick', auxiliary); rendererRef.current?.destroy(); rendererRef.current = undefined }
  }, [])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => { if (event.ctrlKey && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo() } else if (event.ctrlKey && event.key.toLowerCase() === 'y') { event.preventDefault(); redo() } }
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown)
  }, [])

  const addLayer = () => commit(addSpriteLayer(documentRef.current, { id: crypto.randomUUID(), name: `Capa ${documentRef.current.layers.length + 1}` }))
  const removeLayer = () => { try { commit(removeSpriteLayer(documentRef.current, documentRef.current.activeLayerId)) } catch { setStatus('El documento necesita al menos una capa') } }
  const newCanvas = () => { const next = blank(Math.max(1, Math.min(512, size.width)), Math.max(1, Math.min(512, size.height))); undoRef.current = []; redoRef.current = []; setSelection(undefined); show(next); setStatus('Nuevo lienzo creado') }
  const moveSelection = (dx: number, dy: number) => {
    if (!selection) return
    const safeX = Math.max(-selection.x, Math.min(dx, document.width - selection.x - selection.width)); const safeY = Math.max(-selection.y, Math.min(dy, document.height - selection.y - selection.height))
    if (!safeX && !safeY) return
    commit(moveSpriteRegion(documentRef.current, document.activeLayerId, document.activeFrameId, selection, safeX, safeY)); setSelection({ ...selection, x: selection.x + safeX, y: selection.y + safeY })
  }
  const flipSelection = (axis: 'horizontal' | 'vertical') => { if (selection) commit(flipSpriteRegion(documentRef.current, document.activeLayerId, document.activeFrameId, selection, axis)) }
  const addFrame = (duplicate: boolean) => { setPlaying(false); setSelection(undefined); commit(addSpriteFrame(documentRef.current, { id: crypto.randomUUID(), duplicateFromFrameId: duplicate ? document.activeFrameId : undefined })) }
  const removeFrame = () => { try { setPlaying(false); setSelection(undefined); commit(removeSpriteFrame(documentRef.current, document.activeFrameId)) } catch { setStatus('La animación necesita al menos un frame') } }
  const chooseFrame = (frameId: string) => { setPlaying(false); setSelection(undefined); show(selectSpriteFrame(documentRef.current, frameId)) }
  const activeFrame = document.frames.find((frame) => frame.id === document.activeFrameId)!
  const exportPng = () => {
    const canvas = window.document.createElement('canvas'); canvas.width = document.width; canvas.height = document.height
    canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(composeSpriteFrame(document, document.activeFrameId)), document.width, document.height), 0, 0)
    canvas.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob); const link = window.document.createElement('a'); link.href = url; link.download = `${document.name.replace(/[^a-z0-9_-]+/gi, '-')}.png`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0); setStatus('PNG exportado pixel-perfect') }, 'image/png')
  }
  const selectionStyle = selection ? { left: viewportRef.current.offsetX + selection.x * viewportRef.current.zoom, top: viewportRef.current.offsetY + selection.y * viewportRef.current.zoom, width: selection.width * viewportRef.current.zoom, height: selection.height * viewportRef.current.zoom } : undefined

  return <main className="pixel-editor">
    <header className="pixel-optionsbar">
      <strong>{tools.find(([id]) => id === tool)?.[1]}</strong><span className="option-divider" />
      <label className="color-control">Color<input aria-label="Color principal" type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
      <label className="fill-control"><input type="checkbox" checked={filled} onChange={(event) => setFilled(event.target.checked)} /> Relleno de formas</label>
      <span className="option-hint">Shift: restringir ángulo/proporción · Clic medio: mover lienzo</span>
      {tool === 'select' && <div className="selection-actions"><button aria-label="Mover izquierda" onClick={() => moveSelection(-1, 0)}><ArrowLeft /></button><button aria-label="Mover arriba" onClick={() => moveSelection(0, -1)}><ArrowUp /></button><button aria-label="Mover abajo" onClick={() => moveSelection(0, 1)}><ArrowDown /></button><button aria-label="Mover derecha" onClick={() => moveSelection(1, 0)}><ArrowRight /></button><button aria-label="Voltear horizontal" onClick={() => flipSelection('horizontal')}><FlipHorizontal2 /></button><button aria-label="Voltear vertical" onClick={() => flipSelection('vertical')}><FlipVertical2 /></button></div>}
      <div className="history-tools"><button aria-label="Deshacer" title="Deshacer (Ctrl+Z)" onClick={undo}><Undo2 /></button><button aria-label="Rehacer" title="Rehacer (Ctrl+Y)" onClick={redo}><Redo2 /></button></div>
    </header>
    <section className="pixel-body">
      <aside className="pixel-tool-rail" aria-label="Herramientas">{tools.map(([id, label, Icon]) => <button key={id} aria-label={label} title={label} className={tool === id ? 'active' : ''} onClick={() => setTool(id)}><Icon /></button>)}</aside>
      <div className="canvas-shell"><div ref={hostRef} className={`authoring-canvas tool-${tool}`} aria-label="Canvas Pixel Art editable" />{selectionStyle && <div className="selection-overlay" style={selectionStyle} />}</div>
      <aside className="pixel-inspector"><section><div className="panel-title"><div><p className="eyebrow">Documento</p><h2>Lienzo</h2></div><button aria-label="Exportar PNG" title="Exportar PNG" onClick={exportPng}><Download /></button></div><div className="size-fields"><label>Ancho<input type="number" min="1" max="512" value={size.width} onChange={(event) => setSize({ ...size, width: Number(event.target.value) })} /></label><label>Alto<input type="number" min="1" max="512" value={size.height} onChange={(event) => setSize({ ...size, height: Number(event.target.value) })} /></label></div><button className="panel-action" onClick={newCanvas}><FilePlus2 />Crear lienzo</button><p className="document-meta">{document.name} · {document.width}×{document.height} · rev. {document.revision}</p><h3 className="palette-title">Paleta</h3><div className="pixel-palette">{palette.map((swatch) => <button key={swatch} aria-label={`Color ${swatch}`} style={{ backgroundColor: swatch }} onClick={() => setColor(swatch)} />)}<button aria-label="Guardar color en paleta" onClick={() => setPalette([color, ...palette.filter((item) => item !== color)].slice(0, 8))}><Plus /></button></div></section><section className="layer-panel"><div className="panel-title"><div><p className="eyebrow">Inspector</p><h2>Capas <span>{document.layers.length}</span></h2></div><div className="layer-actions"><button aria-label="Añadir capa" title="Añadir capa" onClick={addLayer}><Plus /></button><button aria-label="Eliminar capa" title="Eliminar capa" onClick={removeLayer}><Trash2 /></button></div></div><div className="layer-list">{[...document.layers].reverse().map((layer) => <div key={layer.id} className={`layer-row ${layer.id === document.activeLayerId ? 'selected' : ''}`}><button className="layer-select" onClick={() => commit(selectSpriteLayer(documentRef.current, layer.id))}><span className="layer-thumb"><Grid3X3 /></span><strong>{layer.name}</strong></button><button aria-label={`${layer.visible ? 'Ocultar' : 'Mostrar'} ${layer.name}`} onClick={() => commit(updateSpriteLayer(documentRef.current, layer.id, { visible: !layer.visible }))}>{layer.visible ? <Eye /> : <EyeOff />}</button><button aria-label={`${layer.locked ? 'Desbloquear' : 'Bloquear'} ${layer.name}`} onClick={() => commit(updateSpriteLayer(documentRef.current, layer.id, { locked: !layer.locked }))}>{layer.locked ? <Lock /> : <Unlock />}</button></div>)}</div></section></aside>
    </section>
    <section className="pixel-timeline"><div className="timeline-controls"><strong>Timeline</strong><button aria-label={playing ? 'Pausar animación' : 'Reproducir animación'} title={playing ? 'Pausar' : 'Reproducir'} onClick={() => setPlaying(!playing)}>{playing ? <Pause /> : <Play />}</button><button aria-label="Añadir frame" title="Añadir frame" onClick={() => addFrame(false)}><Plus /></button><button aria-label="Duplicar frame" title="Duplicar frame" onClick={() => addFrame(true)}><Copy /></button><button aria-label="Eliminar frame" title="Eliminar frame" onClick={removeFrame}><Trash2 /></button><label>Duración <input aria-label="Duración del frame" type="number" min="10" max="60000" step="10" value={activeFrame.durationMs} onChange={(event) => { const durationMs = Number(event.target.value); if (Number.isInteger(durationMs) && durationMs >= 10 && durationMs <= 60_000) commit(updateSpriteFrame(documentRef.current, document.activeFrameId, { durationMs })) }} /> ms</label></div><div className="timeline-frames">{document.frames.map((frame, index) => <button key={frame.id} className={(playbackFrameId ?? document.activeFrameId) === frame.id ? 'active' : ''} aria-label={`Seleccionar frame ${index + 1}`} onClick={() => chooseFrame(frame.id)}><span>{index + 1}</span><small>{frame.durationMs} ms</small></button>)}</div></section>
    <footer className="authoring-help"><span>{status}</span><span>Rueda: zoom · clic medio: mover · Ctrl+Z/Y: historial</span></footer>
  </main>
}

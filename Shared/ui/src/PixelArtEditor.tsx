import { useEffect, useRef, useState } from 'react'
import {
  addSpriteLayer, constrainSquareEnd, createSpriteDocument, deserializeSpriteDocument, ellipsePixels, fillPixels, linePixels, rectanglePixels,
  removeSpriteLayer, selectSpriteLayer, setPixels, updateSpriteLayer,
  serializeSpriteDocument, snapLineEnd,
  type GridCoordinate, type RgbaColor, type SpriteDocument,
} from '@mosaico/domain'
import { createViewport, panViewport, pickSpritePixel, PixiPixelViewport, resizeViewport, zoomViewportAt, type Point, type ViewportState } from '@mosaico/canvas'
import { Circle, Eraser, Eye, EyeOff, FilePlus2, Grid3X3, Hand, Lock, PaintBucket, Pencil, Plus, Redo2, Slash, Square, Trash2, Undo2, Unlock, type LucideIcon } from 'lucide-react'

type Tool = 'pencil' | 'eraser' | 'fill' | 'line' | 'rectangle' | 'ellipse' | 'pan'
const tools: readonly [Tool, string, LucideIcon][] = [
  ['pencil', 'Lápiz', Pencil], ['eraser', 'Borrador', Eraser], ['fill', 'Relleno', PaintBucket],
  ['line', 'Línea', Slash], ['rectangle', 'Rectángulo', Square], ['ellipse', 'Elipse', Circle], ['pan', 'Mano', Hand],
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

export function PixelArtEditor() {
  const hostRef = useRef<HTMLDivElement>(null); const rendererRef = useRef<PixiPixelViewport | undefined>(undefined)
  const viewportRef = useRef<ViewportState>(createViewport({ width: 1, height: 1, zoom: 16, offsetX: 48, offsetY: 48 }))
  const [document, setDocument] = useState(initialDocument); const documentRef = useRef(document)
  const [tool, setTool] = useState<Tool>('pencil'); const toolRef = useRef(tool)
  const [color, setColor] = useState('#4bc3b7'); const colorRef = useRef(color)
  const [filled, setFilled] = useState(false); const filledRef = useRef(filled)
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
    renderer.render(previewRef.current ?? documentRef.current, viewportRef.current)
  }

  useEffect(() => { toolRef.current = tool }, [tool])
  useEffect(() => { colorRef.current = color }, [color])
  useEffect(() => { filledRef.current = filled }, [filled])
  useEffect(() => { try { localStorage.setItem(storageKey, serializeSpriteDocument(document)) } catch { setStatus('No se pudo guardar localmente') } }, [document])
  useEffect(render, [document])

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
      if (toolRef.current === 'fill') safely(() => commit(fillPixels(documentRef.current, documentRef.current.activeLayerId, documentRef.current.activeFrameId, picked, rgba(colorRef.current))))
      else if (toolRef.current === 'pencil' || toolRef.current === 'eraser') applyStroke(picked, picked)
    }
    const move = (event: PointerEvent) => {
      const active = gesture.current; const currentScreen = point(event)
      if (active?.panning) { viewportRef.current = panViewport(viewportRef.current, currentScreen.x - active.screen.x, currentScreen.y - active.screen.y); active.screen = currentScreen; render(); return }
      const picked = pixel(event); if (picked) setStatus(`${picked.x}, ${picked.y} · ${documentRef.current.width}×${documentRef.current.height}`)
      if (!active || !picked || (picked.x === active.last.x && picked.y === active.last.y)) return
      if (toolRef.current === 'pencil' || toolRef.current === 'eraser') applyStroke(active.last, picked)
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
    const wheel = (event: WheelEvent) => { event.preventDefault(); viewportRef.current = zoomViewportAt(viewportRef.current, point(event), Math.exp(-event.deltaY * 0.0015)); render() }
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
  const newCanvas = () => { const next = blank(Math.max(1, Math.min(512, size.width)), Math.max(1, Math.min(512, size.height))); undoRef.current = []; redoRef.current = []; show(next); setStatus('Nuevo lienzo creado') }

  return <main className="pixel-editor">
    <header className="pixel-optionsbar">
      <strong>{tools.find(([id]) => id === tool)?.[1]}</strong><span className="option-divider" />
      <label className="color-control">Color<input aria-label="Color principal" type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
      <label className="fill-control"><input type="checkbox" checked={filled} onChange={(event) => setFilled(event.target.checked)} /> Relleno de formas</label>
      <span className="option-hint">Shift: restringir ángulo/proporción · Clic medio: mover lienzo</span>
      <div className="history-tools"><button aria-label="Deshacer" title="Deshacer (Ctrl+Z)" onClick={undo}><Undo2 /></button><button aria-label="Rehacer" title="Rehacer (Ctrl+Y)" onClick={redo}><Redo2 /></button></div>
    </header>
    <section className="pixel-body">
      <aside className="pixel-tool-rail" aria-label="Herramientas">{tools.map(([id, label, Icon]) => <button key={id} aria-label={label} title={label} className={tool === id ? 'active' : ''} onClick={() => setTool(id)}><Icon /></button>)}</aside>
      <div ref={hostRef} className={`authoring-canvas tool-${tool}`} aria-label="Canvas Pixel Art editable" />
      <aside className="pixel-inspector"><section><div className="panel-title"><div><p className="eyebrow">Documento</p><h2>Lienzo</h2></div><FilePlus2 /></div><div className="size-fields"><label>Ancho<input type="number" min="1" max="512" value={size.width} onChange={(event) => setSize({ ...size, width: Number(event.target.value) })} /></label><label>Alto<input type="number" min="1" max="512" value={size.height} onChange={(event) => setSize({ ...size, height: Number(event.target.value) })} /></label></div><button className="panel-action" onClick={newCanvas}><FilePlus2 />Crear lienzo</button><p className="document-meta">{document.name} · {document.width}×{document.height} · rev. {document.revision}</p></section><section className="layer-panel"><div className="panel-title"><div><p className="eyebrow">Inspector</p><h2>Capas <span>{document.layers.length}</span></h2></div><div className="layer-actions"><button aria-label="Añadir capa" title="Añadir capa" onClick={addLayer}><Plus /></button><button aria-label="Eliminar capa" title="Eliminar capa" onClick={removeLayer}><Trash2 /></button></div></div><div className="layer-list">{[...document.layers].reverse().map((layer) => <div key={layer.id} className={`layer-row ${layer.id === document.activeLayerId ? 'selected' : ''}`}><button className="layer-select" onClick={() => commit(selectSpriteLayer(documentRef.current, layer.id))}><span className="layer-thumb"><Grid3X3 /></span><strong>{layer.name}</strong></button><button aria-label={`${layer.visible ? 'Ocultar' : 'Mostrar'} ${layer.name}`} onClick={() => commit(updateSpriteLayer(documentRef.current, layer.id, { visible: !layer.visible }))}>{layer.visible ? <Eye /> : <EyeOff />}</button><button aria-label={`${layer.locked ? 'Desbloquear' : 'Bloquear'} ${layer.name}`} onClick={() => commit(updateSpriteLayer(documentRef.current, layer.id, { locked: !layer.locked }))}>{layer.locked ? <Lock /> : <Unlock />}</button></div>)}</div></section></aside>
    </section>
    <footer className="authoring-help"><span>{status}</span><span>Rueda: zoom · clic medio: mover · Ctrl+Z/Y: historial</span></footer>
  </main>
}

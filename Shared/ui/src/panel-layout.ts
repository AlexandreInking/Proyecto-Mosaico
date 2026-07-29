import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react'

export type PanelLayoutMode = 'map' | 'pixel'
export type PanelResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
export type PanelLayout = {
  inspectorWidth: number
  treeWidth: number
  timelineWidth: number
  timelineHeight: number
  tilesetHeight: number
  layersHeight: number
  timelineVisible: boolean
  floatingTree: boolean
  treeX: number
  treeY: number
}

type StoredLayouts = { active: PanelLayout; saved: Record<string, PanelLayout> }
const defaults: Record<PanelLayoutMode, PanelLayout> = {
  map: { inspectorWidth: 304, treeWidth: 288, timelineWidth: 208, timelineHeight: 112, tilesetHeight: 280, layersHeight: 220, timelineVisible: false, floatingTree: false, treeX: 0, treeY: 0 },
  pixel: { inspectorWidth: 304, treeWidth: 288, timelineWidth: 208, timelineHeight: 112, tilesetHeight: 220, layersHeight: 220, timelineVisible: true, floatingTree: true, treeX: 0, treeY: 0 },
}
const key = 'mosaico-authoring-layouts-v1'
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))

function read(mode: PanelLayoutMode): StoredLayouts {
  try {
    const parsed = JSON.parse(localStorage.getItem(`${key}:${mode}`) ?? '') as Partial<StoredLayouts>
    return { active: { ...defaults[mode], ...parsed.active }, saved: parsed.saved ?? {} }
  } catch { return { active: { ...defaults[mode] }, saved: {} } }
}

export function usePanelLayout(mode: PanelLayoutMode) {
  const initial = read(mode)
  const [layout, setLayout] = useState<PanelLayout>(initial.active)
  const [saved, setSaved] = useState<Record<string, PanelLayout>>(initial.saved)
  useEffect(() => { try { localStorage.setItem(`${key}:${mode}`, JSON.stringify({ active: layout, saved })) } catch { /* layout persistence optional */ } }, [mode, layout, saved])
  const update = (patch: Partial<PanelLayout>) => setLayout((current) => ({ ...current, ...patch }))
  const resize = (panel: 'inspector' | 'timeline' | 'tileset' | 'layers' | 'tree', axis: 'width' | 'height', event: ReactPointerEvent) => {
    event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId)
    const startX = event.clientX; const startY = event.clientY; const startWidth = panel === 'inspector' ? layout.inspectorWidth : panel === 'timeline' ? layout.timelineWidth : layout.treeWidth; const startHeight = panel === 'timeline' ? layout.timelineHeight : panel === 'tileset' ? layout.tilesetHeight : layout.layersHeight
    const move = (next: PointerEvent) => {
      if (axis === 'width') {
        const width = clamp(startWidth + (panel === 'inspector' ? -(next.clientX - startX) : panel === 'tree' ? -(next.clientX - startX) : next.clientX - startX), 160, Math.max(220, window.innerWidth - 400))
        update(panel === 'inspector' ? { inspectorWidth: width } : panel === 'timeline' ? { timelineWidth: width } : { treeWidth: width })
      }
      else { const delta = next.clientY - startY; const height = clamp(startHeight + (panel === 'timeline' ? -delta : delta), 90, Math.max(90, window.innerHeight - 220)); update(panel === 'timeline' ? { timelineHeight: height } : panel === 'tileset' ? { tilesetHeight: height } : { layersHeight: height }) }
    }
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end, { once: true })
    window.addEventListener('pointercancel', end, { once: true })
  }
  const saveLayout = (name: string) => { const trimmed = name.trim(); if (trimmed) setSaved((items) => ({ ...items, [trimmed]: { ...layout } })) }
  const applyLayout = (name: string) => { const next = saved[name]; if (next) setLayout({ ...next }) }
  const deleteLayout = (name: string) => setSaved((items) => { const next = { ...items }; delete next[name]; return next })
  const reset = () => setLayout({ ...defaults[mode] })
  const resizeTree = (edge: PanelResizeEdge, event: ReactPointerEvent) => {
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture?.(event.pointerId)
    const startX = event.clientX; const startY = event.clientY; const startWidth = layout.treeWidth; const startHeight = layout.layersHeight
    const move = (next: PointerEvent) => {
      const dx = next.clientX - startX; const dy = next.clientY - startY
      update({ treeWidth: clamp(startWidth + (edge.includes('w') ? -dx : dx), 160, Math.max(220, window.innerWidth - 400)), layersHeight: clamp(startHeight + (edge.includes('n') ? -dy : dy), 90, Math.max(90, window.innerHeight - 220)) })
    }
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end, { once: true }); window.addEventListener('pointercancel', end, { once: true })
  }
  const dragTree = (event: ReactPointerEvent) => {
    if (!layout.floatingTree) return
    event.preventDefault(); const startX = event.clientX; const startY = event.clientY; const initialX = layout.treeX; const initialY = layout.treeY
    const move = (next: PointerEvent) => update({ treeX: clamp(initialX + next.clientX - startX, -window.innerWidth + 220, window.innerWidth - 220), treeY: clamp(initialY + next.clientY - startY, -window.innerHeight + 120, window.innerHeight - 120) })
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end, { once: true })
    window.addEventListener('pointercancel', end, { once: true })
  }
  return { layout, saved, update, resize, resizeTree, dragTree, saveLayout, applyLayout, deleteLayout, reset }
}

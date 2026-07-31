import { useEffect, useRef, useState, type PointerEvent } from 'react'

type Hsv = { h: number; s: number; v: number }
const clamp = (value: number) => Math.max(0, Math.min(1, value))

export function hexToHsv(hex: string): Hsv {
  const value = Number.parseInt(hex.replace('#', '').slice(0, 6), 16)
  const r = (value >> 16) / 255; const g = ((value >> 8) & 255) / 255; const b = (value & 255) / 255
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const delta = max - min
  const h = !delta ? 0 : max === r ? 60 * (((g - b) / delta) % 6) : max === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4)
  return { h: (h + 360) % 360, s: max ? delta / max : 0, v: max }
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s; const x = c * (1 - Math.abs((h / 60) % 2 - 1)); const m = v - c
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return `#${[r, g, b].map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('')}`
}

export function ColorWheel({ value, onChange, onChangeEnd, label }: { value: string; onChange: (value: string) => void; onChangeEnd?: (value: string, initial: string) => void; label: string }) {
  const [open, setOpen] = useState(false); const [hsv, setHsv] = useState(() => hexToHsv(value)); const [draft, setDraft] = useState(value.toUpperCase())
  const rootRef = useRef<HTMLDivElement>(null); const initialRef = useRef(value); const currentRef = useRef(value)
  useEffect(() => { setHsv(hexToHsv(value)); setDraft(value.toUpperCase()); currentRef.current = value }, [value])
  useEffect(() => {
    if (!open) return
    const close = (event: globalThis.PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    window.addEventListener('pointerdown', close); return () => window.removeEventListener('pointerdown', close)
  }, [open])
  const update = (next: Hsv) => { const hex = hsvToHex(next); setHsv(next); currentRef.current = hex; onChange(hex); return hex }
  const begin = () => { initialRef.current = value }
  const finish = () => onChangeEnd?.(currentRef.current, initialRef.current)
  const keyboard = (next: Hsv) => { begin(); const hex = update(next); onChangeEnd?.(hex, initialRef.current) }
  const pickHue = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect(); const x = event.clientX - box.left - box.width / 2; const y = event.clientY - box.top - box.height / 2
    update({ ...hsv, h: (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360 })
  }
  const pickSv = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    update({ ...hsv, s: clamp((event.clientX - box.left) / box.width), v: 1 - clamp((event.clientY - box.top) / box.height) })
  }
  const hueAngle = (hsv.h - 90) * Math.PI / 180
  return <div className="color-wheel-control" ref={rootRef}>
    <button className="color-swatch" type="button" aria-label={`Seleccionar ${label}`} title={label} style={{ backgroundColor: value }} onClick={() => setOpen((current) => !current)} />
    {open && <div className="color-wheel-popover" role="dialog" aria-label={label}>
      <div className="color-hue-wheel" role="slider" tabIndex={0} aria-label="Tono" aria-valuemin={0} aria-valuemax={359} aria-valuenow={Math.round(hsv.h)} onKeyDown={(event) => { const step = event.shiftKey ? 10 : 1; if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); keyboard({ ...hsv, h: (hsv.h - step + 360) % 360 }) } if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); keyboard({ ...hsv, h: (hsv.h + step) % 360 }) } }} onPointerDown={(event) => { begin(); event.currentTarget.setPointerCapture(event.pointerId); pickHue(event) }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) pickHue(event) }} onPointerUp={finish} onPointerCancel={finish}>
        <i style={{ left: `${50 + Math.cos(hueAngle) * 45}%`, top: `${50 + Math.sin(hueAngle) * 45}%` }} />
        <div className="color-sv" role="slider" tabIndex={0} aria-label="Saturación y brillo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hsv.v * 100)} aria-valuetext={`Saturación ${Math.round(hsv.s * 100)}%, brillo ${Math.round(hsv.v * 100)}%`} style={{ '--hue': `${hsv.h}` } as React.CSSProperties} onKeyDown={(event) => { const step = event.shiftKey ? 0.1 : 0.01; if (event.key === 'ArrowLeft') { event.preventDefault(); keyboard({ ...hsv, s: clamp(hsv.s - step) }) } if (event.key === 'ArrowRight') { event.preventDefault(); keyboard({ ...hsv, s: clamp(hsv.s + step) }) } if (event.key === 'ArrowDown') { event.preventDefault(); keyboard({ ...hsv, v: clamp(hsv.v - step) }) } if (event.key === 'ArrowUp') { event.preventDefault(); keyboard({ ...hsv, v: clamp(hsv.v + step) }) } }} onPointerDown={(event) => { event.stopPropagation(); begin(); event.currentTarget.setPointerCapture(event.pointerId); pickSv(event) }} onPointerMove={(event) => { event.stopPropagation(); if (event.currentTarget.hasPointerCapture(event.pointerId)) pickSv(event) }} onPointerUp={(event) => { event.stopPropagation(); finish() }} onPointerCancel={(event) => { event.stopPropagation(); finish() }}>
          <i style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
        </div>
      </div>
      <label>HEX<input value={draft} maxLength={7} onFocus={begin} onChange={(event) => { const next = event.target.value; setDraft(next); if (/^#[\da-f]{6}$/i.test(next)) { currentRef.current = next.toLowerCase(); onChange(currentRef.current) } }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} onBlur={() => { if (/^#[\da-f]{6}$/i.test(draft)) onChangeEnd?.(draft.toLowerCase(), initialRef.current); else setDraft(value.toUpperCase()) }} /></label>
    </div>}
  </div>
}

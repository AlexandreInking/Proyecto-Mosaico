import type { CustomExpression } from '@mosaico/contracts'
import { parameterPortId, type DemoGraph, type DemoNode, type DemoParameter, type DemoPortType } from './pipeline-editor-model.js'

export interface PipelineSurface {
  readonly width: number
  readonly height: number
  readonly pixels: Uint8ClampedArray
}

export interface PipelineAnimation {
  readonly frames: readonly PipelineSurface[]
  readonly frameDurationsMs: readonly number[]
  readonly loop: boolean
}

export type PipelineAssetSource = PipelineSurface | PipelineAnimation
export type PipelineValue = PipelineSurface | number | boolean | string | readonly number[] | readonly (string | number | boolean | readonly number[])[]
type NumericPipelineValue = number | readonly number[]

export interface PipelineEvaluation {
  readonly outputs: ReadonlyMap<string, ReadonlyMap<string, PipelineValue>>
  readonly values: ReadonlyMap<string, number>
  readonly vectors: ReadonlyMap<string, readonly number[]>
  readonly preview?: PipelineSurface
  readonly diagnostics: readonly string[]
}

export interface PipelineEvaluationContext {
  readonly previousTimeMs?: number
}

const maxDimension = 2048

const dimension = (value: number, fallback = 1) => Math.min(maxDimension, Math.max(1, Math.round(Number.isFinite(value) ? value : fallback)))

export function createSurface(width: number, height: number, pixels?: Uint8ClampedArray): PipelineSurface {
  const safeWidth = dimension(width); const safeHeight = dimension(height); const expected = safeWidth * safeHeight * 4
  if (pixels && pixels.length !== expected) throw new RangeError('PIPELINE_SURFACE_SIZE_INVALID')
  return { width: safeWidth, height: safeHeight, pixels: pixels ? new Uint8ClampedArray(pixels) : new Uint8ClampedArray(expected) }
}

const transparent = (width = 1, height = 1) => createSurface(width, height)
const cloneSurface = (source: PipelineSurface) => createSurface(source.width, source.height, source.pixels)
const indexOf = (surface: PipelineSurface, x: number, y: number) => (y * surface.width + x) * 4

function isAnimation(value: PipelineAssetSource | undefined): value is PipelineAnimation {
  return !!value && typeof value === 'object' && 'frames' in value && Array.isArray(value.frames)
}

function frameAt(source: PipelineAssetSource | undefined, timeMs: number): PipelineSurface | undefined {
  if (!source) return undefined
  if (!isAnimation(source)) return source
  if (!source.frames.length) return undefined
  const durations = source.frameDurationsMs.length === source.frames.length ? source.frameDurationsMs : source.frames.map(() => 100)
  const total = durations.reduce((sum, value) => sum + Math.max(10, value), 0)
  let position = source.loop && total > 0 ? Math.max(0, timeMs) % total : Math.min(Math.max(0, timeMs), Math.max(0, total - 1))
  for (let index = 0; index < source.frames.length; index += 1) {
    const duration = Math.max(10, durations[index] ?? 100)
    if (position < duration) return source.frames[index]
    position -= duration
  }
  return source.frames[source.frames.length - 1]
}

function parameter(node: DemoNode, id: string, incoming?: ReadonlyMap<string, PipelineValue>): DemoParameter | undefined {
  const base = node.parameters.find((item) => item.id === id)
  const connected = incoming?.get(`parameter:${id}`)
  return base && connected !== undefined ? { ...base, value: connected as DemoParameter['value'] } : base
}

function numberParameter(node: DemoNode, id: string, fallback: number, incoming?: ReadonlyMap<string, PipelineValue>): number {
  const value = Number(parameter(node, id, incoming)?.value)
  return Number.isFinite(value) ? value : fallback
}

function colorParameter(node: DemoNode, incoming?: ReadonlyMap<string, PipelineValue>): [number, number, number, number] {
  return parseColor(parameter(node, 'color', incoming)?.value, [255, 255, 255, 255])
}

function parseColor(rawValue: unknown, fallback: [number, number, number, number]): [number, number, number, number] {
  const raw = String(rawValue ?? '#ffffff')
  const value = raw.replace('#', '')
  const hex = value.length === 3 ? value.split('').map((part) => part + part).join('') : value
  const normalized = hex.length === 6 ? hex + 'ff' : hex
  if (!/^[0-9a-f]{8}$/i.test(normalized)) return fallback
  return [Number.parseInt(normalized.slice(0, 2), 16), Number.parseInt(normalized.slice(2, 4), 16), Number.parseInt(normalized.slice(4, 6), 16), Number.parseInt(normalized.slice(6, 8), 16)]
}

function isSurface(value: PipelineValue | undefined): value is PipelineSurface {
  return !!value && typeof value === 'object' && !Array.isArray(value) && 'width' in value && 'height' in value && 'pixels' in value
}

function surfaceInput(portId: string, incoming: ReadonlyMap<string, PipelineValue> | undefined): PipelineSurface | undefined {
  const value = incoming?.get(portId)
  return isSurface(value) ? value : undefined
}

function resize(source: PipelineSurface, width: number, height: number): PipelineSurface {
  const output = createSurface(width, height)
  for (let y = 0; y < output.height; y += 1) for (let x = 0; x < output.width; x += 1) {
    const sourceIndex = indexOf(source, Math.min(source.width - 1, Math.floor(x * source.width / output.width)), Math.min(source.height - 1, Math.floor(y * source.height / output.height)))
    output.pixels.set(source.pixels.subarray(sourceIndex, sourceIndex + 4), indexOf(output, x, y))
  }
  return output
}

function resizeTo(source: PipelineSurface, width: number, height: number): PipelineSurface {
  return source.width === width && source.height === height ? cloneSurface(source) : resize(source, width, height)
}

function flip(source: PipelineSurface, axis: string): PipelineSurface {
  const output = createSurface(source.width, source.height)
  for (let y = 0; y < source.height; y += 1) for (let x = 0; x < source.width; x += 1) {
    const sourceIndex = indexOf(source, x, y)
    const targetX = axis.toLowerCase().startsWith('h') ? source.width - x - 1 : x
    const targetY = axis.toLowerCase().startsWith('h') ? y : source.height - y - 1
    output.pixels.set(source.pixels.subarray(sourceIndex, sourceIndex + 4), indexOf(output, targetX, targetY))
  }
  return output
}

function tint(source: PipelineSurface, color: readonly [number, number, number, number]): PipelineSurface {
  const output = cloneSurface(source)
  for (let offset = 0; offset < output.pixels.length; offset += 4) {
    output.pixels[offset] = Math.round(output.pixels[offset]! * color[0] / 255)
    output.pixels[offset + 1] = Math.round(output.pixels[offset + 1]! * color[1] / 255)
    output.pixels[offset + 2] = Math.round(output.pixels[offset + 2]! * color[2] / 255)
    output.pixels[offset + 3] = Math.round(output.pixels[offset + 3]! * color[3] / 255)
  }
  return output
}

function solid(color: readonly [number, number, number, number], width: number, height: number): PipelineSurface {
  const output = createSurface(width, height)
  for (let offset = 0; offset < output.pixels.length; offset += 4) output.pixels.set(color, offset)
  return output
}

function gradient(from: readonly [number, number, number, number], to: readonly [number, number, number, number], direction: string, width: number, height: number): PipelineSurface {
  const output = createSurface(width, height)
  for (let y = 0; y < output.height; y += 1) for (let x = 0; x < output.width; x += 1) {
    const denominator = direction === 'Vertical' ? output.height - 1 : direction === 'Diagonal' ? output.width + output.height - 2 : output.width - 1
    const numerator = direction === 'Vertical' ? y : direction === 'Diagonal' ? x + y : x
    const t = denominator <= 0 ? 0 : numerator / denominator
    const offset = indexOf(output, x, y)
    for (let channel = 0; channel < 4; channel += 1) output.pixels[offset + channel] = Math.round(from[channel]! + (to[channel]! - from[channel]!) * t)
  }
  return output
}

function radialGradient(from: readonly [number, number, number, number], to: readonly [number, number, number, number], width: number, height: number): PipelineSurface {
  const output = createSurface(width, height); const centerX = (output.width - 1) / 2; const centerY = (output.height - 1) / 2; const radius = Math.max(1, Math.hypot(centerX, centerY))
  for (let y = 0; y < output.height; y += 1) for (let x = 0; x < output.width; x += 1) {
    const t = clamp01(Math.hypot(x - centerX, y - centerY) / radius); const offset = indexOf(output, x, y)
    for (let channel = 0; channel < 4; channel += 1) output.pixels[offset + channel] = Math.round(from[channel]! + (to[channel]! - from[channel]!) * t)
  }
  return output
}

function bilinearGradient(colors: readonly [readonly [number, number, number, number], readonly [number, number, number, number], readonly [number, number, number, number], readonly [number, number, number, number]], width: number, height: number): PipelineSurface {
  const output = createSurface(width, height)
  for (let y = 0; y < output.height; y += 1) for (let x = 0; x < output.width; x += 1) {
    const tx = output.width <= 1 ? 0 : x / (output.width - 1); const ty = output.height <= 1 ? 0 : y / (output.height - 1); const offset = indexOf(output, x, y)
    for (let channel = 0; channel < 4; channel += 1) {
      const top = colors[0]![channel]! + (colors[1]![channel]! - colors[0]![channel]!) * tx; const bottom = colors[2]![channel]! + (colors[3]![channel]! - colors[2]![channel]!) * tx
      output.pixels[offset + channel] = Math.round(top + (bottom - top) * ty)
    }
  }
  return output
}

function normalizedGradient(width: number, height: number): PipelineSurface {
  const output = createSurface(width, height)
  for (let y = 0; y < output.height; y += 1) for (let x = 0; x < output.width; x += 1) { const offset = indexOf(output, x, y); output.pixels[offset] = output.width <= 1 ? 0 : Math.round(x * 255 / (output.width - 1)); output.pixels[offset + 1] = output.height <= 1 ? 0 : Math.round(y * 255 / (output.height - 1)); output.pixels[offset + 2] = 255; output.pixels[offset + 3] = 255 }
  return output
}

function patternedSurface(width: number, height: number, cell: number, first: readonly [number, number, number, number], second: readonly [number, number, number, number], mode: 'checker' | 'stripe' | 'grid' | 'triangular'): PipelineSurface {
  const output = createSurface(width, height); const size = Math.max(1, Math.round(cell))
  for (let y = 0; y < output.height; y += 1) for (let x = 0; x < output.width; x += 1) {
    const line = x % size === 0 || y % size === 0; const triangle = Math.floor(x / size) % 2 === Math.floor(y / size) % 2; const active = mode === 'checker' ? triangle : mode === 'stripe' ? Math.floor(x / size) % 2 === 0 : mode === 'triangular' ? line || ((x + y) % size === 0) : line
    output.pixels.set(active ? (mode === 'grid' || mode === 'triangular' ? second : first) : second, indexOf(output, x, y))
  }
  return output
}

function drawLine(surface: PipelineSurface, x0: number, y0: number, x1: number, y1: number, color: readonly [number, number, number, number]): void {
  let x = Math.round(x0); let y = Math.round(y0); const endX = Math.round(x1); const endY = Math.round(y1); const dx = Math.abs(endX - x); const sx = x < endX ? 1 : -1; const dy = -Math.abs(endY - y); const sy = y < endY ? 1 : -1; let error = dx + dy
  while (true) { if (x >= 0 && y >= 0 && x < surface.width && y < surface.height) surface.pixels.set(color, indexOf(surface, x, y)); if (x === endX && y === endY) break; const doubled = 2 * error; if (doubled >= dy) { error += dy; x += sx } if (doubled <= dx) { error += dx; y += sy } }
}

function drawShape(width: number, height: number, shape: string, color: readonly [number, number, number, number]): PipelineSurface {
  const output = createSurface(width, height); const right = width - 1; const bottom = height - 1
  if (shape === 'Circle') { const cx = right / 2; const cy = bottom / 2; const radius = Math.max(1, Math.min(width, height) / 2 - 1); for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) { const distance = Math.hypot(x - cx, y - cy); if (Math.abs(distance - radius) <= 1.2) output.pixels.set(color, indexOf(output, x, y)) } }
  else if (shape === 'Line') drawLine(output, 0, 0, right, bottom, color)
  else { drawLine(output, 0, 0, right, 0, color); drawLine(output, 0, bottom, right, bottom, color); drawLine(output, 0, 0, 0, bottom, color); drawLine(output, right, 0, right, bottom, color) }
  return output
}

function drawPoints(width: number, height: number, points: readonly number[], color: readonly [number, number, number, number]): PipelineSurface {
  const output = createSurface(width, height); for (let index = 0; index + 3 < points.length; index += 2) drawLine(output, points[index]!, points[index + 1]!, points[index + 2]!, points[index + 3]!, color); return output
}

const bitmapGlyphs: Readonly<Record<string, readonly string[]>> = { M: ['10001', '11011', '10101', '10101', '10001'], O: ['01110', '10001', '10001', '10001', '01110'], S: ['01111', '10000', '01110', '00001', '11110'], A: ['01110', '10001', '11111', '10001', '10001'], I: ['11111', '00100', '00100', '00100', '11111'], C: ['01111', '10000', '10000', '10000', '01111'] }
function drawText(width: number, height: number, text: string, color: readonly [number, number, number, number]): PipelineSurface {
  const output = createSurface(width, height); let cursorX = 1
  for (const character of text.toUpperCase().slice(0, 64)) { const glyph = bitmapGlyphs[character] ?? ['11111', '00100', '00100', '00100', '11111']; for (let y = 0; y < glyph.length; y += 1) for (let x = 0; x < glyph[y]!.length; x += 1) if (glyph[y]![x] === '1' && cursorX + x < width && y + 1 < height) output.pixels.set(color, indexOf(output, cursorX + x, y + 1)); cursorX += 6; if (cursorX >= width) break }
  return output
}

function blend(first: PipelineSurface, second: PipelineSurface, mode: string): PipelineSurface {
  const width = first.width; const height = first.height; const normalizedSecond = resizeTo(second, width, height); const output = createSurface(width, height)
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const firstIndex = indexOf(first, x, y); const secondIndex = indexOf(normalizedSecond, x, y); const outputIndex = indexOf(output, x, y)
    for (let channel = 0; channel < 3; channel += 1) {
      const a = first.pixels[firstIndex + channel]!; const b = normalizedSecond.pixels[secondIndex + channel]!
      output.pixels[outputIndex + channel] = mode === 'Multiply' ? Math.round(a * b / 255) : mode === 'Add' ? Math.min(255, a + b) : 255 - Math.round((255 - a) * (255 - b) / 255)
    }
    output.pixels[outputIndex + 3] = Math.max(first.pixels[firstIndex + 3]!, normalizedSecond.pixels[secondIndex + 3]!)
  }
  return output
}

function rotate(source: PipelineSurface, angle: number, direction: string, anchor: string, offsetX: number, offsetY: number): PipelineSurface {
  const output = createSurface(source.width, source.height); const safeAngle = Math.max(0, Math.min(359.99, angle)); const signedAngle = direction === 'Counterclockwise' ? -safeAngle : safeAngle; const radians = (signedAngle * Math.PI) / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians)
  const anchors: Record<string, [number, number]> = { Center: [(source.width - 1) / 2, (source.height - 1) / 2], TopLeft: [0, 0], Top: [(source.width - 1) / 2, 0], TopRight: [source.width - 1, 0], Right: [source.width - 1, (source.height - 1) / 2], BottomRight: [source.width - 1, source.height - 1], Bottom: [(source.width - 1) / 2, source.height - 1], BottomLeft: [0, source.height - 1], Left: [0, (source.height - 1) / 2] }
  const [centerX, centerY] = anchors[anchor] ?? anchors.Center!
  const pivotX = centerX + offsetX; const pivotY = centerY + offsetY
  for (let y = 0; y < output.height; y += 1) for (let x = 0; x < output.width; x += 1) {
    const relativeX = x - pivotX; const relativeY = y - pivotY; const sourceX = Math.round(relativeX * cosine + relativeY * sine + pivotX); const sourceY = Math.round(-relativeX * sine + relativeY * cosine + pivotY)
    if (sourceX < 0 || sourceY < 0 || sourceX >= source.width || sourceY >= source.height) continue
    const sourceIndex = indexOf(source, sourceX, sourceY); output.pixels.set(source.pixels.subarray(sourceIndex, sourceIndex + 4), indexOf(output, x, y))
  }
  return output
}

function invert(source: PipelineSurface, channels: string): PipelineSurface {
  const output = cloneSurface(source)
  for (let offset = 0; offset < output.pixels.length; offset += 4) {
    output.pixels[offset] = 255 - output.pixels[offset]!
    output.pixels[offset + 1] = 255 - output.pixels[offset + 1]!
    output.pixels[offset + 2] = 255 - output.pixels[offset + 2]!
    if (channels === 'RGBA') output.pixels[offset + 3] = 255 - output.pixels[offset + 3]!
  }
  return output
}

function targetColor(node: DemoNode, incoming?: ReadonlyMap<string, PipelineValue>): [number, number, number, number] {
  return parseColor(parameter(node, 'color', incoming)?.value, [255, 255, 255, 255])
}

function selectMask(source: PipelineSurface, node: DemoNode, incoming?: ReadonlyMap<string, PipelineValue>): PipelineSurface {
  const output = createSurface(source.width, source.height); const mode = String(parameter(node, 'mode', incoming)?.value ?? 'Color'); const target = targetColor(node, incoming); const tolerance = Math.max(0, numberParameter(node, 'tolerance', 0, incoming)); const minimum = numberParameter(node, 'min', 0, incoming); const maximum = numberParameter(node, 'max', 255, incoming)
  for (let offset = 0; offset < output.pixels.length; offset += 4) {
    const r = source.pixels[offset]!; const g = source.pixels[offset + 1]!; const b = source.pixels[offset + 2]!; const a = source.pixels[offset + 3]!; const value = mode === 'Alpha' ? a : mode === 'Luminance' ? Math.round((r * 299 + g * 587 + b * 114) / 1000) : undefined
    const match = mode === 'Color' ? Math.max(Math.abs(r - target[0]), Math.abs(g - target[1]), Math.abs(b - target[2]), Math.abs(a - target[3])) <= tolerance : value! >= minimum && value! <= maximum
    if (match) output.pixels.set([255, 255, 255, 255], offset)
  }
  return output
}

function replaceSurface(first: PipelineSurface, second: PipelineSurface, node: DemoNode, incoming?: ReadonlyMap<string, PipelineValue>): PipelineSurface {
  const replacement = resizeTo(second, first.width, first.height); const output = cloneSurface(first); const target = targetColor(node, incoming); const tolerance = Math.max(0, numberParameter(node, 'tolerance', 0, incoming))
  for (let offset = 0; offset < output.pixels.length; offset += 4) {
    const match = Math.max(Math.abs(first.pixels[offset]! - target[0]), Math.abs(first.pixels[offset + 1]! - target[1]), Math.abs(first.pixels[offset + 2]! - target[2]), Math.abs(first.pixels[offset + 3]! - target[3])) <= tolerance
    if (match) output.pixels.set(replacement.pixels.subarray(offset, offset + 4), offset)
  }
  return output
}

function outline(source: PipelineSurface, node: DemoNode, incoming?: ReadonlyMap<string, PipelineValue>): PipelineSurface {
  const output = createSurface(source.width, source.height); const color = targetColor(node, incoming); const thickness = Math.max(1, Math.round(numberParameter(node, 'thickness', 1, incoming))); const threshold = Math.max(0, Math.min(255, numberParameter(node, 'threshold', 1, incoming))); const mode = String(parameter(node, 'mode', incoming)?.value ?? 'Outside')
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < source.width && y < source.height && source.pixels[indexOf(source, x, y) + 3]! >= threshold
  for (let y = 0; y < source.height; y += 1) for (let x = 0; x < source.width; x += 1) {
    const current = opaque(x, y); let nearOpaque = false; let nearTransparent = false
    for (let dy = -thickness; dy <= thickness; dy += 1) for (let dx = -thickness; dx <= thickness; dx += 1) { if (!dx && !dy) continue; const value = opaque(x + dx, y + dy); nearOpaque ||= value; nearTransparent ||= !value }
    const outside = !current && nearOpaque && (mode === 'Outside' || mode === 'Both'); const inside = current && nearTransparent && (mode === 'Inside' || mode === 'Both')
    if (outside || inside) output.pixels.set(color, indexOf(output, x, y))
  }
  return output
}

function zoom(source: PipelineSurface, scale: number): PipelineSurface {
  const safeScale = Math.max(0.05, Math.min(8, Number.isFinite(scale) ? scale : 1)); const output = createSurface(source.width, source.height); const centerX = (source.width - 1) / 2; const centerY = (source.height - 1) / 2
  for (let y = 0; y < output.height; y += 1) for (let x = 0; x < output.width; x += 1) {
    const sourceX = Math.round((x - centerX) / safeScale + centerX); const sourceY = Math.round((y - centerY) / safeScale + centerY)
    if (sourceX < 0 || sourceY < 0 || sourceX >= source.width || sourceY >= source.height) continue
    const sourceIndex = indexOf(source, sourceX, sourceY); output.pixels.set(source.pixels.subarray(sourceIndex, sourceIndex + 4), indexOf(output, x, y))
  }
  return output
}

const fract = (value: number) => value - Math.floor(value)
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const fade = (value: number) => value * value * (3 - 2 * value)

function random2(x: number, y: number, seed: number): number {
  return fract(Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123)
}

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x); const y0 = Math.floor(y); const tx = fade(fract(x)); const ty = fade(fract(y))
  const a = random2(x0, y0, seed); const b = random2(x0 + 1, y0, seed); const c = random2(x0, y0 + 1, seed); const d = random2(x0 + 1, y0 + 1, seed)
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty
}

function perlinNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x); const y0 = Math.floor(y); const tx = fract(x); const ty = fract(y)
  const gradient = (cellX: number, cellY: number) => {
    const angle = random2(cellX, cellY, seed) * Math.PI * 2
    return [Math.cos(angle), Math.sin(angle)] as const
  }
  const dot = (cellX: number, cellY: number, dx: number, dy: number) => { const vector = gradient(cellX, cellY); return vector[0] * dx + vector[1] * dy }
  const u = fade(tx); const v = fade(ty)
  const n0 = dot(x0, y0, tx, ty); const n1 = dot(x0 + 1, y0, tx - 1, ty); const n2 = dot(x0, y0 + 1, tx, ty - 1); const n3 = dot(x0 + 1, y0 + 1, tx - 1, ty - 1)
  return clamp01(((n0 + (n1 - n0) * u) * (1 - v) + (n2 + (n3 - n2) * u) * v) * 0.7071 + 0.5)
}

function simplexNoise(x: number, y: number, seed: number): number {
  const skew = (x + y) * 0.3660254037844386; const i = Math.floor(x + skew); const j = Math.floor(y + skew); const unskew = (i + j) * 0.21132486540518713; const x0 = x - (i - unskew); const y0 = y - (j - unskew)
  const second = x0 > y0 ? [1, 0] : [0, 1]; const contributions: number[] = []
  for (const [offsetX, offsetY] of [[0, 0], second, [1, 1]] as const) {
    const dx = x0 - offsetX + (offsetX === 1 && offsetY === 1 ? -0.577350269189626 : offsetX === 1 || offsetY === 1 ? 0.211324865405187 : 0)
    const dy = y0 - offsetY + (offsetX === 1 && offsetY === 1 ? -0.577350269189626 : offsetX === 1 || offsetY === 1 ? 0.211324865405187 : 0)
    const radius = 0.5 - dx * dx - dy * dy
    if (radius <= 0) contributions.push(0)
    else {
      const angle = random2(i + offsetX, j + offsetY, seed) * Math.PI * 2
      contributions.push(radius * radius * radius * radius * (Math.cos(angle) * dx + Math.sin(angle) * dy) * 70)
    }
  }
  return clamp01(contributions.reduce((sum, value) => sum + value, 0) * 0.5 + 0.5)
}

function cellularNoise(x: number, y: number, seed: number): number {
  const cellX = Math.floor(x); const cellY = Math.floor(y); let nearest = Number.POSITIVE_INFINITY
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
    const currentX = cellX + offsetX; const currentY = cellY + offsetY
    const pointX = currentX + 0.15 + random2(currentX, currentY, seed) * 0.7
    const pointY = currentY + 0.15 + random2(currentX, currentY, seed + 19.19) * 0.7
    nearest = Math.min(nearest, Math.hypot(x - pointX, y - pointY))
  }
  return clamp01(1 - nearest)
}

type NoiseSampler = (x: number, y: number, seed: number) => number

function fractalNoise(sample: NoiseSampler, x: number, y: number, seed: number, octaves: number, roughness: number): number {
  let amplitude = 1; let frequency = 1; let total = 0; let weight = 0
  for (let octave = 0; octave < Math.max(1, Math.min(8, Math.round(octaves))); octave += 1) {
    total += sample(x * frequency, y * frequency, seed + octave * 101) * amplitude; weight += amplitude
    frequency *= 2; amplitude *= clamp01(roughness)
  }
  return weight ? clamp01(total / weight) : 0
}

function proceduralNoise(kind: DemoNode['kind'], width: number, height: number, scale: number, seed: number, octaves: number, roughness: number, levels: number): PipelineSurface {
  const sample: NoiseSampler = kind === 'cellular-noise' || kind === 'worley-noise' || kind === 'voronoi-noise' ? cellularNoise : kind === 'perlin' ? perlinNoise : kind === 'simplex' ? simplexNoise : kind === 'white-noise' ? random2 : kind === 'blue-noise' ? (x, y, currentSeed) => Math.abs(random2(x, y, currentSeed) - random2(x + 1.7, y + 1.7, currentSeed)) : kind === 'gaussian-noise' ? (x, y, currentSeed) => clamp01((random2(x, y, currentSeed) + random2(x + 3, y + 7, currentSeed) + random2(x + 11, y + 13, currentSeed) - 1.5) / 1.5 + 0.5) : kind === 'impulse-noise' ? (x, y, currentSeed) => random2(x, y, currentSeed) > 0.96 ? 1 : 0 : kind === 'pink-noise' ? (x, y, currentSeed) => (valueNoise(x, y, currentSeed) + valueNoise(x * 0.5, y * 0.5, currentSeed + 7)) / 2 : kind === 'brown-noise' ? (x, y, currentSeed) => valueNoise(x * 0.25, y * 0.25, currentSeed) : kind === 'rings-noise' ? (x, y) => (Math.sin(Math.hypot(x, y) * Math.PI * 2) + 1) / 2 : kind === 'rays-noise' ? (x, y) => (Math.sin(Math.atan2(y, x) * 12) + 1) / 2 : kind === 'euclidean-noise' ? (x, y) => fract(Math.hypot(x, y)) : kind === 'manhattan-noise' ? (x, y) => fract(Math.abs(x) + Math.abs(y)) : kind === 'chebyshev-noise' ? (x, y) => fract(Math.max(Math.abs(x), Math.abs(y))) : kind === 'discrete-noise' ? (x, y, currentSeed) => Math.round(random2(Math.floor(x), Math.floor(y), currentSeed) * 4) / 4 : kind === 'seamless-noise' ? (x, y, currentSeed) => valueNoise(Math.sin(x) * 4, Math.cos(y) * 4, currentSeed) : kind === 'spots-noise' ? (x, y, currentSeed) => Math.pow(cellularNoise(x, y, currentSeed), 3) : valueNoise
  const output = createSurface(width, height); const safeLevels = Math.max(2, Math.round(levels))
  for (let y = 0; y < output.height; y += 1) for (let x = 0; x < output.width; x += 1) {
    const value = fractalNoise(sample, x * scale, y * scale, seed, octaves, roughness); const quantized = Math.round(value * (safeLevels - 1)) / (safeLevels - 1); const channel = Math.round(clamp01(quantized) * 255); const offset = indexOf(output, x, y)
    output.pixels[offset] = channel; output.pixels[offset + 1] = channel; output.pixels[offset + 2] = channel; output.pixels[offset + 3] = 255
  }
  return output
}

function scalarIncoming(incoming: ReadonlyMap<string, PipelineValue> | undefined, portId: string, fallback: number): number {
  const value = incoming?.get(portId); return typeof value === 'number' ? value : fallback
}

function booleanParameter(node: DemoNode, id: string, incoming: ReadonlyMap<string, PipelineValue> | undefined, fallback = false): boolean {
  const connected = incoming?.get(parameterPortId(id)); if (typeof connected === 'boolean') return connected
  const value = parameter(node, id, incoming)?.value; return typeof value === 'boolean' ? value : value === undefined ? fallback : String(value) === 'true'
}

function scalarValue(incoming: ReadonlyMap<string, PipelineValue> | undefined, portId: string): PipelineValue | undefined {
  const value = incoming?.get(portId); return typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string' ? value : undefined
}

type PipelineArray = readonly (string | number | boolean | readonly number[])[]
function arrayInput(incoming: ReadonlyMap<string, PipelineValue> | undefined, portId: string): PipelineArray | undefined {
  const value = incoming?.get(portId); return Array.isArray(value) && !isSurface(value as PipelineValue) ? value as PipelineArray : undefined
}

function numberArray(value: PipelineValue | undefined): number[] {
  return Array.isArray(value) ? value.map((item) => Number(item)).filter((item) => Number.isFinite(item)) : []
}

function defaultValue(type: DemoPortType): PipelineValue {
  if (type === 'surface' || type === 'surface-or-value' || type === 'color' || type === 'gradient') return transparent()
  if (type === 'bool') return false
  if (type === 'vector2') return [0, 0]
  if (type === 'vector3') return [0, 0, 0]
  if (type === 'vector4') return [0, 0, 0, 0]
  if (type === 'array') return []
  return 0
}

function typedIncoming(incoming: ReadonlyMap<string, PipelineValue> | undefined, portId: string, type: DemoPortType, diagnostics: string[]): PipelineValue {
  const value = incoming?.get(portId)
  if (value === undefined) { diagnostics.push('MISSING_INPUT'); return defaultValue(type) }
  return value
}

function translate(source: PipelineSurface, offsetX: number, offsetY: number, wrap: boolean): PipelineSurface {
  const output = createSurface(source.width, source.height); const dx = Math.round(offsetX); const dy = Math.round(offsetY)
  const modulo = (value: number, size: number) => ((value % size) + size) % size
  for (let y = 0; y < output.height; y += 1) for (let x = 0; x < output.width; x += 1) {
    const sourceX = wrap ? modulo(x - dx, source.width) : x - dx; const sourceY = wrap ? modulo(y - dy, source.height) : y - dy
    if (sourceX < 0 || sourceY < 0 || sourceX >= source.width || sourceY >= source.height) continue
    const sourceIndex = indexOf(source, sourceX, sourceY); output.pixels.set(source.pixels.subarray(sourceIndex, sourceIndex + 4), indexOf(output, x, y))
  }
  return output
}

function isVector(value: NumericPipelineValue): value is readonly number[] {
  return Array.isArray(value)
}

function isNumericPipelineValue(value: PipelineValue): value is NumericPipelineValue {
  return typeof value === 'number' || (Array.isArray(value) && value.every((item) => typeof item === 'number'))
}

function surfaceArithmetic(first: PipelineSurface, second: PipelineSurface, kind: DemoNode['kind'], diagnostics: string[]): PipelineSurface {
  const width = first.width; const height = first.height; const normalizedSecond = resizeTo(second, width, height); const output = createSurface(width, height)
  let divisionByZero = false
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const firstIndex = indexOf(first, x, y); const secondIndex = indexOf(normalizedSecond, x, y); const outputIndex = indexOf(output, x, y)
    for (let channel = 0; channel < 3; channel += 1) {
      const a = first.pixels[firstIndex + channel]!; const b = normalizedSecond.pixels[secondIndex + channel]!
      if (kind === 'divide' && b === 0) { output.pixels[outputIndex + channel] = 0; divisionByZero = true }
      else output.pixels[outputIndex + channel] = kind === 'add' ? Math.min(255, a + b) : kind === 'subtract' ? Math.max(0, a - b) : kind === 'multiply' ? Math.round(a * b / 255) : Math.min(255, Math.round(a * 255 / b))
    }
    const alphaA = first.pixels[firstIndex + 3]!; const alphaB = normalizedSecond.pixels[secondIndex + 3]!
    output.pixels[outputIndex + 3] = kind === 'multiply' || kind === 'divide' ? Math.round(alphaA * alphaB / 255) : Math.max(alphaA, alphaB)
  }
  if (divisionByZero) diagnostics.push('DIVISION_BY_ZERO')
  return output
}

function binaryParameterValue(node: DemoNode, id: 'a' | 'b', incoming: ReadonlyMap<string, PipelineValue> | undefined, fallback: number): PipelineValue {
  return incoming?.get(parameterPortId(id)) ?? parameter(node, id, incoming)?.value ?? fallback
}

function normalizeRuntimeTargetPort(node: DemoNode, portId: string): string {
  if (!['add', 'subtract', 'multiply', 'divide', 'noise', 'cellular-noise', 'perlin', 'simplex'].includes(node.kind)) return portId
  return {
    'surface-a': parameterPortId('a'),
    'value-a': parameterPortId('a'),
    'surface-b': parameterPortId('b'),
    'value-b': parameterPortId('b'),
    'seed-in': parameterPortId('seed'),
    'roughness-in': parameterPortId('roughness'),
  }[portId] ?? portId
}

function broadcastSurface(surface: PipelineSurface, scalar: number, kind: DemoNode['kind'], scalarOnLeft: boolean, diagnostics: string[]): PipelineSurface {
  const output = createSurface(surface.width, surface.height); let divisionByZero = false
  for (let offset = 0; offset < surface.pixels.length; offset += 4) {
    const value = surface.pixels[offset]!
    const result = kind === 'add' ? (scalarOnLeft ? scalar + value : value + scalar)
      : kind === 'subtract' ? (scalarOnLeft ? scalar - value : value - scalar)
        : kind === 'multiply' ? value * scalar
          : scalarOnLeft ? (value === 0 ? (divisionByZero = true, 0) : scalar / value) : (scalar === 0 ? (divisionByZero = true, 0) : value / scalar)
    output.pixels[offset] = Math.max(0, Math.min(255, Math.round(result)))
    output.pixels[offset + 1] = output.pixels[offset]!
    output.pixels[offset + 2] = output.pixels[offset]!
    output.pixels[offset + 3] = surface.pixels[offset + 3]!
  }
  if (divisionByZero) diagnostics.push('DIVISION_BY_ZERO')
  return output
}

function mapSurface(source: PipelineSurface, mapper: (r: number, g: number, b: number, a: number, offset: number, x: number, y: number) => readonly [number, number, number, number]): PipelineSurface {
  const output = cloneSurface(source)
  for (let y = 0; y < source.height; y += 1) for (let x = 0; x < source.width; x += 1) {
    const offset = indexOf(source, x, y); output.pixels.set(mapper(source.pixels[offset]!, source.pixels[offset + 1]!, source.pixels[offset + 2]!, source.pixels[offset + 3]!, offset, x, y), offset)
  }
  return output
}

function boxBlur(source: PipelineSurface, radius: number): PipelineSurface {
  const safeRadius = Math.min(16, Math.max(0, Math.round(radius))); if (!safeRadius) return cloneSurface(source)
  const output = createSurface(source.width, source.height); const area = (safeRadius * 2 + 1) ** 2
  for (let y = 0; y < source.height; y += 1) for (let x = 0; x < source.width; x += 1) {
    const sums = [0, 0, 0, 0]
    for (let dy = -safeRadius; dy <= safeRadius; dy += 1) for (let dx = -safeRadius; dx <= safeRadius; dx += 1) {
      const sampleX = Math.max(0, Math.min(source.width - 1, x + dx)); const sampleY = Math.max(0, Math.min(source.height - 1, y + dy)); const sample = indexOf(source, sampleX, sampleY)
      for (let channel = 0; channel < 4; channel += 1) sums[channel] = sums[channel]! + source.pixels[sample + channel]!
    }
    const offset = indexOf(output, x, y); for (let channel = 0; channel < 4; channel += 1) output.pixels[offset + channel] = Math.round(sums[channel]! / area)
  }
  return output
}

function maskSurface(first: PipelineSurface, second: PipelineSurface): PipelineSurface {
  const mask = resizeTo(second, first.width, first.height); return mapSurface(first, (r, g, b, a, offset) => [r, g, b, Math.round(a * mask.pixels[offset + 3]! / 255)])
}

function cropOffset(source: PipelineSurface, offsetX: number, offsetY: number): PipelineSurface {
  const output = createSurface(source.width, source.height); const dx = Math.round(offsetX); const dy = Math.round(offsetY)
  for (let y = 0; y < output.height; y += 1) for (let x = 0; x < output.width; x += 1) {
    const sourceX = x + dx; const sourceY = y + dy
    if (sourceX < 0 || sourceY < 0 || sourceX >= source.width || sourceY >= source.height) continue
    const sourceIndex = indexOf(source, sourceX, sourceY); output.pixels.set(source.pixels.subarray(sourceIndex, sourceIndex + 4), indexOf(output, x, y))
  }
  return output
}

function particleSurface(source: PipelineSurface, seed: number, count: number, timeMs: number, color: readonly [number, number, number, number]): PipelineSurface {
  const output = cloneSurface(source); const safeCount = Math.min(512, Math.max(1, Math.round(count))); const time = timeMs / 1000
  for (let index = 0; index < safeCount; index += 1) {
    const x = Math.floor(random2(index + time * 0.17, seed, seed + 11) * source.width); const y = Math.floor(random2(seed, index - time * 0.23, seed + 37) * source.height)
    if (x >= 0 && y >= 0 && x < source.width && y < source.height) output.pixels.set(color, indexOf(output, x, y))
  }
  return output
}

function advancedSurfaceResult(node: DemoNode, input: PipelineSurface | undefined, second: PipelineSurface | undefined, incoming: ReadonlyMap<string, PipelineValue> | undefined, diagnostics: string[], currentTimeMs: number): PipelineSurface {
  if (!input) { diagnostics.push('MISSING_INPUT'); return transparent() }
  const amount = numberParameter(node, 'amount', 1, incoming); const radius = numberParameter(node, 'radius', amount, incoming); const offsetX = numberParameter(node, 'offsetX', 0, incoming); const offsetY = numberParameter(node, 'offsetY', 0, incoming)
  switch (node.kind) {
    case 'mirror': return flip(input, String(parameter(node, 'axis', incoming)?.value ?? 'Horizontal'))
    case 'move': case 'move-to': return translate(input, offsetX, offsetY, false)
    case 'repeat': case 'tile': return translate(input, offsetX, offsetY, true)
    case 'crop': case 'atlas': case 'deform': case 'displace': case 'corner-warp': case 'lattice-warp': case 'polar-distance': case 'pivot': case 'skew': case 'transform': return cropOffset(input, offsetX, offsetY)
    case 'padding': case 'nine-slice': return translate(input, offsetX, offsetY, false)
    case 'scale': return zoom(input, amount)
    case 'alpha-cut': {
      const threshold = Math.max(0, Math.min(255, numberParameter(node, 'threshold', amount * 255, incoming))); return mapSurface(input, (r, g, b, a) => [r, g, b, a >= threshold ? a : 0])
    }
    case 'blur': case 'blur-directional': case 'blur-gaussian': return boxBlur(input, radius)
    case 'brightness-contrast': return mapSurface(input, (r, g, b, a) => { const contrast = Math.max(0, amount); const brightness = numberParameter(node, 'brightness', 0, incoming); return [clampByte((r - 128) * contrast + 128 + brightness), clampByte((g - 128) * contrast + 128 + brightness), clampByte((b - 128) * contrast + 128 + brightness), a] })
    case 'color-adjust': case 'colorize': case 'hue-saturation-value': case 'shading': return tint(input, colorParameter(node, incoming))
    case 'color-replace': return second ? replaceSurface(input, second, node, incoming) : replaceSurface(input, solid(colorParameter(node, incoming), input.width, input.height), node, incoming)
    case 'dither': case 'dither-bayer': case 'dither-cluster': case 'half-tone': return mapSurface(input, (r, g, b, a, _offset, x, y) => { const threshold = ((x + y) % 2) * 64 + 96; const luminance = (r * 299 + g * 587 + b * 114) / 1000; const value = luminance >= threshold ? 255 : 0; return [value, value, value, a] })
    case 'edge-detect': {
      const output = createSurface(input.width, input.height); for (let y = 0; y < input.height; y += 1) for (let x = 0; x < input.width; x += 1) { const here = indexOf(input, x, y); const right = indexOf(input, Math.min(input.width - 1, x + 1), y); const down = indexOf(input, x, Math.min(input.height - 1, y + 1)); const value = Math.min(255, Math.abs(input.pixels[here]! - input.pixels[right]!) + Math.abs(input.pixels[here]! - input.pixels[down]!)); output.pixels.set([value, value, value, input.pixels[here + 3]!], here) } return output
    }
    case 'glow': case 'bloom': case 'godray': case 'mk-godray': return blend(input, boxBlur(input, radius), 'Add')
    case 'level': case 'posterize': case 'palette-apply': case 'match-palette': return mapSurface(input, (r, g, b, a) => { const levels = Math.max(2, Math.round(numberParameter(node, 'levels', 4, incoming))); const quantize = (value: number) => Math.round(value * (levels - 1) / 255) * 255 / (levels - 1); return [quantize(r), quantize(g), quantize(b), a] })
    case 'pixelate': { const size = Math.max(1, Math.min(32, Math.round(amount * 8))); return mapSurface(input, (_r, _g, _b, _a, _offset, x, y) => { const source = indexOf(input, Math.floor(x / size) * size, Math.floor(y / size) * size); return [input.pixels[source]!, input.pixels[source + 1]!, input.pixels[source + 2]!, input.pixels[source + 3]!] }) }
    case 'shadow': return blend(input, tint(translate(input, offsetX + radius, offsetY + radius, false), [0, 0, 0, 160]), 'Add')
    case 'sharpen': return mapSurface(input, (r, g, b, a) => [clampByte((r - 128) * (1 + amount) + 128), clampByte((g - 128) * (1 + amount) + 128), clampByte((b - 128) * (1 + amount) + 128), a])
    case 'threshold': return mapSurface(input, (r, g, b, a) => { const value = (r * 299 + g * 587 + b * 114) / 1000 >= amount * 128 ? 255 : 0; return [value, value, value, a] })
    case 'alpha-to-color': return mapSurface(input, (_r, _g, _b, a) => { const color = colorParameter(node, incoming); return [color[0], color[1], color[2], a] })
    case 'clean-edge': return mapSurface(input, (r, g, b, a, _offset, x, y) => { const neighbor = x > 0 ? input.pixels[indexOf(input, x - 1, y) + 3]! : 0; return [r, g, b, neighbor === 0 ? 0 : a] })
    case 'isolate-color': return selectMask(input, node, incoming)
    case 'mask': return second ? maskSurface(input, second) : transparent(input.width, input.height)
    case 'mix': return second ? blend(input, second, 'Screen') : cloneSurface(input)
    case 'remap': case 'stack': case 'frame-blend': return second ? blend(input, second, 'Add') : cloneSurface(input)
    case 'frame-bypass': case 'resource-loader': case 'region-system': case 'uv-workflow': case 'condition': case 'delay': case 'feedback': case 'iteration': case 'loop': case 'loop-start': case 'loop-end': case 'script': return cloneSurface(input)
    case 'particle': case 'particle-spawn': case 'pixel-cloud': case 'trail': case 'vfx': return particleSurface(input, numberParameter(node, 'seed', 1, incoming), numberParameter(node, 'count', 16, incoming), currentTimeMs, colorParameter(node, incoming))
    default: return cloneSurface(input)
  }
}

function clampByte(value: number): number { return Math.max(0, Math.min(255, Math.round(Number.isFinite(value) ? value : 0))) }

function vectorArithmetic(first: readonly number[], second: readonly number[], kind: DemoNode['kind'], diagnostics: string[]): number[] {
  const length = Math.max(first.length, second.length); const output: number[] = []
  for (let index = 0; index < length; index += 1) {
    const a = first[index] ?? first[0] ?? 0; const b = second[index] ?? second[0] ?? 0
    if (kind === 'divide' && b === 0) { diagnostics.push('DIVISION_BY_ZERO'); output.push(0) }
    else output.push(kind === 'add' ? a + b : kind === 'subtract' ? a - b : kind === 'multiply' ? a * b : a / b)
  }
  return output
}

type CustomRuntimeValue = PipelineValue | string | boolean

function customParameterValue(node: DemoNode, id: string, incoming?: ReadonlyMap<string, PipelineValue>): CustomRuntimeValue | undefined {
  return parameter(node, id, incoming)?.value as CustomRuntimeValue | undefined
}

function customExpressionValue(expression: CustomExpression, node: DemoNode, incoming: ReadonlyMap<string, PipelineValue>, diagnostics: string[], depth = 0): CustomRuntimeValue | undefined {
  if (depth > 32) { diagnostics.push('CUSTOM_EXPRESSION_DEPTH'); return undefined }
  if (expression.kind === 'literal') return expression.value as CustomRuntimeValue
  if (expression.kind === 'ref') return incoming.get(expression.ref) ?? customParameterValue(node, expression.ref)
  if (expression.kind === 'binary') {
    const left = customExpressionValue(expression.left, node, incoming, diagnostics, depth + 1); const right = customExpressionValue(expression.right, node, incoming, diagnostics, depth + 1)
    if (typeof left === 'number' && typeof right === 'number') {
      if (expression.operator === '/' && right === 0) { diagnostics.push('DIVISION_BY_ZERO'); return 0 }
      return expression.operator === '+' ? left + right : expression.operator === '-' ? left - right : expression.operator === '*' ? left * right : left / right
    }
    if (Array.isArray(left) || Array.isArray(right)) {
      const first = Array.isArray(left) ? left : [Number(left ?? 0)]; const second = Array.isArray(right) ? right : [Number(right ?? 0)]
      return vectorArithmetic(first, second, expression.operator === '+' ? 'add' : expression.operator === '-' ? 'subtract' : expression.operator === '*' ? 'multiply' : 'divide', diagnostics)
    }
    diagnostics.push('CUSTOM_BINARY_TYPE_INVALID'); return undefined
  }
  const args = expression.args.map((arg) => customExpressionValue(arg, node, incoming, diagnostics, depth + 1))
  const first = args[0]; const second = args[1]
  const surface = (value: CustomRuntimeValue | undefined): PipelineSurface | undefined => isSurface(value as PipelineValue | undefined) ? value as PipelineSurface : undefined
  const firstSurface = surface(first); const secondSurface = surface(second)
  switch (expression.name) {
    case 'invert': return firstSurface ? invert(firstSurface, String(customParameterValue(node, 'channels', incoming) ?? 'RGB')) : transparent()
    case 'flip': return firstSurface ? flip(firstSurface, String(customParameterValue(node, 'axis', incoming) ?? 'Horizontal')) : transparent()
    case 'resize': return firstSurface ? resize(firstSurface, Number(args[1] ?? customParameterValue(node, 'width', incoming) ?? firstSurface.width), Number(args[2] ?? customParameterValue(node, 'height', incoming) ?? firstSurface.height)) : transparent()
    case 'rotate': return firstSurface ? rotate(firstSurface, Number(args[1] ?? customParameterValue(node, 'angle', incoming) ?? 0), String(customParameterValue(node, 'direction', incoming) ?? 'Clockwise'), String(customParameterValue(node, 'anchor', incoming) ?? 'Center'), Number(customParameterValue(node, 'offsetX', incoming) ?? 0), Number(customParameterValue(node, 'offsetY', incoming) ?? 0)) : transparent()
    case 'zoom': return firstSurface ? zoom(firstSurface, Number(args[1] ?? customParameterValue(node, 'scale', incoming) ?? 1)) : transparent()
    case 'select': return firstSurface ? selectMask(firstSurface, node, incoming) : transparent()
    case 'replace': return firstSurface && secondSurface ? replaceSurface(firstSurface, secondSurface, node, incoming) : transparent(firstSurface?.width ?? 1, firstSurface?.height ?? 1)
    case 'outline': return firstSurface ? outline(firstSurface, node, incoming) : transparent()
    case 'blend': return firstSurface && secondSurface ? blend(firstSurface, secondSurface, String(customParameterValue(node, 'mode', incoming) ?? 'Screen')) : transparent(firstSurface?.width ?? 1, firstSurface?.height ?? 1)
    case 'add': case 'subtract': case 'multiply': case 'divide':
      if (firstSurface && secondSurface) return surfaceArithmetic(firstSurface, secondSurface, expression.name, diagnostics)
      if (typeof first === 'number' && typeof second === 'number') { if (expression.name === 'divide' && second === 0) { diagnostics.push('DIVISION_BY_ZERO'); return 0 }; return expression.name === 'add' ? first + second : expression.name === 'subtract' ? first - second : expression.name === 'multiply' ? first * second : first / second }
      diagnostics.push('CUSTOM_OPERATION_INPUT_INVALID'); return 0
    case 'color': return firstSurface ? tint(firstSurface, colorParameter(node, incoming)) : solid(colorParameter(node, incoming), Number(customParameterValue(node, 'width', incoming) ?? 64), Number(customParameterValue(node, 'height', incoming) ?? 64))
    case 'gradient': return gradient(parseColor(customParameterValue(node, 'from', incoming), [0, 0, 0, 255]), parseColor(customParameterValue(node, 'to', incoming), [255, 255, 255, 255]), String(customParameterValue(node, 'direction', incoming) ?? 'Horizontal'), Number(customParameterValue(node, 'width', incoming) ?? 64), Number(customParameterValue(node, 'height', incoming) ?? 64))
    default: diagnostics.push('CUSTOM_OPERATION_UNREGISTERED'); return undefined
  }
}

function evaluateCustomNode(node: DemoNode, incoming: ReadonlyMap<string, PipelineValue>, diagnostics: string[]): ReadonlyMap<string, PipelineValue> {
  const output = new Map<string, PipelineValue>(); const definition = node.customDefinition
  if (!definition) { diagnostics.push('CUSTOM_DEFINITION_MISSING'); return new Map(node.outputs.map((port) => [port.id, transparent()] as const)) }
  for (const port of node.outputs) {
    const expression = definition.body[port.id]
    const value = expression ? customExpressionValue(expression, node, incoming, diagnostics) : undefined
    if (isSurface(value as PipelineValue | undefined) || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string' || Array.isArray(value)) output.set(port.id, value as PipelineValue)
    else output.set(port.id, defaultValue(port.type))
  }
  return output
}

function nodeOutput(node: DemoNode, incoming: ReadonlyMap<string, PipelineValue> | undefined, assets: ReadonlyMap<string, PipelineAssetSource>, diagnostics: string[], currentTimeMs: number): ReadonlyMap<string, PipelineValue> {
  const output = new Map<string, PipelineValue>()
  if (node.kind === 'custom') return evaluateCustomNode(node, incoming ?? new Map(), diagnostics)
  if (node.kind === 'asset') { output.set('surface-out', node.assetId ? cloneSurface(frameAt(assets.get(node.assetId), currentTimeMs) ?? transparent()) : transparent()); return output }
  if (node.kind === 'int') { output.set('value-out', Math.trunc(numberParameter(node, 'value', 0, incoming))); return output }
  if (node.kind === 'float') { output.set('value-out', numberParameter(node, 'value', 0, incoming)); return output }
  if (node.kind === 'number') { output.set('value-out', numberParameter(node, 'value', 0, incoming)); return output }
  if (node.kind === 'number-array') { output.set('array-out', numberArray(parameter(node, 'value', incoming)?.value)); return output }
  if (node.kind === 'evaluate') { output.set('value-out', scalarValue(incoming, 'value-in') ?? numberParameter(node, 'value', 0, incoming)); return output }
  if (['absolute', 'ceil', 'cosine', 'floor', 'round', 'sine', 'square-root', 'tangent', 'evaluate'].includes(node.kind)) {
    const value = scalarIncoming(incoming, 'value-in', numberParameter(node, 'value', 0, incoming)); const result = node.kind === 'absolute' ? Math.abs(value) : node.kind === 'ceil' ? Math.ceil(value) : node.kind === 'cosine' ? Math.cos(value) : node.kind === 'floor' ? Math.floor(value) : node.kind === 'round' ? Math.round(value) : node.kind === 'sine' ? Math.sin(value) : node.kind === 'square-root' ? Math.sqrt(Math.max(0, value)) : node.kind === 'tangent' ? Math.tan(value) : value
    output.set('value-out', Number.isFinite(result) ? result : 0); return output
  }
  if (node.kind === 'clamp') { const value = scalarIncoming(incoming, 'value-in', 0); const min = scalarIncoming(incoming, 'min-in', numberParameter(node, 'min', 0, incoming)); const max = scalarIncoming(incoming, 'max-in', numberParameter(node, 'max', 1, incoming)); output.set('value-out', Math.max(Math.min(min, max), Math.min(Math.max(min, max), value))); return output }
  if (node.kind === 'lerp') { const a = scalarIncoming(incoming, 'a', 0); const b = scalarIncoming(incoming, 'b', 0); const t = clamp01(scalarIncoming(incoming, 't', 0)); output.set('value-out', a + (b - a) * t); return output }
  if (node.kind === 'max' || node.kind === 'min' || node.kind === 'modulo') { const a = scalarIncoming(incoming, 'value-a', 0); const b = scalarIncoming(incoming, 'value-b', 0); output.set('value-out', node.kind === 'max' ? Math.max(a, b) : node.kind === 'min' ? Math.min(a, b) : b === 0 ? 0 : a % b); if (node.kind === 'modulo' && b === 0) diagnostics.push('DIVISION_BY_ZERO'); return output }
  if (node.kind === 'vector2' || node.kind === 'vector3' || node.kind === 'vector4') {
    const components = node.kind === 'vector2' ? ['x', 'y'] : node.kind === 'vector3' ? ['x', 'y', 'z'] : ['x', 'y', 'z', 'w']
    output.set('value-out', components.map((component) => numberParameter(node, component, 0, incoming))); return output
  }
  if (node.kind === 'angle' || node.kind === 'normalize' || node.kind === 'vector-length' || node.kind === 'vector-normalize' || node.kind === 'vector-scale' || node.kind === 'vector-add' || node.kind === 'vector-distance') {
    const a = numberArray(incoming?.get(node.kind === 'angle' || node.kind === 'normalize' || node.kind === 'vector-length' || node.kind === 'vector-normalize' ? 'vector-in' : 'a')); const b = numberArray(incoming?.get(node.kind === 'vector-add' || node.kind === 'vector-distance' ? 'b' : 'scale')); const x = a[0] ?? 0; const y = a[1] ?? 0
    if (node.kind === 'angle') output.set('value-out', (Math.atan2(y, x) * 180 / Math.PI + 360) % 360)
    else if (node.kind === 'vector-length' || node.kind === 'vector-distance') { const dx = node.kind === 'vector-distance' ? x - (b[0] ?? 0) : x; const dy = node.kind === 'vector-distance' ? y - (b[1] ?? 0) : y; output.set('value-out', Math.hypot(dx, dy)) }
    else if (node.kind === 'normalize' || node.kind === 'vector-normalize') { const length = Math.hypot(x, y); output.set('value-out', length ? [x / length, y / length] : [0, 0]) }
    else if (node.kind === 'vector-scale') { const scale = scalarIncoming(incoming, 'scale', 1); output.set('value-out', [x * scale, y * scale]) }
    else output.set('value-out', [x + (b[0] ?? 0), y + (b[1] ?? 0)])
    return output
  }
  if (node.kind === 'distance') { const a = numberArray(incoming?.get('a')); const b = numberArray(incoming?.get('b')); output.set('value-out', Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0))); return output }
  if (node.kind === 'array-length' || node.kind === 'array-reverse' || node.kind === 'array-sort' || node.kind === 'array-shuffle' || node.kind === 'array-randomizer' || node.kind === 'array-find' || node.kind === 'array-get' || node.kind === 'array-set' || node.kind === 'array-split' || node.kind === 'array-zip' || node.kind === 'array-range') {
    const source = arrayInput(incoming, 'array-in') ?? []; const index = Math.trunc(scalarIncoming(incoming, 'index', 0)); const target = arrayInput(incoming, 'b') ?? []; let result: PipelineValue
    if (node.kind === 'array-length') result = source.length
    else if (node.kind === 'array-reverse') result = [...source].reverse()
    else if (node.kind === 'array-sort') result = [...source].sort((left, right) => String(left).localeCompare(String(right)))
    else if (node.kind === 'array-shuffle' || node.kind === 'array-randomizer') result = [...source].map((value, position) => ({ value, key: Math.sin((position + 1) * (numberParameter(node, 'seed', 1, incoming) + 1)) })).sort((left, right) => left.key - right.key).map((item) => item.value)
    else if (node.kind === 'array-find') result = source.findIndex((value) => String(value) === String(scalarValue(incoming, 'value-in') ?? ''))
    else if (node.kind === 'array-get') result = source[index] ?? 0
    else if (node.kind === 'array-set') { const copy = [...source]; const value = scalarValue(incoming, 'value-in'); copy[index] = value !== undefined && typeof value !== 'object' ? value : 0; result = copy }
    else if (node.kind === 'array-split') { const size = Math.max(1, Math.trunc(scalarIncoming(incoming, 'size', 1))); result = Array.from({ length: Math.ceil(source.length / size) }, (_, position) => source.slice(position * size, position * size + size).join(',')) }
    else if (node.kind === 'array-zip') result = source.map((value, position) => `${String(value)}:${String(target[position] ?? '')}`)
    else { const start = scalarIncoming(incoming, 'start', 0); const end = scalarIncoming(incoming, 'end', 0); const step = scalarIncoming(incoming, 'step', start <= end ? 1 : -1) || 1; const values: number[] = []; for (let value = start, count = 0; (step > 0 ? value <= end : value >= end) && count < 4096; value += step, count += 1) values.push(value); result = values }
    if (node.kind === 'array-length' || node.kind === 'array-find' || node.kind === 'array-get') output.set('value-out', result)
    else output.set('array-out', result)
    return output
  }
  if (node.kind === 'seed') { output.set('value-out', Math.trunc(numberParameter(node, 'value', 1, incoming))); return output }
  if (node.kind === 'rough') { output.set('value-out', clamp01(numberParameter(node, 'value', 0.5, incoming))); return output }
  if (node.kind === 'time') { output.set('value-out', currentTimeMs / 1000); return output }
  if (node.kind === 'delta-time') {
    const ticksPerSecond = Math.max(1, Math.min(240, Math.round(numberParameter(node, 'ticksPerSecond', 1, incoming))))
    const value = numberParameter(node, 'value', 1, incoming)
    output.set('value-out', Math.floor(Math.max(0, currentTimeMs) / 1000 * ticksPerSecond) * value)
    return output
  }
  if (node.kind === 'bool') { output.set('value-out', booleanParameter(node, 'value', incoming)); return output }
  if (node.kind === 'compare') {
    const left = scalarValue(incoming, 'value-a'); const right = scalarValue(incoming, 'value-b')
    if (left === undefined || right === undefined) diagnostics.push('MISSING_INPUT')
    const operation = String(parameter(node, 'operation', incoming)?.value ?? 'Equal')
    const result = operation === 'Not Equal' ? left !== right : operation === 'Less' ? Number(left) < Number(right) : operation === 'Less Equal' ? Number(left) <= Number(right) : operation === 'Greater' ? Number(left) > Number(right) : operation === 'Greater Equal' ? Number(left) >= Number(right) : left === right
    output.set('value-out', left === undefined || right === undefined ? false : result); return output
  }
  if (node.kind === 'not') { const value = incoming?.get('value-in'); if (typeof value !== 'boolean') diagnostics.push('MISSING_INPUT'); output.set('value-out', typeof value === 'boolean' ? !value : false); return output }
  if (['and', 'or', 'xor', 'nor', 'nand'].includes(node.kind)) {
    const left = incoming?.get('value-a'); const right = incoming?.get('value-b'); if (typeof left !== 'boolean' || typeof right !== 'boolean') diagnostics.push('MISSING_INPUT')
    const a = left === true; const b = right === true; const result = node.kind === 'and' ? a && b : node.kind === 'or' ? a || b : node.kind === 'xor' ? a !== b : node.kind === 'nor' ? !(a || b) : !(a && b)
    output.set('value-out', typeof left === 'boolean' && typeof right === 'boolean' ? result : false); return output
  }
  if (node.kind === 'if') {
    const type = node.outputs.find((port) => port.id === 'result')?.type ?? 'surface'; const condition = incoming?.get('condition'); if (typeof condition !== 'boolean') diagnostics.push('MISSING_INPUT')
    const selectedPort = condition === true ? 'true-in' : 'false-in'; output.set('result', typedIncoming(incoming, selectedPort, type, diagnostics)); return output
  }
  if (node.kind === 'switch') {
    const type = node.outputs.find((port) => port.id === 'result')?.type ?? 'surface'; const selector = incoming?.get('selector'); if (typeof selector !== 'number') diagnostics.push('MISSING_INPUT')
    const selectedPort = selector === 0 ? 'case-0' : selector === 1 ? 'case-1' : 'default'; output.set('result', typedIncoming(incoming, selectedPort, type, diagnostics)); return output
  }
  if (node.kind === 'direction') {
    const angle = numberParameter(node, 'angle', 0, incoming); const magnitude = numberParameter(node, 'magnitude', 1, incoming)
    if (angle < 0 || angle > 359.99) { diagnostics.push('PARAMETER_OUT_OF_RANGE'); output.set('value-out', [0, 0]); return output }
    const radians = angle * Math.PI / 180; output.set('value-out', [Math.cos(radians) * magnitude, Math.sin(radians) * magnitude]); return output
  }
  if (node.kind === 'velocity') { output.set('value-out', [numberParameter(node, 'x', 0, incoming), numberParameter(node, 'y', 0, incoming)]); return output }
  if (node.kind === 'get-pixel') {
    const source = surfaceInput('surface-in', incoming); if (!source) { diagnostics.push('MISSING_INPUT'); output.set('color-out', [0, 0, 0, 0]); return output }
    const point = numberArray(incoming?.get('point-in')); const x = Math.max(0, Math.min(source.width - 1, Math.round(point[0] ?? numberParameter(node, 'x', 0, incoming)))); const y = Math.max(0, Math.min(source.height - 1, Math.round(point[1] ?? numberParameter(node, 'y', 0, incoming)))); const offset = indexOf(source, x, y)
    output.set('color-out', [source.pixels[offset]!, source.pixels[offset + 1]!, source.pixels[offset + 2]!, source.pixels[offset + 3]!]); return output
  }
  if (node.kind === 'solid') { output.set('surface-out', solid(colorParameter(node, incoming), numberParameter(node, 'width', 64, incoming), numberParameter(node, 'height', 64, incoming))); return output }
  if (node.kind === 'linear-gradient') { output.set('surface-out', gradient(parseColor(parameter(node, 'from', incoming)?.value, [0, 0, 0, 255]), parseColor(parameter(node, 'to', incoming)?.value, [255, 255, 255, 255]), String(parameter(node, 'direction', incoming)?.value ?? 'Horizontal'), numberParameter(node, 'width', 64, incoming), numberParameter(node, 'height', 64, incoming))); return output }
  if (node.kind === 'radial-gradient') { output.set('surface-out', radialGradient(parseColor(parameter(node, 'from', incoming)?.value, [0, 0, 0, 255]), parseColor(parameter(node, 'to', incoming)?.value, [255, 255, 255, 255]), numberParameter(node, 'width', 64, incoming), numberParameter(node, 'height', 64, incoming))); return output }
  if (node.kind === 'bilinear-gradient') { output.set('surface-out', bilinearGradient([parseColor(parameter(node, 'top-left', incoming)?.value, [0, 0, 0, 255]), parseColor(parameter(node, 'top-right', incoming)?.value, [255, 255, 255, 255]), parseColor(parameter(node, 'bottom-left', incoming)?.value, [255, 255, 255, 255]), parseColor(parameter(node, 'bottom-right', incoming)?.value, [0, 0, 0, 255])], numberParameter(node, 'width', 64, incoming), numberParameter(node, 'height', 64, incoming))); return output }
  if (node.kind === 'normalized-gradient') { output.set('surface-out', normalizedGradient(numberParameter(node, 'width', 64, incoming), numberParameter(node, 'height', 64, incoming))); return output }
  if (node.kind === 'checkerboard' || node.kind === 'grid' || node.kind === 'grid-triangular' || node.kind === 'stripe') {
    const first = parseColor(parameter(node, 'a', incoming)?.value, [0, 0, 0, 255]); const second = parseColor(parameter(node, 'b', incoming)?.value ?? parameter(node, 'color', incoming)?.value, [255, 255, 255, 255]); const mode = node.kind === 'checkerboard' ? 'checker' : node.kind === 'stripe' ? 'stripe' : node.kind === 'grid-triangular' ? 'triangular' : 'grid'; output.set('surface-out', patternedSurface(numberParameter(node, 'width', 64, incoming), numberParameter(node, 'height', 64, incoming), numberParameter(node, 'cell', 8, incoming), first, second, mode)); return output
  }
  if (node.kind === 'draw-shape') { output.set('surface-out', drawShape(numberParameter(node, 'width', 64, incoming), numberParameter(node, 'height', 64, incoming), String(parameter(node, 'shape', incoming)?.value ?? 'Rectangle'), colorParameter(node, incoming))); return output }
  if (node.kind === 'draw-text') { output.set('surface-out', drawText(numberParameter(node, 'width', 64, incoming), numberParameter(node, 'height', 64, incoming), String(parameter(node, 'text', incoming)?.value ?? ''), colorParameter(node, incoming))); return output }
  if (node.kind === 'draw-curve' || node.kind === 'draw-path') { output.set('surface-out', drawPoints(numberParameter(node, 'width', 64, incoming), numberParameter(node, 'height', 64, incoming), numberArray(incoming?.get('points-in')), colorParameter(node, incoming))); return output }
  if (node.kind === 'draw-group') { const first = surfaceInput('surface-a', incoming); const second = surfaceInput('surface-b', incoming); output.set('surface-out', first && second ? blend(first, second, 'Add') : transparent(first?.width ?? second?.width ?? 1, first?.height ?? second?.height ?? 1)); return output }
  if (node.kind === 'noise' || node.kind === 'cellular-noise' || node.kind === 'perlin' || node.kind === 'simplex' || node.kind.endsWith('-noise') || node.kind === 'fbm') {
    const width = numberParameter(node, 'width', 64, incoming); const height = numberParameter(node, 'height', 64, incoming); const scale = numberParameter(node, 'scale', 0.08, incoming); const seed = Math.trunc(scalarIncoming(incoming, parameterPortId('seed'), numberParameter(node, 'seed', 1, incoming))); const roughness = clamp01(scalarIncoming(incoming, parameterPortId('roughness'), numberParameter(node, 'roughness', 0.5, incoming))); const octaves = numberParameter(node, 'octaves', 1, incoming); const levels = numberParameter(node, 'levels', 8, incoming)
    if (scale <= 0 || scale > 4 || width < 1 || width > 512 || height < 1 || height > 512) { diagnostics.push('PARAMETER_OUT_OF_RANGE'); output.set('surface-out', transparent()); return output }
    output.set('surface-out', proceduralNoise(node.kind, width, height, scale, seed, octaves, roughness, levels)); return output
  }
  if (node.kind === 'add' || node.kind === 'subtract' || node.kind === 'multiply' || node.kind === 'divide') {
    const a = binaryParameterValue(node, 'a', incoming, 0); const b = binaryParameterValue(node, 'b', incoming, node.kind === 'multiply' || node.kind === 'divide' ? 1 : 0)
    const firstSurface = isSurface(a) ? a : undefined; const secondSurface = isSurface(b) ? b : undefined
    if (firstSurface && secondSurface) { output.set('surface-out', surfaceArithmetic(firstSurface, secondSurface, node.kind, diagnostics)); return output }
    if (firstSurface || secondSurface) {
      const surface = firstSurface ?? secondSurface!
      const scalar = Number(firstSurface ? b : a)
      if (!Number.isFinite(scalar)) { diagnostics.push('INCOMPATIBLE_INPUT'); output.set('surface-out', transparent(surface.width, surface.height)); return output }
      output.set('surface-out', broadcastSurface(surface, scalar, node.kind, !firstSurface, diagnostics)); return output
    }
    if (isNumericPipelineValue(a) && isNumericPipelineValue(b) && (isVector(a) || isVector(b))) {
      const first = isVector(a) ? a : [a]; const second = isVector(b) ? b : [b]
      output.set('value-out', vectorArithmetic(first, second, node.kind, diagnostics)); return output
    }
    const scalarA = typeof a === 'number' ? a : 0; const scalarB = typeof b === 'number' ? b : 0
    if (node.kind === 'divide' && scalarB === 0) { diagnostics.push('DIVISION_BY_ZERO'); output.set('value-out', 0); return output }
    output.set('value-out', node.kind === 'add' ? scalarA + scalarB : node.kind === 'subtract' ? scalarA - scalarB : node.kind === 'multiply' ? scalarA * scalarB : scalarA / scalarB); return output
  }
  const input = surfaceInput('surface-in', incoming)
  if (node.kind === 'invert') { output.set('surface-out', input ? invert(input, String(parameter(node, 'channels', incoming)?.value ?? 'RGB')) : transparent()); return output }
  if (node.kind === 'select') { output.set('mask-out', input ? selectMask(input, node, incoming) : transparent()); return output }
  if (node.kind === 'replace') {
    const first = surfaceInput('surface-a', incoming); const second = surfaceInput('surface-b', incoming)
    output.set('surface-out', first && second ? replaceSurface(first, second, node, incoming) : transparent(first?.width ?? 1, first?.height ?? 1)); return output
  }
  if (node.kind === 'outline') {
    output.set('surface-out', input ? cloneSurface(input) : transparent()); output.set('outline-out', input ? outline(input, node, incoming) : transparent()); return output
  }
  if (node.kind === 'movement') {
    const offset = incoming?.get('offset-in'); const offsetX = Array.isArray(offset) ? Number(offset[0] ?? 0) : numberParameter(node, 'x', 0, incoming); const offsetY = Array.isArray(offset) ? Number(offset[1] ?? 0) : numberParameter(node, 'y', 0, incoming)
    output.set('surface-out', input ? translate(input, offsetX, offsetY, String(parameter(node, 'wrap', incoming)?.value ?? 'Transparent') === 'Wrap') : transparent()); return output
  }
  if (node.kind === 'preview') { output.set('surface-out', input ? cloneSurface(input) : transparent()); return output }
  if (node.kind === 'resize') { output.set('surface-out', resize(input ?? transparent(numberParameter(node, 'width', 1, incoming), numberParameter(node, 'height', 1, incoming)), numberParameter(node, 'width', 1, incoming), numberParameter(node, 'height', 1, incoming))); return output }
  if (node.kind === 'flip') { output.set('surface-out', flip(input ?? transparent(), String(parameter(node, 'axis', incoming)?.value ?? 'Horizontal'))); return output }
  if (node.kind === 'color') {
    const color = colorParameter(node, incoming)
    output.set('surface-out', input ? tint(input, color) : solid(color, numberParameter(node, 'width', 64, incoming), numberParameter(node, 'height', 64, incoming))); return output
  }
  if (node.kind === 'gradient') {
    output.set('surface-out', gradient(parseColor(parameter(node, 'from', incoming)?.value, [0, 0, 0, 255]), parseColor(parameter(node, 'to', incoming)?.value, [255, 255, 255, 255]), String(parameter(node, 'direction', incoming)?.value ?? 'Horizontal'), numberParameter(node, 'width', 64, incoming), numberParameter(node, 'height', 64, incoming))); return output
  }
  if (node.kind === 'blend') {
    const first = surfaceInput('surface-a', incoming); const second = surfaceInput('surface-b', incoming)
    output.set('surface-out', first && second ? blend(first, second, String(parameter(node, 'mode', incoming)?.value ?? 'Screen')) : transparent(first?.width ?? second?.width ?? 1, first?.height ?? second?.height ?? 1)); return output
  }
  if (node.kind === 'rotation') {
    const angle = numberParameter(node, 'angle', 0, incoming)
    if (angle < 0 || angle > 359.99) { diagnostics.push('PARAMETER_OUT_OF_RANGE'); output.set('surface-out', transparent()); return output }
    output.set('surface-out', rotate(input ?? transparent(), angle, String(parameter(node, 'direction', incoming)?.value ?? 'Clockwise'), String(parameter(node, 'anchor', incoming)?.value ?? 'Center'), numberParameter(node, 'offsetX', 0, incoming), numberParameter(node, 'offsetY', 0, incoming))); return output
  }
  if (node.kind === 'zoom') {
    const scale = numberParameter(node, 'scale', 1, incoming)
    if (scale < 0.05 || scale > 8) { diagnostics.push('PARAMETER_OUT_OF_RANGE'); output.set('surface-out', transparent()); return output }
    output.set('surface-out', zoom(input ?? transparent(), scale)); return output
  }
  if (['atlas', 'corner-warp', 'crop', 'deform', 'displace', 'lattice-warp', 'mirror', 'move', 'move-to', 'nine-slice', 'padding', 'pivot', 'polar-distance', 'repeat', 'scale', 'skew', 'tile', 'transform', 'alpha-cut', 'blur', 'blur-directional', 'blur-gaussian', 'brightness-contrast', 'color-adjust', 'color-replace', 'colorize', 'dither', 'dither-bayer', 'dither-cluster', 'edge-detect', 'glow', 'hue-saturation-value', 'level', 'palette-apply', 'match-palette', 'pixelate', 'posterize', 'shadow', 'shading', 'sharpen', 'threshold', 'alpha-to-color', 'clean-edge', 'half-tone', 'mask', 'mix', 'remap', 'stack', 'isolate-color', 'frame-blend', 'frame-bypass', 'resource-loader', 'region-system', 'uv-workflow', 'condition', 'delay', 'feedback', 'iteration', 'loop', 'loop-start', 'loop-end', 'script', 'bloom', 'godray', 'mk-godray', 'particle', 'particle-spawn', 'pixel-cloud', 'trail', 'vfx'].includes(node.kind)) {
    const advancedInput = surfaceInput('surface-in', incoming) ?? surfaceInput('surface-a', incoming); const advancedSecond = surfaceInput('surface-b', incoming); output.set('surface-out', advancedSurfaceResult(node, advancedInput, advancedSecond, incoming, diagnostics, currentTimeMs)); return output
  }
  diagnostics.push('NODE_KIND_UNSUPPORTED'); output.set('surface-out', transparent()); return output
}

export function evaluatePipeline(graph: DemoGraph, assets: ReadonlyMap<string, PipelineAssetSource>, currentTimeMs = 0, _context: PipelineEvaluationContext = {}): PipelineEvaluation {
  const diagnostics: string[] = []; const states = new Map<string, 0 | 1 | 2>(); const outputs = new Map<string, ReadonlyMap<string, PipelineValue>>(); const values = new Map<string, number>(); const vectors = new Map<string, readonly number[]>(); const nodes = new Map(graph.nodes.map((node) => [node.id, node] as const))
  const visit = (nodeId: string): boolean => {
    const state = states.get(nodeId); if (state === 1) { diagnostics.push('GRAPH_CYCLE'); return false }; if (state === 2) return true
    const node = nodes.get(nodeId); if (!node) { diagnostics.push('NODE_NOT_FOUND'); return false }
    states.set(nodeId, 1); let valid = true; const incoming = new Map<string, PipelineValue>()
    for (const edge of graph.edges.filter((candidate) => candidate.targetNodeId === nodeId)) {
      if (!visit(edge.sourceNodeId)) valid = false
      const source = outputs.get(edge.sourceNodeId)?.get(edge.sourcePortId); if (source !== undefined) incoming.set(normalizeRuntimeTargetPort(node, edge.targetPortId), source)
    }
    const result = valid ? nodeOutput(node, incoming, assets, diagnostics, currentTimeMs) : new Map<string, PipelineValue>(node.outputs.map((port) => [port.id, defaultValue(port.type)] as const))
    outputs.set(nodeId, result); const value = result.get('value-out'); if (typeof value === 'number') values.set(nodeId, value); if (Array.isArray(value)) vectors.set(nodeId, value); states.set(nodeId, 2); return valid
  }
  for (const node of graph.nodes) visit(node.id)
  const previewNode = [...graph.nodes].reverse().find((node) => node.kind === 'preview'); const previewValue = previewNode ? outputs.get(previewNode.id)?.get('surface-out') : undefined
  return { outputs, values, vectors, preview: isSurface(previewValue) ? previewValue : transparent(), diagnostics: [...new Set(diagnostics)] }
}

export function surfaceHash(surface: PipelineSurface): string {
  let hash = 2166136261; for (const value of surface.pixels) { hash ^= value; hash = Math.imul(hash, 16777619) }
  hash ^= surface.width; hash = Math.imul(hash, 16777619); hash ^= surface.height; hash = Math.imul(hash, 16777619); return (hash >>> 0).toString(16).padStart(8, '0')
}

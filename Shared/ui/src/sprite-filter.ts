import { setPixels, type GridCoordinate, type RgbaColor, type SpriteDocument } from '@mosaico/domain'

export type SpriteFilter = (bytes: Uint8ClampedArray, width: number, height: number) => void

const clampByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)))

export const invertFilter: SpriteFilter = (bytes) => {
  for (let offset = 0; offset < bytes.length; offset += 4) {
    bytes[offset] = 255 - bytes[offset]!
    bytes[offset + 1] = 255 - bytes[offset + 1]!
    bytes[offset + 2] = 255 - bytes[offset + 2]!
  }
}

export const grayscaleFilter: SpriteFilter = (bytes) => {
  for (let offset = 0; offset < bytes.length; offset += 4) {
    const luminance = clampByte((bytes[offset]! * 299 + bytes[offset + 1]! * 587 + bytes[offset + 2]! * 114) / 1000)
    bytes[offset] = luminance; bytes[offset + 1] = luminance; bytes[offset + 2] = luminance
  }
}

export const sepiaFilter: SpriteFilter = (bytes) => {
  for (let offset = 0; offset < bytes.length; offset += 4) {
    const r = bytes[offset]!; const g = bytes[offset + 1]!; const b = bytes[offset + 2]!
    bytes[offset] = clampByte(r * 0.393 + g * 0.769 + b * 0.189)
    bytes[offset + 1] = clampByte(r * 0.349 + g * 0.686 + b * 0.168)
    bytes[offset + 2] = clampByte(r * 0.272 + g * 0.534 + b * 0.131)
  }
}

export function createBrightnessFilter(amount: number): SpriteFilter {
  const shift = Number.isFinite(amount) ? Math.max(-255, Math.min(255, Math.trunc(amount))) : 0
  return (bytes) => { for (let offset = 0; offset < bytes.length; offset += 4) { bytes[offset] = clampByte(bytes[offset]! + shift); bytes[offset + 1] = clampByte(bytes[offset + 1]! + shift); bytes[offset + 2] = clampByte(bytes[offset + 2]! + shift) } }
}

export function createContrastFilter(percent: number): SpriteFilter {
  const factor = Number.isFinite(percent) ? Math.max(-99, Math.min(100, Math.trunc(percent))) / 100 : 0
  return (bytes) => { for (let offset = 0; offset < bytes.length; offset += 4) { bytes[offset] = clampByte((bytes[offset]! - 128) * (1 + factor) + 128); bytes[offset + 1] = clampByte((bytes[offset + 1]! - 128) * (1 + factor) + 128); bytes[offset + 2] = clampByte((bytes[offset + 2]! - 128) * (1 + factor) + 128) } }
}

export function createOutlineFilter(color: RgbaColor): SpriteFilter {
  return (bytes, width, height) => {
    const source = new Uint8ClampedArray(bytes)
    const alphaAt = (x: number, y: number): number => source[(y * width + x) * 4 + 3] ?? 0
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      if (source[offset + 3] !== 0) continue
      const touches = (x > 0 && alphaAt(x - 1, y) > 0) || (x + 1 < width && alphaAt(x + 1, y) > 0) || (y > 0 && alphaAt(x, y - 1) > 0) || (y + 1 < height && alphaAt(x, y + 1) > 0)
      if (!touches) continue
      bytes[offset] = color.r; bytes[offset + 1] = color.g; bytes[offset + 2] = color.b; bytes[offset + 3] = color.a
    }
  }
}

export interface SpriteFilterScope {
  readonly points?: readonly GridCoordinate[]
}

export function applySpriteFilter(document: SpriteDocument, filter: SpriteFilter, scope?: SpriteFilterScope): { next: SpriteDocument; changed: number } {
  const layer = document.layers.find((item) => item.id === document.activeLayerId)
  const cel = layer && !layer.isFolder ? layer.cels.get(document.activeFrameId) : undefined
  if (!layer || !cel || layer.isFolder) return { next: document, changed: 0 }
  const original = cel.pixels.toUint8Array()
  const transformed = new Uint8ClampedArray(original)
  filter(transformed, document.width, document.height)
  const allowed = scope?.points ? new Set(scope.points.map((point) => point.y * document.width + point.x)) : undefined
  const colors = new Map<string, { color: RgbaColor; points: GridCoordinate[] }>()
  let changed = 0
  for (let index = 0; index < original.length; index += 4) {
    if (allowed && !allowed.has(index / 4)) continue
    if (original[index] === transformed[index] && original[index + 1] === transformed[index + 1] && original[index + 2] === transformed[index + 2] && original[index + 3] === transformed[index + 3]) continue
    const point = { x: (index / 4) % document.width, y: Math.floor(index / 4 / document.width) }
    const color = { r: transformed[index]!, g: transformed[index + 1]!, b: transformed[index + 2]!, a: transformed[index + 3]! }
    const id = `${color.r},${color.g},${color.b},${color.a}`
    const group = colors.get(id) ?? { color, points: [] }
    group.points.push(point); colors.set(id, group)
    changed += 1
  }
  if (!changed) return { next: document, changed: 0 }
  let next = document
  for (const { color, points } of colors.values()) next = setPixels(next, document.activeLayerId, document.activeFrameId, points, color)
  return { next, changed }
}

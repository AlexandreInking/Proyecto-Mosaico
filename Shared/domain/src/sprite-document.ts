import type { GridCoordinate } from './map-document.js'

export const MAXIMUM_SPRITE_LAYERS = 128

export interface RgbaColor {
  readonly r: number
  readonly g: number
  readonly b: number
  readonly a: number
}

export interface SpriteFrame {
  readonly id: string
  readonly durationMs: number
}

export class PixelBuffer {
  readonly #bytes: Uint8ClampedArray

  constructor(byteLengthOrBytes: number | Uint8ClampedArray) {
    this.#bytes = typeof byteLengthOrBytes === 'number'
      ? new Uint8ClampedArray(byteLengthOrBytes)
      : new Uint8ClampedArray(byteLengthOrBytes)
  }

  get byteLength(): number { return this.#bytes.byteLength }

  read(offset: number): RgbaColor { return readColor(this.#bytes, offset) }

  copyWith(offset: number, color: RgbaColor): PixelBuffer {
    const bytes = new Uint8ClampedArray(this.#bytes)
    writeColor(bytes, offset, color)
    return new PixelBuffer(bytes)
  }

  mutableCopy(): Uint8ClampedArray { return new Uint8ClampedArray(this.#bytes) }

  toUint8Array(): Uint8Array { return new Uint8Array(this.#bytes) }
}

export interface SpriteCel {
  readonly frameId: string
  readonly pixels: PixelBuffer
}

export interface SpriteLayer {
  readonly id: string
  readonly name: string
  readonly kind: 'raster'
  readonly visible: boolean
  readonly locked: boolean
  readonly opacity: number
  readonly cels: ReadonlyMap<string, SpriteCel>
}

export interface SpriteDocument {
  readonly format: 'mosaico-sprite'
  readonly formatVersion: 1
  readonly id: string
  readonly revision: number
  readonly name: string
  readonly width: number
  readonly height: number
  readonly colorMode: 'rgba'
  readonly activeLayerId: string
  readonly activeFrameId: string
  readonly frames: readonly SpriteFrame[]
  readonly layers: readonly SpriteLayer[]
  readonly palette: readonly string[]
}

export interface CreateSpriteDocumentInput {
  readonly id: string
  readonly name: string
  readonly width: number
  readonly height: number
  readonly layerId: string
  readonly frameId: string
}

const transparent: RgbaColor = { r: 0, g: 0, b: 0, a: 0 }

function assertCoordinate(document: SpriteDocument, coordinate: GridCoordinate): void {
  if (!Number.isInteger(coordinate.x) || !Number.isInteger(coordinate.y)
    || coordinate.x < 0 || coordinate.y < 0
    || coordinate.x >= document.width || coordinate.y >= document.height) {
    throw new RangeError('SPRITE_COORDINATE_OUT_OF_BOUNDS')
  }
}

function assertColor(color: RgbaColor): void {
  for (const channel of [color.r, color.g, color.b, color.a]) {
    if (!Number.isInteger(channel) || channel < 0 || channel > 255) throw new RangeError('SPRITE_COLOR_INVALID')
  }
}

function requireLayer(document: SpriteDocument, layerId: string): SpriteLayer {
  const layer = document.layers.find((candidate) => candidate.id === layerId)
  if (!layer) throw new Error('SPRITE_LAYER_NOT_FOUND')
  return layer
}

function requireEditableLayer(document: SpriteDocument, layerId: string): SpriteLayer {
  const layer = requireLayer(document, layerId)
  if (layer.locked) throw new Error('SPRITE_LAYER_LOCKED')
  return layer
}

function requireCel(layer: SpriteLayer, frameId: string): SpriteCel {
  const cel = layer.cels.get(frameId)
  if (!cel) throw new Error('SPRITE_CEL_NOT_FOUND')
  return cel
}

function pixelOffset(document: SpriteDocument, coordinate: GridCoordinate): number {
  return (coordinate.y * document.width + coordinate.x) * 4
}

function readColor(pixels: Uint8ClampedArray, offset: number): RgbaColor {
  return {
    r: pixels[offset] ?? 0,
    g: pixels[offset + 1] ?? 0,
    b: pixels[offset + 2] ?? 0,
    a: pixels[offset + 3] ?? 0,
  }
}

function colorsEqual(left: RgbaColor, right: RgbaColor): boolean {
  return left.r === right.r && left.g === right.g && left.b === right.b && left.a === right.a
}

function writeColor(pixels: Uint8ClampedArray, offset: number, color: RgbaColor): void {
  pixels[offset] = color.r
  pixels[offset + 1] = color.g
  pixels[offset + 2] = color.b
  pixels[offset + 3] = color.a
}

function replaceCel(document: SpriteDocument, layer: SpriteLayer, frameId: string, pixels: PixelBuffer): SpriteDocument {
  const cels = new Map(layer.cels)
  cels.set(frameId, { frameId, pixels })
  const nextLayer = { ...layer, cels }
  return {
    ...document,
    revision: document.revision + 1,
    layers: document.layers.map((candidate) => candidate.id === layer.id ? nextLayer : candidate),
  }
}

export function createSpriteDocument(input: CreateSpriteDocumentInput): SpriteDocument {
  if (!input.id || !input.layerId || !input.frameId || !input.name.trim()) throw new Error('SPRITE_REQUIRED_FIELD')
  for (const value of [input.width, input.height]) {
    if (!Number.isInteger(value) || value < 1 || value > 4096) throw new RangeError('SPRITE_DIMENSION_OUT_OF_BOUNDS')
  }
  if (new Set([input.id, input.layerId, input.frameId]).size !== 3) throw new Error('SPRITE_DUPLICATE_ID')
  const pixels = new PixelBuffer(input.width * input.height * 4)
  return {
    format: 'mosaico-sprite',
    formatVersion: 1,
    id: input.id,
    revision: 0,
    name: input.name.trim(),
    width: input.width,
    height: input.height,
    colorMode: 'rgba',
    activeLayerId: input.layerId,
    activeFrameId: input.frameId,
    frames: [{ id: input.frameId, durationMs: 100 }],
    layers: [{
      id: input.layerId,
      name: 'Capa 1',
      kind: 'raster',
      visible: true,
      locked: false,
      opacity: 1,
      cels: new Map([[input.frameId, { frameId: input.frameId, pixels }]]),
    }],
    palette: ['#00000000', '#ffffffff'],
  }
}

export function getPixel(document: SpriteDocument, layerId: string, frameId: string, coordinate: GridCoordinate): RgbaColor {
  assertCoordinate(document, coordinate)
  const cel = requireCel(requireLayer(document, layerId), frameId)
  return cel.pixels.read(pixelOffset(document, coordinate))
}

export function setPixel(
  document: SpriteDocument,
  layerId: string,
  frameId: string,
  coordinate: GridCoordinate,
  color: RgbaColor,
): SpriteDocument {
  assertCoordinate(document, coordinate)
  assertColor(color)
  const layer = requireEditableLayer(document, layerId)
  const cel = requireCel(layer, frameId)
  const offset = pixelOffset(document, coordinate)
  if (colorsEqual(cel.pixels.read(offset), color)) return document
  const pixels = cel.pixels.copyWith(offset, color)
  return replaceCel(document, layer, frameId, pixels)
}

export function erasePixel(
  document: SpriteDocument,
  layerId: string,
  frameId: string,
  coordinate: GridCoordinate,
): SpriteDocument {
  return setPixel(document, layerId, frameId, coordinate, transparent)
}

export function fillPixels(
  document: SpriteDocument,
  layerId: string,
  frameId: string,
  origin: GridCoordinate,
  replacement: RgbaColor,
): SpriteDocument {
  assertCoordinate(document, origin)
  assertColor(replacement)
  const layer = requireEditableLayer(document, layerId)
  const cel = requireCel(layer, frameId)
  const target = cel.pixels.read(pixelOffset(document, origin))
  if (colorsEqual(target, replacement)) return document

  const pixels = cel.pixels.mutableCopy()
  const queue: GridCoordinate[] = [origin]
  const visited = new Uint8Array(document.width * document.height)
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const coordinate = queue[cursor]
    if (!coordinate) continue
    const index = coordinate.y * document.width + coordinate.x
    if (visited[index]) continue
    visited[index] = 1
    const offset = index * 4
    if (!colorsEqual(readColor(pixels, offset), target)) continue
    writeColor(pixels, offset, replacement)
    if (coordinate.x > 0) queue.push({ x: coordinate.x - 1, y: coordinate.y })
    if (coordinate.x + 1 < document.width) queue.push({ x: coordinate.x + 1, y: coordinate.y })
    if (coordinate.y > 0) queue.push({ x: coordinate.x, y: coordinate.y - 1 })
    if (coordinate.y + 1 < document.height) queue.push({ x: coordinate.x, y: coordinate.y + 1 })
  }
  return replaceCel(document, layer, frameId, new PixelBuffer(pixels))
}

export function addSpriteLayer(document: SpriteDocument, input: { readonly id: string; readonly name: string }): SpriteDocument {
  if (document.layers.length >= MAXIMUM_SPRITE_LAYERS) throw new RangeError('SPRITE_LAYER_LIMIT')
  if (!input.id || !input.name.trim()) throw new Error('SPRITE_REQUIRED_FIELD')
  if (document.layers.some((layer) => layer.id === input.id)
    || document.frames.some((frame) => frame.id === input.id)) throw new Error('SPRITE_DUPLICATE_ID')
  const byteLength = document.width * document.height * 4
  const cels = new Map(document.frames.map((frame) => [frame.id, {
    frameId: frame.id,
    pixels: new PixelBuffer(byteLength),
  }]))
  const layer: SpriteLayer = {
    id: input.id,
    name: input.name.trim(),
    kind: 'raster',
    visible: true,
    locked: false,
    opacity: 1,
    cels,
  }
  return { ...document, revision: document.revision + 1, activeLayerId: layer.id, layers: [...document.layers, layer] }
}

export function removeSpriteLayer(document: SpriteDocument, layerId: string): SpriteDocument {
  requireLayer(document, layerId)
  if (document.layers.length === 1) throw new Error('SPRITE_REQUIRES_LAYER')
  const layers = document.layers.filter((layer) => layer.id !== layerId)
  return {
    ...document,
    revision: document.revision + 1,
    activeLayerId: document.activeLayerId === layerId ? layers[0]!.id : document.activeLayerId,
    layers,
  }
}

export function selectSpriteLayer(document: SpriteDocument, layerId: string): SpriteDocument {
  requireLayer(document, layerId)
  return document.activeLayerId === layerId ? document : { ...document, revision: document.revision + 1, activeLayerId: layerId }
}

export function updateSpriteLayer(
  document: SpriteDocument,
  layerId: string,
  patch: Partial<Pick<SpriteLayer, 'name' | 'visible' | 'locked' | 'opacity'>>,
): SpriteDocument {
  const layer = requireLayer(document, layerId)
  const name = patch.name === undefined ? layer.name : patch.name.trim()
  const opacity = patch.opacity ?? layer.opacity
  if (!name) throw new Error('SPRITE_REQUIRED_FIELD')
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw new RangeError('SPRITE_OPACITY_INVALID')
  const updated = { ...layer, ...patch, name, opacity }
  return { ...document, revision: document.revision + 1, layers: document.layers.map((item) => item.id === layerId ? updated : item) }
}

function updateHash(hash: bigint, value: number): bigint {
  return BigInt.asUintN(64, (hash ^ BigInt(value)) * 0x100000001b3n)
}

function updateHashText(hash: bigint, value: string): bigint {
  let current = hash
  for (let index = 0; index < value.length; index += 1) current = updateHash(current, value.charCodeAt(index))
  return current
}

export function spriteSemanticFingerprint(document: SpriteDocument): string {
  let hash = updateHashText(0xcbf29ce484222325n,
    `${document.format}|${document.formatVersion}|${document.id}|${document.name}|${document.width}|${document.height}|${document.colorMode}|${document.activeLayerId}|${document.activeFrameId}`)
  for (const frame of document.frames) hash = updateHashText(hash, `F|${frame.id}|${frame.durationMs}`)
  for (const layer of document.layers) {
    hash = updateHashText(hash, `L|${layer.id}|${layer.name}|${layer.visible}|${layer.locked}|${layer.opacity}`)
    for (const frame of document.frames) {
      const cel = layer.cels.get(frame.id)
      if (!cel) continue
      hash = updateHashText(hash, `C|${frame.id}|`)
      for (const byte of cel.pixels.toUint8Array()) hash = updateHash(hash, byte)
    }
  }
  for (const color of document.palette) hash = updateHashText(hash, `P|${color}`)
  return hash.toString(16).padStart(16, '0')
}

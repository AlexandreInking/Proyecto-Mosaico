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

export interface SpriteRegion { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

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

function requireFrame(document: SpriteDocument, frameId: string): SpriteFrame {
  const frame = document.frames.find((candidate) => candidate.id === frameId)
  if (!frame) throw new Error('SPRITE_FRAME_NOT_FOUND')
  return frame
}

function requireEditableLayer(document: SpriteDocument, layerId: string): SpriteLayer {
  const layer = requireLayer(document, layerId)
  if (!layer.visible) throw new Error('SPRITE_LAYER_HIDDEN')
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

export function setPixels(
  document: SpriteDocument,
  layerId: string,
  frameId: string,
  coordinates: readonly GridCoordinate[],
  color: RgbaColor,
): SpriteDocument {
  assertColor(color)
  const layer = requireEditableLayer(document, layerId)
  const cel = requireCel(layer, frameId)
  const pixels = cel.pixels.mutableCopy()
  let changed = false
  for (const coordinate of coordinates) {
    assertCoordinate(document, coordinate)
    const offset = pixelOffset(document, coordinate)
    if (colorsEqual(readColor(pixels, offset), color)) continue
    writeColor(pixels, offset, color); changed = true
  }
  return changed ? replaceCel(document, layer, frameId, new PixelBuffer(pixels)) : document
}

function requireRegion(document: SpriteDocument, region: SpriteRegion): void {
  if (![region.x, region.y, region.width, region.height].every(Number.isInteger) || region.width < 1 || region.height < 1
    || region.x < 0 || region.y < 0 || region.x + region.width > document.width || region.y + region.height > document.height) {
    throw new RangeError('SPRITE_REGION_OUT_OF_BOUNDS')
  }
}

export function moveSpriteRegion(document: SpriteDocument, layerId: string, frameId: string, region: SpriteRegion, dx: number, dy: number): SpriteDocument {
  requireRegion(document, region)
  if (!Number.isInteger(dx) || !Number.isInteger(dy)) throw new RangeError('SPRITE_OFFSET_INVALID')
  if (dx === 0 && dy === 0) return document
  const layer = requireEditableLayer(document, layerId); const cel = requireCel(layer, frameId)
  const pixels = cel.pixels.mutableCopy(); const captured: RgbaColor[] = []
  for (let y = 0; y < region.height; y += 1) for (let x = 0; x < region.width; x += 1) {
    captured.push(readColor(pixels, pixelOffset(document, { x: region.x + x, y: region.y + y })))
    writeColor(pixels, pixelOffset(document, { x: region.x + x, y: region.y + y }), transparent)
  }
  for (let y = 0; y < region.height; y += 1) for (let x = 0; x < region.width; x += 1) {
    const target = { x: region.x + x + dx, y: region.y + y + dy }
    if (target.x >= 0 && target.y >= 0 && target.x < document.width && target.y < document.height) writeColor(pixels, pixelOffset(document, target), captured[y * region.width + x]!)
  }
  return replaceCel(document, layer, frameId, new PixelBuffer(pixels))
}

export function moveSpritePixels(document: SpriteDocument, layerId: string, frameId: string, selectedIndexes: readonly number[], dx: number, dy: number): SpriteDocument {
  if (!Number.isInteger(dx) || !Number.isInteger(dy)) throw new RangeError('SPRITE_OFFSET_INVALID')
  if (dx === 0 && dy === 0) return document
  const layer = requireEditableLayer(document, layerId); const cel = requireCel(layer, frameId); const pixels = cel.pixels.mutableCopy()
  const captured = selectedIndexes.map((index) => {
    if (!Number.isInteger(index) || index < 0 || index >= document.width * document.height) throw new RangeError('SPRITE_SELECTION_INVALID')
    const coordinate = { x: index % document.width, y: Math.floor(index / document.width) }
    return { coordinate, color: readColor(pixels, pixelOffset(document, coordinate)) }
  })
  for (const { coordinate, color } of captured) if (color.a) writeColor(pixels, pixelOffset(document, coordinate), transparent)
  for (const { coordinate, color } of captured) {
    const target = { x: coordinate.x + dx, y: coordinate.y + dy }
    if (color.a && target.x >= 0 && target.y >= 0 && target.x < document.width && target.y < document.height) writeColor(pixels, pixelOffset(document, target), color)
  }
  return replaceCel(document, layer, frameId, new PixelBuffer(pixels))
}

export function flipSpriteRegion(document: SpriteDocument, layerId: string, frameId: string, region: SpriteRegion, axis: 'horizontal' | 'vertical'): SpriteDocument {
  requireRegion(document, region)
  const layer = requireEditableLayer(document, layerId); const cel = requireCel(layer, frameId); const pixels = cel.pixels.mutableCopy()
  const source = cel.pixels.mutableCopy()
  for (let y = 0; y < region.height; y += 1) for (let x = 0; x < region.width; x += 1) {
    const from = { x: region.x + (axis === 'horizontal' ? region.width - 1 - x : x), y: region.y + (axis === 'vertical' ? region.height - 1 - y : y) }
    writeColor(pixels, pixelOffset(document, { x: region.x + x, y: region.y + y }), readColor(source, pixelOffset(document, from)))
  }
  return replaceCel(document, layer, frameId, new PixelBuffer(pixels))
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

export function addSpriteFrame(document: SpriteDocument, input: { readonly id: string; readonly duplicateFromFrameId?: string }): SpriteDocument {
  if (!input.id) throw new Error('SPRITE_REQUIRED_FIELD')
  if (document.frames.some((frame) => frame.id === input.id) || document.layers.some((layer) => layer.id === input.id)) throw new Error('SPRITE_DUPLICATE_ID')
  const source = input.duplicateFromFrameId ? requireFrame(document, input.duplicateFromFrameId) : undefined
  const byteLength = document.width * document.height * 4
  const layers = document.layers.map((layer) => {
    const cels = new Map(layer.cels)
    const sourcePixels = source ? requireCel(layer, source.id).pixels.mutableCopy() : byteLength
    cels.set(input.id, { frameId: input.id, pixels: new PixelBuffer(sourcePixels) })
    return { ...layer, cels }
  })
  const frame: SpriteFrame = { id: input.id, durationMs: source?.durationMs ?? 100 }
  return { ...document, revision: document.revision + 1, activeFrameId: frame.id, frames: [...document.frames, frame], layers }
}

export function removeSpriteFrame(document: SpriteDocument, frameId: string): SpriteDocument {
  requireFrame(document, frameId)
  if (document.frames.length === 1) throw new Error('SPRITE_REQUIRES_FRAME')
  const frames = document.frames.filter((frame) => frame.id !== frameId)
  const layers = document.layers.map((layer) => { const cels = new Map(layer.cels); cels.delete(frameId); return { ...layer, cels } })
  return { ...document, revision: document.revision + 1, activeFrameId: document.activeFrameId === frameId ? frames[0]!.id : document.activeFrameId, frames, layers }
}

export function selectSpriteFrame(document: SpriteDocument, frameId: string): SpriteDocument {
  requireFrame(document, frameId)
  return document.activeFrameId === frameId ? document : { ...document, revision: document.revision + 1, activeFrameId: frameId }
}

export function updateSpriteFrame(document: SpriteDocument, frameId: string, patch: { readonly durationMs: number }): SpriteDocument {
  requireFrame(document, frameId)
  if (!Number.isInteger(patch.durationMs) || patch.durationMs < 10 || patch.durationMs > 60_000) throw new RangeError('SPRITE_FRAME_DURATION_INVALID')
  return { ...document, revision: document.revision + 1, frames: document.frames.map((frame) => frame.id === frameId ? { ...frame, durationMs: patch.durationMs } : frame) }
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

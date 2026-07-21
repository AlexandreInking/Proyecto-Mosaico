import {
  legacyMapManifestSchema,
  mapDocumentSchema,
  spriteDocumentSchema,
  type LegacyMapManifestContract,
  type MapDocumentContract,
  type SpriteDocumentContract,
} from '@mosaico/contracts'
import type { MapDocument, MapLayer } from './map-document.js'
import { PixelBuffer, type SpriteDocument, type SpriteLayer } from './sprite-document.js'

export const MAXIMUM_AUTHORING_JSON_CHARACTERS = 64 * 1024 * 1024
const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function parseJson(text: string): unknown {
  if (typeof text !== 'string' || text.length > MAXIMUM_AUTHORING_JSON_CHARACTERS) throw new Error('AUTHORING_FORMAT_INVALID')
  try { return JSON.parse(text) as unknown } catch { throw new Error('AUTHORING_FORMAT_INVALID') }
}

function invalidFormat(): never { throw new Error('AUTHORING_FORMAT_INVALID') }

function encodeBase64(bytes: Uint8Array): string {
  let result = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0
    const second = bytes[index + 1] ?? 0
    const third = bytes[index + 2] ?? 0
    const combined = (first << 16) | (second << 8) | third
    result += base64Alphabet[(combined >>> 18) & 63]
    result += base64Alphabet[(combined >>> 12) & 63]
    result += index + 1 < bytes.length ? base64Alphabet[(combined >>> 6) & 63] : '='
    result += index + 2 < bytes.length ? base64Alphabet[combined & 63] : '='
  }
  return result
}

function decodeBase64(value: string): Uint8Array {
  if (value.length === 0) return new Uint8Array()
  const bytes: number[] = []
  for (let index = 0; index < value.length; index += 4) {
    const a = base64Alphabet.indexOf(value[index]!)
    const b = base64Alphabet.indexOf(value[index + 1]!)
    const c = value[index + 2] === '=' ? 0 : base64Alphabet.indexOf(value[index + 2]!)
    const d = value[index + 3] === '=' ? 0 : base64Alphabet.indexOf(value[index + 3]!)
    const combined = (a << 18) | (b << 12) | (c << 6) | d
    bytes.push((combined >>> 16) & 255)
    if (value[index + 2] !== '=') bytes.push((combined >>> 8) & 255)
    if (value[index + 3] !== '=') bytes.push(combined & 255)
  }
  return new Uint8Array(bytes)
}

function mapToContract(document: MapDocument): MapDocumentContract {
  return {
    ...document,
    tilesets: document.tilesets.map((tileset) => ({ ...tileset })),
    layers: document.layers.map((layer) => ({
      ...layer,
      cells: [...layer.cells.entries()].map(([key, tile]) => {
        const [x, y] = key.split(',').map(Number)
        return { x: x!, y: y!, ...tile }
      }).sort((left, right) => left.y - right.y || left.x - right.x),
    })),
  }
}

function mapFromContract(contract: MapDocumentContract): MapDocument {
  const layers: MapLayer[] = contract.layers.map((layer) => ({
    ...layer,
    cells: new Map(layer.cells.map(({ x, y, tilesetId, tileId }) => [`${x},${y}`, { tilesetId, tileId }])),
  }))
  return { ...contract, tilesets: contract.tilesets.map((tileset) => ({ ...tileset })), layers }
}

function spriteToContract(document: SpriteDocument): SpriteDocumentContract {
  return {
    ...document,
    frames: document.frames.map((frame) => ({ ...frame })),
    layers: document.layers.map((layer) => ({
      ...layer,
      cels: document.frames.flatMap((frame) => {
        const cel = layer.cels.get(frame.id)
        return cel ? [{ frameId: frame.id, rgbaBase64: encodeBase64(cel.pixels.toUint8Array()) }] : []
      }),
    })),
    palette: [...document.palette],
  }
}

function spriteFromContract(contract: SpriteDocumentContract): SpriteDocument {
  const expectedByteLength = contract.width * contract.height * 4
  const layers: SpriteLayer[] = contract.layers.map((layer) => ({
    ...layer,
    cels: new Map(layer.cels.map((cel) => {
      const bytes = decodeBase64(cel.rgbaBase64)
      if (bytes.byteLength !== expectedByteLength) invalidFormat()
      return [cel.frameId, { frameId: cel.frameId, pixels: new PixelBuffer(new Uint8ClampedArray(bytes)) }]
    })),
  }))
  return { ...contract, frames: contract.frames.map((frame) => ({ ...frame })), layers, palette: [...contract.palette] }
}

export function serializeMapDocument(document: MapDocument): string {
  const parsed = mapDocumentSchema.safeParse(mapToContract(document))
  if (!parsed.success) return invalidFormat()
  return `${JSON.stringify(parsed.data, null, 2)}\n`
}

export function deserializeMapDocument(text: string): MapDocument {
  const input = parseJson(text)
  const parsed = mapDocumentSchema.safeParse(input)
  if (parsed.success) return mapFromContract(parsed.data)
  const legacy = legacyMapManifestSchema.safeParse(input)
  if (legacy.success) return migrateLegacyContract(legacy.data)
  return invalidFormat()
}

export function serializeSpriteDocument(document: SpriteDocument): string {
  const parsed = spriteDocumentSchema.safeParse(spriteToContract(document))
  if (!parsed.success) return invalidFormat()
  return `${JSON.stringify(parsed.data, null, 2)}\n`
}

export function deserializeSpriteDocument(text: string): SpriteDocument {
  const parsed = spriteDocumentSchema.safeParse(parseJson(text))
  if (!parsed.success) return invalidFormat()
  try { return spriteFromContract(parsed.data) } catch { return invalidFormat() }
}

function tileCount(tileset: LegacyMapManifestContract['tilesets'][number]): number {
  const columns = Math.max(0, Math.floor((tileset.imageWidth - 2 * tileset.marginX + tileset.spacingX) / (tileset.tileWidth + tileset.spacingX)))
  const rows = Math.max(0, Math.floor((tileset.imageHeight - 2 * tileset.marginY + tileset.spacingY) / (tileset.tileHeight + tileset.spacingY)))
  const count = columns * rows
  if (count < 1 || count > 1_000_000) return invalidFormat()
  return count
}

function migrateLegacyContract(legacy: LegacyMapManifestContract): MapDocument {
  const contract: MapDocumentContract = {
    format: 'mosaico-map', formatVersion: 2, id: legacy.id, revision: 0, name: legacy.name,
    orientation: 'orthogonal', width: legacy.width, height: legacy.height,
    cellWidth: legacy.cellWidth, cellHeight: legacy.cellHeight, activeLayerId: legacy.activeLayerId,
    tilesets: legacy.tilesets.map((tileset) => ({
      id: tileset.id, name: tileset.name, assetId: `legacy:${tileset.sha256.toLowerCase()}`,
      imageWidth: tileset.imageWidth, imageHeight: tileset.imageHeight,
      tileWidth: tileset.tileWidth, tileHeight: tileset.tileHeight,
      marginX: tileset.marginX, marginY: tileset.marginY, spacingX: tileset.spacingX, spacingY: tileset.spacingY,
      tileCount: tileCount(tileset),
    })),
    layers: [...legacy.layers].sort((left, right) => left.order - right.order).map((layer) => ({
      id: layer.id, name: layer.name, kind: 'tile', visible: layer.isVisible, locked: layer.isLocked, opacity: 1,
      cells: layer.cells.map((cell) => ({ ...cell })),
    })),
  }
  const validated = mapDocumentSchema.safeParse(contract)
  if (!validated.success) return invalidFormat()
  return mapFromContract(validated.data)
}

export function migrateLegacyMapManifest(text: string): MapDocument {
  const parsed = legacyMapManifestSchema.safeParse(parseJson(text))
  if (!parsed.success) return invalidFormat()
  return migrateLegacyContract(parsed.data)
}

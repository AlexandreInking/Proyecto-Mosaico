import { z } from 'zod'

export const AUTHORING_CONTRACT_VERSION = 'mosaico-authoring-t2-v1' as const

const stableIdSchema = z.string().uuid()
const nameSchema = z.string().trim().min(1).max(128)
const dimensionSchema = z.number().int().min(1).max(4096)
const opacitySchema = z.number().min(0).max(1)

export const tileReferenceSchema = z.object({
  tilesetId: stableIdSchema,
  tileId: z.number().int().nonnegative(),
  flipX: z.boolean().optional(),
  flipY: z.boolean().optional(),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
  autotileSetId: stableIdSchema.optional(),
  autotileProfile: z.enum(['terrain', 'contour']).optional(),
  animationId: stableIdSchema.optional(),
  animationFrame: z.number().int().nonnegative().optional(),
  animationDurationMs: z.number().int().min(10).max(60_000).optional(),
}).strict()

export const mapCellSchema = tileReferenceSchema.extend({
  x: z.number().int().min(0).max(4095),
  y: z.number().int().min(0).max(4095),
}).strict()

export const tilesetSchema = z.object({
  id: stableIdSchema,
  name: nameSchema,
  assetId: z.string().min(1).max(256),
  imageWidth: dimensionSchema,
  imageHeight: dimensionSchema,
  tileWidth: dimensionSchema,
  tileHeight: dimensionSchema,
  marginX: z.number().int().min(0).max(4095),
  marginY: z.number().int().min(0).max(4095),
  spacingX: z.number().int().min(0).max(4095),
  spacingY: z.number().int().min(0).max(4095),
  offsetX: z.number().int().min(0).max(4095).optional(),
  offsetY: z.number().int().min(0).max(4095).optional(),
  sha256: z.string().length(64).regex(/^[0-9a-f]+$/i).optional(),
  byteSize: z.number().int().nonnegative().max(50 * 1024 * 1024).optional(),
  mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp']).optional(),
  tileCount: z.number().int().min(1).max(1_000_000),
}).strict().superRefine((tileset, context) => {
  const originX = (tileset.offsetX ?? 0) + tileset.marginX
  const originY = (tileset.offsetY ?? 0) + tileset.marginY
  const columns = Math.floor((tileset.imageWidth - originX - tileset.marginX + tileset.spacingX) / (tileset.tileWidth + tileset.spacingX))
  const rows = Math.floor((tileset.imageHeight - originY - tileset.marginY + tileset.spacingY) / (tileset.tileHeight + tileset.spacingY))
  if (columns < 1 || rows < 1 || columns * rows !== tileset.tileCount) {
    context.addIssue({ code: 'custom', message: 'Tile geometry does not fit inside tileset image.' })
  }
})

export const tileLayerSchema = z.object({
  id: stableIdSchema,
  name: nameSchema,
  kind: z.literal('tile'),
  visible: z.boolean(),
  locked: z.boolean(),
  opacity: opacitySchema,
  cells: z.array(mapCellSchema).max(1_000_000),
  isFolder: z.boolean().optional(),
  parentId: stableIdSchema.optional(),
  collapsed: z.boolean().optional(),
}).strict().superRefine((layer, context) => {
  const coordinates = new Set<string>()
  for (const cell of layer.cells) {
    const key = `${cell.x},${cell.y}`
    if (coordinates.has(key)) {
      context.addIssue({ code: 'custom', message: 'Layer cell coordinates must be unique.', path: ['cells'] })
      return
    }
    coordinates.add(key)
  }
})

export const mapDocumentV2Schema = z.object({
  format: z.literal('mosaico-map'),
  formatVersion: z.literal(2),
  id: stableIdSchema,
  revision: z.number().int().nonnegative(),
  name: nameSchema,
  orientation: z.literal('orthogonal'),
  width: dimensionSchema,
  height: dimensionSchema,
  cellWidth: dimensionSchema,
  cellHeight: dimensionSchema,
  activeLayerId: stableIdSchema,
  tilesets: z.array(tilesetSchema).max(64),
  layers: z.array(tileLayerSchema).min(1).max(128),
}).strict().superRefine((document, context) => {
  const identifiers = [...document.tilesets, ...document.layers].map((item) => item.id)
  if (new Set(identifiers).size !== identifiers.length) {
    context.addIssue({ code: 'custom', message: 'Stable identifiers must be unique.' })
  }
  if (!document.layers.some((layer) => layer.id === document.activeLayerId)) {
    context.addIssue({ code: 'custom', message: 'Active layer must exist.', path: ['activeLayerId'] })
  }
  let occupiedCells = 0
  const tileCounts = new Map(document.tilesets.map((tileset) => [tileset.id, tileset.tileCount]))
  for (const [layerIndex, layer] of document.layers.entries()) {
    if (layer.parentId) {
      const parent = document.layers.find((candidate) => candidate.id === layer.parentId)
      if (!parent || !parent.isFolder || parent.id === layer.id) context.addIssue({ code: 'custom', message: 'Layer parent must be an existing folder.', path: ['layers', layerIndex, 'parentId'] })
    }
    occupiedCells += layer.cells.length
    for (const [cellIndex, cell] of layer.cells.entries()) {
      if (cell.x >= document.width || cell.y >= document.height) {
        context.addIssue({
          code: 'custom',
          message: 'Map cell is outside logical bounds.',
          path: ['layers', layerIndex, 'cells', cellIndex],
        })
      }
      const tileCount = tileCounts.get(cell.tilesetId)
      if (tileCount !== undefined && cell.tileId >= tileCount) {
        context.addIssue({
          code: 'custom',
          message: 'Map cell tile identifier is outside its tileset.',
          path: ['layers', layerIndex, 'cells', cellIndex, 'tileId'],
        })
      }
    }
  }
  if (occupiedCells > 1_000_000) {
    context.addIssue({ code: 'custom', message: 'Occupied cell budget exceeded.', path: ['layers'] })
  }
})

export const mapBackgroundSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('transparent') }).strict(),
  z.object({ kind: z.literal('color'), color: z.string().regex(/^#[0-9a-f]{8}$/i) }).strict(),
])

export const mapGridSchema = z.object({
  visible: z.boolean(),
  color: z.string().regex(/^#[0-9a-f]{8}$/i),
}).strict()

const terrainRoleSchema = z.enum([
  'center', 'top', 'right', 'bottom', 'left',
  'outerTopLeft', 'outerTopRight', 'outerBottomRight', 'outerBottomLeft',
  'innerTopLeft', 'innerTopRight', 'innerBottomRight', 'innerBottomLeft',
])

export const autotileSetSchema = z.object({
  id: stableIdSchema,
  name: nameSchema,
  tilesetId: stableIdSchema,
  centerTileId: z.number().int().nonnegative(),
  terrain: z.partialRecord(terrainRoleSchema, z.number().int().nonnegative()),
  contour: z.record(z.string().regex(/^(?:[0-9]|1[0-5])$/), z.number().int().nonnegative()),
}).strict()

export const mapDocumentSchema = z.object({
  format: z.literal('mosaico-map'),
  formatVersion: z.literal(3),
  id: stableIdSchema,
  revision: z.number().int().nonnegative(),
  name: nameSchema,
  orientation: z.literal('orthogonal'),
  width: dimensionSchema,
  height: dimensionSchema,
  cellWidth: dimensionSchema,
  cellHeight: dimensionSchema,
  background: mapBackgroundSchema,
  grid: mapGridSchema,
  activeLayerId: stableIdSchema,
  tilesets: z.array(tilesetSchema).max(64),
  autotileSets: z.array(autotileSetSchema).max(256),
  layers: z.array(tileLayerSchema).min(1).max(128),
}).strict().superRefine((document, context) => {
  const identifiers = [...document.tilesets, ...document.autotileSets, ...document.layers].map((item) => item.id)
  if (new Set(identifiers).size !== identifiers.length) context.addIssue({ code: 'custom', message: 'Stable identifiers must be unique.' })
  if (!document.layers.some((layer) => layer.id === document.activeLayerId)) context.addIssue({ code: 'custom', message: 'Active layer must exist.', path: ['activeLayerId'] })
  const tileCounts = new Map(document.tilesets.map((tileset) => [tileset.id, tileset.tileCount]))
  const tilesets = new Map(document.tilesets.map((tileset) => [tileset.id, tileset]))
  let occupiedCells = 0
  for (const [setIndex, set] of document.autotileSets.entries()) {
    const count = tileCounts.get(set.tilesetId)
    if (count === undefined || [set.centerTileId, ...Object.values(set.terrain), ...Object.values(set.contour)].some((id) => id >= count)) {
      context.addIssue({ code: 'custom', message: 'Autotile set references an invalid tile.', path: ['autotileSets', setIndex] })
    }
  }
  for (const [layerIndex, layer] of document.layers.entries()) {
    occupiedCells += layer.cells.length
    for (const [cellIndex, cell] of layer.cells.entries()) {
      if (cell.x >= document.width || cell.y >= document.height) context.addIssue({ code: 'custom', message: 'Map cell is outside logical bounds.', path: ['layers', layerIndex, 'cells', cellIndex] })
      const count = tileCounts.get(cell.tilesetId)
      if (count !== undefined && cell.tileId >= count) context.addIssue({ code: 'custom', message: 'Map cell tile identifier is outside its tileset.', path: ['layers', layerIndex, 'cells', cellIndex, 'tileId'] })
      const tileset = tilesets.get(cell.tilesetId)
      if (tileset && (cell.rotation === 90 || cell.rotation === 270) && tileset.tileWidth !== tileset.tileHeight) context.addIssue({ code: 'custom', message: 'Quarter-turn rotation requires square source tiles.', path: ['layers', layerIndex, 'cells', cellIndex, 'rotation'] })
    }
  }
  if (occupiedCells > 1_000_000) context.addIssue({ code: 'custom', message: 'Occupied cell budget exceeded.', path: ['layers'] })
})

const legacyMapCellSchema = z.object({
  x: z.number().int().min(0).max(4095),
  y: z.number().int().min(0).max(4095),
  tilesetId: stableIdSchema,
  tileId: z.number().int().nonnegative().max(999_999),
}).strict()

const legacyTilesetSchema = z.object({
  id: stableIdSchema,
  name: nameSchema,
  assetPath: z.string().min(1).max(512).regex(/^assets\/[0-9a-f-]+\.png$/i),
  imageWidth: dimensionSchema,
  imageHeight: dimensionSchema,
  tileWidth: dimensionSchema,
  tileHeight: dimensionSchema,
  marginX: z.number().int().min(0).max(4095),
  marginY: z.number().int().min(0).max(4095),
  spacingX: z.number().int().min(0).max(4095),
  spacingY: z.number().int().min(0).max(4095),
  sha256: z.string().length(64).regex(/^[0-9a-f]+$/i),
}).strict()

const legacyLayerSchema = z.object({
  id: stableIdSchema,
  name: nameSchema,
  order: z.number().int().min(0).max(127),
  isVisible: z.boolean(),
  isLocked: z.boolean(),
  cells: z.array(legacyMapCellSchema).max(1_000_000),
}).strict()

export const legacyMapManifestSchema = z.object({
  format: z.literal('mosaico-project'),
  formatVersion: z.literal(1),
  id: stableIdSchema,
  name: nameSchema,
  orientation: z.literal('orthogonal'),
  width: dimensionSchema,
  height: dimensionSchema,
  cellWidth: dimensionSchema,
  cellHeight: dimensionSchema,
  activeLayerId: stableIdSchema,
  tilesets: z.array(legacyTilesetSchema).max(64),
  layers: z.array(legacyLayerSchema).min(1).max(128),
}).strict().superRefine((document, context) => {
  const identifiers = [...document.tilesets, ...document.layers].map((item) => item.id)
  if (new Set(identifiers).size !== identifiers.length) context.addIssue({ code: 'custom', message: 'Stable identifiers must be unique.' })
  if (!document.layers.some((layer) => layer.id === document.activeLayerId)) context.addIssue({ code: 'custom', message: 'Active layer must exist.' })
  const orders = document.layers.map((layer) => layer.order).sort((left, right) => left - right)
  if (orders.some((order, index) => order !== index)) context.addIssue({ code: 'custom', message: 'Layer order must be contiguous.' })
  let occupiedCells = 0
  for (const [layerIndex, layer] of document.layers.entries()) {
    occupiedCells += layer.cells.length
    const coordinates = new Set<string>()
    for (const [cellIndex, cell] of layer.cells.entries()) {
      const key = `${cell.x},${cell.y}`
      if (coordinates.has(key) || cell.x >= document.width || cell.y >= document.height) {
        context.addIssue({ code: 'custom', message: 'Legacy cell is duplicate or outside bounds.', path: ['layers', layerIndex, 'cells', cellIndex] })
      }
      coordinates.add(key)
    }
  }
  if (occupiedCells > 1_000_000) context.addIssue({ code: 'custom', message: 'Occupied cell budget exceeded.' })
})

export const spriteFrameSchema = z.object({
  id: stableIdSchema,
  durationMs: z.number().int().min(1).max(60_000),
}).strict()

export const spriteCelSchema = z.object({
  frameId: stableIdSchema,
  rgbaBase64: z.string().max(100_000_000).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
}).strict()

export const spriteLayerSchema = z.object({
  id: stableIdSchema,
  name: nameSchema,
  kind: z.literal('raster'),
  visible: z.boolean(),
  locked: z.boolean(),
  opacity: opacitySchema,
  cels: z.array(spriteCelSchema).max(1024),
  isFolder: z.boolean().optional(),
  parentId: stableIdSchema.optional(),
  collapsed: z.boolean().optional(),
}).strict().superRefine((layer, context) => {
  const frameIds = layer.cels.map((cel) => cel.frameId)
  if (new Set(frameIds).size !== frameIds.length) {
    context.addIssue({ code: 'custom', message: 'A raster layer can have at most one cel per frame.', path: ['cels'] })
  }
})

export const spriteDocumentSchema = z.object({
  format: z.literal('mosaico-sprite'),
  formatVersion: z.literal(1),
  id: stableIdSchema,
  revision: z.number().int().nonnegative(),
  name: nameSchema,
  width: dimensionSchema,
  height: dimensionSchema,
  colorMode: z.literal('rgba'),
  activeLayerId: stableIdSchema,
  activeFrameId: stableIdSchema,
  frames: z.array(spriteFrameSchema).min(1).max(1024),
  layers: z.array(spriteLayerSchema).min(1).max(128),
  palette: z.array(z.string().regex(/^#[0-9a-f]{8}$/i)).max(256),
}).strict().superRefine((document, context) => {
  const identifiers = [...document.frames, ...document.layers].map((item) => item.id)
  if (new Set(identifiers).size !== identifiers.length) {
    context.addIssue({ code: 'custom', message: 'Stable identifiers must be unique.' })
  }
  const frameIds = new Set(document.frames.map((frame) => frame.id))
  if (!frameIds.has(document.activeFrameId)) {
    context.addIssue({ code: 'custom', message: 'Active frame must exist.', path: ['activeFrameId'] })
  }
  if (!document.layers.some((layer) => layer.id === document.activeLayerId)) {
    context.addIssue({ code: 'custom', message: 'Active layer must exist.', path: ['activeLayerId'] })
  }
  for (const [layerIndex, layer] of document.layers.entries()) {
    if (layer.parentId) {
      const parent = document.layers.find((candidate) => candidate.id === layer.parentId)
      if (!parent || !parent.isFolder || parent.id === layer.id) context.addIssue({ code: 'custom', message: 'Layer parent must be an existing folder.', path: ['layers', layerIndex, 'parentId'] })
    }
    for (const [celIndex, cel] of layer.cels.entries()) {
      if (!frameIds.has(cel.frameId)) {
        context.addIssue({
          code: 'custom',
          message: 'Sprite cel references an unknown frame.',
          path: ['layers', layerIndex, 'cels', celIndex, 'frameId'],
        })
      }
    }
  }
})

export type TileReferenceContract = z.infer<typeof tileReferenceSchema>
export type MapCellContract = z.infer<typeof mapCellSchema>
export type TilesetContract = z.infer<typeof tilesetSchema>
export type TileLayerContract = z.infer<typeof tileLayerSchema>
export type MapDocumentContract = z.infer<typeof mapDocumentSchema>
export type MapDocumentV2Contract = z.infer<typeof mapDocumentV2Schema>
export type LegacyMapManifestContract = z.infer<typeof legacyMapManifestSchema>
export type SpriteFrameContract = z.infer<typeof spriteFrameSchema>
export type SpriteCelContract = z.infer<typeof spriteCelSchema>
export type SpriteLayerContract = z.infer<typeof spriteLayerSchema>
export type SpriteDocumentContract = z.infer<typeof spriteDocumentSchema>

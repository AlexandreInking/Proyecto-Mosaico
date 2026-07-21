import { z } from 'zod'

export const AUTHORING_CONTRACT_VERSION = 'mosaico-authoring-t2-v1' as const

const stableIdSchema = z.string().uuid()
const nameSchema = z.string().trim().min(1).max(128)
const dimensionSchema = z.number().int().min(1).max(4096)
const opacitySchema = z.number().min(0).max(1)

export const tileReferenceSchema = z.object({
  tilesetId: stableIdSchema,
  tileId: z.number().int().nonnegative(),
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
  tileCount: z.number().int().min(1).max(1_000_000),
}).strict().superRefine((tileset, context) => {
  if (tileset.marginX * 2 + tileset.tileWidth > tileset.imageWidth
    || tileset.marginY * 2 + tileset.tileHeight > tileset.imageHeight) {
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

export const mapDocumentSchema = z.object({
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
  for (const [layerIndex, layer] of document.layers.entries()) {
    occupiedCells += layer.cells.length
    for (const [cellIndex, cell] of layer.cells.entries()) {
      if (cell.x >= document.width || cell.y >= document.height) {
        context.addIssue({
          code: 'custom',
          message: 'Map cell is outside logical bounds.',
          path: ['layers', layerIndex, 'cells', cellIndex],
        })
      }
    }
  }
  if (occupiedCells > 1_000_000) {
    context.addIssue({ code: 'custom', message: 'Occupied cell budget exceeded.', path: ['layers'] })
  }
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
export type SpriteFrameContract = z.infer<typeof spriteFrameSchema>
export type SpriteCelContract = z.infer<typeof spriteCelSchema>
export type SpriteLayerContract = z.infer<typeof spriteLayerSchema>
export type SpriteDocumentContract = z.infer<typeof spriteDocumentSchema>

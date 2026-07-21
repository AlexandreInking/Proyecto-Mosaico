import {
  addMapLayer,
  eraseTile,
  fillTiles,
  mapSemanticFingerprint,
  removeMapLayer,
  removeTileset,
  setTile,
  type MapDocument,
} from './map-document.js'
import {
  addSpriteLayer,
  erasePixel,
  fillPixels,
  removeSpriteLayer,
  setPixel,
  spriteSemanticFingerprint,
  type SpriteDocument,
} from './sprite-document.js'

export type CommandOriginKind = 'user' | 'node' | 'script' | 'generator' | 'ai'

export interface CommandOrigin {
  readonly kind: CommandOriginKind
  readonly id?: string
}

export interface CommandRequest {
  readonly commandId: string
  readonly commandVersion: number
  readonly params: unknown
  readonly origin: CommandOrigin
  readonly signal?: AbortSignal
}

export interface ParameterSchema<T> {
  parse(input: unknown): T
}

export interface CommandDefinition<TDocument, TParams = unknown> {
  readonly id: string
  readonly version: number
  readonly label: string
  readonly capabilities: readonly string[]
  readonly paramsSchema: ParameterSchema<TParams>
  execute(document: TDocument, params: TParams): TDocument
}

export interface CommandDescriptor {
  readonly id: string
  readonly version: number
  readonly label: string
  readonly capabilities: readonly string[]
  readonly paramsSchema: ParameterSchema<unknown>
}

export interface CommandHistoryEntry<TDocument> {
  readonly commandId: string
  readonly commandVersion: number
  readonly origin: CommandOrigin
  readonly beforeFingerprint: string
  readonly afterFingerprint: string
  readonly before: TDocument
  readonly after: TDocument
}

function commandKey(id: string, version: number): string {
  return `${id}@${version}`
}

export class CommandRegistry<TDocument> {
  readonly #definitions = new Map<string, CommandDefinition<TDocument, unknown>>()
  readonly fingerprint: (document: TDocument) => string

  constructor(fingerprint: (document: TDocument) => string) {
    this.fingerprint = fingerprint
  }

  register<TParams>(definition: CommandDefinition<TDocument, TParams>): this {
    if (!definition.id || !Number.isInteger(definition.version) || definition.version < 1) {
      throw new Error('COMMAND_DEFINITION_INVALID')
    }
    const key = commandKey(definition.id, definition.version)
    if (this.#definitions.has(key)) throw new Error('COMMAND_ALREADY_REGISTERED')
    this.#definitions.set(key, definition as CommandDefinition<TDocument, unknown>)
    return this
  }

  resolve(id: string, version: number): CommandDefinition<TDocument, unknown> {
    const definition = this.#definitions.get(commandKey(id, version))
    if (!definition) throw new Error('COMMAND_NOT_REGISTERED')
    return definition
  }

  describe(): readonly CommandDescriptor[] {
    return [...this.#definitions.values()]
      .map(({ id, version, label, capabilities, paramsSchema }) => ({ id, version, label, capabilities, paramsSchema }))
      .sort((left, right) => left.id.localeCompare(right.id) || left.version - right.version)
  }
}

export class CommandHistory<TDocument> {
  #document: TDocument
  readonly #registry: CommandRegistry<TDocument>
  readonly #capacity: number
  #undoEntries: CommandHistoryEntry<TDocument>[] = []
  #redoEntries: CommandHistoryEntry<TDocument>[] = []

  constructor(document: TDocument, registry: CommandRegistry<TDocument>, options: { readonly capacity?: number } = {}) {
    const capacity = options.capacity ?? 100
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10_000) throw new RangeError('COMMAND_HISTORY_CAPACITY_INVALID')
    this.#document = document
    this.#registry = registry
    this.#capacity = capacity
  }

  get document(): TDocument { return this.#document }
  get canUndo(): boolean { return this.#undoEntries.length > 0 }
  get canRedo(): boolean { return this.#redoEntries.length > 0 }

  execute(request: CommandRequest): CommandHistoryEntry<TDocument> {
    assertRequest(request)
    if (request.signal?.aborted) throw new Error('COMMAND_ABORTED')
    const definition = this.#registry.resolve(request.commandId, request.commandVersion)
    const params = definition.paramsSchema.parse(request.params)
    const before = this.#document
    const after = definition.execute(before, params)
    if (request.signal?.aborted) throw new Error('COMMAND_ABORTED')
    const entry: CommandHistoryEntry<TDocument> = {
      commandId: definition.id,
      commandVersion: definition.version,
      origin: { ...request.origin },
      beforeFingerprint: this.#registry.fingerprint(before),
      afterFingerprint: this.#registry.fingerprint(after),
      before,
      after,
    }
    this.#document = after
    if (after !== before) {
      this.#undoEntries.push(entry)
      if (this.#undoEntries.length > this.#capacity) this.#undoEntries.shift()
      this.#redoEntries = []
    }
    return entry
  }

  undo(): boolean {
    const entry = this.#undoEntries.pop()
    if (!entry) return false
    this.#document = entry.before
    this.#redoEntries.push(entry)
    return true
  }

  redo(): boolean {
    const entry = this.#redoEntries.pop()
    if (!entry) return false
    this.#document = entry.after
    this.#undoEntries.push(entry)
    return true
  }
}

const originKinds = new Set<CommandOriginKind>(['user', 'node', 'script', 'generator', 'ai'])

function assertRequest(request: CommandRequest): void {
  if (!request.commandId || !Number.isInteger(request.commandVersion) || request.commandVersion < 1) {
    throw new Error('COMMAND_REQUEST_INVALID')
  }
  if (!originKinds.has(request.origin?.kind)) throw new Error('COMMAND_ORIGIN_INVALID')
  if (request.origin.id !== undefined && (request.origin.id.length < 1 || request.origin.id.length > 128)) {
    throw new Error('COMMAND_ORIGIN_INVALID')
  }
}

type UnknownRecord = Record<string, unknown>

function strictObject(input: unknown, keys: readonly string[]): UnknownRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('COMMAND_PARAMS_INVALID')
  const record = input as UnknownRecord
  if (Object.keys(record).some((key) => !keys.includes(key))) throw new Error('COMMAND_PARAMS_INVALID')
  return record
}

function requiredString(record: UnknownRecord, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.length < 1 || value.length > 128) throw new Error('COMMAND_PARAMS_INVALID')
  return value
}

function integer(record: UnknownRecord, key: string, maximum = 4095): number {
  const value = record[key]
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > maximum) throw new Error('COMMAND_PARAMS_INVALID')
  return value as number
}

interface TileSetParams { readonly layerId: string; readonly x: number; readonly y: number; readonly tilesetId: string; readonly tileId: number }
interface CoordinateParams { readonly layerId: string; readonly x: number; readonly y: number }
interface LayerAddParams { readonly id: string; readonly name: string }
interface IdentifierParams { readonly id: string }
interface MapStrokeParams { readonly layerId: string; readonly cells: readonly Omit<TileSetParams, 'layerId'>[] }
interface PixelParams extends CoordinateParams { readonly frameId: string; readonly r: number; readonly g: number; readonly b: number; readonly a: number }
interface PixelStrokeParams { readonly layerId: string; readonly frameId: string; readonly pixels: readonly Omit<PixelParams, 'layerId' | 'frameId'>[] }

const tileSetSchema: ParameterSchema<TileSetParams> = { parse(input) {
  const value = strictObject(input, ['layerId', 'x', 'y', 'tilesetId', 'tileId'])
  return { layerId: requiredString(value, 'layerId'), x: integer(value, 'x'), y: integer(value, 'y'), tilesetId: requiredString(value, 'tilesetId'), tileId: integer(value, 'tileId', 999_999) }
} }

const coordinateSchema: ParameterSchema<CoordinateParams> = { parse(input) {
  const value = strictObject(input, ['layerId', 'x', 'y'])
  return { layerId: requiredString(value, 'layerId'), x: integer(value, 'x'), y: integer(value, 'y') }
} }

const layerAddSchema: ParameterSchema<LayerAddParams> = { parse(input) {
  const value = strictObject(input, ['id', 'name'])
  return { id: requiredString(value, 'id'), name: requiredString(value, 'name') }
} }

const identifierSchema: ParameterSchema<IdentifierParams> = { parse(input) {
  const value = strictObject(input, ['id'])
  return { id: requiredString(value, 'id') }
} }

function requiredArray(record: UnknownRecord, key: string): readonly unknown[] {
  const value = record[key]
  if (!Array.isArray(value) || value.length < 1 || value.length > 100_000) throw new Error('COMMAND_PARAMS_INVALID')
  return value
}

const mapStrokeSchema: ParameterSchema<MapStrokeParams> = { parse(input) {
  const value = strictObject(input, ['layerId', 'cells'])
  return {
    layerId: requiredString(value, 'layerId'),
    cells: requiredArray(value, 'cells').map((cell) => {
      const parsed = tileSetSchema.parse({ layerId: requiredString(value, 'layerId'), ...strictObject(cell, ['x', 'y', 'tilesetId', 'tileId']) })
      return { x: parsed.x, y: parsed.y, tilesetId: parsed.tilesetId, tileId: parsed.tileId }
    }),
  }
} }

function colorChannel(record: UnknownRecord, key: string): number { return integer(record, key, 255) }

const pixelSchema: ParameterSchema<PixelParams> = { parse(input) {
  const value = strictObject(input, ['layerId', 'frameId', 'x', 'y', 'r', 'g', 'b', 'a'])
  return {
    layerId: requiredString(value, 'layerId'), frameId: requiredString(value, 'frameId'),
    x: integer(value, 'x'), y: integer(value, 'y'),
    r: colorChannel(value, 'r'), g: colorChannel(value, 'g'), b: colorChannel(value, 'b'), a: colorChannel(value, 'a'),
  }
} }

const pixelCoordinateSchema: ParameterSchema<CoordinateParams & { readonly frameId: string }> = { parse(input) {
  const value = strictObject(input, ['layerId', 'frameId', 'x', 'y'])
  return { layerId: requiredString(value, 'layerId'), frameId: requiredString(value, 'frameId'), x: integer(value, 'x'), y: integer(value, 'y') }
} }

const pixelStrokeSchema: ParameterSchema<PixelStrokeParams> = { parse(input) {
  const value = strictObject(input, ['layerId', 'frameId', 'pixels'])
  const layerId = requiredString(value, 'layerId')
  const frameId = requiredString(value, 'frameId')
  return {
    layerId, frameId,
    pixels: requiredArray(value, 'pixels').map((pixel) => {
      const parsed = pixelSchema.parse({ layerId, frameId, ...strictObject(pixel, ['x', 'y', 'r', 'g', 'b', 'a']) })
      return { x: parsed.x, y: parsed.y, r: parsed.r, g: parsed.g, b: parsed.b, a: parsed.a }
    }),
  }
} }

export function createMapCommandRegistry(): CommandRegistry<MapDocument> {
  return new CommandRegistry(mapSemanticFingerprint)
    .register({ id: 'map.tile.stroke', version: 1, label: 'Trazo de tiles', capabilities: ['map.write'], paramsSchema: mapStrokeSchema,
      execute: (document, params) => params.cells.reduce((current, cell) => setTile(current, params.layerId, cell, { tilesetId: cell.tilesetId, tileId: cell.tileId }), document) })
    .register({ id: 'map.tile.set', version: 1, label: 'Pintar tile', capabilities: ['map.write'], paramsSchema: tileSetSchema,
      execute: (document, params) => setTile(document, params.layerId, { x: params.x, y: params.y }, { tilesetId: params.tilesetId, tileId: params.tileId }) })
    .register({ id: 'map.tile.erase', version: 1, label: 'Borrar tile', capabilities: ['map.write'], paramsSchema: coordinateSchema,
      execute: (document, params) => eraseTile(document, params.layerId, params) })
    .register({ id: 'map.tile.fill', version: 1, label: 'Rellenar tiles', capabilities: ['map.write'], paramsSchema: tileSetSchema,
      execute: (document, params) => fillTiles(document, params.layerId, { x: params.x, y: params.y }, { tilesetId: params.tilesetId, tileId: params.tileId }) })
    .register({ id: 'map.layer.add', version: 1, label: 'Añadir capa', capabilities: ['map.layers.write'], paramsSchema: layerAddSchema,
      execute: (document, params) => addMapLayer(document, params) })
    .register({ id: 'map.layer.remove', version: 1, label: 'Eliminar capa', capabilities: ['map.layers.write'], paramsSchema: identifierSchema,
      execute: (document, params) => removeMapLayer(document, params.id) })
    .register({ id: 'map.tileset.remove', version: 1, label: 'Eliminar tileset', capabilities: ['map.tilesets.write'], paramsSchema: identifierSchema,
      execute: (document, params) => removeTileset(document, params.id) })
}

export function createSpriteCommandRegistry(): CommandRegistry<SpriteDocument> {
  return new CommandRegistry(spriteSemanticFingerprint)
    .register({ id: 'sprite.pixel.stroke', version: 1, label: 'Trazo de píxeles', capabilities: ['sprite.write'], paramsSchema: pixelStrokeSchema,
      execute: (document, params) => params.pixels.reduce((current, pixel) => setPixel(current, params.layerId, params.frameId, pixel, pixel), document) })
    .register({ id: 'sprite.pixel.set', version: 1, label: 'Pintar píxel', capabilities: ['sprite.write'], paramsSchema: pixelSchema,
      execute: (document, params) => setPixel(document, params.layerId, params.frameId, params, params) })
    .register({ id: 'sprite.pixel.erase', version: 1, label: 'Borrar píxel', capabilities: ['sprite.write'], paramsSchema: pixelCoordinateSchema,
      execute: (document, params) => erasePixel(document, params.layerId, params.frameId, params) })
    .register({ id: 'sprite.pixel.fill', version: 1, label: 'Rellenar píxeles', capabilities: ['sprite.write'], paramsSchema: pixelSchema,
      execute: (document, params) => fillPixels(document, params.layerId, params.frameId, params, params) })
    .register({ id: 'sprite.layer.add', version: 1, label: 'Añadir capa', capabilities: ['sprite.layers.write'], paramsSchema: layerAddSchema,
      execute: (document, params) => addSpriteLayer(document, params) })
    .register({ id: 'sprite.layer.remove', version: 1, label: 'Eliminar capa', capabilities: ['sprite.layers.write'], paramsSchema: identifierSchema,
      execute: (document, params) => removeSpriteLayer(document, params.id) })
}

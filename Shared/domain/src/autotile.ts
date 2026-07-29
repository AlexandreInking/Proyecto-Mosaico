import {
  MAXIMUM_AUTOTILE_SETS,
  applyMapCells,
  getTile,
  type AutotileSet,
  type GridCoordinate,
  type MapDocument,
  type TerrainRole,
} from './map-document.js'

export interface CardinalNeighbors {
  readonly north: boolean
  readonly east: boolean
  readonly south: boolean
  readonly west: boolean
}

export interface TerrainNeighbors extends CardinalNeighbors {
  readonly northWest?: boolean
  readonly northEast?: boolean
  readonly southEast?: boolean
  readonly southWest?: boolean
}

export interface AutotileDiagnostic {
  readonly code: 'MAP_AUTOTILE_ROLE_MISSING'
  readonly severity: 'warning'
  readonly groupKey: string
  readonly count: number
  readonly message: string
  readonly tilesetId: string
  readonly setId: string
  readonly profile: 'terrain' | 'contour'
  readonly missing: readonly string[]
}

const terrainRoles: readonly TerrainRole[] = [
  'top', 'right', 'bottom', 'left', 'outerTopLeft', 'outerTopRight', 'outerBottomRight', 'outerBottomLeft',
  'innerTopLeft', 'innerTopRight', 'innerBottomRight', 'innerBottomLeft',
]

export function autotileDiagnostics(document: MapDocument): readonly AutotileDiagnostic[] {
  const result: AutotileDiagnostic[] = []
  const used = new Set<string>()
  for (const layer of document.layers) for (const tile of layer.cells.values()) if (tile.autotileSetId && tile.autotileProfile) used.add(`${tile.autotileSetId}:${tile.autotileProfile}`)
  for (const set of document.autotileSets) for (const profile of ['terrain', 'contour'] as const) {
    if (!used.has(`${set.id}:${profile}`)) continue
    const missing = profile === 'terrain'
      ? terrainRoles.filter((role) => set.terrain[role] === undefined)
      : Array.from({ length: 16 }, (_, mask) => String(mask)).filter((mask) => set.contour[mask] === undefined)
    if (!missing.length) continue
    result.push({
      code: 'MAP_AUTOTILE_ROLE_MISSING', severity: 'warning', groupKey: `autotile:${set.id}:${profile}`, count: missing.length,
      message: `${set.name}: faltan ${missing.length} asignaciones ${profile}; se usa centro como fallback.`,
      tilesetId: set.tilesetId, setId: set.id, profile, missing,
    })
  }
  return result
}

export function resolveContourMask(neighbors: CardinalNeighbors): number {
  return (neighbors.north ? 1 : 0) | (neighbors.east ? 2 : 0) | (neighbors.south ? 4 : 0) | (neighbors.west ? 8 : 0)
}

export function resolveTerrainRole(neighbors: TerrainNeighbors): TerrainRole {
  const { north, east, south, west } = neighbors
  if (north && east && south && west) {
    const missing = [
      !neighbors.northWest && 'innerTopLeft',
      !neighbors.northEast && 'innerTopRight',
      !neighbors.southEast && 'innerBottomRight',
      !neighbors.southWest && 'innerBottomLeft',
    ].filter(Boolean)
    return missing.length === 1 ? missing[0] as TerrainRole : 'center'
  }
  if (!north && !west && east && south) return 'outerTopLeft'
  if (!north && !east && west && south) return 'outerTopRight'
  if (!south && !east && west && north) return 'outerBottomRight'
  if (!south && !west && east && north) return 'outerBottomLeft'
  if (!north && east && south && west) return 'top'
  if (!east && north && south && west) return 'right'
  if (!south && north && east && west) return 'bottom'
  if (!west && north && east && south) return 'left'
  return 'center'
}

function requireSet(document: MapDocument, setId: string): AutotileSet {
  const set = document.autotileSets.find((candidate) => candidate.id === setId)
  if (!set) throw new Error('MAP_AUTOTILE_SET_NOT_FOUND')
  return set
}

function validateSet(document: MapDocument, set: AutotileSet): void {
  if (!set.id || !set.name.trim()) throw new Error('MAP_REQUIRED_FIELD')
  const tileset = document.tilesets.find((candidate) => candidate.id === set.tilesetId)
  if (!tileset) throw new Error('MAP_TILESET_NOT_FOUND')
  const ids = [set.centerTileId, ...Object.values(set.terrain), ...Object.values(set.contour)]
  if (ids.some((id) => !Number.isInteger(id) || id! < 0 || id! >= tileset.tileCount)) throw new RangeError('MAP_TILE_ID_OUT_OF_BOUNDS')
}

export function addAutotileSet(document: MapDocument, set: AutotileSet): MapDocument {
  validateSet(document, set)
  if (document.autotileSets.length >= MAXIMUM_AUTOTILE_SETS) throw new RangeError('MAP_AUTOTILE_SET_LIMIT')
  if (document.autotileSets.some((candidate) => candidate.id === set.id)
    || document.layers.some((layer) => layer.id === set.id)
    || document.tilesets.some((tileset) => tileset.id === set.id)) throw new Error('MAP_DUPLICATE_ID')
  return { ...document, revision: document.revision + 1, autotileSets: [...document.autotileSets, { ...set }] }
}

export function updateAutotileSet(document: MapDocument, set: AutotileSet): MapDocument {
  requireSet(document, set.id)
  validateSet(document, set)
  let next: MapDocument = {
    ...document,
    revision: document.revision + 1,
    autotileSets: document.autotileSets.map((candidate) => candidate.id === set.id ? { ...set } : candidate),
  }
  for (const layer of document.layers) for (const profile of ['terrain', 'contour'] as const) {
    const coordinates = [...layer.cells.entries()]
      .filter(([, tile]) => tile.autotileSetId === set.id && tile.autotileProfile === profile)
      .map(([cell]) => { const [x, y] = cell.split(',').map(Number); return { x: x!, y: y! } })
    if (coordinates.length) next = applyAutotileCells(next, layer.id, coordinates, set.id, profile, { allowLocked: true })
  }
  return next
}

export function removeAutotileSet(document: MapDocument, setId: string): MapDocument {
  requireSet(document, setId)
  return { ...document, revision: document.revision + 1, autotileSets: document.autotileSets.filter((set) => set.id !== setId) }
}

const key = ({ x, y }: GridCoordinate) => `${x},${y}`

export function applyAutotileCells(
  document: MapDocument,
  layerId: string,
  coordinates: readonly GridCoordinate[],
  setId: string,
  profile: 'terrain' | 'contour',
  options: { readonly allowLocked?: boolean } = {},
): MapDocument {
  if (!coordinates.length) return document
  const set = requireSet(document, setId)
  const additions = new Set(coordinates.map(key))
  const affected = new Map<string, GridCoordinate>()
  for (const coordinate of coordinates) {
    if (coordinate.x < 0 || coordinate.y < 0 || coordinate.x >= document.width || coordinate.y >= document.height) throw new RangeError('MAP_COORDINATE_OUT_OF_BOUNDS')
    for (let y = coordinate.y - 1; y <= coordinate.y + 1; y += 1) for (let x = coordinate.x - 1; x <= coordinate.x + 1; x += 1) {
      if (x >= 0 && y >= 0 && x < document.width && y < document.height) affected.set(`${x},${y}`, { x, y })
    }
  }
  const member = (coordinate: GridCoordinate): boolean => {
    if (coordinate.x < 0 || coordinate.y < 0 || coordinate.x >= document.width || coordinate.y >= document.height) return false
    if (additions.has(key(coordinate))) return true
    const tile = getTile(document, layerId, coordinate)
    return tile?.autotileSetId === setId && tile.autotileProfile === profile
  }
  const changes = [...affected.values()].flatMap((coordinate) => {
    const existing = getTile(document, layerId, coordinate)
    if (!additions.has(key(coordinate)) && (existing?.autotileSetId !== setId || existing.autotileProfile !== profile)) return []
    const neighbors = {
      north: member({ x: coordinate.x, y: coordinate.y - 1 }),
      east: member({ x: coordinate.x + 1, y: coordinate.y }),
      south: member({ x: coordinate.x, y: coordinate.y + 1 }),
      west: member({ x: coordinate.x - 1, y: coordinate.y }),
      northWest: member({ x: coordinate.x - 1, y: coordinate.y - 1 }),
      northEast: member({ x: coordinate.x + 1, y: coordinate.y - 1 }),
      southEast: member({ x: coordinate.x + 1, y: coordinate.y + 1 }),
      southWest: member({ x: coordinate.x - 1, y: coordinate.y + 1 }),
    }
    const tileId = profile === 'contour'
      ? set.contour[resolveContourMask(neighbors)] ?? set.centerTileId
      : set.terrain[resolveTerrainRole(neighbors)] ?? set.centerTileId
    return [{ ...coordinate, tile: { tilesetId: set.tilesetId, tileId, autotileSetId: set.id, autotileProfile: profile } }]
  })
  return applyMapCells(document, layerId, changes, options)
}

export function eraseAutotileCells(document: MapDocument, layerId: string, coordinates: readonly GridCoordinate[]): MapDocument {
  if (!coordinates.length) return document
  const removed = new Set(coordinates.map(key))
  const identities = new Map<string, { setId: string; profile: 'terrain' | 'contour' }>()
  for (const coordinate of coordinates) {
    const tile = getTile(document, layerId, coordinate)
    if (tile?.autotileSetId && tile.autotileProfile) identities.set(`${tile.autotileSetId}:${tile.autotileProfile}`, { setId: tile.autotileSetId, profile: tile.autotileProfile })
  }
  let next = applyMapCells(document, layerId, coordinates.map((coordinate) => ({ ...coordinate })))
  for (const identity of identities.values()) {
    const neighbors = new Map<string, GridCoordinate>()
    for (const coordinate of coordinates) for (let y = coordinate.y - 1; y <= coordinate.y + 1; y += 1) for (let x = coordinate.x - 1; x <= coordinate.x + 1; x += 1) {
      if (x < 0 || y < 0 || x >= next.width || y >= next.height || removed.has(`${x},${y}`)) continue
      const tile = getTile(next, layerId, { x, y })
      if (tile?.autotileSetId === identity.setId && tile.autotileProfile === identity.profile) neighbors.set(`${x},${y}`, { x, y })
    }
    next = applyAutotileCells(next, layerId, [...neighbors.values()], identity.setId, identity.profile)
  }
  return next
}

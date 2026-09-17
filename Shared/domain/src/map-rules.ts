import { applyMapCells, type GridCoordinate, type MapDocument } from './map-document.js'

/**
 * TRN-401 · Motor de reglas de patrón para Maps (inspirado en TileKit/Tiled Automapping).
 *
 * Semántica canónica: cada fase evalúa TODAS las celdas contra una INSTANTÁNEA previa al
 * pase y escribe los cambios al final. Así, re-evaluar solo una región acotada produce
 * exactamente los mismos valores que el pase completo (base del modo incremental).
 */

/** Predicado por celda del vecindario: identidad, negación o pertenencia a un grupo de similitud. */
export type RuleCellPredicate = 'same' | 'different' | { readonly kind: 'group'; readonly groupId: string; readonly negated?: boolean }

/** Clave de vecino: offset `"dx,dy"` (centro excluido). La UI usa radio 2 (grilla 5×5). */
export type RuleNeighborKey = string

export interface MapRuleCondition {
  /** Tile requerido en la celda central; si se omite, cualquier tile pintado coincide. */
  readonly tileId?: number
  readonly neighbors?: Readonly<Record<RuleNeighborKey, RuleCellPredicate>>
}

export interface MapRuleOutput {
  readonly tilesetId: string
  readonly tileId: number
  /** Peso relativo de esta variante (estilo TileKit); ausente = 1. */
  readonly weight?: number
}

export interface MapRuleGroupMember {
  readonly tilesetId: string
  readonly tileId: number
}

/** Grupo de similitud: conjunto con nombre de tiles que las condiciones pueden exigir. */
export interface MapRuleGroup {
  readonly id: string
  readonly name: string
  /** Color sugerido para la UI. */
  readonly color?: string
  readonly members: readonly MapRuleGroupMember[]
}

export interface MapPatternRule {
  readonly id: string
  readonly name: string
  /** Menor número = mayor prioridad; a igualdad decide el orden por id. */
  readonly priority: number
  /** Las fases se ejecutan ascendente; la fase N ve los resultados de fases previas. */
  readonly phase: number
  /** @deprecated usa weight por variante en outputs; se mantiene por compatibilidad. */
  readonly weight: number
  /** Probabilidad de disparo 0..1 (estilo TileKit `chance`); ausente = siempre. */
  readonly chance?: number
  /** Expande la condición con sus rotaciones de 90°/180°/270°. */
  readonly allowRotations?: boolean
  readonly condition: MapRuleCondition
  /** Variantes de salida; una se elige de forma determinista según la semilla y la celda. */
  readonly outputs: readonly MapRuleOutput[]
}

export interface MapRuleDiagnostics {
  readonly code: 'MAP_RULE_DUPLICATE_ID' | 'MAP_RULE_WEIGHT_INVALID' | 'MAP_RULE_OUTPUT_EMPTY' | 'MAP_RULE_OUTPUT_TILESET_MISSING' | 'MAP_RULE_OUTPUT_TILE_OUT_OF_BOUNDS' | 'MAP_RULE_PRIORITY_INVALID' | 'MAP_RULE_GROUP_MISSING'
  readonly severity: 'error'
  readonly ruleId: string
  readonly message: string
}

/** Brújula clásica → offsets (compatibilidad v1 y legibilidad en tests). */
export const RULE_COMPASS_OFFSETS: Readonly<Record<string, readonly [number, number]>> = {
  north: [0, -1], northEast: [1, -1], east: [1, 0], southEast: [1, 1],
  south: [0, 1], southWest: [-1, 1], west: [-1, 0], northWest: [-1, -1],
  north2: [0, -2], east2: [2, 0], south2: [0, 2], west2: [-2, 0],
}

/** Convierte una especificación con claves brújula u offsets a claves canónicas `"dx,dy"`. */
export function ruleNeighbors(spec: Partial<Record<string, RuleCellPredicate>>): Record<RuleNeighborKey, RuleCellPredicate> {
  const result: Record<string, RuleCellPredicate> = {}
  for (const [key, predicate] of Object.entries(spec)) {
    if (predicate === undefined) continue
    const offset = RULE_COMPASS_OFFSETS[key]
    result[offset ? `${offset[0]},${offset[1]}` : key] = predicate
  }
  return result
}

const parseOffsetKey = (key: RuleNeighborKey): readonly [number, number] | undefined => {
  const match = /^(-?\d+),(-?\d+)$/.exec(key)
  return match ? [Number(match[1]), Number(match[2])] : undefined
}

const sameIdentity = (a: { tilesetId: string; tileId: number } | undefined, b: { tilesetId: string; tileId: number } | undefined): boolean =>
  !!a && !!b && a.tilesetId === b.tilesetId && a.tileId === b.tileId

function hash32(value: number): number {
  let hash = value | 0
  hash = Math.imul(hash ^ 16_777_619, 2_166_136_261)
  hash ^= hash >>> 15
  hash = Math.imul(hash, 2_246_822_077)
  hash ^= hash >>> 13
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickVariant<T>(variants: readonly T[], weights: readonly number[], random: number): T {
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0)
  if (total <= 0) return variants[variants.length - 1]!
  let threshold = random * total
  for (let index = 0; index < variants.length; index += 1) {
    const weight = Math.max(0, weights[index]!)
    if (weight === 0) continue
    threshold -= weight
    if (threshold <= 0) return variants[index]!
  }
  return variants[variants.length - 1]!
}

const rotateOffsetCW = (x: number, y: number): readonly [number, number] => [-y, x]

function rotateNeighborsCW(neighbors: Readonly<Record<RuleNeighborKey, RuleCellPredicate>>): Record<RuleNeighborKey, RuleCellPredicate> {
  const result: Record<string, RuleCellPredicate> = {}
  for (const [key, predicate] of Object.entries(neighbors)) {
    const offset = parseOffsetKey(key)
    if (!offset) continue
    const rotated = rotateOffsetCW(offset[0], offset[1])
    result[`${rotated[0]},${rotated[1]}`] = predicate
  }
  return result
}

function conditionVariants(rule: MapPatternRule): readonly (Readonly<Record<RuleNeighborKey, RuleCellPredicate>> | undefined)[] {
  const neighbors = rule.condition.neighbors
  if (!neighbors || !Object.keys(neighbors).length) return [undefined]
  if (!rule.allowRotations) return [neighbors]
  const variants: Readonly<Record<RuleNeighborKey, RuleCellPredicate>>[] = []
  let current = neighbors
  for (let rotation = 0; rotation < 4; rotation += 1) {
    variants.push(current)
    current = rotateNeighborsCW(current)
  }
  return variants
}

interface RuleMatchContext {
  readonly x: number
  readonly y: number
  /** Celda central; puede ser undefined para evaluar reglas que decoran celdas vacías. */
  readonly tile?: { tilesetId: string; tileId: number }
  readonly neighborAt: (x: number, y: number) => { tilesetId: string; tileId: number } | undefined
  readonly groups: ReadonlyMap<string, MapRuleGroup>
}

function predicateMatches(predicate: RuleCellPredicate, actual: { tilesetId: string; tileId: number } | undefined, center: { tilesetId: string; tileId: number } | undefined, groups: ReadonlyMap<string, MapRuleGroup>): boolean {
  if (predicate === 'same') return sameIdentity(actual, center)
  if (predicate === 'different') return !sameIdentity(actual, center)
  if (typeof predicate === 'string') return false
  const group = groups.get(predicate.groupId)
  if (!group) return false
  const member = !!actual && group.members.some((candidate) => candidate.tilesetId === actual.tilesetId && candidate.tileId === actual.tileId)
  return predicate.negated ? !member : member
}

export function ruleMatches(rule: MapPatternRule, context: RuleMatchContext): boolean {
  if (rule.condition.tileId !== undefined && context.tile?.tileId !== rule.condition.tileId) return false
  const neighborSpecs = conditionVariants(rule)
  return neighborSpecs.some((spec) => {
    if (!spec) return true
    return Object.entries(spec).every(([key, expected]) => {
      const offset = parseOffsetKey(key)
      if (!offset) return false
      const actual = context.neighborAt(context.x + offset[0], context.y + offset[1])
      return predicateMatches(expected, actual, context.tile, context.groups)
    })
  })
}

function evaluatePhase(
  document: MapDocument,
  sourceLayerId: string,
  rules: readonly MapPatternRule[],
  phase: number,
  seed: number,
  region: { readonly left: number; readonly top: number; readonly width: number; readonly height: number },
  groups: ReadonlyMap<string, MapRuleGroup>,
  compareAt?: (x: number, y: number) => { tilesetId: string; tileId: number } | undefined,
): { x: number; y: number; tile: { tilesetId: string; tileId: number } }[] {
  const layer = document.layers.find((candidate) => candidate.id === sourceLayerId)
  if (!layer || layer.isFolder || !layer.cells.size) return []
  const snapshot = new Map(layer.cells)
  const readAt = (x: number, y: number) => snapshot.get(`${x},${y}`)
  const unchangedOnTarget = (x: number, y: number, variant: { tilesetId: string; tileId: number }): boolean => {
    const current = compareAt ? compareAt(x, y) : snapshot.get(`${x},${y}`)
    return !!current && current.tilesetId === variant.tilesetId && current.tileId === variant.tileId
  }
  const eligible = rules.filter((rule) => rule.phase === phase)
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))
  if (!eligible.length) return []
  const changes: { x: number; y: number; tile: { tilesetId: string; tileId: number } }[] = []
  const top = Math.max(0, region.top); const left = Math.max(0, region.left)
  const bottom = Math.min(document.height, region.top + region.height); const right = Math.min(document.width, region.left + region.width)
  for (let y = top; y < bottom; y += 1) for (let x = left; x < right; x += 1) {
    const tile = snapshot.get(`${x},${y}`)
    for (const rule of eligible) {
      if (rule.condition.tileId !== undefined && (!tile || rule.condition.tileId !== tile.tileId)) continue
      // Celdas vacías solo participan si la regla mira vecinos (decoración estilo TileKit);
      // una regla sin ninguna condición sigue significando "cualquier tile pintado".
      if (!tile && !Object.keys(rule.condition.neighbors ?? {}).length) continue
      if (!ruleMatches(rule, { x, y, tile, neighborAt: readAt, groups })) continue
      const random = mulberry32(hash32(hash32(seed) ^ hash32(x * 49157 + y * 98317) ^ hash32(phase)))
      if (rule.chance !== undefined && random() >= Math.max(0, Math.min(1, rule.chance))) continue
      const weights = rule.outputs.map((output) => {
        const weight = output.weight ?? rule.weight
        return Math.max(0, Number.isFinite(weight) ? weight : 1)
      })
      const variant = pickVariant(rule.outputs, weights, random())
      if (!unchangedOnTarget(x, y, variant)) changes.push({ x, y, tile: { tilesetId: variant.tilesetId, tileId: variant.tileId } })
      break
    }
  }
  return changes
}

export interface MapRulesOptions {
  readonly seed?: number
  readonly region?: { readonly left: number; readonly top: number; readonly width: number; readonly height: number }
  readonly phases?: readonly number[]
  /** Grupos de similitud disponibles para los predicados de condición. */
  readonly groups?: readonly MapRuleGroup[]
  /** Capa destino de las escrituras; por defecto la propia capa evaluada (estilo blueprint). */
  readonly targetLayerId?: string
}

/** Pase completo (o de región) por fases ascendentes; cada fase evalúa contra su propia instantánea. */
export function applyMapRulePass(
  document: MapDocument,
  layerId: string,
  rules: readonly MapPatternRule[],
  options: MapRulesOptions = {},
): MapDocument {
  let next = document
  const phases = [...new Set(options.phases ?? rules.map((rule) => rule.phase))].sort((left, right) => left - right)
  const region = options.region ?? { left: 0, top: 0, width: document.width, height: document.height }
  const groups = new Map((options.groups ?? []).map((group) => [group.id, group] as const))
  const targetLayerId = options.targetLayerId ?? layerId
  for (const phase of phases) {
    // Compara contra la capa DESTINO para no reescribir valores idénticos (evita revisiones vacías).
    const targetCells = next.layers.find((layer) => layer.id === targetLayerId)?.cells
    const compareAt = targetLayerId === layerId ? undefined : (x: number, y: number) => targetCells?.get(`${x},${y}`)
    const changes = evaluatePhase(next, layerId, rules, phase, options.seed ?? 0, region, groups, compareAt)
    if (changes.length) next = applyMapCells(next, targetLayerId, changes)
  }
  return next
}

/**
 * Modo incremental: re-evalúa la región afectada alrededor de cada coordenada editada.
 * El margen cubre el alcance máximo de las condiciones (radio de vecinos) dilatado una
 * vez por fase (cono causal). Para rulesets ESTABLES (cada fase solo consume salidas
 * previas, sin oscilar sobre sus propias celdas) el resultado coincide exactamente con
 * el pase completo; rulesets oscilantes pueden requerir un pase completo manual.
 */
export function applyMapRulesIncremental(
  document: MapDocument,
  layerId: string,
  editedCoordinates: readonly GridCoordinate[],
  rules: readonly MapPatternRule[],
  options: MapRulesOptions = {},
): MapDocument {
  const phases = [...new Set(options.phases ?? rules.map((rule) => rule.phase))].sort((left, right) => left - right)
  let reach = 0
  for (const rule of rules) for (const key of Object.keys(rule.condition.neighbors ?? {})) {
    const offset = parseOffsetKey(key)
    if (offset) reach = Math.max(reach, Math.abs(offset[0]), Math.abs(offset[1]))
  }
  // Cada frontera de fase dilata el cono causal en `reach`: margen = alcance × número de fases.
  const margin = Math.max(1, reach) * Math.max(1, phases.length)
  const affected = new Map<string, GridCoordinate>()
  for (const coordinate of editedCoordinates) {
    for (let dy = -margin; dy <= margin; dy += 1) for (let dx = -margin; dx <= margin; dx += 1) {
      const x = coordinate.x + dx; const y = coordinate.y + dy
      if (x >= 0 && y >= 0 && x < document.width && y < document.height) affected.set(`${x},${y}`, { x, y })
    }
  }
  if (!affected.size) return document
  const ordered = [...affected.values()].sort((left, right) => left.y - right.y || left.x - right.x)
  const left = Math.min(...ordered.map((point) => point.x))
  const top = Math.min(...ordered.map((point) => point.y))
  const region = {
    left,
    top,
    width: Math.max(...ordered.map((point) => point.x)) - left + 1,
    height: Math.max(...ordered.map((point) => point.y)) - top + 1,
  }
  return applyMapRulePass(document, layerId, rules, { ...options, region })
}

export function mapRuleDiagnostics(document: MapDocument, rules: readonly MapPatternRule[], groups: readonly MapRuleGroup[] = []): readonly MapRuleDiagnostics[] {
  const result: MapRuleDiagnostics[] = []
  const seen = new Set<string>()
  const tileCounts = new Map(document.tilesets.map((tileset) => [tileset.id, tileset.tileCount] as const))
  const knownGroups = new Set(groups.map((group) => group.id))
  for (const rule of rules) {
    if (seen.has(rule.id)) result.push({ code: 'MAP_RULE_DUPLICATE_ID', severity: 'error', ruleId: rule.id, message: `${rule.name}: id duplicado.` })
    seen.add(rule.id)
    if (!(rule.weight > 0) || !Number.isFinite(rule.weight)) result.push({ code: 'MAP_RULE_WEIGHT_INVALID', severity: 'error', ruleId: rule.id, message: `${rule.name}: peso inválido.` })
    if (!Number.isFinite(rule.priority)) result.push({ code: 'MAP_RULE_PRIORITY_INVALID', severity: 'error', ruleId: rule.id, message: `${rule.name}: prioridad inválida.` })
    if (rule.chance !== undefined && (!Number.isFinite(rule.chance) || rule.chance < 0 || rule.chance > 1)) result.push({ code: 'MAP_RULE_WEIGHT_INVALID', severity: 'error', ruleId: rule.id, message: `${rule.name}: probabilidad fuera de 0..1.` })
    if (!rule.outputs.length) result.push({ code: 'MAP_RULE_OUTPUT_EMPTY', severity: 'error', ruleId: rule.id, message: `${rule.name}: sin salidas.` })
    for (const predicate of Object.values(rule.condition.neighbors ?? {})) {
      if (typeof predicate === 'object' && predicate.kind === 'group' && !knownGroups.has(predicate.groupId)) {
        result.push({ code: 'MAP_RULE_GROUP_MISSING', severity: 'error', ruleId: rule.id, message: `${rule.name}: usa un grupo de similitud eliminado.` })
      }
    }
    for (const output of rule.outputs) {
      const count = tileCounts.get(output.tilesetId)
      if (count === undefined) { result.push({ code: 'MAP_RULE_OUTPUT_TILESET_MISSING', severity: 'error', ruleId: rule.id, message: `${rule.name}: tileset inexistente.` }); continue }
      if (output.tileId < 0 || output.tileId >= count) result.push({ code: 'MAP_RULE_OUTPUT_TILE_OUT_OF_BOUNDS', severity: 'error', ruleId: rule.id, message: `${rule.name}: tile ${output.tileId} fuera del tileset.` })
      const weight = output.weight ?? rule.weight
      if (!(weight > 0) || !Number.isFinite(weight)) result.push({ code: 'MAP_RULE_WEIGHT_INVALID', severity: 'error', ruleId: rule.id, message: `${rule.name}: peso de variante inválido.` })
    }
    if (rule.condition.tileId !== undefined && rule.condition.tileId < 0) result.push({ code: 'MAP_RULE_OUTPUT_TILE_OUT_OF_BOUNDS', severity: 'error', ruleId: rule.id, message: `${rule.name}: condición con tile negativo.` })
  }
  return result
}

/** Explica qué regla coincidiría en una celda (soporte de "buscar coincidencias"). */
export function explainRuleAt(
  document: MapDocument,
  layerId: string,
  coordinate: GridCoordinate,
  rules: readonly MapPatternRule[],
  groups: readonly MapRuleGroup[] = [],
): { matched?: string; reason: 'EMPTY_CELL' | 'NO_MATCH' | 'MATCHED'; candidates: readonly string[] } {
  const layer = document.layers.find((candidate) => candidate.id === layerId)
  const tile = layer?.cells.get(`${coordinate.x},${coordinate.y}`)
  if (!layer || !tile) return { reason: 'EMPTY_CELL', candidates: [] }
  const neighborAt = (x: number, y: number) => layer.cells.get(`${x},${y}`)
  const groupMap = new Map(groups.map((group) => [group.id, group] as const))
  const candidates = rules.filter((rule) => ruleMatches(rule, { x: coordinate.x, y: coordinate.y, tile, neighborAt, groups: groupMap }))
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id)).map((rule) => rule.id)
  return candidates.length ? { matched: candidates[0], reason: 'MATCHED', candidates } : { reason: 'NO_MATCH', candidates }
}

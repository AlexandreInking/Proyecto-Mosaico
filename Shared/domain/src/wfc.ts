import { applyMapCells, type MapDocument, type TileReference } from './map-document.js'

/**
 * TRN-403 · Wave Function Collapse (modelo Overlapping) para Maps.
 *
 * Extrae patrones N×N de una región muestra del propio mapa, precomputa adyacencias por
 * solapamiento y colapsa una región destino con semilla determinista y backtracking
 * acotado (deshacer por instantáneas de dominios).
 */

export interface WfcPattern {
  readonly id: number
  /** TileIds en orden row-major N×N (-1 = vacío). */
  readonly cells: readonly number[]
  /** Tileset de cada celda (paralelo a cells). */
  readonly tilesetIds: readonly string[]
  readonly weight: number
}

export interface WfcSample {
  readonly size: number
  readonly patterns: readonly WfcPattern[]
  /** adjacency[dir][patternId] = ids compatibles en esa dirección (0=este,1=sur,2=oeste,3=norte). */
  readonly adjacency: readonly number[][][]
}

export interface WfcResult {
  /** TileId colapsado por celda (row-major) o undefined si quedó sin resolver. */
  readonly cells: readonly (number | undefined)[]
  readonly tilesetIds: readonly (string | undefined)[]
  readonly solved: boolean
  readonly contradictions: number
  readonly backtracks: number
}

const DIRS: readonly (readonly [number, number])[] = [[1, 0], [0, 1], [-1, 0], [0, -1]]

const patternKey = (cells: readonly (string | number)[]): string => cells.join('|')

/** Extrae patrones N×N de la región muestra; las celdas vacías usan tileId -1. */
export function extractWfcPatterns(
  document: MapDocument,
  layerId: string,
  region: { readonly left: number; readonly top: number; readonly width: number; readonly height: number },
  size: number,
): WfcSample {
  const layer = document.layers.find((candidate) => candidate.id === layerId)
  if (!layer || layer.isFolder || size < 1) return { size, patterns: [], adjacency: [] }
  const at = (x: number, y: number): { tileId: number; tilesetId: string } => {
    if (x < region.left || y < region.top || x >= region.left + region.width || y >= region.top + region.height) return { tileId: -1, tilesetId: '' }
    const tile = layer.cells.get(`${x},${y}`)
    return tile ? { tileId: tile.tileId, tilesetId: tile.tilesetId } : { tileId: -1, tilesetId: '' }
  }
  const weights = new Map<string, number>()
  const order: { cells: number[]; tilesetIds: string[] }[] = []
  for (let y = region.top; y + size <= region.top + region.height; y += 1) {
    for (let x = region.left; x + size <= region.left + region.width; x += 1) {
      const cells: number[] = []; const tilesetIds: string[] = []
      for (let dy = 0; dy < size; dy += 1) for (let dx = 0; dx < size; dx += 1) {
        const value = at(x + dx, y + dy)
        cells.push(value.tileId); tilesetIds.push(value.tilesetId)
      }
      const key = patternKey(cells)
      const existing = weights.get(key)
      if (existing === undefined) { weights.set(key, 1); order.push({ cells, tilesetIds }) } else weights.set(key, existing + 1)
    }
  }
  const patterns: WfcPattern[] = order.map((entry, id) => ({ id, cells: entry.cells, tilesetIds: entry.tilesetIds, weight: weights.get(patternKey(entry.cells))! }))
  const adjacencyDirs: number[][][] = patterns.map(() => [[], [], [], []])
  for (const a of patterns) for (const b of patterns) {
    for (let dir = 0; dir < 4; dir += 1) {
      const [dx, dy] = DIRS[dir]!
      let compatible = true
      for (let row = 0; row < size && compatible; row += 1) {
        for (let col = 0; col < size && compatible; col += 1) {
          const bx = col - dx; const by = row - dy
          if (bx < 0 || by < 0 || bx >= size || by >= size) continue
          if (a.cells[row * size + col] !== b.cells[by * size + bx]) compatible = false
        }
      }
      if (compatible) adjacencyDirs[a.id]![dir]!.push(b.id)
    }
  }
  const adjacency: readonly number[][][] = adjacencyDirs.map((dirs) => dirs.map((list) => [...new Set(list)]))
  return { size, patterns, adjacency }
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

export interface WfcOptions {
  readonly seed?: number
  readonly maxBacktracks?: number
}

/** Colapsa una rejilla width×height con los patrones de la muestra. */
export function wfcSolve(width: number, height: number, sample: WfcSample, options: WfcOptions = {}): WfcResult {
  const { size, patterns, adjacency } = sample
  const total = width * height
  const emptyCells: (number | undefined)[] = Array.from({ length: total }, () => undefined)
  const empty: WfcResult = { cells: emptyCells, tilesetIds: Array.from({ length: total }, () => undefined), solved: false, contradictions: 0, backtracks: 0 }
  if (!patterns.length || size < 1 || width < 1 || height < 1) return empty
  const random = mulberry32(options.seed ?? 1)
  const maxBacktracks = options.maxBacktracks ?? 512

  // Dominios como flags planas (1 byte por patrón y celda): sin aliasing de 32 bits.
  if (patterns.length > 4096) throw new RangeError('WFC_SAMPLE_TOO_COMPLEX')
  const P = patterns.length
  const domains = new Uint8Array(total * P).fill(1)
  const collapsed: (number | undefined)[] = Array.from({ length: total }, () => undefined)
  const scratch = new Uint8Array(P)

  const domainCount = (index: number): number => { let count = 0; const base = index * P; for (let i = 0; i < P; i += 1) count += domains[base + i]!; return count }

  const neighborsOf = (index: number): readonly (readonly [number, number])[] => {
    const x = index % width; const y = Math.floor(index / width)
    const result: (readonly [number, number])[] = []
    for (let dir = 0; dir < 4; dir += 1) {
      const nx = x + DIRS[dir]![0]!; const ny = y + DIRS[dir]![1]!
      if (nx >= 0 && ny >= 0 && nx < width && ny < height) result.push([ny * width + nx, dir] as const)
    }
    return result
  }

  interface DomainChange { readonly index: number; readonly previous: number }

  /** Propaga restricciones; devuelve los cambios para poder deshacer y el nº de contradicciones. */
  const propagate = (queue: number[]): { changes: DomainChange[]; contradictions: number } => {
    const changes: DomainChange[] = []
    let contradictions = 0
    while (queue.length) {
      const index = queue.pop()!
      const base = index * P
      for (const [neighbor, dir] of neighborsOf(index)) {
        if (collapsed[neighbor] !== undefined) continue
        scratch.fill(0)
        for (let candidate = 0; candidate < P; candidate += 1) {
          if (!domains[base + candidate]) continue
          for (const supported of adjacency[candidate]![dir] ?? []) scratch[supported] = 1
        }
        const neighborBase = neighbor * P
        let changed = false
        for (let candidate = 0; candidate < P; candidate += 1) {
          if (!scratch[candidate] && domains[neighborBase + candidate]) {
            changes.push({ index: neighborBase + candidate, previous: 1 })
            domains[neighborBase + candidate] = 0
            changed = true
          }
        }
        if (changed) {
          let remaining = 0; for (let candidate = 0; candidate < P; candidate += 1) remaining += domains[neighborBase + candidate]!
          if (remaining === 0) contradictions += 1
          else queue.push(neighbor)
        }
      }
    }
    return { changes, contradictions }
  }

  let backtracks = 0
  let totalContradictions = 0
  const solve = (depth: number): boolean => {
    let best = -1; let bestEntropy = Number.POSITIVE_INFINITY
    for (let index = 0; index < total; index += 1) {
      if (collapsed[index] !== undefined) continue
      const entropy = domainCount(index)
      if (entropy === 0) return false
      if (entropy < bestEntropy) { bestEntropy = entropy; best = index }
    }
    if (best === -1) return true
    const base = best * P
    const candidates: { id: number; jitter: number }[] = []
    for (let candidate = 0; candidate < P; candidate += 1) if (domains[base + candidate]) candidates.push({ id: candidate, jitter: random() })
    // Peso descendente; desempate por jitter determinista de la semilla (comparador consistente).
    candidates.sort((left, right) => (patterns[right.id]!.weight - patterns[left.id]!.weight) || (left.jitter - right.jitter))
    for (const { id: candidate } of candidates) {
      collapsed[best] = candidate
      const ownChanges: DomainChange[] = []
      for (let candidateIndex = 0; candidateIndex < P; candidateIndex += 1) {
        if (candidateIndex !== candidate && domains[base + candidateIndex]) { ownChanges.push({ index: base + candidateIndex, previous: 1 }); domains[base + candidateIndex] = 0 }
      }
      const { changes, contradictions } = propagate([best])
      totalContradictions += contradictions
      if (contradictions === 0 && solve(depth + 1)) return true
      // Deshacer en orden inverso: primero la propagación, luego el colapso propio.
      for (let index = changes.length - 1; index >= 0; index -= 1) domains[changes[index]!.index] = changes[index]!.previous
      for (let index = ownChanges.length - 1; index >= 0; index -= 1) domains[ownChanges[index]!.index] = ownChanges[index]!.previous
      collapsed[best] = undefined
      backtracks += 1
      if (backtracks > maxBacktracks || depth > 4096) return false
    }
    return false
  }

  const solved = solve(0)
  const center = Math.floor(size / 2) * size + Math.floor(size / 2)
  const cells: (number | undefined)[] = Array.from({ length: total }, (_, index) => {
    const patternId = collapsed[index]
    return patternId === undefined ? undefined : patterns[patternId]!.cells[center]!
  })
  const tilesetIds: (string | undefined)[] = Array.from({ length: total }, (_, index) => {
    const patternId = collapsed[index]
    return patternId === undefined ? undefined : patterns[patternId]!.tilesetIds[center]!
  })
  return { cells, tilesetIds, solved, contradictions: totalContradictions, backtracks }
}

export interface WfcApplyOptions extends WfcOptions {
  /** Conserva celdas destino que ya tienen tile. */
  readonly keepExisting?: boolean
  /** Tamaño de patrón explícito (1-4); por defecto el máximo que cabe en la muestra. */
  readonly size?: number
}

/** Genera con WFC en la región destino y escribe los tiles vía applyMapCells. */
export function applyWfcToRegion(
  document: MapDocument,
  sourceLayerId: string,
  targetLayerId: string,
  sampleRegion: { readonly left: number; readonly top: number; readonly width: number; readonly height: number },
  targetRegion: { readonly left: number; readonly top: number; readonly width: number; readonly height: number },
  options: WfcApplyOptions = {},
): { document: MapDocument; result: WfcResult } {
  const size = Math.min(4, Math.max(1, options.size ?? Math.min(sampleRegion.width, sampleRegion.height)))
  const sample = extractWfcPatterns(document, sourceLayerId, sampleRegion, size)
  const result = wfcSolve(targetRegion.width, targetRegion.height, sample, options)
  const targetLayer = document.layers.find((layer) => layer.id === targetLayerId)
  const changes: ({ x: number; y: number } & { tile?: TileReference })[] = []
  for (let y = 0; y < targetRegion.height; y += 1) for (let x = 0; x < targetRegion.width; x += 1) {
    const gx = targetRegion.left + x; const gy = targetRegion.top + y
    if (gx < 0 || gy < 0 || gx >= document.width || gy >= document.height) continue
    const key = `${gx},${gy}`
    if (options.keepExisting && targetLayer?.cells.has(key)) continue
    const tileId = result.cells[y * targetRegion.width + x]
    const tilesetId = result.tilesetIds[y * targetRegion.width + x]
    if (tileId === undefined || tileId < 0 || !tilesetId) changes.push({ x: gx, y: gy })
    else changes.push({ x: gx, y: gy, tile: { tilesetId, tileId } })
  }
  return { document: changes.length ? applyMapCells(document, targetLayerId, changes) : document, result }
}

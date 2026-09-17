import { describe, expect, it } from 'vitest'
import { applyMapCells, applyWfcToRegion, createMapDocument, extractWfcPatterns, wfcSolve } from '../src/index.js'

const tilesetId = 'b1000000-0000-4000-8000-000000000001'
const layerId = 'b2000000-0000-4000-8000-000000000001'

function baseDocument(width = 16, height = 16) {
  return createMapDocument({
    id: 'b3000000-0000-4000-8000-000000000001',
    name: 'WFC', width, height, cellWidth: 16, cellHeight: 16,
    layerId,
    tilesets: [{ id: tilesetId, name: 'TS', assetId: 'asset', imageWidth: 128, imageHeight: 16, tileWidth: 16, tileHeight: 16, marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 8 }],
  })
}

const paint = (document: ReturnType<typeof baseDocument>, cells: readonly (readonly [number, number, number])[]) =>
  applyMapCells(document, layerId, cells.map(([x, y, tileId]) => ({ x, y, tile: { tilesetId, tileId } })))

const tilesOf = (document: ReturnType<typeof baseDocument>): readonly (number | undefined)[] => {
  const layer = document.layers.find((candidate) => candidate.id === layerId)!
  return Array.from({ length: document.width * document.height }, (_, index) => layer.cells.get(`${index % document.width},${Math.floor(index / document.width)}`)?.tileId)
}

describe('wfc (TRN-403 · overlapping)', () => {
  it('extrae patrones ponderados de la muestra', () => {
    let document = baseDocument()
    // Franja 4×2 de tile 1 → un único patrón 2×2 con peso alto.
    const cells: [number, number, number][] = []
    for (let y = 0; y < 2; y += 1) for (let x = 0; x < 4; x += 1) cells.push([x, y, 1])
    document = paint(document, cells)
    const sample = extractWfcPatterns(document, layerId, { left: 0, top: 0, width: 4, height: 2 }, 2)
    expect(sample.patterns).toHaveLength(1)
    expect(sample.patterns[0]!.cells).toEqual([1, 1, 1, 1])
    expect(sample.patterns[0]!.weight).toBe(3)
    expect(sample.patterns[0]!.tilesetIds.every((id) => id === tilesetId)).toBe(true)
  })

  it('la misma semilla reproduce el resultado', () => {
    let document = baseDocument()
    const cells: [number, number, number][] = []
    for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) cells.push([x, y, (x + y) % 2])
    document = paint(document, cells)
    const sample = extractWfcPatterns(document, layerId, { left: 0, top: 0, width: 8, height: 8 }, 2)
    const a = wfcSolve(6, 6, sample, { seed: 11 })
    const b = wfcSolve(6, 6, sample, { seed: 11 })
    expect(a.cells).toEqual(b.cells)
    expect(a.solved).toBe(true)
  })

  it('genera una región respetando las adyacencias de la muestra', () => {
    let document = baseDocument()
    const cells: [number, number, number][] = []
    for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) cells.push([x, y, (x + y) % 2])
    document = paint(document, cells)
    const { document: generated, result } = applyWfcToRegion(document, layerId, layerId, { left: 0, top: 0, width: 8, height: 8 }, { left: 0, top: 0, width: 6, height: 6 }, { seed: 5 })
    expect(result.solved).toBe(true)
    const all = tilesOf(generated)
    const tiles = Array.from({ length: 36 }, (_, index) => all[Math.floor(index / 6) * document.width + index % 6])
    expect(tiles.every((tile) => tile === 0 || tile === 1)).toBe(true)
    // Adyacencia 2×2 válida: cada vecino derecho difiere (patrón (x+y)%2).
    for (let y = 0; y < 6; y += 1) for (let x = 0; x < 5; x += 1) {
      const here = tiles[y * 6 + x]!; const right = tiles[y * 6 + x + 1]!
      expect(right === here ? false : true).toBe(true)
    }
  })

  it('soporta muestras con más de 32 patrones sin aliasing de bits', () => {
    let document = baseDocument()
    const cells: [number, number, number][] = []
    for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) cells.push([x, y, (x * 7 + y * 11 + ((x * y) % 5)) % 8])
    document = paint(document, cells)
    const sample = extractWfcPatterns(document, layerId, { left: 0, top: 0, width: 8, height: 8 }, 3)
    expect(sample.patterns.length).toBeGreaterThan(32)
    const a = wfcSolve(8, 8, sample, { seed: 21, maxBacktracks: 2000 })
    const b = wfcSolve(8, 8, sample, { seed: 21, maxBacktracks: 2000 })
    expect(a.cells).toEqual(b.cells)
    // Todas las celdas resueltas pertenecen al alfabeto de la muestra.
    expect(a.cells.every((tile) => tile === undefined || (tile >= 0 && tile < 8))).toBe(true)
  })

  it('keepExisting conserva las celdas destino ya pintadas', () => {
    let document = baseDocument()
    const cells: [number, number, number][] = []
    for (let y = 0; y < 4; y += 1) for (let x = 0; x < 4; x += 1) cells.push([x, y, 1])
    document = paint(document, cells)
    document = paint(document, [[0, 0, 6]]) // celda protegida
    const { document: generated } = applyWfcToRegion(document, layerId, layerId, { left: 0, top: 0, width: 4, height: 4 }, { left: 0, top: 0, width: 4, height: 4 }, { seed: 2, keepExisting: true })
    expect(tilesOf(generated)[0]).toBe(6)
  })
})

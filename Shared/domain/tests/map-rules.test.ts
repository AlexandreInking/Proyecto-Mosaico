import { describe, expect, it } from 'vitest'
import {
  applyMapCells,
  applyMapRulePass,
  applyMapRulesIncremental,
  createMapDocument,
  explainRuleAt,
  mapRuleDiagnostics,
  ruleNeighbors,
  type MapPatternRule,
  type MapRuleGroup,
} from '../src/index.js'

const tilesetId = 'e0000000-0000-4000-8000-000000000001'
const layerId = 'f0000000-0000-4000-8000-000000000001'

function baseDocument(width = 8, height = 8) {
  return createMapDocument({
    id: 'a1000000-0000-4000-8000-000000000001',
    name: 'Reglas', width, height, cellWidth: 16, cellHeight: 16,
    layerId,
    tilesets: [{ id: tilesetId, name: 'TS', assetId: 'asset', imageWidth: 128, imageHeight: 16, tileWidth: 16, tileHeight: 16, marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 8 }],
  })
}

const paintRow = (document: ReturnType<typeof baseDocument>, y: number, tileIds: readonly number[]) =>
  applyMapCells(document, layerId, tileIds.map((tileId, x) => ({ x, y, tile: { tilesetId, tileId } })))

const paintBlock = (document: ReturnType<typeof baseDocument>, left: number, top: number, width: number, height: number, tileId: number) => {
  const changes: { x: number; y: number; tile: { tilesetId: string; tileId: number } }[] = []
  for (let y = top; y < top + height; y += 1) for (let x = left; x < left + width; x += 1) changes.push({ x, y, tile: { tilesetId, tileId } })
  return applyMapCells(document, layerId, changes)
}

const tilesOf = (document: ReturnType<typeof baseDocument>, targetLayerId = layerId): readonly (number | undefined)[] => {
  const layer = document.layers.find((candidate) => candidate.id === targetLayerId)!
  return Array.from({ length: document.width * document.height }, (_, index) => {
    const x = index % document.width; const y = Math.floor(index / document.width)
    return layer.cells.get(`${x},${y}`)?.tileId
  })
}

describe('map rule engine (TRN-401)', () => {
  it('respeta prioridad: gana la regla de menor número', () => {
    const rules: MapPatternRule[] = [
      { id: 'low', name: 'Baja', priority: 10, phase: 0, weight: 1, condition: { tileId: 1 }, outputs: [{ tilesetId, tileId: 2 }] },
      { id: 'high', name: 'Alta', priority: 1, phase: 0, weight: 1, condition: { tileId: 1 }, outputs: [{ tilesetId, tileId: 3 }] },
    ]
    let document = baseDocument(); document = paintRow(document, 0, [1])
    document = applyMapRulePass(document, layerId, rules)
    expect(tilesOf(document)[0]).toBe(3)
  })

  it('las fases avanzan en orden y la fase posterior ve los resultados de la anterior', () => {
    const rules: MapPatternRule[] = [
      { id: 'p0', name: 'Fase 0', priority: 1, phase: 0, weight: 1, condition: { tileId: 1, neighbors: ruleNeighbors({ east: 'same' }) }, outputs: [{ tilesetId, tileId: 2 }] },
      { id: 'p1', name: 'Fase 1', priority: 1, phase: 1, weight: 1, condition: { tileId: 2, neighbors: ruleNeighbors({ west: 'same' }) }, outputs: [{ tilesetId, tileId: 3 }] },
    ]
    let document = baseDocument(4, 1); document = paintRow(document, 0, [1, 1, 1])
    document = applyMapRulePass(document, layerId, rules)
    // Instantáneas por fase: fase 0 → [2,2,1]; fase 1 → x1 ve oeste=2 → 3. Resultado [2,3,1].
    expect(tilesOf(document)).toEqual([2, 3, 1, undefined])
  })

  it('misma semilla reproduce el resultado y semillas distintas pueden variar', () => {
    const variantRule: MapPatternRule[] = [
      { id: 'v', name: 'Variantes', priority: 1, phase: 0, weight: 1, condition: {}, outputs: [{ tilesetId, tileId: 4 }, { tilesetId, tileId: 5 }] },
    ]
    let document = baseDocument(8, 8); document = paintBlock(document, 0, 0, 8, 8, 1)
    const seedA = applyMapRulePass(document, layerId, variantRule, { seed: 7 })
    const seedA2 = applyMapRulePass(document, layerId, variantRule, { seed: 7 })
    const seedB = applyMapRulePass(document, layerId, variantRule, { seed: 8 })
    expect(tilesOf(seedA)).toEqual(tilesOf(seedA2))
    expect(tilesOf(seedA)).not.toEqual(tilesOf(seedB))
  })

  it('las rotaciones expanden la condición a sus cuatro orientaciones', () => {
    const straight: MapPatternRule[] = [
      { id: 'n', name: 'Norte', priority: 1, phase: 0, weight: 1, condition: { neighbors: ruleNeighbors({ north: 'same' }) }, outputs: [{ tilesetId, tileId: 4 }] },
    ]
    const rotating: MapPatternRule[] = [
      { id: 'rot', name: 'Rotante', priority: 1, phase: 0, weight: 1, allowRotations: true, condition: { neighbors: ruleNeighbors({ north: 'same' }) }, outputs: [{ tilesetId, tileId: 4 }] },
    ]
    let vertical = baseDocument(3, 2); vertical = paintRow(vertical, 0, [1]); vertical = paintRow(vertical, 1, [1])
    let horizontal = baseDocument(3, 1); horizontal = paintRow(horizontal, 0, [1, 1])
    expect(tilesOf(applyMapRulePass(vertical, layerId, straight))[3]).toBe(4)
    expect(tilesOf(applyMapRulePass(horizontal, layerId, straight))[0]).toBe(1)
    expect(tilesOf(applyMapRulePass(horizontal, layerId, rotating))[0]).toBe(4)
  })

  it('los grupos de similitud actúan como predicados, incluso negados y a radio 2', () => {
    const ground: MapRuleGroup = { id: 'g-ground', name: 'Suelo', color: '#2f8f6b', members: [{ tilesetId, tileId: 1 }, { tilesetId, tileId: 2 }] }
    const rules: MapPatternRule[] = [
      // A dos casillas por ENCIMA de un miembro del grupo Suelo (south2 apunta al suelo) → decoración
      { id: 'deco', name: 'Deco', priority: 1, phase: 0, weight: 1, condition: { neighbors: ruleNeighbors({ south2: { kind: 'group', groupId: 'g-ground' } }) }, outputs: [{ tilesetId, tileId: 6 }] },
      // Junto a un tile que NO es del grupo Suelo → variante
      { id: 'edge', name: 'Borde', priority: 2, phase: 0, weight: 1, condition: { tileId: 1, neighbors: ruleNeighbors({ east: { kind: 'group', groupId: 'g-ground', negated: true } }) }, outputs: [{ tilesetId, tileId: 7 }] },
    ]
    let document = baseDocument(6, 6)
    document = paintBlock(document, 0, 2, 6, 2, 1) // franja Suelo en y=2..3
    document = applyMapCells(document, layerId, [{ x: 5, y: 2, tile: { tilesetId, tileId: 3 } }]) // rompe el grupo en el borde este
    const ruled = applyMapRulePass(document, layerId, rules, { seed: 1, groups: [ground] })
    const ruledTiles = tilesOf(ruled)
    expect(ruledTiles[0], '(0,0) deco sobre suelo a +2 sur').toBe(6)
    expect(ruledTiles[5], '(5,0) sin deco: south2=3 ∉ grupo').toBe(undefined)
    expect(ruledTiles[1 * 6 + 5], '(5,1) deco sobre suelo a +2 sur').toBe(6)
    expect(ruledTiles[2 * 6 + 4], '(4,2) borde junto a no-grupo este').toBe(7)
    expect(ruledTiles[2 * 6 + 0], '(0,2) suelo con este ∈ grupo no cambia').toBe(1)
    expect(ruledTiles[3 * 6 + 5], '(5,3) borde junto a vacío este').toBe(7)
  })

  it('ACEPTACIÓN TRN-401: el modo incremental equivale al recálculo completo', () => {
    const ground: MapRuleGroup = { id: 'g-ground', name: 'Suelo', members: [{ tilesetId, tileId: 1 }, { tilesetId, tileId: 2 }] }
    const rules: MapPatternRule[] = [
      { id: 'edge', name: 'Borde', priority: 1, phase: 0, weight: 1, condition: { tileId: 1, neighbors: ruleNeighbors({ north: 'different', south: 'different' }) }, outputs: [{ tilesetId, tileId: 2 }] },
      { id: 'fill', name: 'Relleno', priority: 5, phase: 0, weight: 1, condition: { tileId: 1, neighbors: ruleNeighbors({ east: 'same', west: 'same' }) }, outputs: [{ tilesetId, tileId: 3 }] },
      { id: 'corner', name: 'Esquina', priority: 2, phase: 1, weight: 1, allowRotations: true, condition: { tileId: 2, neighbors: ruleNeighbors({ southEast: { kind: 'group', groupId: 'g-ground' } }) }, outputs: [{ tilesetId, tileId: 4 }] },
    ]
    const scenario = (editX: number, editY: number, editTileId: number) => {
      let normalized = baseDocument(9, 9)
      normalized = paintBlock(normalized, 1, 1, 6, 6, 1)
      normalized = applyMapRulePass(normalized, layerId, rules, { seed: 42, groups: [ground] })
      const edited = applyMapCells(normalized, layerId, [{ x: editX, y: editY, tile: { tilesetId, tileId: editTileId } }])
      const expected = applyMapRulePass(edited, layerId, rules, { seed: 42, groups: [ground] })
      const actual = applyMapRulesIncremental(edited, layerId, [{ x: editX, y: editY }], rules, { seed: 42, groups: [ground] })
      expect(tilesOf(actual)).toEqual(tilesOf(expected))
    }
    scenario(4, 4, 1)
    scenario(1, 1, 1)
    scenario(3, 5, 2)
    scenario(6, 6, 1)
    scenario(0, 0, 1)
  })

  it('margen incremental cubre alcance 2 con fases encadenadas estables (radio × fases)', () => {
    const ground: MapRuleGroup = { id: 'g-ground', name: 'Suelo', members: [{ tilesetId, tileId: 1 }] }
    // Fase 0 a distancia 2 marca decoración bajo suelo; fase 1 consume SOLO esa decoración
    // (tile 4) y la convierte — sin oscilar sobre celdas de otras fases → ruleset estable.
    const rules: MapPatternRule[] = [
      { id: 'r2', name: 'Radio2', priority: 1, phase: 0, weight: 1, condition: { neighbors: ruleNeighbors({ north2: { kind: 'group', groupId: 'g-ground' } }) }, outputs: [{ tilesetId, tileId: 4 }] },
      { id: 'cap', name: 'Tapa', priority: 1, phase: 1, weight: 1, condition: { tileId: 4, neighbors: ruleNeighbors({ east: { kind: 'group', groupId: 'g-ground' } }) }, outputs: [{ tilesetId, tileId: 5 }] },
    ]
    const run = (document: ReturnType<typeof baseDocument>) => applyMapRulePass(document, layerId, rules, { seed: 3, groups: [ground] })
    let normalized = baseDocument(7, 7)
    normalized = paintBlock(normalized, 0, 0, 7, 2, 1) // franja Suelo arriba
    normalized = run(normalized)
    expect(tilesOf(normalized)[2 * 7]).toBe(4) // (0,2) decoración de fase 0
    for (const [x, y] of [[2, 3], [4, 4], [6, 2], [3, 5]] as const) {
      const edited = applyMapCells(normalized, layerId, [{ x, y, tile: { tilesetId, tileId: 1 } }])
      const expected = tilesOf(run(edited))
      const actual = tilesOf(applyMapRulesIncremental(edited, layerId, [{ x, y }], rules, { seed: 3, groups: [ground] }))
      expect(actual, `edición en (${x},${y})`).toEqual(expected)
    }
  })

  it('capa destino: evalúa una capa y escribe en otra (estilo blueprint)', () => {
    const rules: MapPatternRule[] = [
      { id: 'wall', name: 'Muro', priority: 1, phase: 0, weight: 1, condition: { tileId: 1 }, outputs: [{ tilesetId, tileId: 5 }] },
    ]
    let dual = baseDocument()
    const artLayerId = 'aa000000-0000-4000-8000-000000000002'
    dual = { ...dual, layers: [...dual.layers, { ...dual.layers[0]!, id: artLayerId, name: 'Arte' }] }
    dual = paintRow(dual, 0, [1]) // el boceto vive en la capa origen
    const result = applyMapRulePass(dual, layerId, rules, { targetLayerId: artLayerId })
    expect(tilesOf(result)[0]).toBe(1)               // origen intacto (sigue siendo boceto)
    expect(tilesOf(result, artLayerId)[0]).toBe(5)   // destino recibe la salida
  })

  it('chance puerta el disparo de la regla y los pesos por variante reparten la salida', () => {
    let document = baseDocument(4, 2); document = paintBlock(document, 0, 0, 4, 2, 1)
    const never = applyMapRulePass(document, layerId, [
      { id: 'c0', name: 'Nunca', priority: 1, phase: 0, weight: 1, chance: 0, condition: { tileId: 1 }, outputs: [{ tilesetId, tileId: 4 }] },
    ])
    expect(tilesOf(never)).toEqual(tilesOf(document))
    const always = applyMapRulePass(document, layerId, [
      { id: 'c1', name: 'Siempre', priority: 1, phase: 0, weight: 1, chance: 1, condition: { tileId: 1 }, outputs: [{ tilesetId, tileId: 5 }] },
    ], { seed: 3 })
    expect(tilesOf(always).every((tile) => tile === 5)).toBe(true)
    for (const seed of [1, 2, 3, 4, 5]) {
      const weighted = applyMapRulePass(document, layerId, [
        { id: 'w', name: 'Pesos', priority: 1, phase: 0, weight: 1, condition: { tileId: 1 }, outputs: [{ tilesetId, tileId: 6, weight: 0 }, { tilesetId, tileId: 7, weight: 50 }] },
      ], { seed })
      expect(tilesOf(weighted).every((tile) => tile === 7)).toBe(true)
    }
    const halfRules: MapPatternRule[] = [
      { id: 'h', name: 'Mitad', priority: 1, phase: 0, weight: 1, chance: 0.5, condition: { tileId: 1 }, outputs: [{ tilesetId, tileId: 6 }] },
    ]
    expect(tilesOf(applyMapRulePass(document, layerId, halfRules, { seed: 9 })))
      .toEqual(tilesOf(applyMapRulePass(document, layerId, halfRules, { seed: 9 })))
  })

  it('diagnostica reglas inválidas y grupos eliminados', () => {
    const broken: MapPatternRule[] = [
      { id: 'dup', name: 'A', priority: 1, phase: 0, weight: 1, condition: {}, outputs: [{ tilesetId, tileId: 1 }] },
      { id: 'dup', name: 'B', priority: 1, phase: 0, weight: 0, condition: {}, outputs: [] },
      { id: 'ts', name: 'C', priority: 1, phase: 0, weight: 1, condition: {}, outputs: [{ tilesetId: '00000000-0000-4000-8000-000000000009', tileId: 0 }] },
      { id: 'oob', name: 'D', priority: 1, phase: 0, weight: 1, condition: {}, outputs: [{ tilesetId, tileId: 99 }] },
      { id: 'grp', name: 'E', priority: 1, phase: 0, weight: 1, condition: { neighbors: ruleNeighbors({ north: { kind: 'group', groupId: 'fantasma' } }) }, outputs: [{ tilesetId, tileId: 1 }] },
    ]
    const codes = mapRuleDiagnostics(baseDocument(), broken).map((diagnostic) => `${diagnostic.code}:${diagnostic.ruleId}`)
    expect(codes).toContain('MAP_RULE_DUPLICATE_ID:dup')
    expect(codes).toContain('MAP_RULE_WEIGHT_INVALID:dup')
    expect(codes).toContain('MAP_RULE_OUTPUT_EMPTY:dup')
    expect(codes).toContain('MAP_RULE_OUTPUT_TILESET_MISSING:ts')
    expect(codes).toContain('MAP_RULE_OUTPUT_TILE_OUT_OF_BOUNDS:oob')
    expect(codes).toContain('MAP_RULE_GROUP_MISSING:grp')
  })

  it('explainRuleAt explica coincidencias por prioridad', () => {
    const rules: MapPatternRule[] = [
      { id: 'a', name: 'A', priority: 2, phase: 0, weight: 1, condition: { tileId: 1 }, outputs: [{ tilesetId, tileId: 2 }] },
      { id: 'b', name: 'B', priority: 1, phase: 0, weight: 1, condition: { tileId: 1 }, outputs: [{ tilesetId, tileId: 3 }] },
    ]
    let document = baseDocument(); document = paintRow(document, 0, [1])
    expect(explainRuleAt(document, layerId, { x: 0, y: 0 }, rules)).toMatchObject({ reason: 'MATCHED', matched: 'b' })
    expect(explainRuleAt(document, layerId, { x: 5, y: 5 }, rules).reason).toBe('EMPTY_CELL')
  })
})

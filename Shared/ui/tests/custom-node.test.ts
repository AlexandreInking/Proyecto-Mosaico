import { describe, expect, it } from 'vitest'
import { parseCustomNodeDsl } from '../src/custom-node.js'

describe('custom node DSL', () => {
  it('parses typed declarations and registered calls', () => {
    const result = parseCustomNodeDsl('input source: Surface\nparam amount: Float = 1\noutput result: Surface\n\nresult = invert(source)', 'Invert custom')
    expect(result.diagnostics).toEqual([])
    expect(result.definition?.body.result).toEqual({ kind: 'call', name: 'invert', args: [{ kind: 'ref', ref: 'source' }] })
  })

  it('rejects arbitrary operations and missing outputs', () => {
    const result = parseCustomNodeDsl('input source: Surface\noutput result: Surface\nresult = eval(source)', 'Unsafe')
    expect(result.definition).toBeUndefined()
    expect(result.diagnostics.map((item) => item.message).join(' ')).toContain('not registered')
  })

  it('parses boolean ports and parameters', () => {
    const result = parseCustomNodeDsl('input condition: Bool\nparam enabled: Bool = true\noutput result: Bool\nresult = condition', 'Boolean custom')
    expect(result.diagnostics).toEqual([])
    expect(result.definition?.inputs[0]?.type).toBe('bool')
    expect(result.definition?.parameters[0]?.type).toBe('boolean')
  })
})

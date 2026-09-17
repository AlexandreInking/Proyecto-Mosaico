import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getPublishedNodeLibrary } from '../src/pipeline-node-registry.js'
import { createDemoNode } from '../src/pipeline-editor-model.js'
import { evaluatePipeline } from '../src/pipeline-evaluator.js'
import { PipelineInspector } from '../src/PipelineEditor.js'

/** Cada nodo publicado debe evaluar sin NODE_KIND_UNSUPPORTED y renderizar su inspector sin crash. */
describe('node registry sweep', () => {
  const library = getPublishedNodeLibrary()

  it('cada nodo del palette tiene definición y evaluador', () => {
    expect(library.length).toBeGreaterThan(100)
    for (const entry of library) expect(() => createDemoNode(entry.kind, `sweep-${entry.kind}`, { x: 0, y: 0 })).not.toThrow()
  })

  it('ninguna evaluación produce NODE_KIND_UNSUPPORTED', () => {
    const offenders: string[] = []
    for (const entry of library) {
      const node = createDemoNode(entry.kind, `sweep-${entry.kind}`, { x: 0, y: 0 })
      const nodes: Node[] = [{ id: node.id, type: 'mosaico', position: { x: 0, y: 0 }, data: { demo: node } }]
      const edges: Edge[] = []
      let evaluation
      try { evaluation = evaluatePipeline({ nodes: [node], edges: [] }, new Map(), 0) } catch (error) { offenders.push(`${entry.kind}: throw ${String(error)}`); continue }
      void nodes; void edges
      if (evaluation.diagnostics.includes('NODE_KIND_UNSUPPORTED')) offenders.push(entry.kind)
    }
    expect(offenders, `nodos sin evaluador: ${offenders.join(', ')}`).toEqual([])
  })

  it('el inspector renderiza parámetros para cada nodo publicado', () => {
    for (const entry of library) {
      const node = createDemoNode(entry.kind, `inspect-${entry.kind}`, { x: 0, y: 0 })
      const html = renderToStaticMarkup(<PipelineInspector selectedNode={node} onUpdateParameter={() => undefined} onAttachAsset={() => undefined} />)
      expect(html).toContain('pipeline-inspector')
    }
  })
})

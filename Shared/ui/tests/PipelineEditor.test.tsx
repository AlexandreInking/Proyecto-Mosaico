import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NodePreview, PipelineEditor, PipelineInspector } from '../src/PipelineEditor.js'
import { createDemoNode } from '../src/pipeline-editor-model.js'
import { createSurface } from '../src/pipeline-evaluator.js'

describe('PipelineEditor', () => {
  it('renders the local pipeline surface', () => {
    const html = renderToStaticMarkup(<PipelineEditor />)
    expect(html).toContain('Pipelines')
    expect(html).toContain('Evaluacion local')
    expect(html).toContain('empty output = transparent RGBA')
    expect(html).toContain('Resultado final')
    expect(html).toContain('pipeline-left-preview')
    expect(html).toContain('pipeline-real-preview')
    expect(html).toContain('pipeline-transparent-empty')
    expect(html).toContain('Explorador')
    expect(html).toContain('pipeline-inspector')
    expect(html).toContain('Selecciona un nodo')
    expect(html).toContain('aria-label="Buscar Assets"')
    expect(html).toContain('role="status"')
  })

  it('exposes palette, keyboard canvas and fixed timeline affordances', () => {
    const html = renderToStaticMarkup(<PipelineEditor />)
    expect(html).toContain('Nodos')
    expect(html).toContain('Doble clic o Space abre la palette')
    expect(html).toContain('aria-label="Canvas de Pipelines"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('class="react-flow pipeline-flow')
    expect(html).toContain('React Flow: arrastra nodos')
    expect(html).toContain('aria-keyshortcuts="Delete Backspace"')
    expect(html).toContain('pipeline-timeline-fixed')
    expect(html).toContain('Timeline zoom')
    expect(html).not.toContain('Flip 90°')
    expect(html).not.toContain('pipeline-project-actions')
    expect(html).not.toContain('>Supr<')
    expect(html).not.toContain('pipeline-node-search')
    expect(html).toContain('aria-label="Exportar resultado"')
    expect(html).toContain('pipeline-frame-timeline')
    expect(html).toContain('RGBA transparente')
  })

  it('shows an Asset drop target in the inspector for a selected Asset node', () => {
    const node = createDemoNode('asset', 'asset-1', { x: 0, y: 0 })
    const html = renderToStaticMarkup(<PipelineInspector selectedNode={node} onUpdateParameter={() => undefined} onAttachAsset={() => undefined} />)
    expect(html).toContain('data-pipeline-asset-drop-target="asset-1"')
    expect(html).toContain('Suelta un Asset para usarlo como fuente')
  })

  it('renders a real surface in a node preview instead of a placeholder', () => {
    const html = renderToStaticMarkup(<NodePreview surface={createSurface(1, 1, new Uint8ClampedArray([255, 0, 0, 255]))} />)
    expect(html).toContain('pipeline-node-real-preview')
    expect(html).not.toContain('pipeline-transparent-preview')
  })
})

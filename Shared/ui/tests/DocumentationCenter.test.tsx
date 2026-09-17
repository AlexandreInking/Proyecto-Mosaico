import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DocumentationCenter } from '../src/DocumentationCenter.js'

describe('DocumentationCenter', () => {
  it('contains active tools, formats, shortcuts and published node reference', () => {
    const html = renderToStaticMarkup(<DocumentationCenter locale="es" onClose={() => undefined} />)
    expect(html).toContain('Pipelines: canvas y palette')
    expect(html).toContain('Editor: herramientas')
    expect(html).toContain('Atajos de teclado')
    expect(html).toContain('Solid')
    expect(html).toContain('Time')
    expect(html).toContain('Formatos y guardado')
  })

  it('renders French and Italian help shell labels', () => {
    expect(renderToStaticMarkup(<DocumentationCenter locale="fr" onClose={() => undefined} />)).toContain('Aide Mosaico')
    expect(renderToStaticMarkup(<DocumentationCenter locale="it" onClose={() => undefined} />)).toContain('Aiuto Mosaico')
  })
})

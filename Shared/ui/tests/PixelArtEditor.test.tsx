import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PixelArtEditor } from '../src/PixelArtEditor.js'

describe('PixelArtEditor', () => {
  it('exposes visible authoring tools, document controls and layers', () => {
    const html = renderToStaticMarkup(<PixelArtEditor />)

    for (const label of ['Lápiz', 'Borrador', 'Relleno', 'Línea', 'Rectángulo', 'Elipse', 'Mano', 'Deshacer', 'Rehacer']) {
      expect(html).toContain(`aria-label="${label}"`)
    }
    expect(html).toContain('Nuevo lienzo')
    expect(html).toContain('Capas')
    expect(html).toContain('Capa 1')
  })
})

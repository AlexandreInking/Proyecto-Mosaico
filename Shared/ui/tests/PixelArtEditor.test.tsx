import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PixelArtEditor } from '../src/PixelArtEditor.js'

describe('PixelArtEditor', () => {
  it('exposes visible authoring tools, document controls and layers', () => {
    const html = renderToStaticMarkup(<PixelArtEditor />)

    for (const label of ['Lápiz', 'Borrador', 'Relleno', 'Línea', 'Rectángulo', 'Elipse', 'Selección', 'Mano', 'Deshacer', 'Rehacer', 'Exportar PNG']) {
      expect(html).toContain(`aria-label="${label}"`)
    }
    expect(html).toContain('Crear lienzo')
    expect(html).toContain('Capas')
    expect(html).toContain('Capa 1')
    expect(html).toContain('Paleta')
    expect(html).toContain('Timeline')
    for (const label of ['Reproducir animación', 'Añadir frame', 'Duplicar frame', 'Eliminar frame', 'Duración del frame']) {
      expect(html).toContain(`aria-label="${label}"`)
    }
    expect(html).toContain('pixel-tool-rail')
    expect(html).toContain('lucide')
    expect(html).not.toMatch(/[✎⌫▨✋🔒◇◉○＋−]/u)
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PixelArtEditor } from '../src/PixelArtEditor.js'

describe('PixelArtEditor', () => {
  it('exposes visible authoring tools, document controls and layers', () => {
    const html = renderToStaticMarkup(<PixelArtEditor />)

    for (const label of ['Lápiz', 'Borrador', 'Relleno', 'Línea', 'Selección rectangular', 'Mano', 'Deshacer', 'Rehacer', 'Exportar imagen']) {
      expect(html).toContain(`aria-label="${label}"`)
    }
    expect(html).not.toContain('aria-label="Rectángulo"')
    expect(html).not.toContain('aria-label="Elipse"')
    expect(html).toContain('>Archivo<')
    expect(html).toContain('Capas')
    expect(html).toContain('Capa 1')
    expect(html).toContain('Colores usados')
    expect(html).toContain('Timeline')
    for (const menu of ['Archivo', 'Editar', 'Imagen', 'Capa', 'Seleccionar', 'Filtro', 'Vista', 'Ventana', 'Otro']) expect(html).toContain(`>${menu}<`)
    expect(html).toContain('document-tabs')
    expect(html).not.toContain('>Crear lienzo<')
    for (const label of ['Reproducir animación', 'Añadir frame', 'Duplicar frame', 'Eliminar frame', 'Duración del frame', 'Onion skin', 'Exportar sprite sheet']) {
      expect(html).toContain(`aria-label="${label}"`)
    }
    expect(html).toContain('pixel-tool-rail')
    expect(html).toContain('has-flyout')
    expect(html).toContain('0: ajustar')
    expect(html).toContain('lucide')
    expect(html).not.toMatch(/[✎⌫▨✋🔒◇◉○＋−]/u)
  })
})

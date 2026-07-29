import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MapEditor } from '../src/MapEditor.js'

describe('MapEditor', () => {
  it('renders complete manual editor controls', () => {
    const html = renderToString(<MapEditor />)
    for (const label of ['Lápiz', 'Borrador', 'Cuentagotas', 'Balde', 'Línea', 'Rectángulo', 'Elipse', 'Selección', 'Mano', 'Tilesets', 'Capas', 'Redimensionar mapa']) expect(html).toContain(label)
  })
})

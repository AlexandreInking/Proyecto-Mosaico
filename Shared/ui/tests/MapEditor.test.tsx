import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MapEditor } from '../src/MapEditor.js'

describe('MapEditor', () => {
  it('renders complete manual editor controls', () => {
    const html = renderToString(<MapEditor />)
    for (const label of ['Lápiz', 'Borrador', 'Selector de tile', 'Balde', 'Línea', 'Rectángulo', 'Elipse', 'Selección', 'Mano', 'Tilesets', 'Capas', 'Redimensionar mapa']) expect(html).toContain(label)
    expect(html).toContain('layer-tree-sidebar')
    expect(html).not.toContain('map-tree-runtime-floating')
    expect(html).not.toContain('Panel de capas flotante')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('aria-keyshortcuts="Control+C Control+X Control+V Meta+C Meta+X Meta+V"')
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AppShell, SHARED_UI_VERSION } from '../src/index.js'

describe('AppShell', () => {
  it('renders the same shared contract and platform execution target', () => {
    const html = renderToStaticMarkup(<AppShell platform="Web" execution="Navegador" online />)
    expect(SHARED_UI_VERSION).toBe('mosaico-ui-t1-v1')
    expect(html).toContain('Pixel workspace')
    expect(html).toContain('Web · Connected')
    expect(html).toContain('Language')
    expect(html).toContain('data-ui-contract="mosaico-ui-t1-v1"')
  })

  it('opens Assets first and exposes active authoring modules', () => {
    const html = renderToStaticMarkup(<AppShell platform="Desktop" execution="Local" online={false} />)
    expect(html.indexOf('Assets')).toBeLessThan(html.indexOf('Editor'))
    expect(html).toContain('class="active" type="button">Assets')
    expect(html).not.toContain('Mundo')
    expect(html).toContain('>Maps<')
    expect(html).not.toContain('disabled="" type="button">Mapas')
    expect(html).not.toContain('disabled="" type="button">Pipelines')
    expect(html).not.toContain('Jobs')
    expect(html).not.toContain('Export')
    expect(html).not.toContain('Planned')
    expect(html).toContain('Desktop · Offline')
  })

  it('keeps Jobs hidden from the shipped web module', () => {
    const html = renderToStaticMarkup(<AppShell platform="Web" execution="Navegador" online />)
    expect(html).not.toContain('Jobs')
    expect(html).not.toContain('Planned')
    expect(html).not.toContain('Export')
  })
})

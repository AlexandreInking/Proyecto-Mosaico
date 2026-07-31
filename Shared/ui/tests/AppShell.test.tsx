import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AppShell, SHARED_UI_VERSION } from '../src/index.js'

describe('AppShell', () => {
  it('renders the same shared contract and platform execution target', () => {
    const html = renderToStaticMarkup(
      <AppShell platform="Web" execution="Navegador" online />,
    )

    expect(SHARED_UI_VERSION).toBe('mosaico-ui-t1-v1')
    expect(html).toContain('Asset Pipeline AI')
    expect(html).toContain('Web · Connected')
    expect(html).toContain('Language')
    expect(html).toContain('data-ui-contract="mosaico-ui-t1-v1"')
  })

  it('opens Pixel Art first and exposes assets plus map modules', () => {
    const html = renderToStaticMarkup(
      <AppShell platform="Desktop" execution="Local" online={false} />,
    )

    expect(html.indexOf('Pixel Art')).toBeLessThan(html.indexOf('Assets'))
    expect(html).toContain('class="active" type="button">Pixel Art')
    expect(html).toContain('>Maps<')
    expect(html).not.toContain('disabled="" type="button">Mapas')
    expect(html).toContain('Planned')
    expect(html).toContain('Desktop · Offline')
  })
})

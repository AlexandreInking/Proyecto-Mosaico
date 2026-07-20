import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AppShell, SHARED_UI_VERSION } from '../src/index.js'

describe('AppShell', () => {
  it('renders the same shared contract and platform execution target', () => {
    const html = renderToStaticMarkup(
      <AppShell platform="Web" execution="Navegador" online />,
    )

    expect(SHARED_UI_VERSION).toBe('mosaico-ui-t0-v1')
    expect(html).toContain('Asset Pipeline AI')
    expect(html).toContain('Ejecución: Navegador')
    expect(html).toContain('data-ui-contract="mosaico-ui-t0-v1"')
  })

  it('marks unavailable T0 modules without pretending they work', () => {
    const html = renderToStaticMarkup(
      <AppShell platform="Desktop" execution="Local" online={false} />,
    )

    expect(html).toContain('Disponible en T1')
    expect(html).toContain('Sin conexión')
  })
})

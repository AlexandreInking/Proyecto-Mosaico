import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('authoring lazy preservation', () => {
  it('loads Editor and Maps independently while preserving Pixi CSP support', () => {
    const canvas = source('../src/AuthoringCanvas.tsx')
    expect(canvas).toContain("import 'pixi.js/unsafe-eval'")
    expect(canvas).toMatch(/lazy\(async \(\) =>[\s\S]*import\('\.\/MapEditor\.js'\)/)
    expect(canvas).toMatch(/lazy\(async \(\) =>[\s\S]*import\('\.\/PixelArtEditor\.js'\)/)
    expect(canvas).not.toMatch(/import \{ MapEditor \} from/)
    expect(canvas).not.toMatch(/import \{ PixelArtEditor \} from/)
    expect(canvas).toContain('<PixelArtEditor active={active} />')
    expect(canvas).toContain('<MapEditor active={active} sharedAssets={assets} />')
  })

  it('keeps visited authoring views mounted and isolates inactive views', () => {
    const shell = source('../src/AppShell.tsx')
    const styles = source('../src/styles.css')
    expect(shell).toContain("if (activeModule === 'Pixel Art') setEditorMounted(true)")
    expect(shell).toContain("if (activeModule === 'Mapas') setMapsMounted(true)")
    expect(shell).toContain('hidden={!active}')
    expect(shell).toContain('aria-hidden={active ? undefined : true}')
    expect(shell).toContain('inert={!active}')
    expect(styles).toMatch(/\.authoring-preserved-view\s*\{\s*display:\s*none;\s*\}/)
  })
})

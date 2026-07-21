import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const launcher = await readFile(new URL('../../Mosaico.cmd', import.meta.url), 'utf8')
const authoringCanvas = await readFile(new URL('../../Shared/ui/src/AuthoringCanvas.tsx', import.meta.url), 'utf8')

test('desktop launcher prioritizes current Tauri app over legacy manual packages', () => {
  const currentIndex = launcher.indexOf('target\\release\\mosaico-desktop.exe')
  const legacyIndex = launcher.indexOf('output\\manual\\Mosaico-T0-')

  assert.ok(currentIndex >= 0, 'launcher must reference current Tauri executable')
  assert.ok(legacyIndex < 0 || currentIndex < legacyIndex, 'legacy T0 package must never win over current Tauri executable')
})

test('authoring canvas keeps Pixi compatible with strict desktop CSP', () => {
  assert.match(authoringCanvas, /import ['"]pixi\.js\/unsafe-eval['"]/)
})

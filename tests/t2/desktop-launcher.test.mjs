import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const launcher = await readFile(new URL('../../Mosaico.cmd', import.meta.url), 'utf8')
const silentLauncher = await readFile(new URL('../../Mosaico.vbs', import.meta.url), 'utf8')
const desktopStarter = await readFile(new URL('../../scripts/start-desktop.ps1', import.meta.url), 'utf8')
const authoringCanvas = await readFile(new URL('../../Shared/ui/src/AuthoringCanvas.tsx', import.meta.url), 'utf8')

test('desktop launcher opens the compiled binary without rebuilding', () => {
  assert.match(launcher, /wscript\.exe.*Mosaico\.vbs/i)
  assert.match(silentLauncher, /mosaico-desktop\.exe/i)
  assert.match(silentLauncher, /app\\dist\\index\.html/i)
  assert.match(desktopStarter, /mosaico-desktop\.exe/i)
  assert.match(desktopStarter, /buildMarker/i)
  assert.doesNotMatch(launcher, /powershell|tauri build/i)
  assert.doesNotMatch(silentLauncher, /powershell|tauri build/i)
  assert.doesNotMatch(desktopStarter, /tauri build/i)
})

test('authoring canvas keeps Pixi compatible with strict desktop CSP', () => {
  assert.match(authoringCanvas, /import ['"]pixi\.js\/unsafe-eval['"]/)
})

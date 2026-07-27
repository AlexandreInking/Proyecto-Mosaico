import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const launcher = await readFile(new URL('../../Mosaico.cmd', import.meta.url), 'utf8')
const desktopStarter = await readFile(new URL('../../scripts/start-desktop.ps1', import.meta.url), 'utf8')
const authoringCanvas = await readFile(new URL('../../Shared/ui/src/AuthoringCanvas.tsx', import.meta.url), 'utf8')

test('desktop launcher rebuilds stale Tauri app from shared UI before opening it', () => {
  assert.match(launcher, /scripts\\start-desktop\.ps1/)
  assert.match(desktopStarter, /Shared\\ui\\src/)
  assert.match(desktopStarter, /LastWriteTimeUtc/)
  assert.match(desktopStarter, /tauri build/)
  assert.doesNotMatch(launcher, /output\\manual/)
})

test('authoring canvas keeps Pixi compatible with strict desktop CSP', () => {
  assert.match(authoringCanvas, /import ['"]pixi\.js\/unsafe-eval['"]/)
})

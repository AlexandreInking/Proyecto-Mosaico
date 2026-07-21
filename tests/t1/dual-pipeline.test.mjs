import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

test('Web and Desktop render the same pipeline UI', () => {
  const desktopEntry = readFileSync('DesktopApp/app/src/main.tsx', 'utf8')
  const webEntry = readFileSync('WebApp/client/src/main.tsx', 'utf8')

  assert.match(desktopEntry, /import \{ AppShell \} from '@mosaico\/ui'/)
  assert.match(webEntry, /import \{ AppShell \} from '@mosaico\/ui'/)
  assert.match(desktopEntry, /<AppShell platform="Desktop"/)
  assert.match(webEntry, /<AppShell platform="Web"/)
})

test('the shared UI owns the single image pipeline implementation', () => {
  const desktop = readJson('DesktopApp/app/package.json')
  const web = readJson('WebApp/client/package.json')
  const ui = readJson('Shared/ui/package.json')

  assert.equal(desktop.dependencies['@mosaico/ui'], 'workspace:*')
  assert.equal(web.dependencies['@mosaico/ui'], 'workspace:*')
  assert.equal(ui.dependencies['@mosaico/pipeline'], 'workspace:*')
})

test('T1 manual gate covers both surfaces and pixel-perfect resize', () => {
  const walkthrough = readFileSync('docs/manual/MG-T1-image-pipeline.md', 'utf8')

  assert.match(walkthrough, /PASS T1 Web/)
  assert.match(walkthrough, /PASS T1 Desktop/)
  assert.match(walkthrough, /pixel-art/)
  assert.match(walkthrough, /Cancelar/)
})

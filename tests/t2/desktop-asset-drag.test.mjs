import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const root = new URL('../../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('Desktop asset drag includes a portable text fallback', () => {
  const appShell = read('Shared/ui/src/AppShell.tsx')
  const pipeline = read('Shared/ui/src/PipelineEditor.tsx')

  assert.match(appShell, /setData\('text\/plain', asset\.record\.id\)/)
  assert.match(pipeline, /setData\('text\/plain', asset\.record\.id\)/)
  assert.match(pipeline, /getData\('text\/plain'\)/)
})

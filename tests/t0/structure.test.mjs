import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

test('T0 separates shared, desktop and web workspaces', () => {
  const workspace = readFileSync('pnpm-workspace.yaml', 'utf8')

  assert.match(workspace, /Shared\/\*/)
  assert.match(workspace, /DesktopApp\/app/)
  assert.match(workspace, /WebApp\/client/)
  assert.match(workspace, /WebApp\/server/)
})

test('desktop and web consume the same UI package', () => {
  const desktop = readJson('DesktopApp/app/package.json')
  const web = readJson('WebApp/client/package.json')

  assert.equal(desktop.dependencies['@mosaico/ui'], 'workspace:*')
  assert.equal(web.dependencies['@mosaico/ui'], 'workspace:*')
})

test('desktop has a Tauri shell and preserves the WPF baseline', () => {
  assert.equal(existsSync('DesktopApp/src-tauri/tauri.conf.json'), true)
  assert.equal(existsSync('DesktopApp/LegacyWpf/ProyectoMosaico.slnx'), true)
})

test('web server is an AdonisJS application', () => {
  const server = readJson('WebApp/server/package.json')

  assert.ok(server.dependencies['@adonisjs/core'])
  assert.equal(existsSync('WebApp/server/ace.js'), true)
})

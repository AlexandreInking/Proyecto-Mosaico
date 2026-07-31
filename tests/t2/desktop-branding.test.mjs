import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const config = JSON.parse(readFileSync('DesktopApp/src-tauri/tauri.conf.json', 'utf8'))

test('desktop ships branded startup and NSIS art', () => {
  assert.equal(existsSync('DesktopApp/app/public/splash-pixel-art.png'), true)
  assert.equal(existsSync('DesktopApp/src-tauri/icons/installer-sidebar.bmp'), true)
  assert.equal(existsSync('DesktopApp/src-tauri/icons/installer-header.bmp'), true)
  assert.equal(config.bundle.windows.nsis.sidebarImage, 'icons/installer-sidebar.bmp')
  assert.equal(config.bundle.windows.nsis.headerImage, 'icons/installer-header.bmp')
  assert.equal(config.bundle.windows.nsis.installerHooks, 'nsis/installer-hooks.nsh')
  assert.equal(config.bundle.windows.allowDowngrades, false)
})

test('custom installer exposes update and repair paths', () => {
  const hooks = readFileSync('DesktopApp/src-tauri/nsis/installer-hooks.nsh', 'utf8')
  assert.match(hooks, /CopyFiles \/SILENT "\$EXEPATH" "\$INSTDIR\\Mosaico-setup\.exe"/)
  assert.match(hooks, /IfErrors mosaico_maintenance_done/)
  assert.match(hooks, /IfFileExists "\$INSTDIR\\Mosaico-setup\.exe" 0 mosaico_maintenance_done/)
  assert.match(hooks, /"ModifyPath".*\/P \/UPDATE/)
  assert.match(hooks, /"RepairPath".*\/P \/UPDATE/)
  assert.match(hooks, /"NoModify" 0/)
  assert.match(hooks, /"NoRepair" 0/)
})

test('desktop launcher starts PowerShell without a visible console', () => {
  const launcher = readFileSync('Mosaico.cmd', 'utf8')
  assert.match(launcher, /start "" \/b powershell\.exe .*WindowStyle Hidden/i)
})

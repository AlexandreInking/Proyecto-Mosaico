import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const config = JSON.parse(readFileSync('DesktopApp/src-tauri/tauri.conf.json', 'utf8'))
const installerConfig = JSON.parse(readFileSync('DesktopApp/src-tauri/installer.conf.json', 'utf8'))

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

test('desktop builds one branded installer wrapper', () => {
  const installer = readFileSync('DesktopApp/installer/MosaicoInstaller.nsi', 'utf8')
  const buildScript = readFileSync('scripts/build-custom-installer.ps1', 'utf8')
  const rootPackage = JSON.parse(readFileSync('package.json', 'utf8'))
  assert.match(installer, /Page custom WelcomePage/)
  assert.match(installer, /nsDialogs::Create/)
  assert.match(installer, /Mosaico-core-setup\.exe.*\/S/s)
  assert.match(installer, /Crear acceso directo en el escritorio/)
  assert.equal(config.version, '0.2.17')
  assert.equal(rootPackage.version, '0.2.17')
  assert.match(buildScript, /mosaico-setup-\$version\.exe/)
  assert.match(buildScript, /DPRODUCT_VERSION=\$version/)
  assert.match(buildScript, /INPUTCHARSET.*UTF8/)
  assert.match(buildScript, /installer\.conf\.json/)
  assert.match(buildScript, /Mosaico_\$\{version\}_x64-setup\.exe/)
  assert.equal(installerConfig.bundle.createUpdaterArtifacts, false)
  assert.equal(rootPackage.scripts['installer:build'], 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-custom-installer.ps1')
})

test('current user manual documents only visible functional modules', () => {
  const manual = readFileSync('docs/MANUAL_FUNCIONAL_ACTUAL.md', 'utf8')
  assert.match(manual, /Assets[\s\S]+Editor[\s\S]+Pipelines[\s\S]+Maps/)
  assert.match(manual, /mosaico-setup-0\.2\.17\.exe/)
  assert.match(manual, /Catálogo de nodos funcionales/)
  assert.doesNotMatch(manual, /\bJobs\b|\bbacklog\b|Volumetric|Fluid Simulation|3D Camera/)
})

test('desktop launcher delegates to the no-console Windows host', () => {
  const launcher = readFileSync('Mosaico.cmd', 'utf8')
  assert.match(launcher, /start "" wscript\.exe .*Mosaico\.vbs/i)
  assert.doesNotMatch(launcher, /powershell|tauri build/i)
})

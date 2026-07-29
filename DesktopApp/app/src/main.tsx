import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { AppShell } from '@mosaico/ui'
import '@mosaico/ui/styles.css'
import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'

function DesktopUpdater() {
  useEffect(() => {
    if (!import.meta.env.PROD || !('__TAURI_INTERNALS__' in window)) return
    let active = true
    void check().then(async (update) => {
      if (!active || !update) return
      const notes = update.body ? `\n\n${update.body}` : ''
      if (!window.confirm(`Hay una actualización de Mosaico (${update.version}). ¿Instalar ahora?${notes}`)) return
      await update.downloadAndInstall()
      await relaunch()
    }).catch((error: unknown) => {
      if (active) console.warn('Actualizador Mosaico no disponible', error)
    })
    return () => { active = false }
  }, [])
  return null
}

const root = document.getElementById('root')

if (!root) {
  throw new Error('No se encontró el host #root de Mosaico Desktop.')
}

createRoot(root).render(
  <StrictMode>
    <DesktopUpdater />
    <AppShell platform="Desktop" execution="Local" online={navigator.onLine} />
  </StrictMode>,
)

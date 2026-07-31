import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { AppShell, getStoredLocale, translateText } from '@mosaico/ui'
import '@mosaico/ui/styles.css'
import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'

function DesktopUpdater() {
  useEffect(() => {
    if (!import.meta.env.PROD || !('__TAURI_INTERNALS__' in window)) return
    let active = true
    const t = (key: string) => translateText(key, getStoredLocale())
    void check().then(async (update) => {
      if (!active || !update) return
      const notes = update.body ? `\n\n${update.body}` : ''
      if (!window.confirm(`${t('Actualización de Mosaico disponible')} (${update.version}). ${t('¿Instalar ahora?')}${notes}`)) return
      await update.downloadAndInstall()
      await relaunch()
    }).catch((error: unknown) => {
      if (active) console.warn(t('Actualizador Mosaico no disponible'), error)
    })
    return () => { active = false }
  }, [])
  return null
}

function DesktopBootReady() {
  useEffect(() => {
    const splash = document.getElementById('boot-splash')
    splash?.classList.add('is-ready')
    const timeout = window.setTimeout(() => splash?.remove(), 650)
    return () => window.clearTimeout(timeout)
  }, [])
  return null
}

const root = document.getElementById('root')

if (!root) {
  throw new Error('Mosaico Desktop root host not found.')
}

createRoot(root).render(
  <StrictMode>
    <DesktopBootReady />
    <DesktopUpdater />
    <AppShell platform="Desktop" execution="Local" online={navigator.onLine} />
  </StrictMode>,
)

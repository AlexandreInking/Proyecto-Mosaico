import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppShell } from '@mosaico/ui'
import '@mosaico/ui/styles.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('No se encontró el host #root de Mosaico Desktop.')
}

createRoot(root).render(
  <StrictMode>
    <AppShell platform="Desktop" execution="Local" online={navigator.onLine} />
  </StrictMode>,
)

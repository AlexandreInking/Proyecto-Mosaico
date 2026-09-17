import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AppShell } from '@mosaico/ui'
import '@mosaico/ui/styles.css'

function WebEntry() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return <AppShell platform="Web" execution="Navegador" online={online} />
}

const root = document.getElementById('root')

if (!root) {
  throw new Error('Mosaico Web root host not found.')
}

createRoot(root).render(
  <StrictMode><WebEntry /></StrictMode>,
)

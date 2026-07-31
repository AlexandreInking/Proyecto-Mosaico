import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { ImageOff, ImagePlus } from 'lucide-react'
import { UI_CONTRACT_VERSION, type Diagnostic, type Recipe } from '@mosaico/contracts'
import {
  createImageRecipe,
  deleteImage,
  extensionFor,
  groupDiagnostics,
  importImage,
  loadImages,
  PipelineJobQueue,
  processImage,
  saveImage,
  type DiagnosticOccurrence,
  type ImportedImage,
  type ProcessedImage,
  type QueueJobSnapshot,
  type SupportedImageType,
} from '@mosaico/pipeline'
import type { AuthoringMode } from './AuthoringCanvas.js'
import { localeNames, localizeElement, translateText, useLocale, type Locale } from './i18n.js'

export interface AppShellProps {
  platform: 'Web' | 'Desktop'
  execution: string
  online: boolean
}

interface VisibleAsset extends ImportedImage { thumbnailUrl: string }
interface OutputState extends ProcessedImage { previewUrl: string }
interface ImageJobInput { asset: ImportedImage; recipe: Recipe }

const modules = ['Pixel Art', 'Assets', 'Pipelines', 'Mapas', 'Mundo', 'Jobs', 'Exportar']
const activeModules = new Set(['Assets', 'Mapas', 'Pixel Art'])
const AuthoringCanvas = lazy(async () => ({ default: (await import('./AuthoringCanvas.js')).AuthoringCanvas }))
const recipeStorageKey = 'mosaico-t1-recipe'

class AuthoringErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Authoring Core fallo al renderizar', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <main className="authoring-error" role="alert"><h2>The editor could not be loaded</h2><p>{this.state.error.message || 'Unexpected Authoring Core error.'}</p><button className="primary" type="button" onClick={() => this.setState({ error: null })}>Retry</button></main>
  }
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function safeBaseName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-') || 'asset'
}

export function AppShell({ platform, execution, online }: AppShellProps) {
  const [locale, setLocale] = useLocale()
  const shellRef = useRef<HTMLDivElement>(null)
  const t = (value: string) => translateText(value, locale)
  const fileInput = useRef<HTMLInputElement>(null)
  const queueRef = useRef<PipelineJobQueue<ImageJobInput, ProcessedImage> | null>(null)
  if (!queueRef.current) {
    queueRef.current = new PipelineJobQueue((input, context) => processImage(input.asset, input.recipe, context))
  }
  const [assets, setAssets] = useState<VisibleAsset[]>([])
  const [selectedId, setSelectedId] = useState<string>()
  const [search, setSearch] = useState('')
  const [width, setWidth] = useState(32)
  const [height, setHeight] = useState(32)
  const [mediaType, setMediaType] = useState<SupportedImageType>('image/png')
  const [quality, setQuality] = useState(0.92)
  const [jobs, setJobs] = useState<readonly QueueJobSnapshot<ProcessedImage>[]>([])
  const [output, setOutput] = useState<OutputState>()
  const [occurrences, setOccurrences] = useState<DiagnosticOccurrence[]>([])
  const [consoleOpen, setConsoleOpen] = useState(true)
  const [activeModule, setActiveModule] = useState('Pixel Art')

  useEffect(() => {
    const root = shellRef.current
    if (!root) return
    let frame = 0
    const apply = () => { frame = 0; localizeElement(root, locale) }
    apply()
    const observer = new MutationObserver(() => { if (!frame) frame = window.requestAnimationFrame(apply) })
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder'] })
    return () => { observer.disconnect(); if (frame) window.cancelAnimationFrame(frame) }
  }, [locale])

  const selected = assets.find((asset) => asset.record.id === selectedId)
  const diagnostics: Diagnostic[] = useMemo(() => groupDiagnostics(occurrences), [occurrences])
  const filteredAssets = assets.filter((asset) => `${asset.record.name} ${asset.record.mediaType} ${asset.record.sha256}`.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    let active = true
    loadImages().then((stored) => {
      if (!active) return
      const visible = stored.map((asset) => ({ ...asset, thumbnailUrl: URL.createObjectURL(asset.thumbnail) }))
      setAssets(visible)
      setSelectedId(visible[0]?.record.id)
    }).catch((error: unknown) => {
      setOccurrences((items) => [...items, { code: 'STORE_LOAD', severity: 'error', groupKey: 'persistence', message: error instanceof Error ? error.message : 'No se pudo restaurar catálogo.' }])
    })
    try {
      const saved = localStorage.getItem(recipeStorageKey)
      if (saved) {
        const value = JSON.parse(saved) as { width?: number; height?: number; mediaType?: SupportedImageType; quality?: number }
        if (value.width) setWidth(value.width)
        if (value.height) setHeight(value.height)
        if (value.mediaType) setMediaType(value.mediaType)
        if (value.quality !== undefined) setQuality(value.quality)
      }
    } catch { /* receta inválida vuelve a defaults seguros */ }
    return () => { active = false }
  }, [])

  useEffect(() => {
    localStorage.setItem(recipeStorageKey, JSON.stringify({ width, height, mediaType, quality }))
  }, [width, height, mediaType, quality])

  useEffect(() => queueRef.current?.subscribe(setJobs), [])
  useEffect(() => {
    const assetTransfer = (event: Event) => { const file = (event as CustomEvent<{ file?: File }>).detail?.file; if (file) void addFiles([file]) }
    const mapTransfer = (event: Event) => { setActiveModule('Mapas'); window.setTimeout(() => window.dispatchEvent(new CustomEvent('mosaico:map-import-ready', { detail: (event as CustomEvent).detail })), 0) }
    window.addEventListener('mosaico:asset-import', assetTransfer); window.addEventListener('mosaico:map-import', mapTransfer)
    return () => { window.removeEventListener('mosaico:asset-import', assetTransfer); window.removeEventListener('mosaico:map-import', mapTransfer) }
  }, [])

  async function addFiles(files: readonly File[]): Promise<void> {
    for (const file of files) {
      try {
        const image = await importImage(file)
        await saveImage(image)
        const visible = { ...image, thumbnailUrl: URL.createObjectURL(image.thumbnail) }
        setAssets((items) => {
          const previous = items.find((item) => item.record.sha256 === image.record.sha256)
          if (previous) {
            URL.revokeObjectURL(visible.thumbnailUrl)
            return items
          }
          return [...items, visible]
        })
        setSelectedId((current) => current ?? image.record.id)
      } catch (error: unknown) {
        setOccurrences((items) => [...items, {
          code: 'IMAGE_IMPORT', severity: 'error', groupKey: 'image-import',
          message: error instanceof Error ? error.message : 'Error desconocido al importar imagen.',
        }])
      }
    }
  }

  async function removeSelected(): Promise<void> {
    if (!selected) return
    await deleteImage(selected.record.id)
    URL.revokeObjectURL(selected.thumbnailUrl)
    const remaining = assets.filter((item) => item.record.id !== selected.record.id)
    setAssets(remaining)
    setSelectedId(remaining[0]?.record.id)
    if (output) URL.revokeObjectURL(output.previewUrl)
    setOutput(undefined)
  }

  function enqueueRecipe(): void {
    if (!selected) return
    if (output) URL.revokeObjectURL(output.previewUrl)
    setOutput(undefined)
    const assetId = selected.record.id
    const handle = queueRef.current?.enqueue({ asset: selected, recipe: createImageRecipe(width, height, mediaType, quality) })
    void handle?.completed.then((job) => {
      if (job.status === 'succeeded' && job.output) {
        setOutput((previous) => {
          if (previous) URL.revokeObjectURL(previous.previewUrl)
          return { ...job.output!, previewUrl: URL.createObjectURL(job.output!.blob) }
        })
      } else if (job.status === 'failed') {
        setOccurrences((items) => [...items, { code: 'RECIPE_RUN', severity: 'error', groupKey: 'recipe', message: job.error ?? 'La receta falló.', assetId }])
      }
    })
  }

  return (
    <div ref={shellRef} className="app-shell" data-ui-contract={UI_CONTRACT_VERSION} data-locale={locale} onContextMenu={(event) => event.preventDefault()}>
      <header className="titlebar">
        <div className="brand-mark" aria-hidden="true">M</div>
        <div><p className="eyebrow">{t('Mosaico')}</p><h1>{t('Asset Pipeline AI')}</h1></div>
        <div className="titlebar-actions"><label className="language-picker"><span>{t('Idioma')}</span><select aria-label={t('Idioma')} value={locale} onChange={(event) => setLocale(event.target.value as Locale)}><option value="en">{localeNames.en}</option><option value="es">{localeNames.es}</option><option value="ru">{localeNames.ru}</option></select></label><div className="runtime-status" role="status"><span className={`status-dot ${online ? 'online' : ''}`} /><span>{platform} · {online ? t('Conectado') : t('Sin conexión')}</span></div></div>
      </header>

      <nav className="module-nav" aria-label={t('Módulos principales')}>
        {modules.map((module) => <button className={module === activeModule ? 'active' : ''} disabled={!activeModules.has(module)} key={module} type="button" onClick={() => setActiveModule(module)}>{t(module)}{!activeModules.has(module) && <span>{t('Planificado')}</span>}</button>)}
      </nav>

      {activeModule === 'Assets' ? <main className="workspace">
        <aside className="sidebar" aria-label="Catálogo de assets">
          <div className="panel-heading"><div><p className="eyebrow">Workspace</p><h2>Catálogo</h2></div><button className="primary" type="button" onClick={() => fileInput.current?.click()}>Importar</button></div>
          <input ref={fileInput} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => void addFiles([...event.target.files ?? []])} />
          <label className="search-label" htmlFor="asset-search">Buscar assets</label>
          <input id="asset-search" type="search" placeholder="Nombre, tipo o hash" value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="asset-list">
            {filteredAssets.map((asset) => <button className={`asset-card ${selectedId === asset.record.id ? 'selected' : ''}`} key={asset.record.id} type="button" onClick={() => setSelectedId(asset.record.id)}><img src={asset.thumbnailUrl} alt="" /><span><strong>{asset.record.name}</strong><small>{asset.record.width}×{asset.record.height} · {formatBytes(asset.record.byteSize)}</small></span></button>)}
            {!filteredAssets.length && <div className="empty-compact"><ImageOff aria-hidden="true" /><p>Sin assets importados</p></div>}
          </div>
        </aside>

        <section className="stage" aria-labelledby="stage-title" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addFiles([...event.dataTransfer.files]) }}>
          <div className="stage-toolbar"><div><p className="eyebrow">Vista de trabajo</p><h2 id="stage-title">Receta no destructiva</h2></div><span className="execution-badge">Ejecución: {execution}</span></div>
          {selected ? <div className="comparison">
            <figure><div className="preview-checker"><img src={selected.thumbnailUrl} alt={`Original ${selected.record.name}`} /></div><figcaption>Original · {selected.record.width}×{selected.record.height}<strong>SHA {selected.record.sha256.slice(0, 12)}…</strong></figcaption></figure>
            <div className="flow-arrow" aria-hidden="true">→</div>
            <figure><div className="preview-checker">{output ? <img src={output.previewUrl} alt="Resultado procesado" /> : <span>Vista previa pendiente</span>}</div><figcaption>Salida · {width}×{height}<strong>{output ? `SHA ${output.manifest.outputSha256.slice(0, 12)}…` : 'Ejecuta receta'}</strong></figcaption></figure>
          </div> : <button className="dropzone" type="button" onClick={() => fileInput.current?.click()}><ImagePlus className="drop-icon" aria-hidden="true" /><strong>Importa o arrastra imágenes</strong><span>PNG, JPEG o WebP · originales inmutables</span></button>}

          <section className="console-panel" aria-label="Consola de diagnósticos">
            <button className="console-heading" type="button" onClick={() => setConsoleOpen((value) => !value)}><span>Consola</span><span>{diagnostics.length} grupos · {diagnostics.reduce((sum, item) => sum + item.count, 0)} eventos {consoleOpen ? '⌄' : '›'}</span></button>
            {consoleOpen && <div className="console-body">{diagnostics.map((item) => <div className={`diagnostic ${item.severity}`} key={`${item.code}:${item.groupKey}`}><code>{item.code}</code><span>{item.message}</span><strong>×{item.count}</strong></div>)}{!diagnostics.length && <p>Sin errores actuales.</p>}</div>}
          </section>
        </section>

        <aside className="inspector" aria-label="Inspector">
          <p className="eyebrow">Inspector</p><h2>Resize pixel-perfect + conversión</h2>
          <div className="form-grid"><label>Ancho<input type="number" min="1" max="16384" value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label><label>Alto<input type="number" min="1" max="16384" value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label></div>
          <label className="field">Formato<select value={mediaType} onChange={(event) => setMediaType(event.target.value as SupportedImageType)}><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option></select></label>
          <label className="field">Calidad <span>{Math.round(quality * 100)}%</span><input type="range" min="0.1" max="1" step="0.01" value={quality} disabled={mediaType === 'image/png'} onChange={(event) => setQuality(Number(event.target.value))} /></label>
          <div className="recipe-flow"><span>Original</span><i>→</i><span>Nearest</span><i>→</i><span>Convert</span></div>
          <div className="job-actions"><button className="primary" type="button" disabled={!selected} onClick={enqueueRecipe}>Añadir a cola</button>{output && selected && <><a className="button-link" href={output.previewUrl} download={`${safeBaseName(selected.record.name)}-${width}x${height}.${extensionFor(mediaType)}`}>Exportar imagen</a><a className="button-link" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(output.manifest, null, 2))}`} download={`${safeBaseName(selected.record.name)}-manifest.json`}>Exportar manifiesto</a></>}{selected && <button className="danger" type="button" onClick={() => void removeSelected()}>Eliminar asset</button>}</div>
          <section className="job-queue" aria-label="Cola de jobs"><div className="queue-heading"><span>Cola</span><strong>{jobs.length}</strong></div>{jobs.map((job) => <div className={`queue-row ${job.status}`} key={job.id}><span><code>{job.id}</code>{job.status}</span><progress max="1" value={job.progress} />{(job.status === 'queued' || job.status === 'running') && <button type="button" onClick={() => queueRef.current?.cancel(job.id)}>Cancelar</button>}</div>)}{jobs.length === 0 && <p>Sin jobs.</p>}</section>
          {selected && <dl><div><dt>Tipo</dt><dd>{selected.record.mediaType}</dd></div><div><dt>Tamaño</dt><dd>{formatBytes(selected.record.byteSize)}</dd></div><div><dt>Hash original</dt><dd title={selected.record.sha256}>{selected.record.sha256.slice(0, 16)}…</dd></div></dl>}
          <div className="notice"><strong>Original protegido</strong><p>Resize y conversión crean salida derivada. El hash fuente y receta quedan en manifiesto JSON.</p></div>
        </aside>
      </main> : <AuthoringErrorBoundary><Suspense fallback={<main className="authoring-loading">Cargando Authoring Core…</main>}><AuthoringCanvas mode={activeModule as AuthoringMode} /></Suspense></AuthoringErrorBoundary>}

      <footer className="statusbar"><span>{t('Persistencia local activa')}</span><span>{assets.length} {t('assets')} · {jobs.length} {t('jobs')} · {diagnostics.filter((item) => item.severity === 'error').length} {t('errores agrupados')}</span></footer>
    </div>
  )
}

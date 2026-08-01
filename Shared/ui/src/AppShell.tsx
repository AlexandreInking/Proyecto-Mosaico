import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { Download, FileArchive, Folder, FolderPlus, HelpCircle, ImageOff, ImagePlus, Map as MapIcon, Workflow } from 'lucide-react'
import { groupDiagnostics, importImage, loadImages, saveImage, type ImportedImage, type DiagnosticOccurrence } from '@mosaico/pipeline'
import { UI_CONTRACT_VERSION, type Diagnostic } from '@mosaico/contracts'
import type { AuthoringMode } from './AuthoringCanvas.js'
import { localeNames, localizeElement, translateText, useLocale, type Locale } from './i18n.js'
import type { VisibleAsset } from './asset-catalog.js'
import type { AssetFolder } from '@mosaico/contracts'
import { createWorkspacePackage, loadWorkspacePackage, saveWorkspaceProject, WORKSPACE_PROJECT_EXTENSION } from './workspace-media.js'
import { createWorkspaceSnapshot, loadWorkspaceDraft, persistWorkspaceDraft, restoreWorkspaceDraft } from './workspace-store.js'
import type { PipelineTransferPayload } from './pipeline-frames.js'

export interface AppShellProps {
  platform: 'Web' | 'Desktop'
  execution: string
  online: boolean
}

const modules = ['Assets', 'Editor', 'Pipelines', 'Mapas', 'Jobs'] as const
const activeModules = new Set(['Assets', 'Pixel Art', 'Pipelines', 'Mapas'])
const AuthoringCanvas = lazy(async () => ({ default: (await import('./AuthoringCanvas.js')).AuthoringCanvas }))
const PipelineEditor = lazy(async () => ({ default: (await import('./PipelineEditor.js')).PipelineEditor }))
const DocumentationCenter = lazy(async () => ({ default: (await import('./DocumentationCenter.js')).DocumentationCenter }))

class AuthoringErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Authoring Core render failed', error, info.componentStack) }
  render() {
    if (!this.state.error) return this.props.children
    return <main className="authoring-error" role="alert"><h2>Editor unavailable</h2><p>{this.state.error.message || 'Unexpected editor error.'}</p><button className="primary" type="button" onClick={() => this.setState({ error: null })}>Retry</button></main>
  }
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function visibleAsset(image: ImportedImage): VisibleAsset {
  return { ...image, thumbnailUrl: URL.createObjectURL(image.thumbnail) }
}

async function imageFromWorkspace(record: ImportedImage['record'], blob: Blob): Promise<VisibleAsset> {
  const source = await importImage(new File([blob], record.name, { type: record.mediaType }))
  const image = { ...source, record, original: blob }
  await saveImage(image)
  return visibleAsset(image)
}

export function AppShell({ platform, execution, online }: AppShellProps) {
  const [locale, setLocale] = useLocale()
  const t = (value: string) => translateText(value, locale)
  const shellRef = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const workspaceInput = useRef<HTMLInputElement>(null)
  const assetsRef = useRef<VisibleAsset[]>([])
  const [assets, setAssets] = useState<VisibleAsset[]>([])
  const [selectedId, setSelectedId] = useState<string>()
  const [search, setSearch] = useState('')
  const [assetFolders, setAssetFolders] = useState<AssetFolder[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string>()
  const [helpOpen, setHelpOpen] = useState(false)
  const [assetDragActive, setAssetDragActive] = useState(false)
  const [activeModule, setActiveModule] = useState<typeof modules[number] | 'Pixel Art'>('Assets')
  const [status, setStatus] = useState('Workspace ready.')
  const [occurrences, setOccurrences] = useState<DiagnosticOccurrence[]>([])
  const [editorMounted, setEditorMounted] = useState(false)
  const [mapsMounted, setMapsMounted] = useState(false)
  const [pipelineMounted, setPipelineMounted] = useState(false)
  const [workspaceEpoch, setWorkspaceEpoch] = useState(0)

  useEffect(() => {
    if (activeModule === 'Pixel Art') setEditorMounted(true)
    if (activeModule === 'Mapas') setMapsMounted(true)
    if (activeModule === 'Pipelines') setPipelineMounted(true)
  }, [activeModule])

  useEffect(() => {
    const root = shellRef.current
    if (!root) return
    let frame = 0; const pending = new Set<HTMLElement>()
    localizeElement(root, locale)
    const apply = () => { frame = 0; const targets = [...pending]; pending.clear(); for (const target of targets) localizeElement(target, locale) }
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'childList') for (const node of record.addedNodes) {
          const element = node instanceof HTMLElement ? node : node.parentElement
          if (element) pending.add(element)
        }
        else {
          const element = record.target instanceof HTMLElement ? record.target : record.target.parentElement
          if (element) pending.add(element)
        }
      }
      if (pending.size && !frame) frame = window.requestAnimationFrame(apply)
    })
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder'] })
    return () => { observer.disconnect(); if (frame) window.cancelAnimationFrame(frame) }
  }, [locale])

  useEffect(() => {
    const saved = loadWorkspaceDraft()
    if (saved?.assetFolders) setAssetFolders(saved.assetFolders)
    if (saved?.selectedAssetId) setSelectedId(saved.selectedAssetId)
    if (saved?.activeModule === 'Editor') setActiveModule('Pixel Art')
    else if (saved?.activeModule === 'Assets' || saved?.activeModule === 'Pipelines' || saved?.activeModule === 'Mapas') setActiveModule(saved.activeModule)
    let active = true
    void loadImages().then((stored) => {
      if (!active) return
      const saved = loadWorkspaceDraft()
      const locations = new Map((saved?.assetLocations ?? []).map((location) => [location.assetId, location.folderId] as const))
      const visible = stored.map((image) => ({ ...visibleAsset(image), folderId: locations.get(image.record.id) }))
      assetsRef.current = visible
      setAssets(visible)
      setSelectedId(saved?.selectedAssetId ?? visible[0]?.record.id)
    }).catch((error: unknown) => setOccurrences((items) => [...items, { code: 'STORE_LOAD', severity: 'error', groupKey: 'persistence', message: error instanceof Error ? error.message : 'Asset catalog could not be restored.' }]))
    return () => { active = false }
  }, [])

  useEffect(() => () => { for (const asset of assetsRef.current) URL.revokeObjectURL(asset.thumbnailUrl) }, [])

  useEffect(() => {
    const handle = window.setTimeout(() => persistWorkspaceDraft(createWorkspaceSnapshot(assets, activeModule === 'Pixel Art' ? 'Editor' : activeModule, selectedId, assetFolders, [], { includeDocuments: false })), 250)
    return () => window.clearTimeout(handle)
  }, [activeModule, assetFolders, assets, selectedId])

  useEffect(() => {
    const openHelp = (event: KeyboardEvent) => { if (event.key === 'F1') { event.preventDefault(); setHelpOpen(true) } }
    window.addEventListener('keydown', openHelp)
    return () => window.removeEventListener('keydown', openHelp)
  }, [])

  const selected = assets.find((asset) => asset.record.id === selectedId)
  const filteredAssets = useMemo(() => assets.filter((asset) => (search.length > 0 || asset.folderId === currentFolderId) && `${asset.record.name} ${asset.record.mediaType} ${asset.record.sha256}`.toLowerCase().includes(search.toLowerCase())), [assets, currentFolderId, search])
  const diagnostics: Diagnostic[] = useMemo(() => groupDiagnostics(occurrences), [occurrences])
  const visibleModules = modules.filter((module) => module !== 'Jobs')

  function createAssetFolder(): void {
    const name = window.prompt(t('Folder name'))?.trim()
    if (!name) return
    const folder: AssetFolder = { id: `folder-${crypto.randomUUID()}`, name, parentId: currentFolderId }
    setAssetFolders((items) => [...items, folder])
    setCurrentFolderId(folder.id)
  }

  function moveAssetToFolder(assetId: string, folderId?: string): void {
    const next = assetsRef.current.map((asset) => asset.record.id === assetId ? { ...asset, folderId } : asset)
    assetsRef.current = next
    setAssets(next)
    setStatus(t('Asset location updated.'))
  }

  async function addFiles(files: readonly File[]): Promise<readonly VisibleAsset[]> {
    const added: VisibleAsset[] = []
    const known = new Set(assetsRef.current.map((asset) => asset.record.sha256))
    for (const file of files) {
      try {
        const image = await importImage(file)
        if (known.has(image.record.sha256)) continue
        await saveImage(image)
        const next = visibleAsset(image)
        known.add(image.record.sha256)
        added.push(next)
        assetsRef.current = [...assetsRef.current, next]
        setAssets(assetsRef.current)
        setSelectedId((current) => current ?? next.record.id)
      } catch (error: unknown) {
        setOccurrences((items) => [...items, { code: 'IMAGE_IMPORT', severity: 'error', groupKey: 'image-import', message: error instanceof Error ? error.message : 'Image import failed.' }])
      }
    }
    if (added.length) setStatus(`${added.length} asset(s) imported.`)
    return added
  }

  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<{ file?: File }>).detail
      if (detail.file) void addFiles([detail.file])
    }
    window.addEventListener('mosaico:asset-import', receive)
    return () => window.removeEventListener('mosaico:asset-import', receive)
  }, [])

  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<PipelineTransferPayload>).detail
      if (!detail?.frames?.length) return
      setActiveModule('Pixel Art')
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('mosaico:pipeline-transfer-ready', { detail })), 0)
    }
    window.addEventListener('mosaico:pipeline-transfer-request', receive)
    return () => window.removeEventListener('mosaico:pipeline-transfer-request', receive)
  }, [])

  async function openWorkspace(file?: File): Promise<void> {
    if (!file) return
    try {
      const loaded = await loadWorkspacePackage(file)
      const restored = await Promise.all(loaded.document.assets.map(async (record) => {
        const blob = loaded.assets.get(record.id)
        if (!blob) throw new Error('WORKSPACE_ASSET_MISSING')
        return imageFromWorkspace(record, blob)
      }))
      for (const previous of assetsRef.current) URL.revokeObjectURL(previous.thumbnailUrl)
      const locations = new Map((loaded.document.assetLocations ?? []).map((location) => [location.assetId, location.folderId] as const))
      const located = restored.map((asset) => ({ ...asset, folderId: locations.get(asset.record.id) }))
      assetsRef.current = located
      setAssets(located)
      setAssetFolders(loaded.document.assetFolders ?? [])
      setSelectedId(loaded.document.selectedAssetId ?? restored[0]?.record.id)
      restoreWorkspaceDraft(loaded.document)
      setWorkspaceEpoch((value) => value + 1)
      const restoredModule = loaded.document.activeModule === 'Editor' ? 'Pixel Art' : loaded.document.activeModule
      setActiveModule(restoredModule === 'Pixel Art' || restoredModule === 'Assets' || restoredModule === 'Pipelines' || restoredModule === 'Mapas' ? restoredModule : 'Assets')
      setStatus('Workspace opened.')
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : 'Workspace could not be opened.')
    }
  }

  async function saveWorkspace(): Promise<void> {
    try {
      const document = createWorkspaceSnapshot(assets, activeModule === 'Pixel Art' ? 'Editor' : activeModule, selectedId, assetFolders)
      const blobs = new Map(assets.map((asset) => [asset.record.id, asset.original] as const))
      const blob = await createWorkspacePackage(document, blobs)
      await saveWorkspaceProject(blob, `Workspace${WORKSPACE_PROJECT_EXTENSION}`)
      setStatus('Workspace saved.')
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : 'Workspace could not be saved.')
    }
  }

  function targetAsset(target: 'Editor' | 'Pipelines' | 'Mapas'): void {
    if (!selected) return
    if (target === 'Mapas') window.setTimeout(() => window.dispatchEvent(new CustomEvent('mosaico:map-import-ready', { detail: { file: new File([selected.original], selected.record.name, { type: selected.record.mediaType }), name: selected.record.name } })), 0)
    else window.setTimeout(() => window.dispatchEvent(new CustomEvent('mosaico:asset-open', { detail: { assetId: selected.record.id, target, file: new File([selected.original], selected.record.name, { type: selected.record.mediaType }) } })), 0)
    setActiveModule(target === 'Editor' ? 'Pixel Art' : target)
    setStatus(`${selected.record.name} sent to ${target}.`)
  }

  const activate = (module: typeof modules[number]) => {
    if (!activeModules.has(module) && module !== 'Editor') return
    const target = module === 'Editor' ? 'Pixel Art' : module
    performance.mark(`mosaico:${target}:activate`)
    setActiveModule(target)
  }

  const pipelineActive = activeModule === 'Pipelines'
  const pipelineView = (pipelineMounted || pipelineActive) ? <AuthoringErrorBoundary key={`pipeline-${workspaceEpoch}`}><Suspense fallback={<main className="authoring-loading">{t('Loading editor…')}</main>}><div className={pipelineActive ? 'pipeline-preserved-active' : 'pipeline-preserved-view'} hidden={!pipelineActive} aria-hidden={pipelineActive ? undefined : true}><PipelineEditor assets={assets} onImportFiles={addFiles} active={pipelineActive} /></div></Suspense></AuthoringErrorBoundary> : null
  const editorActive = activeModule === 'Pixel Art'
  const mapsActive = activeModule === 'Mapas'
  const authoringView = (mode: AuthoringMode, mounted: boolean, active: boolean) => (mounted || active) ? <AuthoringErrorBoundary key={`${mode}-${workspaceEpoch}`}><Suspense fallback={active ? <main className="authoring-loading">{t('Loading editor…')}</main> : null}><div className={active ? 'authoring-preserved-active' : 'authoring-preserved-view'} hidden={!active} aria-hidden={active ? undefined : true} inert={!active}><AuthoringCanvas mode={mode} active={active} assets={mode === 'Mapas' ? assets : undefined} /></div></Suspense></AuthoringErrorBoundary> : null

  return <div ref={shellRef} className="app-shell" data-ui-contract={UI_CONTRACT_VERSION} data-locale={locale} onContextMenu={(event) => event.preventDefault()}>
    <header className="titlebar">
      <div className="brand-mark" aria-hidden="true">M</div>
      <div><p className="eyebrow">Mosaico</p><h1>{t('Pixel workspace')}</h1></div>
      <div className="titlebar-actions"><div className="workspace-global-actions"><button type="button" aria-label={t('Save .mws')} title={t('Save .mws')} onClick={() => void saveWorkspace()}><Download size={13} /></button><button type="button" aria-label={t('Open .mws')} title={t('Open .mws')} onClick={() => workspaceInput.current?.click()}><FileArchive size={13} /></button><input ref={workspaceInput} className="visually-hidden" type="file" accept=".mws,application/vnd.mosaico.workspace+zip" onChange={(event) => { void openWorkspace(event.target.files?.[0]); event.currentTarget.value = '' }} /></div><label className="language-picker"><span>{t('Language')}</span><select aria-label={t('Language')} value={locale} onChange={(event) => setLocale(event.target.value as Locale)}><option value="en">{localeNames.en}</option><option value="es">{localeNames.es}</option><option value="ru">{localeNames.ru}</option><option value="fr">{localeNames.fr}</option><option value="it">{localeNames.it}</option></select></label><span className="runtime-status"><span className={`status-dot ${online ? 'online' : ''}`} />{platform} · {online ? 'Connected' : 'Offline'}</span></div>
    </header>
    <nav className="module-nav" aria-label={t('Main modules')}>
      {visibleModules.map((module) => { const internal = module === 'Editor' ? 'Pixel Art' : module; const enabled = activeModules.has(internal); return <button className={internal === activeModule ? 'active' : ''} disabled={!enabled} key={module} type="button" onClick={() => activate(module)}>{t(module)}{!enabled && <span>{t('Planned')}</span>}</button> })}
    </nav>
    <button className="app-help-button" type="button" aria-label={t('Help')} title={t('Help')} onClick={() => setHelpOpen(true)}><HelpCircle size={14} /></button>

    {activeModule === 'Assets' ? <main className={`workspace asset-catalog-workspace${assetDragActive ? ' is-dragging' : ''}`} data-execution={execution} onDragEnter={(event) => { if ([...event.dataTransfer.types].includes('Files')) setAssetDragActive(true) }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setAssetDragActive(false) }} onDrop={(event) => { event.preventDefault(); setAssetDragActive(false); void addFiles([...event.dataTransfer.files]) }}>
      <aside className="sidebar" aria-label={t('Asset catalog')}>
        <div className="panel-heading"><div><p className="eyebrow">Assets</p><h2>{t('Catalog')} <span className="asset-count">{assets.length}</span></h2></div><button className="primary" type="button" onClick={() => fileInput.current?.click()}><ImagePlus size={14} />{t('Import')}</button></div>
        <input ref={fileInput} className="visually-hidden" type="file" accept="image/png,image/gif" multiple onChange={(event) => { void addFiles([...event.target.files ?? []]); event.currentTarget.value = '' }} />
        <label className="search-label" htmlFor="asset-search">{t('Search assets')}</label>
        <input id="asset-search" type="search" placeholder={t('Name, type or hash')} value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="asset-folder-toolbar"><button type="button" aria-label={t('New folder')} title={t('New folder')} onClick={createAssetFolder}><FolderPlus size={14} /></button><button type="button" onClick={() => setCurrentFolderId(undefined)}>{t('Root')}</button></div>
        <div className="asset-folder-tree" aria-label={t('Folders')}>{assetFolders.filter((folder) => folder.parentId === currentFolderId).map((folder) => <button type="button" key={folder.id} onClick={() => setCurrentFolderId(folder.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = event.dataTransfer.getData('application/x-mosaico-asset-id'); if (id) moveAssetToFolder(id, folder.id) }}><Folder size={14} /><span data-user-content="true">{folder.name}</span></button>)}</div>
        <div className="asset-list">{filteredAssets.map((asset) => <button className={`asset-card ${selectedId === asset.record.id ? 'selected' : ''}`} aria-pressed={selectedId === asset.record.id} draggable key={asset.record.id} type="button" title={asset.folderId ? t('Double-click to move to root') : undefined} onClick={() => setSelectedId(asset.record.id)} onDoubleClick={() => { if (asset.folderId) moveAssetToFolder(asset.record.id) }} onDragStart={(event) => { event.dataTransfer.setData('application/x-mosaico-asset-id', asset.record.id); event.dataTransfer.effectAllowed = 'copy' }}><img src={asset.thumbnailUrl} alt="" /><span><strong data-user-content="true">{asset.record.name}</strong><small>{asset.record.mediaType} · {asset.record.width}×{asset.record.height} · {formatBytes(asset.record.byteSize)}</small></span></button>)}{!filteredAssets.length && <div className="empty-compact"><ImageOff aria-hidden="true" /><p>{t('No imported assets')}</p></div>}</div>
      </aside>
      <section className="stage asset-catalog-stage" aria-labelledby="asset-stage-title">
        <div className="stage-toolbar"><div><p className="eyebrow">Assets</p><h2 id="asset-stage-title">{t('Shared asset catalog')}</h2></div><span className="asset-count" aria-label={`${assets.length} ${t('assets')}`}>{assets.length}</span></div>
        {selected ? <article className="asset-detail">
          <div className="asset-detail-preview"><img src={selected.thumbnailUrl} alt={selected.record.name} /><span>{selected.record.width} × {selected.record.height}</span></div>
          <div className="asset-detail-panel"><p className="eyebrow">{t('Selected asset')}</p><h2 data-user-content="true">{selected.record.name}</h2><dl><div><dt>{t('Format')}</dt><dd>{selected.record.mediaType.replace('image/', '').toUpperCase()}</dd></div><div><dt>{t('Dimensions')}</dt><dd>{selected.record.width} × {selected.record.height} px</dd></div><div><dt>{t('File size')}</dt><dd>{formatBytes(selected.record.byteSize)}</dd></div><div><dt>{t('Animation')}</dt><dd>{selected.record.animation ? `${selected.record.animation.frameCount} ${t('Frames')}` : t('Static image')}</dd></div></dl><div className="asset-target-actions"><button className="primary" type="button" onClick={() => targetAsset('Editor')}><ImagePlus size={14} />{t('Open in Editor')}</button><button type="button" onClick={() => targetAsset('Pipelines')}><Workflow size={14} />{t('Add to Pipelines')}</button><button type="button" onClick={() => targetAsset('Mapas')}><MapIcon size={14} />{t('Use in Maps')}</button></div><div className="asset-hash"><span>SHA-256</span><code title={selected.record.sha256}>{selected.record.sha256}</code></div></div>
        </article> : <button className="dropzone" type="button" onClick={() => fileInput.current?.click()}><ImagePlus className="drop-icon" aria-hidden="true" /><strong>{t('Import PNG or GIF')}</strong><span>{t('Original assets remain available to every editor.')}</span></button>}
        <section className="console-panel" aria-label={t('Diagnostics')}><div className="console-heading"><span>{t('Status')}</span><span>{diagnostics.length}</span></div><div className="console-body"><p role="status">{status}</p>{diagnostics.map((item) => <div className={`diagnostic ${item.severity}`} key={`${item.code}:${item.groupKey}`}><code>{item.code}</code><span>{item.message}</span><strong>×{item.count}</strong></div>)}</div></section>
      </section>
      {assetDragActive && <div className="asset-import-overlay" aria-hidden="true"><ImagePlus /><strong>{t('Import PNG or GIF')}</strong></div>}
    </main> : null}
    {authoringView('Pixel Art', editorMounted, editorActive)}
    {authoringView('Mapas', mapsMounted, mapsActive)}
    {pipelineView}

    <footer className="statusbar"><span>{status}</span><span>{assets.length} {t('assets')} · {diagnostics.filter((item) => item.severity === 'error').length} {t('grouped errors')}</span></footer>
    {helpOpen && <Suspense fallback={null}><DocumentationCenter locale={locale} onClose={() => setHelpOpen(false)} /></Suspense>}
  </div>
}

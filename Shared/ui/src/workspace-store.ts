import { customNodeDefinitionSchema, workspaceDocumentSchema, type AssetFolder, type AssetLocation, type AssetRecord, type WorkspaceDocument } from '@mosaico/contracts'
import type { VisibleAsset } from './asset-catalog.js'

export const workspaceStorageKey = 'mosaico-workspace-draft-v1'
const pixelStorageKey = 'mosaico-pixel-document-v1'
const pixelTabsStorageKey = 'mosaico-pixel-tabs-v1'
const mapStorageKey = 'mosaico-map-tabs-v3'
const pipelineStorageKey = 'mosaico-pipeline-draft-v2'
const customNodesStorageKey = 'mosaico-custom-nodes-v1'

function readJson(value: string | null): unknown {
  if (!value) return undefined
  try { return JSON.parse(value) as unknown } catch { return undefined }
}

export function loadWorkspaceDraft(): WorkspaceDocument | undefined {
  if (typeof localStorage === 'undefined') return undefined
  const parsed = workspaceDocumentSchema.safeParse(readJson(localStorage.getItem(workspaceStorageKey)))
  return parsed.success ? parsed.data : undefined
}

export function createWorkspaceSnapshot(assets: readonly VisibleAsset[], activeModule: WorkspaceDocument['activeModule'], selectedAssetId?: string, assetFolders: readonly AssetFolder[] = [], assetLocations: readonly AssetLocation[] = [], options: { readonly includeDocuments?: boolean } = {}): WorkspaceDocument {
  const includeDocuments = options.includeDocuments ?? true
  const editor = includeDocuments ? readJson(typeof localStorage === 'undefined' ? null : localStorage.getItem(pixelStorageKey)) : undefined
  const editorTabs = includeDocuments ? readJson(typeof localStorage === 'undefined' ? null : localStorage.getItem(pixelTabsStorageKey)) : undefined
  const mapState = includeDocuments ? readJson(typeof localStorage === 'undefined' ? null : localStorage.getItem(mapStorageKey)) : undefined
  const pipeline = includeDocuments ? readJson(typeof localStorage === 'undefined' ? null : localStorage.getItem(pipelineStorageKey)) : undefined
  const customNodeValue = readJson(typeof localStorage === 'undefined' ? null : localStorage.getItem(customNodesStorageKey))
  const customNodes = Array.isArray(customNodeValue) ? customNodeValue.flatMap((value) => { const parsed = customNodeDefinitionSchema.safeParse(value); return parsed.success ? [parsed.data] : [] }) : []
  const maps = mapState && typeof mapState === 'object' && Array.isArray((mapState as { documents?: unknown }).documents)
    ? (mapState as { documents: unknown[] }).documents.map((value) => readJson(String(value))).filter((value) => value !== undefined)
    : []
  const editorDocuments = editorTabs && typeof editorTabs === 'object' && Array.isArray((editorTabs as { documents?: unknown }).documents)
    ? (editorTabs as { documents: unknown[] }).documents.map((value) => readJson(String(value))).filter((value) => value !== undefined)
    : editor ? [editor] : []
  return {
    format: 'mosaico-workspace',
    formatVersion: 1,
    id: 'workspace-local',
    name: 'Workspace',
    activeModule,
    selectedAssetId,
    assets: assets.map((asset) => asset.record),
    assetFolders: [...assetFolders],
    assetLocations: assetLocations.length ? [...assetLocations] : assets.flatMap((asset) => asset.folderId ? [{ assetId: asset.record.id, folderId: asset.folderId }] : []),
    tabs: {
      editor: { documents: editorDocuments, activeId: editorTabs && typeof editorTabs === 'object' && 'activeId' in editorTabs ? String((editorTabs as { activeId: string }).activeId) : editor && typeof editor === 'object' && 'id' in editor ? String((editor as { id: string }).id) : undefined, ui: {} },
      pipelines: { documents: pipeline ? [pipeline] : [], ui: {} },
      maps: { documents: maps, activeId: mapState && typeof mapState === 'object' && 'activeId' in mapState ? String((mapState as { activeId: string }).activeId) : undefined, ui: {} },
    },
    customNodes,
  }
}

export function persistWorkspaceDraft(document: WorkspaceDocument): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(workspaceStorageKey, JSON.stringify(document)) } catch { /* best effort */ }
}

export function restoreWorkspaceDraft(document: WorkspaceDocument): void {
  if (typeof localStorage === 'undefined') return
  const editor = document.tabs.editor.documents[0]
  const pipeline = document.tabs.pipelines.documents[0]
  const maps = document.tabs.maps.documents
  try {
    if (editor !== undefined) localStorage.setItem(pixelStorageKey, JSON.stringify(editor)); else localStorage.removeItem(pixelStorageKey)
    if (document.tabs.editor.documents.length) localStorage.setItem(pixelTabsStorageKey, JSON.stringify({ activeId: document.tabs.editor.activeId, documents: document.tabs.editor.documents.map((value) => JSON.stringify(value)) })); else localStorage.removeItem(pixelTabsStorageKey)
    if (pipeline !== undefined) localStorage.setItem(pipelineStorageKey, JSON.stringify(pipeline)); else localStorage.removeItem(pipelineStorageKey)
    localStorage.setItem(customNodesStorageKey, JSON.stringify(document.customNodes))
    if (maps.length) localStorage.setItem(mapStorageKey, JSON.stringify({ activeId: document.tabs.maps.activeId, documents: maps.map((value) => JSON.stringify(value)) })); else localStorage.removeItem(mapStorageKey)
    localStorage.setItem(workspaceStorageKey, JSON.stringify(document))
  } catch { /* invalid local storage is handled by individual editors */ }
}

export function recordsById(assets: readonly VisibleAsset[]): ReadonlyMap<string, AssetRecord> {
  return new Map(assets.map((asset) => [asset.record.id, asset.record]))
}

import { assetSchema, workspaceDocumentSchema, type AssetRecord, type WorkspaceDocument } from '@mosaico/contracts'
import { detectImageType, sha256 } from '@mosaico/pipeline'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

export const WORKSPACE_PROJECT_EXTENSION = '.mws'
export const WORKSPACE_PROJECT_MEDIA_TYPE = 'application/vnd.mosaico.workspace+zip'
const MAX_PACKAGE_BYTES = 256 * 1024 * 1024
const MAX_ENTRY_BYTES = 64 * 1024 * 1024
const safePath = /^(?:workspace\.json|tabs\/(?:editor|pipelines|maps)\/[A-Za-z0-9._-]+\.json|assets\/[a-f0-9]{64}\.(?:png|jpg|webp|gif))$/i

export interface LoadedWorkspacePackage {
  readonly document: WorkspaceDocument
  readonly assets: ReadonlyMap<string, Blob>
}

function extension(mediaType: AssetRecord['mediaType']): string {
  return mediaType === 'image/jpeg' ? 'jpg' : mediaType === 'image/webp' ? 'webp' : mediaType === 'image/gif' ? 'gif' : 'png'
}

function assetPath(asset: AssetRecord): string {
  return `assets/${asset.sha256.toLowerCase()}.${extension(asset.mediaType)}`
}

function assertEntries(entries: Record<string, Uint8Array>): void {
  let total = 0
  for (const [path, bytes] of Object.entries(entries)) {
    if (!safePath.test(path) || bytes.byteLength > MAX_ENTRY_BYTES) throw new Error('WORKSPACE_PACKAGE_ENTRIES_INVALID')
    total += bytes.byteLength
    if (total > MAX_PACKAGE_BYTES) throw new Error('WORKSPACE_PACKAGE_TOO_LARGE')
  }
}

function tabPath(kind: 'editor' | 'pipelines' | 'maps', index: number): string {
  return `tabs/${kind}/${String(index).padStart(4, '0')}.json`
}

function manifestFor(document: WorkspaceDocument): WorkspaceDocument {
  const tabs = (Object.keys(document.tabs) as Array<'editor' | 'pipelines' | 'maps'>).reduce((result, kind) => {
    const tab = document.tabs[kind]
    result[kind] = {
      ...tab,
      documents: tab.documents.map((value, index) => ({ path: tabPath(kind, index), value: value && typeof value === 'object' && 'id' in value ? (value as { id?: string }).id : undefined })),
    }
    return result
  }, {} as WorkspaceDocument['tabs'])
  return { ...document, tabs }
}

export function serializeWorkspaceDocument(document: WorkspaceDocument): string {
  const parsed = workspaceDocumentSchema.safeParse(document)
  if (!parsed.success) throw new Error('WORKSPACE_FORMAT_INVALID')
  return `${JSON.stringify(parsed.data, null, 2)}\n`
}

export async function createWorkspacePackage(document: WorkspaceDocument, assets: ReadonlyMap<string, Blob>): Promise<Blob> {
  const parsed = workspaceDocumentSchema.safeParse(document)
  if (!parsed.success) throw new Error('WORKSPACE_FORMAT_INVALID')
  const entries: Record<string, Uint8Array> = { 'workspace.json': strToU8(serializeWorkspaceDocument(manifestFor(parsed.data))) }
  for (const kind of ['editor', 'pipelines', 'maps'] as const) {
    for (const [index, value] of parsed.data.tabs[kind].documents.entries()) entries[tabPath(kind, index)] = strToU8(`${JSON.stringify(value)}\n`)
  }
  for (const asset of parsed.data.assets) {
    const blob = assets.get(asset.id)
    if (!blob) throw new Error('WORKSPACE_ASSET_MISSING')
    if (blob.size !== asset.byteSize) throw new Error('WORKSPACE_ASSET_SIZE_MISMATCH')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    if (detectImageType(bytes) !== asset.mediaType) throw new Error('WORKSPACE_ASSET_TYPE_MISMATCH')
    if ((await sha256(blob)).toLowerCase() !== asset.sha256.toLowerCase()) throw new Error('WORKSPACE_ASSET_HASH_MISMATCH')
    entries[assetPath(asset)] = new Uint8Array(await blob.arrayBuffer())
  }
  assertEntries(entries)
  const bytes = zipSync(entries, { level: 6 })
  if (bytes.byteLength > MAX_PACKAGE_BYTES) throw new Error('WORKSPACE_PACKAGE_TOO_LARGE')
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: WORKSPACE_PROJECT_MEDIA_TYPE })
}

export async function loadWorkspacePackage(blob: Blob): Promise<LoadedWorkspacePackage> {
  if (blob.size > MAX_PACKAGE_BYTES) throw new Error('WORKSPACE_PACKAGE_TOO_LARGE')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('WORKSPACE_PACKAGE_INVALID')
  let entries: Record<string, Uint8Array>
  try { entries = unzipSync(bytes) } catch { throw new Error('WORKSPACE_PACKAGE_INVALID') }
  assertEntries(entries)
  const manifest = entries['workspace.json']
  if (!manifest) throw new Error('WORKSPACE_MANIFEST_MISSING')
  let parsed: WorkspaceDocument
  try {
    const value = JSON.parse(strFromU8(manifest)) as unknown
    const result = workspaceDocumentSchema.safeParse(value)
    if (!result.success) throw new Error('WORKSPACE_FORMAT_INVALID')
    parsed = result.data
  } catch (error) {
    if (error instanceof Error && error.message === 'WORKSPACE_FORMAT_INVALID') throw error
    throw new Error('WORKSPACE_FORMAT_INVALID')
  }
  const tabs = (Object.keys(parsed.tabs) as Array<'editor' | 'pipelines' | 'maps'>).reduce((result, kind) => {
    const tab = parsed.tabs[kind]
    result[kind] = {
      ...tab,
      documents: tab.documents.map((reference, index) => {
        const path = reference && typeof reference === 'object' && 'path' in reference ? String((reference as { path?: unknown }).path) : tabPath(kind, index)
        if (!safePath.test(path) || !path.startsWith(`tabs/${kind}/`)) throw new Error('WORKSPACE_DOCUMENT_PATH_INVALID')
        const value = entries[path]
        if (!value) throw new Error('WORKSPACE_DOCUMENT_MISSING')
        try { return JSON.parse(strFromU8(value)) as unknown } catch { throw new Error('WORKSPACE_DOCUMENT_INVALID') }
      }),
    }
    return result
  }, {} as WorkspaceDocument['tabs'])
  const loadedAssets = new Map<string, Blob>()
  for (const asset of parsed.assets) {
    const value = entries[assetPath(asset)]
    if (!value) throw new Error('WORKSPACE_ASSET_MISSING')
    const candidate = new Blob([value.slice().buffer as ArrayBuffer], { type: asset.mediaType })
    if (candidate.size !== asset.byteSize) throw new Error('WORKSPACE_ASSET_SIZE_MISMATCH')
    if (detectImageType(value) !== asset.mediaType) throw new Error('WORKSPACE_ASSET_TYPE_MISMATCH')
    if ((await sha256(candidate)).toLowerCase() !== asset.sha256.toLowerCase()) throw new Error('WORKSPACE_ASSET_HASH_MISMATCH')
    if (!assetSchema.safeParse(asset).success) throw new Error('WORKSPACE_ASSET_INVALID')
    loadedAssets.set(asset.id, candidate)
  }
  return { document: { ...parsed, tabs }, assets: loadedAssets }
}

export async function saveWorkspaceProject(blob: Blob, name = `Workspace${WORKSPACE_PROJECT_EXTENSION}`): Promise<void> {
  const picker = (window as unknown as { showSaveFilePicker?: (options: unknown) => Promise<{ createWritable(): Promise<{ write(value: Blob): Promise<void>; close(): Promise<void> }> }> }).showSaveFilePicker
  if (picker) {
    const handle = await picker({ suggestedName: name, types: [{ description: 'Mosaico Workspace', accept: { [WORKSPACE_PROJECT_MEDIA_TYPE]: [WORKSPACE_PROJECT_EXTENSION] } }] })
    const writable = await handle.createWritable(); await writable.write(blob); await writable.close(); return
  }
  const url = URL.createObjectURL(blob); const link = window.document.createElement('a'); link.href = url; link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

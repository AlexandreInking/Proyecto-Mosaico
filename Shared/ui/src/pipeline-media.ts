import { customNodeDefinitionSchema, pipelineDocumentSchema, type AssetRecord, type PipelineDocument } from '@mosaico/contracts'
import { sha256 } from '@mosaico/pipeline'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

const maxPackageBytes = 64 * 1024 * 1024
const maxEntryBytes = 50 * 1024 * 1024
const safeArchivePath = /^(?:pipeline\.json|assets\/[A-Za-z0-9._-]+\.(?:png|jpg|webp|gif)|snapshots\/[A-Za-z0-9._-]+\.png)$/
const mediaExtension = (mediaType: AssetRecord['mediaType']): string => mediaType === 'image/jpeg' ? 'jpg' : mediaType === 'image/webp' ? 'webp' : mediaType === 'image/gif' ? 'gif' : 'png'
export const PIPELINE_PROJECT_EXTENSION = '.mpl'
export const PIPELINE_PROJECT_MEDIA_TYPE = 'application/vnd.mosaico.pipeline+zip'

export interface LoadedPipelinePackage {
  readonly document: PipelineDocument
  readonly assets: ReadonlyMap<string, Blob>
  readonly snapshots: ReadonlyMap<string, Blob>
}

function assetPath(asset: AssetRecord): string {
  const path = `assets/${asset.id}.${mediaExtension(asset.mediaType)}`
  if (!safeArchivePath.test(path)) throw new Error('PIPELINE_ASSET_REFERENCE_INVALID')
  return path
}

function validateEntries(entries: Record<string, Uint8Array>): void {
  let total = 0
  for (const [path, bytes] of Object.entries(entries)) {
    if (!safeArchivePath.test(path) || bytes.byteLength > maxEntryBytes) throw new Error('PIPELINE_PACKAGE_ENTRIES_INVALID')
    total += bytes.byteLength
    if (total > maxPackageBytes) throw new Error('PIPELINE_PACKAGE_TOO_LARGE')
  }
}

function validateCustomNodes(document: PipelineDocument): void {
  for (const node of document.nodes) {
    if (node.kind !== 'custom' && node.customDefinition === undefined) continue
    if (!customNodeDefinitionSchema.safeParse(node.customDefinition).success) throw new Error('PIPELINE_CUSTOM_NODE_INVALID')
  }
}

export function serializePipelineDocument(document: PipelineDocument): string {
  const parsed = pipelineDocumentSchema.safeParse(document)
  if (!parsed.success) throw new Error('PIPELINE_FORMAT_INVALID')
  validateCustomNodes(parsed.data)
  return `${JSON.stringify(parsed.data, null, 2)}\n`
}

export function deserializePipelineDocument(text: string): PipelineDocument {
  try {
    const parsed = pipelineDocumentSchema.safeParse(JSON.parse(text) as unknown)
    if (!parsed.success) throw new Error('PIPELINE_FORMAT_INVALID')
    validateCustomNodes(parsed.data)
    return parsed.data
  } catch (error) {
    if (error instanceof Error && error.message === 'PIPELINE_FORMAT_INVALID') throw error
    throw new Error('PIPELINE_FORMAT_INVALID')
  }
}

export async function createPipelinePackage(
  document: PipelineDocument,
  assets: ReadonlyMap<string, Blob>,
  snapshots: ReadonlyMap<string, Blob> = new Map(),
): Promise<Blob> {
  const validated = pipelineDocumentSchema.safeParse(document)
  if (!validated.success) throw new Error('PIPELINE_FORMAT_INVALID')
  validateCustomNodes(validated.data)
  const entries: Record<string, Uint8Array> = { 'pipeline.json': strToU8(serializePipelineDocument(validated.data)) }
  for (const asset of validated.data.assets) {
    const blob = assets.get(asset.id)
    if (!blob) throw new Error('PIPELINE_ASSET_MISSING')
    if (blob.size !== asset.byteSize) throw new Error('PIPELINE_ASSET_SIZE_MISMATCH')
    if (await sha256(blob) !== asset.sha256) throw new Error('PIPELINE_ASSET_HASH_MISMATCH')
    entries[assetPath(asset)] = new Uint8Array(await blob.arrayBuffer())
  }
  for (const snapshot of validated.data.timeline.snapshots) {
    if (!snapshot.thumbnailPath) continue
    const blob = snapshots.get(snapshot.id)
    if (!blob) throw new Error('PIPELINE_SNAPSHOT_MISSING')
    if (blob.type && blob.type !== 'image/png') throw new Error('PIPELINE_SNAPSHOT_TYPE_INVALID')
    entries[snapshot.thumbnailPath] = new Uint8Array(await blob.arrayBuffer())
  }
  validateEntries(entries)
  const bytes = zipSync(entries, { level: 6 })
  if (bytes.byteLength > maxPackageBytes) throw new RangeError('PIPELINE_PACKAGE_TOO_LARGE')
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: PIPELINE_PROJECT_MEDIA_TYPE })
}

export async function loadPipelinePackage(blob: Blob): Promise<LoadedPipelinePackage> {
  if (blob.size > maxPackageBytes) throw new RangeError('PIPELINE_PACKAGE_TOO_LARGE')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('PIPELINE_PACKAGE_INVALID')
  let entries: Record<string, Uint8Array>
  try { entries = unzipSync(bytes) } catch { throw new Error('PIPELINE_PACKAGE_INVALID') }
  validateEntries(entries)
  const manifest = entries['pipeline.json']
  if (!manifest) throw new Error('PIPELINE_MANIFEST_MISSING')
  const document = deserializePipelineDocument(strFromU8(manifest))
  validateCustomNodes(document)
  const loadedAssets = new Map<string, Blob>()
  for (const asset of document.assets) {
    const value = entries[assetPath(asset)]
    if (!value) throw new Error('PIPELINE_ASSET_MISSING')
    const assetBlob = new Blob([value.slice().buffer as ArrayBuffer], { type: asset.mediaType })
    if (assetBlob.size !== asset.byteSize) throw new Error('PIPELINE_ASSET_SIZE_MISMATCH')
    if (await sha256(assetBlob) !== asset.sha256) throw new Error('PIPELINE_ASSET_HASH_MISMATCH')
    loadedAssets.set(asset.id, assetBlob)
  }
  const loadedSnapshots = new Map<string, Blob>()
  for (const snapshot of document.timeline.snapshots) {
    if (!snapshot.thumbnailPath) continue
    const value = entries[snapshot.thumbnailPath]
    if (!value) throw new Error('PIPELINE_SNAPSHOT_MISSING')
    loadedSnapshots.set(snapshot.id, new Blob([value.slice().buffer as ArrayBuffer], { type: 'image/png' }))
  }
  return { document, assets: loadedAssets, snapshots: loadedSnapshots }
}

export async function savePipelineProject(blob: Blob, name: string): Promise<void> {
  const picker = (window as unknown as { showSaveFilePicker?: (options: unknown) => Promise<{ createWritable(): Promise<{ write(value: Blob): Promise<void>; close(): Promise<void> }> }> }).showSaveFilePicker
  if (picker) {
    const handle = await picker({ suggestedName: name, types: [{ description: 'Pipeline Mosaico', accept: { [PIPELINE_PROJECT_MEDIA_TYPE]: [PIPELINE_PROJECT_EXTENSION] } }] })
    const writable = await handle.createWritable(); await writable.write(blob); await writable.close(); return
  }
  const url = URL.createObjectURL(blob); const link = window.document.createElement('a'); link.href = url; link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

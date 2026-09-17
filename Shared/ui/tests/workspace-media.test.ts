import { describe, expect, it } from 'vitest'
import { sha256 } from '@mosaico/pipeline'
import { createWorkspacePackage, loadWorkspacePackage } from '../src/workspace-media.js'
import type { WorkspaceDocument } from '@mosaico/contracts'

const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='), (value) => value.charCodeAt(0))

async function fixture(): Promise<{ document: WorkspaceDocument; blob: Blob }> {
  const blob = new Blob([png], { type: 'image/png' }); const hash = await sha256(blob)
  return {
    document: {
      format: 'mosaico-workspace', formatVersion: 1, id: 'workspace-1', name: 'Рабочая область', activeModule: 'Assets', selectedAssetId: 'asset-1',
      assets: [{ id: 'asset-1', name: 'Capa · 1.png', mediaType: 'image/png', sha256: hash, byteSize: blob.size, width: 1, height: 1, importedAt: '2026-07-31T00:00:00.000Z' }],
      tabs: { editor: { documents: [{ id: 'editor-1', name: 'Capa' }], activeId: 'editor-1', ui: {} }, pipelines: { documents: [{ id: 'pipeline-1' }], ui: {} }, maps: { documents: [{ id: 'map-1' }], activeId: 'map-1', ui: {} } }, customNodes: [],
    },
    blob,
  }
}

describe('workspace .mws package', () => {
  it('round-trips Unicode workspace state and asset bytes', async () => {
    const { document, blob } = await fixture(); const packageBlob = await createWorkspacePackage(document, new Map([['asset-1', blob]])); const loaded = await loadWorkspacePackage(packageBlob)
    expect(loaded.document.name).toBe('Рабочая область')
    expect(loaded.document.tabs.editor.documents[0]).toEqual({ id: 'editor-1', name: 'Capa' })
    expect(await sha256(loaded.assets.get('asset-1')!)).toBe(document.assets[0]!.sha256)
  })

  it('rejects missing, invalid and wrongly typed assets', async () => {
    const { document, blob } = await fixture()
    await expect(createWorkspacePackage(document, new Map())).rejects.toThrow('WORKSPACE_ASSET_MISSING')
    await expect(createWorkspacePackage(document, new Map([['asset-1', new Blob([new Uint8Array(blob.size)], { type: 'image/gif' })]]))).rejects.toThrow('WORKSPACE_ASSET_TYPE_MISMATCH')
    await expect(loadWorkspacePackage(new Blob(['not a zip']))).rejects.toThrow('WORKSPACE_PACKAGE_INVALID')
  })
})

import { describe, expect, it } from 'vitest'
import { sha256 } from '@mosaico/pipeline'
import { strToU8, zipSync } from 'fflate'
import { createPipelinePackage, loadPipelinePackage, PIPELINE_PROJECT_EXTENSION, PIPELINE_PROJECT_MEDIA_TYPE } from '../src/pipeline-media.js'
import type { PipelineDocument } from '@mosaico/contracts'

async function fixture(): Promise<{ document: PipelineDocument; blob: Blob }> {
  const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' })
  const document: PipelineDocument = {
    format: 'mosaico-pipeline', formatVersion: 1, id: 'pipeline-a', revision: 1, name: 'Pipeline prueba',
    nodes: [{ id: 'asset-node', kind: 'asset', x: 0, y: 0, assetId: 'asset-a', parameters: [] }],
    edges: [],
    assets: [{ id: 'asset-a', name: 'Capa 1.png', mediaType: 'image/png', sha256: await sha256(blob), byteSize: blob.size, width: 1, height: 1, importedAt: '2026-07-31T00:00:00.000Z' }],
    timeline: { mode: 'snapshots', durationMs: 1000, currentTimeMs: 0, keyframes: [], snapshots: [] },
    viewport: { x: 0, y: 0, zoom: 1 },
  }
  return { document, blob }
}

describe('pipeline media', () => {
  it('uses mpl as the new Pipeline project format', () => {
    expect(PIPELINE_PROJECT_EXTENSION).toBe('.mpl')
    expect(PIPELINE_PROJECT_MEDIA_TYPE).toBe('application/vnd.mosaico.pipeline+zip')
  })

  it('round-trips a self-contained MPL package and its asset bytes', async () => {
    const { document, blob } = await fixture()
    const packageBlob = await createPipelinePackage(document, new Map([['asset-a', blob]]))
    const loaded = await loadPipelinePackage(packageBlob)
    expect(loaded.document).toEqual(document)
    expect([...new Uint8Array(await loaded.assets.get('asset-a')!.arrayBuffer())]).toEqual([1, 2, 3, 4])
  })

  it('stores GIF Assets under gif archive paths without changing metadata', async () => {
    const { document } = await fixture()
    const blob = new Blob([new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])], { type: 'image/gif' })
    const gifDocument: PipelineDocument = { ...document, assets: [{ ...document.assets[0]!, mediaType: 'image/gif', byteSize: blob.size, sha256: await sha256(blob) }] }
    const loaded = await loadPipelinePackage(await createPipelinePackage(gifDocument, new Map([['asset-a', blob]])))
    expect(loaded.document.assets[0]?.mediaType).toBe('image/gif')
    expect([...new Uint8Array(await loaded.assets.get('asset-a')!.arrayBuffer())]).toEqual([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  })

  it('rejects a missing or modified asset before saving', async () => {
    const { document } = await fixture()
    await expect(createPipelinePackage(document, new Map())).rejects.toThrow('PIPELINE_ASSET_MISSING')
    const wrong = new Blob([new Uint8Array([9, 8, 7, 6])], { type: 'image/png' })
    await expect(createPipelinePackage(document, new Map([['asset-a', wrong]]))).rejects.toThrow('PIPELINE_ASSET_HASH_MISMATCH')
  })

  it('rejects unsafe archive entries while loading', async () => {
    const bytes = zipSync({ '../evil.json': strToU8('{}'), 'pipeline.json': strToU8('{}') })
    await expect(loadPipelinePackage(new Blob([bytes.slice().buffer as ArrayBuffer]))).rejects.toThrow('PIPELINE_PACKAGE_ENTRIES_INVALID')
  })
})

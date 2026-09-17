import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import type { BrushPackContract } from '@mosaico/contracts'
import { createBrushPack, loadBrushPack } from '../src/brush-pack.js'

const pack: BrushPackContract = {
  format: 'mosaico-brush-pack',
  formatVersion: 1,
  name: 'Pinceles base',
  brushes: [
    { id: '3fa85f64-5717-4562-b3fc-2c963f66afa6', label: 'Fino', shape: 'square', size: 1 },
    { id: 'c232b39a-8db4-4d92-9df1-9e5c73a2b111', label: 'Redondo', shape: 'circle', size: 7 },
    { id: '91adac41-6ea5-4a70-9c67-d1cb4a2fc222', label: 'Romboidal', shape: 'diamond', size: 12 },
  ],
}

const packBlob = (bytes: Uint8Array) => new Blob([bytes.slice().buffer as ArrayBuffer])

describe('brush pack', () => {
  it('round-trips a valid package through zip bytes', async () => {
    const loaded = await loadBrushPack(createBrushPack(pack))
    expect(loaded).toEqual(pack)
  })

  it('rejects blobs without zip magic', async () => {
    await expect(loadBrushPack(packBlob(new Uint8Array([0, 1, 2, 3])))).rejects.toThrow('BRUSH_PACK_INVALID')
  })

  it('rejects foreign archive entries', async () => {
    const hostile = zipSync({ 'brush-pack.json': strToU8(JSON.stringify(pack)), 'stamps/evil.png': new Uint8Array([1]) })
    await expect(loadBrushPack(packBlob(hostile))).rejects.toThrow('BRUSH_PACK_ENTRIES_INVALID')
  })

  it('rejects manifests with duplicate preset ids', async () => {
    const duplicated: BrushPackContract = { ...pack, brushes: [pack.brushes[0]!, pack.brushes[1]!, { ...pack.brushes[2]!, id: pack.brushes[0]!.id }] }
    const hostile = zipSync({ 'brush-pack.json': strToU8(JSON.stringify(duplicated)) })
    await expect(loadBrushPack(packBlob(hostile))).rejects.toThrow('BRUSH_PACK_FORMAT_INVALID')
  })

  it('rejects archives without a manifest entry', async () => {
    await expect(loadBrushPack(packBlob(zipSync({})))).rejects.toThrow('BRUSH_PACK_MANIFEST_MISSING')
  })

  it('rejects packs exceeding the preset budget', () => {
    const flooded: BrushPackContract = { ...pack, brushes: Array.from({ length: 65 }, (_, index) => ({ id: crypto.randomUUID(), label: `P${index}`, shape: 'square' as const, size: 1 })) }
    expect(() => createBrushPack(flooded)).toThrow('BRUSH_PACK_FORMAT_INVALID')
  })

  it('rejects out-of-range brush sizes at the contract boundary', async () => {
    const invalid: BrushPackContract = { ...pack, brushes: [{ ...pack.brushes[0]!, size: 33 }] }
    expect(() => createBrushPack(invalid)).toThrow('BRUSH_PACK_FORMAT_INVALID')
    const hostile = zipSync({ 'brush-pack.json': strToU8(JSON.stringify(invalid)) })
    await expect(loadBrushPack(packBlob(hostile))).rejects.toThrow('BRUSH_PACK_FORMAT_INVALID')
  })
})

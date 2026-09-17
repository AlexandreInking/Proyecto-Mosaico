import { brushPackSchema, type BrushPackContract } from '@mosaico/contracts'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

const maxPackBytes = 16 * 1024 * 1024
const maxDecompressedBytes = 4 * 1024 * 1024
const safeArchivePath = /^brush-pack\.json$/
export const BRUSH_PACK_EXTENSION = '.brushpack'
export const BRUSH_PACK_MEDIA_TYPE = 'application/vnd.mosaico.brushpack+zip'

export function createBrushPack(pack: BrushPackContract): Blob {
  const parsed = brushPackSchema.safeParse(pack)
  if (!parsed.success) throw new Error('BRUSH_PACK_FORMAT_INVALID')
  const bytes = zipSync({ 'brush-pack.json': strToU8(`${JSON.stringify(parsed.data, null, 2)}\n`) }, { level: 6 })
  if (bytes.byteLength > maxPackBytes) throw new RangeError('BRUSH_PACK_TOO_LARGE')
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: BRUSH_PACK_MEDIA_TYPE })
}

export async function loadBrushPack(blob: Blob): Promise<BrushPackContract> {
  if (blob.size > maxPackBytes) throw new RangeError('BRUSH_PACK_TOO_LARGE')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('BRUSH_PACK_INVALID')
  let entries: Record<string, Uint8Array>
  try { entries = unzipSync(bytes) } catch { throw new Error('BRUSH_PACK_INVALID') }
  let totalBytes = 0
  for (const [path, entry] of Object.entries(entries)) {
    if (!safeArchivePath.test(path)) throw new Error('BRUSH_PACK_ENTRIES_INVALID')
    totalBytes += entry.byteLength
  }
  if (totalBytes > maxDecompressedBytes) throw new RangeError('BRUSH_PACK_TOO_LARGE')
  const manifest = entries['brush-pack.json']
  if (!manifest) throw new Error('BRUSH_PACK_MANIFEST_MISSING')
  try {
    const parsed = brushPackSchema.safeParse(JSON.parse(strFromU8(manifest)) as unknown)
    if (!parsed.success) throw new Error('BRUSH_PACK_FORMAT_INVALID')
    return parsed.data
  } catch (error) {
    if (error instanceof Error && error.message === 'BRUSH_PACK_FORMAT_INVALID') throw error
    throw new Error('BRUSH_PACK_FORMAT_INVALID')
  }
}

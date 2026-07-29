import { deserializeMapDocument, orphanTileDiagnostics, serializeMapDocument, type MapDocument } from '@mosaico/domain'
import { sha256 } from '@mosaico/pipeline'
import { strFromU8, strToU8, unzip, zip, type AsyncZippable } from 'fflate'

export interface MapAsset { readonly blob: Blob; readonly url: string }
export interface LoadedMapProject { readonly document: MapDocument; readonly assets: ReadonlyMap<string, MapAsset> }

const maxPackageBytes = 256 * 1024 * 1024
const safeName = (name: string) => name.replace(/[^a-z0-9_-]+/gi, '-') || 'map'
const extension = (mediaType?: string) => mediaType === 'image/jpeg' ? 'jpg' : mediaType === 'image/webp' ? 'webp' : 'png'
const safeArchivePath = /^(?:project\.json|manifest\.json|map\.json|assets\/[a-zA-Z0-9._-]+\.(?:png|jpg|webp))$/
const assertExportable = (document: MapDocument) => { if (orphanTileDiagnostics(document).length) throw new Error('MAP_EXPORT_ORPHANS') }
const yieldExportTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
const assetPath = (assetId: string, mediaType?: string) => {
  const path = `assets/${assetId}.${extension(mediaType)}`
  if (!safeArchivePath.test(path)) throw new Error('MAP_ASSET_REFERENCE_INVALID')
  return path
}

async function assetEntries(document: MapDocument, assets: ReadonlyMap<string, MapAsset>): Promise<Record<string, Uint8Array>> {
  const entries: Record<string, Uint8Array> = {}
  for (const tileset of document.tilesets) {
    const asset = assets.get(tileset.assetId)
    if (!asset) throw new Error('MAP_ASSET_MISSING')
    if (tileset.byteSize !== undefined && asset.blob.size !== tileset.byteSize) throw new Error('MAP_ASSET_SIZE_MISMATCH')
    if (tileset.sha256 && await sha256(asset.blob) !== tileset.sha256.toLowerCase()) throw new Error('MAP_ASSET_HASH_MISMATCH')
    const path = assetPath(tileset.assetId, tileset.mediaType)
    if (entries[path]) continue
    entries[path] = new Uint8Array(await asset.blob.arrayBuffer())
  }
  return entries
}

function zipFiles(entries: Readonly<Record<string, Uint8Array>>): Promise<Uint8Array> {
  const input: AsyncZippable = {}
  for (const path of Object.keys(entries).sort()) input[path] = [entries[path]!, { mtime: new Date(1980, 0, 1) }]
  return new Promise((resolve, reject) => zip(input, { level: 6 }, (error, data) => error ? reject(error) : resolve(data)))
}

function unzipFiles(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  let invalid = false; let total = 0; const names = new Set<string>()
  return new Promise((resolve, reject) => unzip(bytes, {
    filter(file) {
      total += file.originalSize
      if (!safeArchivePath.test(file.name) || names.has(file.name) || file.originalSize > maxPackageBytes || total > maxPackageBytes) { invalid = true; return false }
      names.add(file.name); return true
    },
  }, (error, files) => error ? reject(error) : invalid ? reject(new Error('MAP_PACKAGE_ENTRIES_INVALID')) : resolve(files)))
}

export async function createMapPackage(document: MapDocument, assets: ReadonlyMap<string, MapAsset>): Promise<Blob> {
  const bytes = await zipFiles({ 'project.json': strToU8(serializeMapDocument(document)), ...await assetEntries(document, assets) })
  if (bytes.byteLength > maxPackageBytes) throw new RangeError('MAP_PACKAGE_TOO_LARGE')
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/vnd.mosaico.project+zip' })
}

export async function loadMapProject(blob: Blob): Promise<LoadedMapProject> {
  if (blob.size > maxPackageBytes) throw new RangeError('MAP_PACKAGE_TOO_LARGE')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return { document: deserializeMapDocument(strFromU8(bytes)), assets: new Map() }
  const files = await unzipFiles(bytes)
  const manifest = files['project.json'] ?? files['manifest.json']
  if (!manifest) throw new Error('MAP_PACKAGE_MANIFEST_MISSING')
  const document = deserializeMapDocument(strFromU8(manifest))
  const assets = new Map<string, MapAsset>()
  for (const tileset of document.tilesets) {
    const path = assetPath(tileset.assetId, tileset.mediaType)
    const value = files[path]
    if (!value) throw new Error('MAP_PACKAGE_ASSET_MISSING')
    const blob = new Blob([value.slice().buffer as ArrayBuffer], { type: tileset.mediaType ?? 'image/png' })
    if (tileset.byteSize !== undefined && blob.size !== tileset.byteSize) throw new Error('MAP_PACKAGE_ASSET_SIZE_MISMATCH')
    if (tileset.sha256 && await sha256(blob) !== tileset.sha256.toLowerCase()) throw new Error('MAP_PACKAGE_ASSET_HASH_MISMATCH')
    assets.set(tileset.assetId, { blob, url: URL.createObjectURL(blob) })
  }
  return { document, assets }
}

export function neutralMapJson(document: MapDocument): string {
  assertExportable(document)
  return `${JSON.stringify({
    format: 'mosaico-neutral-tilemap', version: 1, id: document.id, revision: document.revision, name: document.name,
    map: { width: document.width, height: document.height, tileWidth: document.cellWidth, tileHeight: document.cellHeight, orientation: document.orientation, background: document.background, grid: document.grid },
    tilesets: document.tilesets.map((set) => ({ id: set.id, name: set.name, asset: assetPath(set.assetId, set.mediaType), assetId: set.assetId, sha256: set.sha256, byteSize: set.byteSize, mediaType: set.mediaType, imageWidth: set.imageWidth, imageHeight: set.imageHeight, tileWidth: set.tileWidth, tileHeight: set.tileHeight, margin: { x: set.marginX, y: set.marginY }, spacing: { x: set.spacingX, y: set.spacingY }, offset: { x: set.offsetX ?? 0, y: set.offsetY ?? 0 }, tileCount: set.tileCount })),
    autotileSets: document.autotileSets,
    layers: document.layers.map((layer, order) => ({ id: layer.id, name: layer.name, order, visible: layer.visible, locked: layer.locked, opacity: layer.opacity, isFolder: !!layer.isFolder, parentId: layer.parentId, collapsed: !!layer.collapsed, tiles: [...layer.cells.entries()].map(([key, tile]) => { const [x, y] = key.split(',').map(Number); return { x: x!, y: y!, tilesetId: tile.tilesetId, tileId: tile.tileId, flipX: !!tile.flipX, flipY: !!tile.flipY, rotation: tile.rotation ?? 0, autotileSetId: tile.autotileSetId, autotileProfile: tile.autotileProfile, animationId: tile.animationId, animationFrame: tile.animationFrame, animationDurationMs: tile.animationDurationMs } }).sort((left, right) => left.y - right.y || left.x - right.x) })),
  }, null, 2)}\n`
}

export async function createNeutralMapPackage(document: MapDocument, assets: ReadonlyMap<string, MapAsset>): Promise<Blob> {
  const bytes = await zipFiles({ 'map.json': strToU8(neutralMapJson(document)), ...await assetEntries(document, assets) })
  if (bytes.byteLength > maxPackageBytes) throw new RangeError('MAP_PACKAGE_TOO_LARGE')
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/zip' })
}

export async function renderMapPng(document: MapDocument, assets: ReadonlyMap<string, MapAsset>): Promise<Blob> {
  assertExportable(document)
  for (const tileset of document.tilesets) if (!assets.has(tileset.assetId)) throw new Error('MAP_ASSET_MISSING')
  const width = document.width * document.cellWidth; const height = document.height * document.cellHeight
  if (width > 16_384 || height > 16_384 || width * height > 67_108_864) throw new RangeError('MAP_EXPORT_TOO_LARGE')
  const canvas = window.document.createElement('canvas'); canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d'); if (!context) throw new Error('CANVAS_2D_UNAVAILABLE')
  context.imageSmoothingEnabled = false
  if (document.background.kind === 'color') { context.fillStyle = document.background.color; context.fillRect(0, 0, width, height) }
  const images = new Map<string, ImageBitmap>()
  try {
    for (const [id, asset] of assets) images.set(id, await createImageBitmap(asset.blob))
    let drawnCells = 0
    for (const layer of document.layers) {
      if (!layer.visible || layer.opacity <= 0) continue
      context.globalAlpha = layer.opacity
      for (const [key, tile] of layer.cells) {
        const tileset = document.tilesets.find((set) => set.id === tile.tilesetId); if (!tileset) continue
        const image = images.get(tileset.assetId); if (!image || image.width <= 0 || image.height <= 0) continue
        const columns = Math.max(1, Math.floor((tileset.imageWidth - (tileset.offsetX ?? 0) - tileset.marginX * 2 + tileset.spacingX) / (tileset.tileWidth + tileset.spacingX)))
        const sx = (tileset.offsetX ?? 0) + tileset.marginX + (tile.tileId % columns) * (tileset.tileWidth + tileset.spacingX)
        const sy = (tileset.offsetY ?? 0) + tileset.marginY + Math.floor(tile.tileId / columns) * (tileset.tileHeight + tileset.spacingY)
        const [x, y] = key.split(',').map(Number); const dx = x! * document.cellWidth; const dy = (y! + 1) * document.cellHeight - tileset.tileHeight
        context.save(); context.translate(dx + tileset.tileWidth / 2, dy + tileset.tileHeight / 2); context.rotate((tile.rotation ?? 0) * Math.PI / 180); context.scale(tile.flipX ? -1 : 1, tile.flipY ? -1 : 1)
        if (sx < 0 || sy < 0 || sx + tileset.tileWidth > image.width || sy + tileset.tileHeight > image.height) { context.restore(); continue }
        context.drawImage(image, sx, sy, tileset.tileWidth, tileset.tileHeight, -tileset.tileWidth / 2, -tileset.tileHeight / 2, tileset.tileWidth, tileset.tileHeight); context.restore()
        drawnCells += 1
        if (drawnCells % 1024 === 0) await yieldExportTask()
      }
    }
  } finally { for (const image of images.values()) image.close() }
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('MAP_EXPORT_FAILED')), 'image/png'))
}

export async function saveMapPackage(document: MapDocument, assets: ReadonlyMap<string, MapAsset>): Promise<void> {
  const blob = await createMapPackage(document, assets)
  await saveMapBlob(blob, `${safeName(document.name)}.mosaico`, 'Proyecto Mosaico', 'application/vnd.mosaico.project+zip', '.mosaico')
}

export async function saveMapBlob(blob: Blob, name: string, description: string, mediaType: string, fileExtension: string): Promise<void> {
  const picker = (window as unknown as { showSaveFilePicker?: (options: unknown) => Promise<{ createWritable(): Promise<{ write(value: Blob): Promise<void>; close(): Promise<void> }> }> }).showSaveFilePicker
  if (picker) {
    const handle = await picker({ suggestedName: name, types: [{ description, accept: { [mediaType]: [fileExtension] } }] })
    const writable = await handle.createWritable(); await writable.write(blob); await writable.close(); return
  }
  const url = URL.createObjectURL(blob); const link = window.document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0)
}

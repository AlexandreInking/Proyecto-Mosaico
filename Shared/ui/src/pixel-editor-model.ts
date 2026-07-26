import { PixelBuffer, type SpriteDocument, type SpriteLayer } from '@mosaico/domain'

export function usedPalette(document: SpriteDocument): string[] {
  const colors = new Set<string>()
  for (const layer of document.layers) for (const cel of layer.cels.values()) {
    const bytes = cel.pixels.toUint8Array()
    for (let offset = 0; offset < bytes.length; offset += 4) if (bytes[offset + 3]) colors.add(`#${[bytes[offset], bytes[offset + 1], bytes[offset + 2]].map((value) => value!.toString(16).padStart(2, '0')).join('')}`)
  }
  return [...colors]
}

function onionLayers(document: SpriteDocument, frameId: string, color: readonly [number, number, number], prefix: string): SpriteLayer[] {
  return document.layers.flatMap((layer) => {
    const cel = layer.cels.get(frameId); if (!cel) return []
    const bytes = cel.pixels.mutableCopy()
    for (let offset = 0; offset < bytes.length; offset += 4) if (bytes[offset + 3]) { bytes[offset] = color[0]; bytes[offset + 1] = color[1]; bytes[offset + 2] = color[2] }
    const active = document.activeFrameId
    return [{ ...layer, id: `${prefix}-${layer.id}`, locked: true, opacity: layer.opacity * 0.35, cels: new Map([[active, { frameId: active, pixels: new PixelBuffer(bytes) }]]) }]
  })
}

export function onionSkinDocument(document: SpriteDocument): SpriteDocument {
  const index = document.frames.findIndex((frame) => frame.id === document.activeFrameId)
  const previous = index > 0 ? onionLayers(document, document.frames[index - 1]!.id, [255, 96, 96], 'onion-prev') : []
  const next = index + 1 < document.frames.length ? onionLayers(document, document.frames[index + 1]!.id, [96, 160, 255], 'onion-next') : []
  return { ...document, layers: [...previous, ...next, ...document.layers] }
}

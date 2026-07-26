import { describe, expect, it } from 'vitest'
import { addSpriteFrame, addSpriteLayer, createSpriteDocument, getPixel, setPixel, updateSpriteLayer } from '@mosaico/domain'
import { onionSkinDocument, usedPalette } from '../src/pixel-editor-model.js'

const ids = { id: 'doc', layerId: 'layer-1', frameId: 'frame-1' }

describe('pixel editor model', () => {
  it('collects colors from hidden layers and every frame', () => {
    let document = createSpriteDocument({ ...ids, name: 'Sprite', width: 2, height: 1 })
    document = addSpriteLayer(document, { id: 'layer-2', name: 'Oculta' })
    document = setPixel(document, 'layer-2', 'frame-1', { x: 0, y: 0 }, { r: 255, g: 0, b: 0, a: 255 })
    document = updateSpriteLayer(document, 'layer-2', { visible: false })
    document = addSpriteFrame(document, { id: 'frame-2' })
    document = setPixel(document, 'layer-2', 'frame-2', { x: 1, y: 0 }, { r: 0, g: 0, b: 255, a: 255 })
    expect(usedPalette(document)).toEqual(['#ff0000', '#0000ff'])
  })

  it('adds tinted previous and next onion frames around the active frame', () => {
    let document = createSpriteDocument({ ...ids, name: 'Sprite', width: 1, height: 1 })
    document = setPixel(document, 'layer-1', 'frame-1', { x: 0, y: 0 }, { r: 255, g: 255, b: 255, a: 255 })
    document = addSpriteFrame(document, { id: 'frame-2' })
    document = addSpriteFrame(document, { id: 'frame-3' })
    document = setPixel(document, 'layer-1', 'frame-3', { x: 0, y: 0 }, { r: 255, g: 255, b: 255, a: 255 })
    document = { ...document, activeFrameId: 'frame-2' }
    const onion = onionSkinDocument(document)
    expect(onion.layers).toHaveLength(3)
    expect(getPixel(onion, onion.layers[0]!.id, 'frame-2', { x: 0, y: 0 })).toMatchObject({ r: 255, g: 96, b: 96 })
    expect(getPixel(onion, onion.layers[1]!.id, 'frame-2', { x: 0, y: 0 })).toMatchObject({ r: 96, g: 160, b: 255 })
  })
})

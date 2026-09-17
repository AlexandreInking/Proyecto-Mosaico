import { describe, expect, it } from 'vitest'
import { loadMapImage, type MapImageElement } from '../src/map-textures.js'

function fakeImage(): MapImageElement {
  return { complete: false, naturalWidth: 0, naturalHeight: 0, src: '', onload: null, onerror: null }
}

describe('map texture loading', () => {
  it('waits for decoded non-zero image dimensions before resolving', async () => {
    const image = fakeImage()
    let settled = false
    const pending = loadMapImage('blob:test', () => image).then(() => { settled = true })
    await Promise.resolve()
    expect(settled).toBe(false)
    image.naturalWidth = 32; image.naturalHeight = 16; image.complete = true; image.onload?.()
    await pending
    expect(settled).toBe(true)
  })

  it('rejects zero-sized images instead of handing them to CanvasRenderer', async () => {
    const image = fakeImage()
    const pending = loadMapImage('blob:empty', () => image)
    image.complete = true; image.onload?.()
    await expect(pending).rejects.toThrow('MAP_IMAGE_EMPTY')
  })
})

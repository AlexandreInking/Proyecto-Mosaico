import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMapDocument, setTile } from '@mosaico/domain'
import { createViewport } from '../src/index.js'

const pixi = vi.hoisted(() => {
  const renderers: MockRenderer[] = []
  const graphics: MockGraphics[] = []
  const containers: MockContainer[] = []

  class MockContainer {
    children: any[] = []
    mask: unknown
    setChildIndex = vi.fn((child: any, index: number) => {
      this.children.splice(this.children.indexOf(child), 1)
      this.children.splice(index, 0, child)
    })
    constructor() { containers.push(this) }
    addChild(...children: any[]) { this.children.push(...children) }
    removeChild(child: any) { this.children.splice(this.children.indexOf(child), 1) }
    destroy() {}
  }

  class MockGraphics {
    moveTo = vi.fn(() => this)
    lineTo = vi.fn(() => this)
    constructor() { graphics.push(this) }
    clear() { return this }
    rect() { return this }
    fill() { return this }
    stroke() { return this }
  }

  class MockSprite {
    visible = true
    texture: any
    anchor = { set: vi.fn() }
    position = { set: vi.fn() }
    scale = { x: 1, y: 1 }
    width = 0
    height = 0
    rotation = 0
    alpha = 1
    constructor(texture: any) { this.texture = texture }
    destroy() {}
  }

  class MockRenderer {
    resize = vi.fn()
    render = vi.fn()
    canvas = { style: {}, setAttribute: vi.fn() }
    constructor() { renderers.push(this) }
    async init() {}
    destroy() {}
  }

  return { MockContainer, MockGraphics, MockRenderer, MockSprite, renderers, graphics, containers }
})

vi.mock('pixi.js', () => ({
  CanvasRenderer: pixi.MockRenderer,
  Container: pixi.MockContainer,
  Graphics: pixi.MockGraphics,
  Sprite: pixi.MockSprite,
}))

import { OrthogonalPixiViewport } from '../src/map/pixi-orthogonal-viewport.js'

function mapWithTile() {
  const tileset = {
    id: '11111111-1111-4111-8111-111111111111', name: 'Tiles', assetId: 'asset',
    imageWidth: 16, imageHeight: 16, tileWidth: 16, tileHeight: 16,
    marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 1,
  }
  let map = createMapDocument({
    id: '22222222-2222-4222-8222-222222222222', name: 'Map', width: 4096, height: 4096,
    cellWidth: 16, cellHeight: 16, layerId: '33333333-3333-4333-8333-333333333333', tilesets: [tileset],
  })
  map = setTile(map, map.activeLayerId, { x: 0, y: 0 }, { tilesetId: tileset.id, tileId: 0 })
  return map
}

describe('OrthogonalPixiViewport render work', () => {
  beforeEach(() => {
    pixi.renderers.length = 0
    pixi.graphics.length = 0
    pixi.containers.length = 0
  })

  it('skips stable resize and sprite order while limiting grid lines to the viewport', async () => {
    const host = { clientWidth: 160, clientHeight: 160, replaceChildren: vi.fn() } as unknown as HTMLElement
    const texture = { source: { scaleMode: '' } } as any
    const renderer = await OrthogonalPixiViewport.create({ host, resolveTexture: () => texture })
    const viewport = createViewport({ width: 160, height: 160 })
    const map = mapWithTile()

    renderer.render(map, viewport, { showGrid: true })
    renderer.render(map, viewport, { showGrid: true })

    expect(pixi.renderers[0]!.resize).not.toHaveBeenCalled()
    expect(pixi.containers[1]!.setChildIndex).not.toHaveBeenCalled()
    const grid = pixi.graphics[2]!
    expect(grid.moveTo).toHaveBeenCalledTimes(22 * 2)

    renderer.render(map, { ...viewport, width: 176 }, { showGrid: false })
    expect(pixi.renderers[0]!.resize).toHaveBeenCalledOnce()
    expect(pixi.renderers[0]!.resize).toHaveBeenCalledWith(176, 160)
  })
})

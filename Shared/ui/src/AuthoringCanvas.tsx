import { useEffect, useRef, useState } from 'react'
import 'pixi.js/unsafe-eval'
import { createMapDocument, createSpriteDocument, setPixel, setTile } from '@mosaico/domain'
import {
  createViewport,
  OrthogonalPixiViewport,
  panViewport,
  pickOrthogonalCell,
  pickSpritePixel,
  PixiPixelViewport,
  resizeViewport,
  zoomViewportAt,
  type Point,
} from '@mosaico/canvas'
import { Texture } from 'pixi.js'

export type AuthoringMode = 'Mapas' | 'Pixel Art'

function createTileTexture(color: string, detail: string): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const context = canvas.getContext('2d')
  if (!context) throw new Error('TILE_TEXTURE_CONTEXT_UNAVAILABLE')
  context.fillStyle = color
  context.fillRect(0, 0, 16, 16)
  context.fillStyle = detail
  context.fillRect(2, 2, 5, 5)
  context.fillRect(9, 9, 5, 5)
  const texture = Texture.from(canvas)
  texture.source.scaleMode = 'nearest'
  return texture
}

function demoMap() {
  const tileset = {
    id: '11111111-1111-4111-8111-111111111111', name: 'Tiles base', assetId: 'authoring-demo',
    imageWidth: 64, imageHeight: 16, tileWidth: 16, tileHeight: 16,
    marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 4,
  }
  let map = createMapDocument({
    id: '22222222-2222-4222-8222-222222222222', name: 'Mapa sin título', width: 64, height: 40,
    cellWidth: 16, cellHeight: 16, layerId: '33333333-3333-4333-8333-333333333333', tilesets: [tileset],
  })
  for (let y = 0; y < 18; y += 1) for (let x = 0; x < 28; x += 1) {
    map = setTile(map, map.activeLayerId, { x, y }, { tilesetId: tileset.id, tileId: (x * 7 + y * 3) % 4 })
  }
  return map
}

function demoSprite() {
  let sprite = createSpriteDocument({
    id: '44444444-4444-4444-8444-444444444444', name: 'Sprite sin título', width: 16, height: 16,
    layerId: '55555555-5555-4555-8555-555555555555', frameId: '66666666-6666-4666-8666-666666666666',
  })
  const palette = [{ r: 75, g: 195, b: 183, a: 255 }, { r: 232, g: 187, b: 107, a: 255 }, { r: 255, g: 137, b: 149, a: 255 }]
  for (let y = 2; y < 14; y += 1) for (let x = 2; x < 14; x += 1) {
    if ((x + y) % 3 !== 0) sprite = setPixel(sprite, sprite.activeLayerId, sprite.activeFrameId, { x, y }, palette[(x + y) % palette.length]!)
  }
  return sprite
}

export function AuthoringCanvas({ mode }: { readonly mode: AuthoringMode }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('Inicializando canvas…')

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let cleanup = () => {}

    void (async () => {
      const map = mode === 'Mapas' ? demoMap() : undefined
      const sprite = mode === 'Pixel Art' ? demoSprite() : undefined
      const textures = map ? [createTileTexture('#23534f', '#4bc3b7'), createTileTexture('#51452d', '#e8bb6b'), createTileTexture('#4d2930', '#ff8995'), createTileTexture('#26384e', '#76a8df')] : []
      const mapRenderer = map ? await OrthogonalPixiViewport.create({ host, resolveTexture: (tile) => textures[tile.tileId] }) : undefined
      const pixelRenderer = sprite ? await PixiPixelViewport.create(host) : undefined
      if (disposed) {
        mapRenderer?.destroy(); pixelRenderer?.destroy(); textures.forEach((texture) => texture.destroy(true)); return
      }
      let viewport = createViewport({ width: 1, height: 1, zoom: map ? 1.35 : 18, offsetX: map ? 28 : 44, offsetY: map ? 28 : 44 })
      let previous: Point | undefined
      const render = () => {
        viewport = resizeViewport(viewport, Math.max(1, host.clientWidth), Math.max(1, host.clientHeight))
        if (map && mapRenderer) setStatus(`${mapRenderer.render(map, viewport)} tiles visibles`)
        if (sprite && pixelRenderer) { pixelRenderer.render(sprite, viewport); setStatus('16 × 16 px · grid activo') }
      }
      const point = (event: PointerEvent | WheelEvent): Point => {
        const bounds = host.getBoundingClientRect()
        return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
      }
      const wheel = (event: WheelEvent) => { event.preventDefault(); viewport = zoomViewportAt(viewport, point(event), Math.exp(-event.deltaY * 0.0015)); render() }
      const down = (event: PointerEvent) => { previous = point(event); host.setPointerCapture(event.pointerId) }
      const move = (event: PointerEvent) => {
        const current = point(event)
        const picked = map ? pickOrthogonalCell(viewport, current, map) : sprite ? pickSpritePixel(viewport, current, sprite) : undefined
        if (picked) setStatus(`${picked.x}, ${picked.y}`)
        if (!previous || !host.hasPointerCapture(event.pointerId)) return
        viewport = panViewport(viewport, current.x - previous.x, current.y - previous.y)
        previous = current
        render()
      }
      const up = (event: PointerEvent) => { previous = undefined; if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId) }
      const observer = new ResizeObserver(render)
      observer.observe(host)
      host.addEventListener('wheel', wheel, { passive: false })
      host.addEventListener('pointerdown', down)
      host.addEventListener('pointermove', move)
      host.addEventListener('pointerup', up)
      render()
      cleanup = () => {
        observer.disconnect()
        host.removeEventListener('wheel', wheel)
        host.removeEventListener('pointerdown', down)
        host.removeEventListener('pointermove', move)
        host.removeEventListener('pointerup', up)
        mapRenderer?.destroy()
        pixelRenderer?.destroy()
        textures.forEach((texture) => texture.destroy(true))
      }
    })().catch((error: unknown) => setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`))

    return () => { disposed = true; cleanup() }
  }, [mode])

  return <main className="authoring-workspace">
    <div className="authoring-toolbar"><div><p className="eyebrow">Authoring Core</p><h2>{mode === 'Mapas' ? 'Mapa ortogonal' : 'Editor Pixel Art'}</h2></div><span>{status}</span></div>
    <div ref={hostRef} className="authoring-canvas" aria-label={`Canvas ${mode}`} />
    <div className="authoring-help">Rueda: zoom al cursor · arrastre: pan · picking limitado al documento</div>
  </main>
}

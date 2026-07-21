import { createMapDocument, createSpriteDocument, setPixel, setTile } from '@mosaico/domain'
import { Texture } from 'pixi.js'
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
  type ViewportState,
} from '../src/index.js'

const required = <T extends Element>(selector: string): T => {
  const value = document.querySelector<T>(selector)
  if (!value) throw new Error(`DEMO_ELEMENT_MISSING:${selector}`)
  return value
}

function makeTileTexture(color: string, detail: string): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const context = canvas.getContext('2d')!
  context.fillStyle = color
  context.fillRect(0, 0, 16, 16)
  context.fillStyle = detail
  for (let index = 0; index < 16; index += 4) context.fillRect(index, (index * 3) % 16, 3, 3)
  const texture = Texture.from(canvas)
  texture.source.scaleMode = 'nearest'
  return texture
}

const tileset = {
  id: '11111111-1111-4111-8111-111111111111', name: 'Lab', assetId: 'canvas-lab',
  imageWidth: 64, imageHeight: 16, tileWidth: 16, tileHeight: 16,
  marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 4,
}
let mapDocument = createMapDocument({
  id: '22222222-2222-4222-8222-222222222222', name: 'Canvas Lab', width: 64, height: 40,
  cellWidth: 16, cellHeight: 16, layerId: '33333333-3333-4333-8333-333333333333', tilesets: [tileset],
})
for (let y = 0; y < 24; y += 1) for (let x = 0; x < 38; x += 1) {
  const tileId = (x * 7 + y * 3 + (x + y) % 2) % 4
  mapDocument = setTile(mapDocument, mapDocument.activeLayerId, { x, y }, { tilesetId: tileset.id, tileId })
}

let spriteDocument = createSpriteDocument({
  id: '44444444-4444-4444-8444-444444444444', name: 'Pixel Lab', width: 16, height: 16,
  layerId: '55555555-5555-4555-8555-555555555555', frameId: '66666666-6666-4666-8666-666666666666',
})
const palette = [{ r: 75, g: 195, b: 183, a: 255 }, { r: 232, g: 187, b: 107, a: 255 }, { r: 255, g: 137, b: 149, a: 255 }]
for (let y = 2; y < 14; y += 1) for (let x = 2; x < 14; x += 1) {
  if ((x + y) % 3 !== 0) spriteDocument = setPixel(spriteDocument, spriteDocument.activeLayerId, spriteDocument.activeFrameId, { x, y }, palette[(x + y) % palette.length]!)
}

const mapHost = required<HTMLElement>('#map-host')
const pixelHost = required<HTMLElement>('#pixel-host')
const mapStatus = required<HTMLElement>('#map-status')
const pixelStatus = required<HTMLElement>('#pixel-status')
const runtimeStatus = required<HTMLElement>('#runtime-status')
const textures = [makeTileTexture('#23534f', '#4bc3b7'), makeTileTexture('#51452d', '#e8bb6b'), makeTileTexture('#4d2930', '#ff8995'), makeTileTexture('#26384e', '#76a8df')]
runtimeStatus.textContent = 'Inicializando mapa Pixi…'
const mapRenderer = await OrthogonalPixiViewport.create({ host: mapHost, resolveTexture: (tile) => textures[tile.tileId] })
runtimeStatus.textContent = 'Mapa activo · inicializando Pixel Core…'
const pixelRenderer = await PixiPixelViewport.create(pixelHost)
let mapViewport = createViewport({ width: 1, height: 1, zoom: 1.4, offsetX: 24, offsetY: 24 })
let pixelViewport = createViewport({ width: 1, height: 1, zoom: 18, offsetX: 32, offsetY: 32 })

function localPoint(host: HTMLElement, event: PointerEvent | WheelEvent): Point {
  const bounds = host.getBoundingClientRect()
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}

function bindViewport(
  host: HTMLElement,
  read: () => ViewportState,
  write: (viewport: ViewportState) => void,
  render: () => void,
  pick: (point: Point) => Point | undefined,
  status: HTMLElement,
): void {
  let previous: Point | undefined
  host.addEventListener('wheel', (event) => {
    event.preventDefault()
    write(zoomViewportAt(read(), localPoint(host, event), Math.exp(-event.deltaY * 0.0015)))
    render()
  }, { passive: false })
  host.addEventListener('pointerdown', (event) => { previous = localPoint(host, event); host.setPointerCapture(event.pointerId); host.classList.add('dragging') })
  host.addEventListener('pointermove', (event) => {
    const point = localPoint(host, event)
    status.textContent = pick(point) ? `${pick(point)!.x}, ${pick(point)!.y}` : 'fuera'
    if (!previous || !host.hasPointerCapture(event.pointerId)) return
    write(panViewport(read(), point.x - previous.x, point.y - previous.y))
    previous = point
    render()
  })
  host.addEventListener('pointerup', (event) => { previous = undefined; host.releasePointerCapture(event.pointerId); host.classList.remove('dragging') })
}

function renderMap(): void { mapStatus.dataset.rendered = String(mapRenderer.render(mapDocument, mapViewport)) }
function renderPixel(): void { pixelRenderer.render(spriteDocument, pixelViewport) }
bindViewport(mapHost, () => mapViewport, (value) => { mapViewport = value }, renderMap, (point) => pickOrthogonalCell(mapViewport, point, mapDocument), mapStatus)
bindViewport(pixelHost, () => pixelViewport, (value) => { pixelViewport = value }, renderPixel, (point) => pickSpritePixel(pixelViewport, point, spriteDocument), pixelStatus)

const resize = (): void => {
  mapViewport = resizeViewport(mapViewport, Math.max(1, mapHost.clientWidth), Math.max(1, mapHost.clientHeight))
  pixelViewport = resizeViewport(pixelViewport, Math.max(1, pixelHost.clientWidth), Math.max(1, pixelHost.clientHeight))
  renderMap()
  renderPixel()
}
new ResizeObserver(resize).observe(mapHost)
new ResizeObserver(resize).observe(pixelHost)
resize()
runtimeStatus.textContent = 'PASS · ambos renderers activos'
document.body.dataset.ready = 'true'
document.title = 'PASS · Mosaico Canvas Lab'

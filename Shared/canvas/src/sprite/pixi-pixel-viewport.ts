import type { SpriteDocument } from '@mosaico/domain'
import { CanvasRenderer, Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js'
import type { ViewportState } from '../viewport.js'
import { composeSpriteFrame, shouldShowPixelGrid, visiblePixelRange } from './pixel-viewport.js'

const MAX_SEAMLESS_COPIES = 512
function repeatOffsets(enabled: boolean, viewportSize: number, offset: number, period: number): number[] {
  if (!enabled) return [0]
  if (!Number.isFinite(period) || period <= 0) return [0]
  const first = Math.floor(-offset / period) - 1; const last = Math.ceil((viewportSize - offset) / period) + 1
  return Array.from({ length: Math.max(1, last - first + 1) }, (_, index) => first + index)
}

export class PixiPixelViewport {
  readonly #renderer: CanvasRenderer
  readonly #stage = new Container()
  readonly #content = new Container()
  readonly #grid = new Graphics()
  readonly #clip = new Graphics()
  readonly #buffer = globalThis.document.createElement('canvas')
  readonly #context: CanvasRenderingContext2D
  #texture?: Texture
  #sprites: Array<Sprite | TilingSprite> = []

  private constructor(renderer: CanvasRenderer) {
    this.#renderer = renderer
    const context = this.#buffer.getContext('2d')
    if (!context) throw new Error('PIXEL_CANVAS_CONTEXT_UNAVAILABLE')
    this.#context = context
    this.#content.mask = this.#clip
    this.#stage.addChild(this.#clip, this.#content, this.#grid)
  }

  static async create(host: HTMLElement, resolution = globalThis.devicePixelRatio ?? 1): Promise<PixiPixelViewport> {
    const renderer = new CanvasRenderer()
    await renderer.init({
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      resolution,
      autoDensity: true,
      antialias: false,
      background: 0x11171a,
      manageImports: false,
    })
    renderer.canvas.style.display = 'block'
    renderer.canvas.style.width = '100%'
    renderer.canvas.style.height = '100%'
    renderer.canvas.style.imageRendering = 'pixelated'
    renderer.canvas.setAttribute('aria-label', 'Canvas de pixel art')
    host.replaceChildren(renderer.canvas)
    return new PixiPixelViewport(renderer)
  }

  get canvas(): HTMLCanvasElement { return this.#renderer.canvas }

  render(document: SpriteDocument, viewport: ViewportState, showGuides = true, seamless: 'none' | 'horizontal' | 'vertical' | 'total' = 'none'): void {
    this.#renderer.resize(viewport.width, viewport.height)
    this.#clip.clear().rect(0, 0, viewport.width, viewport.height).fill(0xffffff)
    this.#updateTexture(document)
    if (!this.#texture) throw new Error('PIXEL_TEXTURE_UNAVAILABLE')
    this.#content.removeChildren()
    for (const sprite of this.#sprites) sprite.destroy()
    this.#sprites = []
    const horizontal = seamless === 'horizontal' || seamless === 'total'; const vertical = seamless === 'vertical' || seamless === 'total'
    const periodX = document.width * viewport.zoom; const periodY = document.height * viewport.zoom
    const xs = repeatOffsets(horizontal, viewport.width, viewport.offsetX, periodX); const ys = repeatOffsets(vertical, viewport.height, viewport.offsetY, periodY)
    if (xs.length > MAX_SEAMLESS_COPIES || ys.length > MAX_SEAMLESS_COPIES) {
      const tiled = TilingSprite.from(this.#texture, { width: horizontal ? viewport.width : periodX, height: vertical ? viewport.height : periodY, tileScale: { x: viewport.zoom, y: viewport.zoom }, tilePosition: { x: horizontal ? viewport.offsetX : 0, y: vertical ? viewport.offsetY : 0 } })
      tiled.position.set(horizontal ? 0 : viewport.offsetX, vertical ? 0 : viewport.offsetY); this.#sprites.push(tiled); this.#content.addChild(tiled)
    } else for (const offsetY of ys) for (const offsetX of xs) {
      const sprite = new Sprite(this.#texture); sprite.position.set(viewport.offsetX + offsetX * document.width * viewport.zoom, viewport.offsetY + offsetY * document.height * viewport.zoom); sprite.width = document.width * viewport.zoom; sprite.height = document.height * viewport.zoom; this.#sprites.push(sprite); this.#content.addChild(sprite)
    }
    this.#drawGrid(document, viewport, showGuides, xs, ys)
    this.#renderer.render({ container: this.#stage })
  }

  #updateTexture(document: SpriteDocument): void {
    const sizeChanged = this.#buffer.width !== document.width || this.#buffer.height !== document.height
    if (sizeChanged) { this.#buffer.width = document.width; this.#buffer.height = document.height }
    const composed = composeSpriteFrame(document, document.activeFrameId)
    const imageBytes = new Uint8ClampedArray(composed.length)
    imageBytes.set(composed)
    this.#context.putImageData(new ImageData(imageBytes, document.width, document.height), 0, 0)
    if (!this.#texture || sizeChanged) {
      this.#texture?.destroy(true)
      this.#texture = Texture.from(this.#buffer)
      this.#texture.source.scaleMode = 'nearest'
    } else this.#texture.source.update()
  }

  #drawGrid(document: SpriteDocument, viewport: ViewportState, showGuides: boolean, xs = [0], ys = [0]): void {
    this.#grid.clear()
    if (!showGuides || !shouldShowPixelGrid(viewport)) return
    const range = visiblePixelRange(viewport, document)
    for (const offsetY of ys) for (const offsetX of xs) {
      for (let x = range.startX; x <= range.endX; x += 1) { const screenX = viewport.offsetX + offsetX * document.width * viewport.zoom + x * viewport.zoom; this.#grid.moveTo(screenX, Math.max(0, viewport.offsetY + offsetY * document.height * viewport.zoom + range.startY * viewport.zoom)).lineTo(screenX, Math.min(viewport.height, viewport.offsetY + offsetY * document.height * viewport.zoom + range.endY * viewport.zoom)) }
      for (let y = range.startY; y <= range.endY; y += 1) { const screenY = viewport.offsetY + offsetY * document.height * viewport.zoom + y * viewport.zoom; this.#grid.moveTo(Math.max(0, viewport.offsetX + offsetX * document.width * viewport.zoom + range.startX * viewport.zoom), screenY).lineTo(Math.min(viewport.width, viewport.offsetX + offsetX * document.width * viewport.zoom + range.endX * viewport.zoom), screenY) }
    }
    this.#grid.stroke({ color: 0x53636b, width: 1, alpha: 0.75, pixelLine: true })
  }

  destroy(): void {
    for (const sprite of this.#sprites) sprite.destroy()
    this.#texture?.destroy(true)
    this.#stage.destroy({ children: true })
    this.#renderer.destroy({ removeView: true })
  }
}

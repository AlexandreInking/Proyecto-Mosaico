import type { SpriteDocument } from '@mosaico/domain'
import { CanvasRenderer, Container, Graphics, Sprite, Texture } from 'pixi.js'
import type { ViewportState } from '../viewport.js'
import { composeSpriteFrame, shouldShowPixelGrid, visiblePixelRange } from './pixel-viewport.js'

export class PixiPixelViewport {
  readonly #renderer: CanvasRenderer
  readonly #stage = new Container()
  readonly #content = new Container()
  readonly #grid = new Graphics()
  readonly #clip = new Graphics()
  readonly #buffer = globalThis.document.createElement('canvas')
  readonly #context: CanvasRenderingContext2D
  #texture?: Texture
  #sprite?: Sprite

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

  render(document: SpriteDocument, viewport: ViewportState): void {
    this.#renderer.resize(viewport.width, viewport.height)
    this.#clip.clear().rect(0, 0, viewport.width, viewport.height).fill(0xffffff)
    this.#updateTexture(document)
    if (!this.#sprite) throw new Error('PIXEL_TEXTURE_UNAVAILABLE')
    this.#sprite.position.set(viewport.offsetX, viewport.offsetY)
    this.#sprite.width = document.width * viewport.zoom
    this.#sprite.height = document.height * viewport.zoom
    this.#drawGrid(document, viewport)
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
      this.#sprite?.destroy()
      this.#texture?.destroy(true)
      this.#texture = Texture.from(this.#buffer)
      this.#texture.source.scaleMode = 'nearest'
      this.#sprite = new Sprite(this.#texture)
      this.#content.removeChildren()
      this.#content.addChild(this.#sprite)
    } else this.#texture.source.update()
  }

  #drawGrid(document: SpriteDocument, viewport: ViewportState): void {
    this.#grid.clear()
    if (!shouldShowPixelGrid(viewport)) return
    const range = visiblePixelRange(viewport, document)
    for (let x = range.startX; x <= range.endX; x += 1) {
      const screenX = viewport.offsetX + x * viewport.zoom
      this.#grid.moveTo(screenX, Math.max(0, viewport.offsetY + range.startY * viewport.zoom))
        .lineTo(screenX, Math.min(viewport.height, viewport.offsetY + range.endY * viewport.zoom))
    }
    for (let y = range.startY; y <= range.endY; y += 1) {
      const screenY = viewport.offsetY + y * viewport.zoom
      this.#grid.moveTo(Math.max(0, viewport.offsetX + range.startX * viewport.zoom), screenY)
        .lineTo(Math.min(viewport.width, viewport.offsetX + range.endX * viewport.zoom), screenY)
    }
    this.#grid.stroke({ color: 0x53636b, width: 1, alpha: 0.75, pixelLine: true })
  }

  destroy(): void {
    this.#texture?.destroy(true)
    this.#stage.destroy({ children: true })
    this.#renderer.destroy({ removeView: true })
  }
}

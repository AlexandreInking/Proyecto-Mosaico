import type { SpriteDocument } from '@mosaico/domain'
import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js'
import type { ViewportState } from '../viewport.js'
import { composeSpriteFrame, shouldShowPixelGrid, visiblePixelRange } from './pixel-viewport.js'

export class PixiPixelViewport {
  readonly #app: Application
  readonly #content = new Container()
  readonly #grid = new Graphics()
  readonly #clip = new Graphics()
  readonly #buffer = globalThis.document.createElement('canvas')
  readonly #context: CanvasRenderingContext2D
  #texture?: Texture
  #sprite?: Sprite

  private constructor(app: Application) {
    this.#app = app
    const context = this.#buffer.getContext('2d')
    if (!context) throw new Error('PIXEL_CANVAS_CONTEXT_UNAVAILABLE')
    this.#context = context
    this.#content.mask = this.#clip
    this.#app.stage.addChild(this.#clip, this.#content, this.#grid)
  }

  static async create(host: HTMLElement, resolution = globalThis.devicePixelRatio ?? 1): Promise<PixiPixelViewport> {
    const app = new Application()
    await app.init({ resizeTo: host, resolution, autoDensity: true, antialias: false, background: 0x11171a, preference: 'webgl' })
    app.canvas.style.display = 'block'
    app.canvas.style.width = '100%'
    app.canvas.style.height = '100%'
    app.canvas.style.imageRendering = 'pixelated'
    app.canvas.setAttribute('aria-label', 'Canvas de pixel art')
    host.replaceChildren(app.canvas)
    return new PixiPixelViewport(app)
  }

  get canvas(): HTMLCanvasElement { return this.#app.canvas }

  render(document: SpriteDocument, viewport: ViewportState): void {
    this.#app.renderer.resize(viewport.width, viewport.height)
    this.#clip.clear().rect(0, 0, viewport.width, viewport.height).fill(0xffffff)
    this.#updateTexture(document)
    if (!this.#sprite) throw new Error('PIXEL_TEXTURE_UNAVAILABLE')
    this.#sprite.position.set(viewport.offsetX, viewport.offsetY)
    this.#sprite.width = document.width * viewport.zoom
    this.#sprite.height = document.height * viewport.zoom
    this.#drawGrid(document, viewport)
    this.#app.renderer.render({ container: this.#app.stage })
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
    this.#app.destroy(true, { children: true })
  }
}

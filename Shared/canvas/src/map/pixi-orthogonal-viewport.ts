import type { MapDocument, TileReference } from '@mosaico/domain'
import { CanvasRenderer, Container, Graphics, Sprite, type Texture } from 'pixi.js'
import type { ViewportState } from '../viewport.js'
import { visibleMapCells } from './map-viewport.js'

export type TileTextureResolver = (tile: TileReference) => Texture | undefined

export interface OrthogonalPixiViewportOptions {
  readonly host: HTMLElement
  readonly resolveTexture: TileTextureResolver
  readonly background?: number
  readonly resolution?: number
}

export class OrthogonalPixiViewport {
  readonly #renderer: CanvasRenderer
  readonly #stage = new Container()
  readonly #content = new Container()
  readonly #grid = new Graphics()
  readonly #clip = new Graphics()
  readonly #resolveTexture: TileTextureResolver

  private constructor(renderer: CanvasRenderer, resolveTexture: TileTextureResolver) {
    this.#renderer = renderer
    this.#resolveTexture = resolveTexture
    this.#content.mask = this.#clip
    this.#stage.addChild(this.#clip, this.#content, this.#grid)
  }

  static async create(options: OrthogonalPixiViewportOptions): Promise<OrthogonalPixiViewport> {
    const renderer = new CanvasRenderer()
    await renderer.init({
      width: Math.max(1, options.host.clientWidth),
      height: Math.max(1, options.host.clientHeight),
      resolution: options.resolution ?? globalThis.devicePixelRatio ?? 1,
      autoDensity: true,
      antialias: false,
      background: options.background ?? 0x11171a,
      manageImports: false,
    })
    renderer.canvas.style.display = 'block'
    renderer.canvas.style.width = '100%'
    renderer.canvas.style.height = '100%'
    renderer.canvas.style.imageRendering = 'pixelated'
    renderer.canvas.setAttribute('aria-label', 'Canvas de mapa ortogonal')
    options.host.replaceChildren(renderer.canvas)
    return new OrthogonalPixiViewport(renderer, options.resolveTexture)
  }

  get canvas(): HTMLCanvasElement { return this.#renderer.canvas }

  render(document: MapDocument, viewport: ViewportState, options: { readonly showGrid?: boolean } = {}): number {
    this.#renderer.resize(viewport.width, viewport.height)
    this.#clip.clear().rect(0, 0, viewport.width, viewport.height).fill(0xffffff)
    for (const child of this.#content.removeChildren()) child.destroy()

    const visible = visibleMapCells(document, viewport)
    for (const cell of visible) {
      const texture = this.#resolveTexture(cell)
      if (!texture) continue
      texture.source.scaleMode = 'nearest'
      const sprite = new Sprite(texture)
      sprite.position.set(cell.screenX, cell.screenY)
      sprite.width = cell.screenWidth
      sprite.height = cell.screenHeight
      sprite.alpha = cell.opacity
      this.#content.addChild(sprite)
    }
    this.#drawGrid(document, viewport, options.showGrid ?? true)
    this.#renderer.render({ container: this.#stage })
    return this.#content.children.length
  }

  #drawGrid(document: MapDocument, viewport: ViewportState, showGrid: boolean): void {
    this.#grid.clear()
    if (!showGrid || viewport.zoom * Math.min(document.cellWidth, document.cellHeight) < 6) return
    const width = document.width * document.cellWidth * viewport.zoom
    const height = document.height * document.cellHeight * viewport.zoom
    const cellWidth = document.cellWidth * viewport.zoom
    const cellHeight = document.cellHeight * viewport.zoom
    for (let x = 0; x <= document.width; x += 1) {
      const screenX = viewport.offsetX + x * cellWidth
      if (screenX < 0 || screenX > viewport.width) continue
      this.#grid.moveTo(screenX, Math.max(0, viewport.offsetY)).lineTo(screenX, Math.min(viewport.height, viewport.offsetY + height))
    }
    for (let y = 0; y <= document.height; y += 1) {
      const screenY = viewport.offsetY + y * cellHeight
      if (screenY < 0 || screenY > viewport.height) continue
      this.#grid.moveTo(Math.max(0, viewport.offsetX), screenY).lineTo(Math.min(viewport.width, viewport.offsetX + width), screenY)
    }
    this.#grid.stroke({ color: 0x415058, width: 1, alpha: 0.6, pixelLine: true })
  }

  destroy(): void {
    this.#stage.destroy({ children: true })
    this.#renderer.destroy({ removeView: true })
  }
}

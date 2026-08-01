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
  readonly #mapBackground = new Graphics()
  readonly #content = new Container()
  readonly #orphans = new Graphics()
  readonly #grid = new Graphics()
  readonly #clip = new Graphics()
  readonly #resolveTexture: TileTextureResolver
  readonly #sprites = new Map<string, Sprite>()
  readonly #spritePool: Sprite[] = []
  #width: number
  #height: number

  private constructor(renderer: CanvasRenderer, resolveTexture: TileTextureResolver, width: number, height: number) {
    this.#renderer = renderer
    this.#resolveTexture = resolveTexture
    this.#width = width
    this.#height = height
    this.#content.mask = this.#clip
    this.#orphans.mask = this.#clip
    this.#stage.addChild(this.#mapBackground, this.#clip, this.#content, this.#orphans, this.#grid)
  }

  static async create(options: OrthogonalPixiViewportOptions): Promise<OrthogonalPixiViewport> {
    const renderer = new CanvasRenderer()
    const width = Math.max(1, options.host.clientWidth)
    const height = Math.max(1, options.host.clientHeight)
    await renderer.init({
      width,
      height,
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
    return new OrthogonalPixiViewport(renderer, options.resolveTexture, width, height)
  }

  get canvas(): HTMLCanvasElement { return this.#renderer.canvas }

  render(document: MapDocument, viewport: ViewportState, options: { readonly showGrid?: boolean } = {}): number {
    if (viewport.width !== this.#width || viewport.height !== this.#height) {
      this.#renderer.resize(viewport.width, viewport.height)
      this.#width = viewport.width
      this.#height = viewport.height
    }
    const mapWidth = document.width * document.cellWidth * viewport.zoom
    const mapHeight = document.height * document.cellHeight * viewport.zoom
    const clipX = Math.max(0, viewport.offsetX); const clipY = Math.max(0, viewport.offsetY)
    this.#clip.clear().rect(clipX, clipY, Math.max(0, Math.min(viewport.width, viewport.offsetX + mapWidth) - clipX), Math.max(0, Math.min(viewport.height, viewport.offsetY + mapHeight) - clipY)).fill(0xffffff)
    this.#drawBackground(document, viewport)
    this.#orphans.clear()

    const visible = visibleMapCells(document, viewport)
    const retained = new Set<string>()
    const order: Sprite[] = []
    for (const cell of visible) {
      const texture = this.#resolveTexture(cell)
      if (!texture) {
        this.#orphans.rect(cell.screenX, cell.screenY, cell.screenWidth, cell.screenHeight).fill({ color: 0xff00cc, alpha: cell.opacity })
        this.#orphans.moveTo(cell.screenX, cell.screenY).lineTo(cell.screenX + cell.screenWidth, cell.screenY + cell.screenHeight)
          .moveTo(cell.screenX + cell.screenWidth, cell.screenY).lineTo(cell.screenX, cell.screenY + cell.screenHeight)
          .stroke({ color: 0x22001c, width: Math.max(1, viewport.zoom), alpha: cell.opacity, pixelLine: true })
        continue
      }
      texture.source.scaleMode = 'nearest'
      const key = `${cell.layerId}:${cell.x},${cell.y}`
      retained.add(key)
      const sprite = this.#sprites.get(key) ?? this.#spritePool.pop() ?? new Sprite(texture)
      if (!this.#sprites.has(key)) { this.#sprites.set(key, sprite); sprite.visible = true; this.#content.addChild(sprite) }
      order.push(sprite)
      sprite.texture = texture
      sprite.anchor.set(0.5)
      sprite.position.set(cell.screenX + cell.screenWidth / 2, cell.screenY + cell.screenHeight / 2)
      sprite.width = cell.screenWidth
      sprite.height = cell.screenHeight
      sprite.scale.x = Math.abs(sprite.scale.x) * (cell.flipX ? -1 : 1)
      sprite.scale.y = Math.abs(sprite.scale.y) * (cell.flipY ? -1 : 1)
      sprite.rotation = (cell.rotation ?? 0) * Math.PI / 180
      sprite.alpha = cell.opacity
    }
    for (const [key, sprite] of this.#sprites) if (!retained.has(key)) { this.#sprites.delete(key); this.#content.removeChild(sprite); sprite.visible = false; this.#spritePool.push(sprite) }
    order.forEach((sprite, index) => {
      if (this.#content.children[index] !== sprite) this.#content.setChildIndex(sprite, index)
    })
    this.#drawGrid(document, viewport, options.showGrid ?? document.grid.visible)
    this.#renderer.render({ container: this.#stage })
    return this.#content.children.length
  }

  #drawBackground(document: MapDocument, viewport: ViewportState): void {
    this.#mapBackground.clear()
    const width = document.width * document.cellWidth * viewport.zoom
    const height = document.height * document.cellHeight * viewport.zoom
    if (document.background.kind === 'color') {
      const match = document.background.color.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i)
      this.#mapBackground.rect(viewport.offsetX, viewport.offsetY, width, height).fill({
        color: match ? Number.parseInt(match[1]!, 16) : 0,
        alpha: match?.[2] ? Number.parseInt(match[2], 16) / 255 : 1,
      })
      return
    }
    this.#mapBackground.rect(viewport.offsetX, viewport.offsetY, width, height).fill({ color: 0x151b1f })
  }

  #drawGrid(document: MapDocument, viewport: ViewportState, showGrid: boolean): void {
    this.#grid.clear()
    if (!showGrid || viewport.zoom * Math.min(document.cellWidth, document.cellHeight) < 6) return
    const width = document.width * document.cellWidth * viewport.zoom
    const height = document.height * document.cellHeight * viewport.zoom
    const cellWidth = document.cellWidth * viewport.zoom
    const cellHeight = document.cellHeight * viewport.zoom
    const left = Math.max(0, viewport.offsetX)
    const right = Math.min(viewport.width, viewport.offsetX + width)
    const top = Math.max(0, viewport.offsetY)
    const bottom = Math.min(viewport.height, viewport.offsetY + height)
    if (left > right || top > bottom) return
    const startX = Math.max(0, Math.ceil(-viewport.offsetX / cellWidth))
    const endX = Math.min(document.width, Math.floor((viewport.width - viewport.offsetX) / cellWidth))
    const startY = Math.max(0, Math.ceil(-viewport.offsetY / cellHeight))
    const endY = Math.min(document.height, Math.floor((viewport.height - viewport.offsetY) / cellHeight))
    for (let x = startX; x <= endX; x += 1) {
      const screenX = viewport.offsetX + x * cellWidth
      this.#grid.moveTo(screenX, top).lineTo(screenX, bottom)
    }
    for (let y = startY; y <= endY; y += 1) {
      const screenY = viewport.offsetY + y * cellHeight
      this.#grid.moveTo(left, screenY).lineTo(right, screenY)
    }
    const color = document.grid.color.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i)
    this.#grid.stroke({
      color: color ? Number.parseInt(color[1]!, 16) : 0x415058,
      width: 1,
      alpha: color?.[2] ? Number.parseInt(color[2], 16) / 255 : 0.6,
      pixelLine: true,
    })
  }

  destroy(): void {
    for (const sprite of this.#spritePool) sprite.destroy()
    this.#spritePool.length = 0
    this.#stage.destroy({ children: true })
    this.#renderer.destroy({ removeView: true })
  }
}

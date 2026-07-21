export interface Point {
  readonly x: number
  readonly y: number
}

export interface ViewportState {
  readonly width: number
  readonly height: number
  readonly offsetX: number
  readonly offsetY: number
  readonly zoom: number
  readonly minZoom: number
  readonly maxZoom: number
}

export interface CreateViewportInput {
  readonly width: number
  readonly height: number
  readonly offsetX?: number
  readonly offsetY?: number
  readonly zoom?: number
  readonly minZoom?: number
  readonly maxZoom?: number
}

function positiveFinite(value: number, code: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(code)
  return value
}

export function createViewport(input: CreateViewportInput): ViewportState {
  const width = positiveFinite(input.width, 'VIEWPORT_SIZE_INVALID')
  const height = positiveFinite(input.height, 'VIEWPORT_SIZE_INVALID')
  const minZoom = positiveFinite(input.minZoom ?? 0.125, 'VIEWPORT_ZOOM_INVALID')
  const maxZoom = positiveFinite(input.maxZoom ?? 64, 'VIEWPORT_ZOOM_INVALID')
  if (minZoom > maxZoom) throw new RangeError('VIEWPORT_ZOOM_INVALID')
  const zoom = input.zoom ?? 1
  if (!Number.isFinite(zoom) || zoom < minZoom || zoom > maxZoom) throw new RangeError('VIEWPORT_ZOOM_INVALID')
  const offsetX = input.offsetX ?? 0
  const offsetY = input.offsetY ?? 0
  if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) throw new RangeError('VIEWPORT_OFFSET_INVALID')
  return { width, height, offsetX, offsetY, zoom, minZoom, maxZoom }
}

export function isPointInsideViewport(viewport: ViewportState, point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
    && point.x >= 0 && point.y >= 0 && point.x < viewport.width && point.y < viewport.height
}

export function worldToScreen(viewport: ViewportState, point: Point): Point {
  return { x: point.x * viewport.zoom + viewport.offsetX, y: point.y * viewport.zoom + viewport.offsetY }
}

export function screenToWorld(viewport: ViewportState, point: Point): Point {
  return { x: (point.x - viewport.offsetX) / viewport.zoom, y: (point.y - viewport.offsetY) / viewport.zoom }
}

export function panViewport(viewport: ViewportState, deltaX: number, deltaY: number): ViewportState {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) throw new RangeError('VIEWPORT_PAN_INVALID')
  return { ...viewport, offsetX: viewport.offsetX + deltaX, offsetY: viewport.offsetY + deltaY }
}

export function zoomViewportAt(viewport: ViewportState, cursor: Point, zoomFactor: number): ViewportState {
  if (!Number.isFinite(zoomFactor) || zoomFactor <= 0) throw new RangeError('VIEWPORT_ZOOM_INVALID')
  const world = screenToWorld(viewport, cursor)
  const zoom = Math.min(viewport.maxZoom, Math.max(viewport.minZoom, viewport.zoom * zoomFactor))
  return { ...viewport, zoom, offsetX: cursor.x - world.x * zoom, offsetY: cursor.y - world.y * zoom }
}

export function resizeViewport(viewport: ViewportState, width: number, height: number): ViewportState {
  return { ...viewport, width: positiveFinite(width, 'VIEWPORT_SIZE_INVALID'), height: positiveFinite(height, 'VIEWPORT_SIZE_INVALID') }
}

export function canvasBackingSize(width: number, height: number, devicePixelRatio: number): { readonly width: number; readonly height: number; readonly resolution: number } {
  positiveFinite(width, 'VIEWPORT_SIZE_INVALID')
  positiveFinite(height, 'VIEWPORT_SIZE_INVALID')
  positiveFinite(devicePixelRatio, 'VIEWPORT_DPR_INVALID')
  return { width: Math.round(width * devicePixelRatio), height: Math.round(height * devicePixelRatio), resolution: devicePixelRatio }
}

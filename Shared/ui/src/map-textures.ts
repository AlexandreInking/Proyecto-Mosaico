export interface MapImageElement {
  decoding?: string
  src: string
  complete: boolean
  naturalWidth: number
  naturalHeight: number
  onload: (() => void) | null
  onerror: (() => void) | null
}

export type MapImageFactory = () => MapImageElement

export function loadMapImage(url: string, factory: MapImageFactory = () => new Image() as unknown as MapImageElement): Promise<MapImageElement> {
  return new Promise((resolve, reject) => {
    const image = factory()
    image.decoding = 'async'
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      if (error) reject(error)
      else if (image.naturalWidth > 0 && image.naturalHeight > 0) resolve(image)
      else reject(new Error('MAP_IMAGE_EMPTY'))
    }
    image.onload = () => finish()
    image.onerror = () => finish(new Error('MAP_IMAGE_LOAD_FAILED'))
    image.src = url
    if (image.complete) finish()
  })
}

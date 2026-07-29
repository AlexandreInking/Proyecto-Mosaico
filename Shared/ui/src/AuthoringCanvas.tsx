import 'pixi.js/unsafe-eval'
import { MapEditor } from './MapEditor.js'
import { PixelArtEditor } from './PixelArtEditor.js'

export type AuthoringMode = 'Mapas' | 'Pixel Art'

export function AuthoringCanvas({ mode }: { readonly mode: AuthoringMode }) {
  return mode === 'Pixel Art' ? <PixelArtEditor /> : <MapEditor />
}

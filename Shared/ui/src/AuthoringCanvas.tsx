import 'pixi.js/unsafe-eval'
import { lazy } from 'react'
import type { VisibleAsset } from './asset-catalog.js'

const MapEditor = lazy(async () => ({ default: (await import('./MapEditor.js')).MapEditor }))
const PixelArtEditor = lazy(async () => ({ default: (await import('./PixelArtEditor.js')).PixelArtEditor }))

export type AuthoringMode = 'Mapas' | 'Pixel Art'

export function AuthoringCanvas({ mode, active, assets }: { readonly mode: AuthoringMode; readonly active: boolean; readonly assets?: readonly VisibleAsset[] }) {
  return mode === 'Pixel Art' ? <PixelArtEditor active={active} /> : <MapEditor active={active} sharedAssets={assets} />
}

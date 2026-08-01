import type { ImportedImage } from '@mosaico/pipeline'

export interface VisibleAsset extends ImportedImage {
  readonly thumbnailUrl: string
  readonly folderId?: string
}

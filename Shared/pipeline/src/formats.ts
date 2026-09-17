export const supportedImageTypes = ['image/png', 'image/jpeg', 'image/webp'] as const
export type SupportedImageType = typeof supportedImageTypes[number]

export const assetImageTypes = [...supportedImageTypes, 'image/gif'] as const
export type AssetMediaType = typeof assetImageTypes[number]

export function isSupportedImageType(value: string): value is SupportedImageType {
  return supportedImageTypes.includes(value as SupportedImageType)
}

export function isSupportedAssetType(value: string): value is AssetMediaType {
  return assetImageTypes.includes(value as AssetMediaType)
}

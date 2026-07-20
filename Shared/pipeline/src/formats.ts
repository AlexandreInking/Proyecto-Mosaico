export const supportedImageTypes = ['image/png', 'image/jpeg', 'image/webp'] as const
export type SupportedImageType = typeof supportedImageTypes[number]

export function isSupportedImageType(value: string): value is SupportedImageType {
  return supportedImageTypes.includes(value as SupportedImageType)
}

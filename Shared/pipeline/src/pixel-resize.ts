export function resizeNearestRgba(
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): Uint8ClampedArray<ArrayBuffer> {
  if (![sourceWidth, sourceHeight, targetWidth, targetHeight].every(Number.isInteger)) throw new Error('Las dimensiones deben ser enteras.')
  if (sourceWidth < 1 || sourceHeight < 1 || targetWidth < 1 || targetHeight < 1) throw new Error('Las dimensiones deben ser positivas.')
  if (source.length !== sourceWidth * sourceHeight * 4) throw new Error('El buffer RGBA no coincide con las dimensiones fuente.')

  const target: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray(targetWidth * targetHeight * 4)
  for (let targetY = 0; targetY < targetHeight; targetY += 1) {
    const sourceY = Math.floor(targetY * sourceHeight / targetHeight)
    for (let targetX = 0; targetX < targetWidth; targetX += 1) {
      const sourceX = Math.floor(targetX * sourceWidth / targetWidth)
      const sourceOffset = (sourceY * sourceWidth + sourceX) * 4
      const targetOffset = (targetY * targetWidth + targetX) * 4
      target[targetOffset] = source[sourceOffset] ?? 0
      target[targetOffset + 1] = source[sourceOffset + 1] ?? 0
      target[targetOffset + 2] = source[sourceOffset + 2] ?? 0
      target[targetOffset + 3] = source[sourceOffset + 3] ?? 0
    }
  }
  return target
}

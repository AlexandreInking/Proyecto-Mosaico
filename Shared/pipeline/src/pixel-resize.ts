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

export interface AsyncPixelResizeOptions {
  rowsPerBatch?: number
  signal?: AbortSignal
  onProgress?: (progress: number) => void
}

export async function resizeNearestRgbaAsync(
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  options: AsyncPixelResizeOptions = {},
): Promise<Uint8ClampedArray<ArrayBuffer>> {
  if (![sourceWidth, sourceHeight, targetWidth, targetHeight].every(Number.isInteger)) throw new Error('Las dimensiones deben ser enteras.')
  if (sourceWidth < 1 || sourceHeight < 1 || targetWidth < 1 || targetHeight < 1) throw new Error('Las dimensiones deben ser positivas.')
  if (source.length !== sourceWidth * sourceHeight * 4) throw new Error('El buffer RGBA no coincide con las dimensiones fuente.')
  const rowsPerBatch = Math.max(1, Math.floor(options.rowsPerBatch ?? 64))
  const target: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray(targetWidth * targetHeight * 4)

  for (let batchStart = 0; batchStart < targetHeight; batchStart += rowsPerBatch) {
    if (options.signal?.aborted) throw new DOMException('Operación cancelada', 'AbortError')
    const batchEnd = Math.min(targetHeight, batchStart + rowsPerBatch)
    for (let targetY = batchStart; targetY < batchEnd; targetY += 1) {
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
    options.onProgress?.(batchEnd / targetHeight)
    if (batchEnd < targetHeight) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
  }

  if (options.signal?.aborted) throw new DOMException('Operación cancelada', 'AbortError')
  return target
}

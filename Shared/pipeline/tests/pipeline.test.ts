import { describe, expect, it } from 'vitest'
import { createImageRecipe, detectImageType, groupDiagnostics, isSupportedImageType, orderRecipeSteps, resizeNearestRgba } from '../src/index.js'

describe('T1 image pipeline domain', () => {
  it('creates a deterministic resize and convert recipe', () => {
    expect(createImageRecipe(32, 24, 'image/webp', 0.8)).toEqual({
      id: 'image-resize-convert',
      version: 1,
      steps: [
        { id: 'resize', operation: 'resize', dependsOn: [], parameters: { width: 32, height: 24, interpolation: 'nearest' } },
        { id: 'convert', operation: 'convert', dependsOn: ['resize'], parameters: { mediaType: 'image/webp', quality: 0.8 } },
      ],
    })
  })

  it('accepts only formats implemented by T1', () => {
    expect(isSupportedImageType('image/png')).toBe(true)
    expect(isSupportedImageType('image/gif')).toBe(false)
  })

  it('detects image type from magic bytes instead of trusting extension', () => {
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png')
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xdb]))).toBe('image/jpeg')
    expect(detectImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('image/webp')
    expect(detectImageType(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toBeUndefined()
  })

  it('groups repeated diagnostics and preserves affected assets', () => {
    const grouped = groupDiagnostics([
      { code: 'IMAGE_DECODE', severity: 'error', groupKey: 'decode', message: 'No se pudo decodificar', assetId: 'a' },
      { code: 'IMAGE_DECODE', severity: 'error', groupKey: 'decode', message: 'No se pudo decodificar', assetId: 'b' },
    ])
    expect(grouped).toEqual([{ code: 'IMAGE_DECODE', severity: 'error', groupKey: 'decode', message: 'No se pudo decodificar', count: 2, assetIds: ['a', 'b'] }])
  })

  it('enlarges pixels as exact color blocks without interpolation', () => {
    const redThenBlue = new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 0, 255, 255,
    ])

    expect([...resizeNearestRgba(redThenBlue, 2, 1, 4, 2)]).toEqual([
      255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255,
      255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255,
    ])
  })

  it('reduces pixels by deterministic nearest-neighbor sampling', () => {
    const fourPixels = new Uint8ClampedArray([
      1, 0, 0, 255, 2, 0, 0, 255,
      3, 0, 0, 255, 4, 0, 0, 255,
    ])

    expect([...resizeNearestRgba(fourPixels, 2, 2, 1, 1)]).toEqual([1, 0, 0, 255])
  })

  it('orders recipe steps by dependencies instead of array position', () => {
    const recipe = createImageRecipe(32, 32, 'image/png')
    recipe.steps.reverse()

    expect(orderRecipeSteps(recipe).map((step) => step.id)).toEqual(['resize', 'convert'])
  })

  it('rejects recipe dependency cycles before execution', () => {
    const recipe = createImageRecipe(32, 32, 'image/png')
    recipe.steps[0]!.dependsOn = ['convert']

    expect(() => orderRecipeSteps(recipe)).toThrow('ciclo')
  })

  it('rejects dependencies that do not exist', () => {
    const recipe = createImageRecipe(32, 32, 'image/png')
    recipe.steps[1]!.dependsOn = ['missing']

    expect(() => orderRecipeSteps(recipe)).toThrow('missing')
  })
})

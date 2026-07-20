import { describe, expect, it } from 'vitest'
import {
  assetSchema,
  capabilitiesSchema,
  createT0FakePlatform,
  diagnosticSchema,
  jobSchema,
  recipeSchema,
  UI_CONTRACT_VERSION,
} from '../src/index.js'

describe('T0 shared contracts', () => {
  it('uses one stable UI contract version', () => {
    expect(UI_CONTRACT_VERSION).toBe('mosaico-ui-t1-v1')
  })

  it('rejects capabilities that omit execution location', () => {
    expect(() => capabilitiesSchema.parse({ platform: 'web', offline: false })).toThrow()
  })

  it('accepts the minimum versioned pipeline records', () => {
    expect(assetSchema.parse({ id: 'asset-1', name: 'hero.png', mediaType: 'image/png', sha256: 'a'.repeat(64), byteSize: 4, width: 16, height: 16, importedAt: '2026-07-20T00:00:00.000Z' })).toBeTruthy()
    expect(recipeSchema.parse({ id: 'recipe-1', version: 1, steps: [{ id: 'resize', operation: 'resize', parameters: { width: 32, height: 32, interpolation: 'nearest' } }] })).toBeTruthy()
    expect(jobSchema.parse({ id: 'job-1', status: 'queued', executionTarget: 'browser', progress: 0 })).toBeTruthy()
    expect(diagnosticSchema.parse({ code: 'ASSET_INVALID', severity: 'error', groupKey: 'invalid-image', count: 2, message: 'Imagen inválida', assetIds: [] })).toBeTruthy()
  })

  it('provides a deterministic fake platform for shared UI tests', async () => {
    const platform = createT0FakePlatform('web')

    await expect(platform.getCapabilities()).resolves.toEqual({
      platform: 'web',
      executionTarget: 'browser',
      offline: false,
      fileAccess: 'picker',
    })
  })
})

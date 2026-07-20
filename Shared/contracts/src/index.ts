import { z } from 'zod'

export const UI_CONTRACT_VERSION = 'mosaico-ui-t1-v1' as const

export const executionTargetSchema = z.enum(['browser', 'desktop', 'cloud'])

export const capabilitiesSchema = z.object({
  platform: z.enum(['web', 'desktop']),
  executionTarget: executionTargetSchema,
  offline: z.boolean(),
  fileAccess: z.enum(['picker', 'native']),
})

export const assetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  byteSize: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  importedAt: z.string().datetime(),
})

export const resizeStepSchema = z.object({
  id: z.string().min(1),
  operation: z.literal('resize'),
  parameters: z.object({
    width: z.number().int().positive().max(16384),
    height: z.number().int().positive().max(16384),
    interpolation: z.enum(['nearest', 'smooth']).default('nearest'),
  }),
})

export const convertStepSchema = z.object({
  id: z.string().min(1),
  operation: z.literal('convert'),
  parameters: z.object({
    mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
    quality: z.number().min(0).max(1).default(0.92),
  }),
})

export const recipeStepSchema = z.discriminatedUnion('operation', [resizeStepSchema, convertStepSchema])

export const recipeSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  steps: z.array(recipeStepSchema),
})

export const jobSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']),
  executionTarget: executionTargetSchema,
  progress: z.number().min(0).max(1),
})

export const diagnosticSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(['info', 'warning', 'error']),
  groupKey: z.string().min(1),
  count: z.number().int().positive(),
  message: z.string().min(1),
  assetIds: z.array(z.string()).default([]),
})

export const derivedAssetManifestSchema = z.object({
  schemaVersion: z.literal(1),
  sourceAssetId: z.string().min(1),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  outputSha256: z.string().regex(/^[a-f0-9]{64}$/),
  recipe: recipeSchema,
  output: z.object({
    mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
    byteSize: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
})

export type PlatformCapabilities = z.infer<typeof capabilitiesSchema>
export type AssetRecord = z.infer<typeof assetSchema>
export type Recipe = z.infer<typeof recipeSchema>
export type PipelineJob = z.infer<typeof jobSchema>
export type Diagnostic = z.infer<typeof diagnosticSchema>
export type DerivedAssetManifest = z.infer<typeof derivedAssetManifestSchema>

export interface PlatformPort {
  getCapabilities(): Promise<PlatformCapabilities>
}

export interface FileSystemPort {
  pickFiles(accept: readonly string[]): Promise<readonly File[]>
}

export interface JobRunnerPort {
  enqueue(recipe: Recipe, assets: readonly AssetRecord[]): Promise<PipelineJob>
  cancel(jobId: string): Promise<void>
}

export function createT0FakePlatform(platform: 'web' | 'desktop'): PlatformPort {
  const capabilities: PlatformCapabilities = platform === 'desktop'
    ? { platform, executionTarget: 'desktop', offline: true, fileAccess: 'native' }
    : { platform, executionTarget: 'browser', offline: false, fileAccess: 'picker' }

  return {
    async getCapabilities() {
      return capabilities
    },
  }
}

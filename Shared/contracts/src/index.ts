import { z } from 'zod'

export const UI_CONTRACT_VERSION = 'mosaico-ui-t0-v1' as const

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
  mediaType: z.string().min(1),
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
})

export const recipeStepSchema = z.object({
  id: z.string().min(1),
  operation: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()).default({}),
})

export const recipeSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  steps: z.array(recipeStepSchema),
})

export const jobSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']),
  executionTarget: executionTargetSchema,
})

export const diagnosticSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(['info', 'warning', 'error']),
  groupKey: z.string().min(1),
  count: z.number().int().positive(),
})

export type PlatformCapabilities = z.infer<typeof capabilitiesSchema>
export type AssetRecord = z.infer<typeof assetSchema>
export type Recipe = z.infer<typeof recipeSchema>
export type PipelineJob = z.infer<typeof jobSchema>
export type Diagnostic = z.infer<typeof diagnosticSchema>

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

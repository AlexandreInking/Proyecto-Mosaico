import { z } from 'zod'

export const assetMediaTypeSchema = z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

export const assetAnimationSchema = z.object({
  frameCount: z.number().int().positive().max(1024),
  frameDurationsMs: z.array(z.number().int().min(10).max(86_400_000)).max(1024),
  loop: z.boolean(),
}).strict().superRefine((animation, context) => {
  if (animation.frameDurationsMs.length !== animation.frameCount) context.addIssue({ code: 'custom', path: ['frameDurationsMs'], message: 'Animation frame durations must match frame count.' })
})

export const assetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mediaType: assetMediaTypeSchema,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  byteSize: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  importedAt: z.string().datetime(),
  animation: assetAnimationSchema.optional(),
})

export type AssetMediaType = z.infer<typeof assetMediaTypeSchema>
export type AssetAnimation = z.infer<typeof assetAnimationSchema>
export type AssetRecord = z.infer<typeof assetSchema>

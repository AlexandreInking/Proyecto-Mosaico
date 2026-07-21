import type { Diagnostic, Recipe } from '@mosaico/contracts'
import type { SupportedImageType } from './formats.js'

export interface DiagnosticOccurrence {
  code: string
  severity: 'info' | 'warning' | 'error'
  groupKey: string
  message: string
  assetId?: string
}

export function createImageRecipe(width: number, height: number, mediaType: SupportedImageType, quality = 0.92): Recipe {
  return {
    id: 'image-resize-convert',
    version: 1,
    steps: [
      { id: 'resize', operation: 'resize', parameters: { width, height, interpolation: 'nearest' } },
      { id: 'convert', operation: 'convert', parameters: { mediaType, quality } },
    ],
  }
}

export function groupDiagnostics(occurrences: readonly DiagnosticOccurrence[]): Diagnostic[] {
  const groups = new Map<string, Diagnostic>()
  for (const item of occurrences) {
    const key = `${item.code}:${item.groupKey}:${item.message}`
    const current = groups.get(key)
    if (current) {
      current.count += 1
      if (item.assetId && !current.assetIds.includes(item.assetId)) current.assetIds.push(item.assetId)
    } else {
      groups.set(key, {
        code: item.code,
        severity: item.severity,
        groupKey: item.groupKey,
        message: item.message,
        count: 1,
        assetIds: item.assetId ? [item.assetId] : [],
      })
    }
  }
  return [...groups.values()]
}

export * from './web-image-pipeline.js'
export * from './indexed-db-store.js'
export * from './formats.js'
export * from './pixel-resize.js'

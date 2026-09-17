export type PipelineBackendKind = 'cpu2d' | 'webgl' | 'webgpu'

export interface PipelineBackendStatus {
  readonly kind: PipelineBackendKind
  readonly available: boolean
  readonly reason?: string
}

export function detectPipelineBackends(scope: typeof globalThis = globalThis): readonly PipelineBackendStatus[] {
  const documentScope = scope as typeof globalThis & { document?: { createElement?: (tag: string) => { getContext?: (kind: string) => unknown } } }
  let webgl = false
  if (documentScope.document?.createElement) {
    try { webgl = !!documentScope.document.createElement('canvas').getContext?.('webgl2') || !!documentScope.document.createElement('canvas').getContext?.('webgl') } catch { webgl = false }
  }
  return [
    { kind: 'cpu2d', available: true },
    { kind: 'webgl', available: webgl, reason: webgl ? undefined : 'WEBGL_UNAVAILABLE' },
    { kind: 'webgpu', available: 'gpu' in scope, reason: 'gpu' in scope ? undefined : 'WEBGPU_UNAVAILABLE' },
  ]
}

export function selectPipelineBackend(preferred: PipelineBackendKind, statuses = detectPipelineBackends()): PipelineBackendStatus {
  const selected = statuses.find((status) => status.kind === preferred)
  if (selected?.available) return selected
  return statuses.find((status) => status.kind === 'cpu2d') ?? { kind: 'cpu2d', available: true }
}

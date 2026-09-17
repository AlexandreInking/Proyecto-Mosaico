import { describe, expect, it } from 'vitest'
import { detectPipelineBackends, selectPipelineBackend } from '../src/pipeline-backends.js'

describe('pipeline backends', () => {
  it('always keeps deterministic CPU fallback available', () => {
    const statuses = detectPipelineBackends({} as typeof globalThis)
    expect(statuses.find((status) => status.kind === 'cpu2d')?.available).toBe(true)
    expect(selectPipelineBackend('webgpu', statuses).kind).toBe('cpu2d')
  })

  it('selects available GPU backend without hiding fallback', () => {
    const statuses = detectPipelineBackends({ gpu: {}, document: { createElement: () => ({ getContext: (kind: string) => kind === 'webgl2' ? {} : null }) } } as unknown as typeof globalThis)
    expect(selectPipelineBackend('webgl', statuses).kind).toBe('webgl')
    expect(selectPipelineBackend('webgpu', statuses).kind).toBe('webgpu')
  })
})

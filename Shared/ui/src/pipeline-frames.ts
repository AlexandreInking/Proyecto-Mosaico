import type { PipelineValue } from '@mosaico/contracts'
import { evaluatePipeline, type PipelineAssetSource, type PipelineSurface } from './pipeline-evaluator.js'
import type { DemoGraph, DemoParameter } from './pipeline-editor-model.js'

export type PipelineKeyframeLike = {
  readonly nodeId: string
  readonly parameterId: string
  readonly timeMs: number
  readonly value?: PipelineValue
  readonly interpolation?: 'step' | 'linear' | 'bezier' | 'spline'
  readonly easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
  readonly handles?: { readonly in: [number, number]; readonly out: [number, number] }
}

export interface PipelineRenderSettings {
  readonly durationMs: number
  readonly fps: number
  readonly rangeStartMs?: number
  readonly rangeEndMs?: number
  readonly selectedFrameTimesMs?: readonly number[]
}

export interface GeneratedPipelineFrame {
  readonly id: string
  readonly timeMs: number
  readonly durationMs: number
  readonly surface: PipelineSurface
  readonly diagnostics: readonly string[]
  readonly selected: boolean
}

export interface PipelineTransferPayload {
  readonly name: string
  readonly width: number
  readonly height: number
  readonly frames: readonly { readonly pixels: Uint8ClampedArray; readonly durationMs: number }[]
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const isSurface = (value: unknown): value is PipelineSurface => !!value && typeof value === 'object' && !Array.isArray(value) && 'pixels' in value && 'width' in value && 'height' in value

function applyValue(parameter: DemoParameter, value: PipelineValue | DemoParameter['value']): DemoParameter {
  return { ...parameter, value: value as DemoParameter['value'] }
}

export function interpolatePipelineGraph(graph: DemoGraph, keyframes: readonly PipelineKeyframeLike[], timeMs: number): DemoGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      parameters: node.parameters.map((parameter) => {
        const frames = keyframes.filter((frame) => frame.nodeId === node.id && frame.parameterId === parameter.id && typeof frame.value === 'number').sort((left, right) => left.timeMs - right.timeMs)
        if (!frames.length) return parameter
        const before = [...frames].reverse().find((frame) => frame.timeMs <= timeMs)
        const after = frames.find((frame) => frame.timeMs >= timeMs)
        if (!before) return applyValue(parameter, after?.value ?? parameter.value)
        if (!after || before.timeMs === after.timeMs) return applyValue(parameter, before.value ?? parameter.value)
        const span = Math.max(1, after.timeMs - before.timeMs)
        let ratio = clamp((timeMs - before.timeMs) / span, 0, 1)
        if (before.easing === 'ease-in') ratio *= ratio
        else if (before.easing === 'ease-out') ratio = 1 - (1 - ratio) * (1 - ratio)
        else if (before.easing === 'ease-in-out') ratio = ratio < 0.5 ? 2 * ratio * ratio : 1 - Math.pow(-2 * ratio + 2, 2) / 2
        if (before.interpolation === 'step') ratio = 0
        if (before.interpolation === 'bezier') {
          const handles = before.handles ?? { in: [0.25, 0] as [number, number], out: [0.75, 1] as [number, number] }
          let low = 0; let high = 1
          for (let iteration = 0; iteration < 12; iteration += 1) {
            const candidate = (low + high) / 2
            const x = 3 * (1 - candidate) ** 2 * candidate * handles.out[0] + 3 * (1 - candidate) * candidate ** 2 * handles.in[0] + candidate ** 3
            if (x < ratio) low = candidate; else high = candidate
          }
          const t = (low + high) / 2
          ratio = 3 * (1 - t) ** 2 * t * handles.out[1] + 3 * (1 - t) * t ** 2 * handles.in[1] + t ** 3
        }
        if (before.interpolation === 'spline') {
          const previous = [...frames].reverse().find((frame) => frame.timeMs < before!.timeMs)
          const next = frames.find((frame) => frame.timeMs > after!.timeMs)
          const p0 = Number(previous?.value ?? before.value); const p1 = Number(before.value); const p2 = Number(after.value); const p3 = Number(next?.value ?? after.value)
          const t2 = ratio * ratio; const t3 = t2 * ratio
          return applyValue(parameter, 0.5 * ((2 * p1) + (-p0 + p2) * ratio + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
        }
        return applyValue(parameter, Number(before.value) + (Number(after.value) - Number(before.value)) * ratio)
      }),
    })),
  }
}

export function samplePipelineTimes(settings: PipelineRenderSettings, keyframes: readonly PipelineKeyframeLike[]): number[] {
  const duration = Math.max(0, Math.round(settings.durationMs))
  const start = clamp(Math.round(settings.rangeStartMs ?? 0), 0, duration)
  const end = clamp(Math.round(settings.rangeEndMs ?? duration), start, duration)
  const fps = clamp(Math.round(settings.fps), 1, 60)
  const requestedStep = Math.max(1, Math.round(1000 / fps))
  const step = Math.max(requestedStep, Math.ceil(Math.max(0, end - start) / 3_599))
  const times = new Set<number>()
  for (let time = start; time <= end; time += step) times.add(time)
  times.add(start); times.add(end)
  for (const keyframe of keyframes) if (keyframe.timeMs >= start && keyframe.timeMs <= end) times.add(Math.round(keyframe.timeMs))
  return [...times].sort((left, right) => left - right)
}

function resultSurface(graph: DemoGraph, evaluation: ReturnType<typeof evaluatePipeline>): PipelineSurface {
  const preview = [...graph.nodes].reverse().find((node) => node.kind === 'preview')
  const previewOutput = preview ? evaluation.outputs.get(preview.id)?.get('surface-out') : undefined
  if (isSurface(previewOutput)) return previewOutput
  for (const node of [...graph.nodes].reverse()) {
    const values = evaluation.outputs.get(node.id)
    for (const value of values?.values() ?? []) if (isSurface(value)) return value
  }
  return { width: 1, height: 1, pixels: new Uint8ClampedArray(4) }
}

export function renderPipelineFrame(graph: DemoGraph, assets: ReadonlyMap<string, PipelineAssetSource>, keyframes: readonly PipelineKeyframeLike[], timeMs: number, durationMs: number, selected = true): GeneratedPipelineFrame {
  if (!graph.nodes.length) return { id: `frame-${timeMs}`, timeMs, durationMs, surface: { width: 1, height: 1, pixels: new Uint8ClampedArray(4) }, diagnostics: ['EMPTY_GRAPH'], selected }
  const evaluation = evaluatePipeline(interpolatePipelineGraph(graph, keyframes, timeMs), assets, timeMs)
  return { id: `frame-${timeMs}`, timeMs, durationMs, surface: resultSurface(graph, evaluation), diagnostics: evaluation.diagnostics, selected }
}

export function renderPipelineFrames(graph: DemoGraph, assets: ReadonlyMap<string, PipelineAssetSource>, keyframes: readonly PipelineKeyframeLike[], settings: PipelineRenderSettings): GeneratedPipelineFrame[] {
  const times = samplePipelineTimes(settings, keyframes)
  const selected = new Set(settings.selectedFrameTimesMs ?? times)
  const defaultDuration = Math.max(10, Math.round(1000 / clamp(Math.round(settings.fps), 1, 60)))
  if (!graph.nodes.length) {
    const timeMs = times[0] ?? 0
    return [{ id: `frame-${timeMs}`, timeMs, durationMs: defaultDuration, surface: { width: 1, height: 1, pixels: new Uint8ClampedArray(4) }, diagnostics: ['EMPTY_GRAPH'], selected: selected.has(timeMs) }]
  }
  return times.map((timeMs, index) => {
    const nextTime = times[index + 1]
    const durationMs = Math.max(10, nextTime === undefined ? defaultDuration : nextTime - timeMs)
    return renderPipelineFrame(graph, assets, keyframes, timeMs, durationMs, selected.has(timeMs))
  })
}

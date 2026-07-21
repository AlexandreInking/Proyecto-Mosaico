import { describe, expect, it } from 'vitest'
import { PipelineJobQueue } from '../src/index.js'

describe('PipelineJobQueue', () => {
  it('runs jobs sequentially in FIFO order', async () => {
    const started: string[] = []
    const releases: Array<() => void> = []
    const queue = new PipelineJobQueue<string, string>(async (input) => {
      started.push(input)
      await new Promise<void>((resolve) => releases.push(resolve))
      return input.toUpperCase()
    })

    const first = queue.enqueue('first')
    const second = queue.enqueue('second')
    await Promise.resolve()
    expect(started).toEqual(['first'])

    releases.shift()?.()
    await first.completed
    expect(started).toEqual(['first', 'second'])
    releases.shift()?.()

    await expect(second.completed).resolves.toMatchObject({ status: 'succeeded', output: 'SECOND' })
  })

  it('cancels a queued job without starting it', async () => {
    let releaseFirst: (() => void) | undefined
    const started: string[] = []
    const queue = new PipelineJobQueue<string, string>(async (input) => {
      started.push(input)
      await new Promise<void>((resolve) => { releaseFirst = resolve })
      return input
    })
    const first = queue.enqueue('first')
    const second = queue.enqueue('second')

    queue.cancel(second.id)

    const cancelled = await second.completed
    expect(cancelled.status).toBe('cancelled')
    expect('output' in cancelled).toBe(false)
    expect(started).toEqual(['first'])
    releaseFirst?.()
    await first.completed
  })

  it('aborts a running job and never publishes its output', async () => {
    const queue = new PipelineJobQueue<string, string>(async (_input, context) => {
      await new Promise<void>((_resolve, reject) => {
        context.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true })
      })
      return 'must-not-publish'
    })
    const job = queue.enqueue('active')
    await Promise.resolve()

    queue.cancel(job.id)

    const cancelled = await job.completed
    expect(cancelled.status).toBe('cancelled')
    expect('output' in cancelled).toBe(false)
  })

  it('publishes observable progress snapshots', async () => {
    const observed: number[] = []
    const queue = new PipelineJobQueue<string, string>(async (input, context) => {
      context.onProgress(0.25)
      context.onProgress(0.75)
      return input
    })
    queue.subscribe((jobs) => {
      const current = jobs[0]
      if (current?.status === 'running') observed.push(current.progress)
    })

    const job = queue.enqueue('asset')
    await job.completed

    expect(observed).toContain(0.25)
    expect(observed).toContain(0.75)
    expect(queue.snapshots[0]).toMatchObject({ status: 'succeeded', progress: 1 })
  })
})

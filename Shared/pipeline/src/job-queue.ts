export type QueueJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export interface QueueJobSnapshot<Output> {
  id: string
  status: QueueJobStatus
  progress: number
  output?: Output
  error?: string
}

export interface QueueJobContext {
  signal: AbortSignal
  onProgress(progress: number): void
}

export interface QueueJobHandle<Output> {
  id: string
  completed: Promise<QueueJobSnapshot<Output>>
}

type QueueWorker<Input, Output> = (input: Input, context: QueueJobContext) => Promise<Output>
type QueueListener<Output> = (jobs: readonly QueueJobSnapshot<Output>[]) => void

interface QueueEntry<Input, Output> {
  input: Input
  controller: AbortController
  snapshot: QueueJobSnapshot<Output>
  resolve(snapshot: QueueJobSnapshot<Output>): void
}

export class PipelineJobQueue<Input, Output> {
  private readonly entries: Array<QueueEntry<Input, Output>> = []
  private readonly listeners = new Set<QueueListener<Output>>()
  private sequence = 0
  private draining = false

  constructor(private readonly worker: QueueWorker<Input, Output>) {}

  get snapshots(): readonly QueueJobSnapshot<Output>[] {
    return this.entries.map((entry) => ({ ...entry.snapshot }))
  }

  enqueue(input: Input): QueueJobHandle<Output> {
    const id = `job-${++this.sequence}`
    let resolveCompleted: (snapshot: QueueJobSnapshot<Output>) => void = () => undefined
    const completed = new Promise<QueueJobSnapshot<Output>>((resolve) => { resolveCompleted = resolve })
    this.entries.push({
      input,
      controller: new AbortController(),
      snapshot: { id, status: 'queued', progress: 0 },
      resolve: resolveCompleted,
    })
    this.notify()
    void this.drain()
    return { id, completed }
  }

  cancel(id: string): void {
    const entry = this.entries.find((candidate) => candidate.snapshot.id === id)
    if (!entry || !['queued', 'running'].includes(entry.snapshot.status)) return
    entry.controller.abort()
    if (entry.snapshot.status === 'queued') {
      entry.snapshot = { id, status: 'cancelled', progress: entry.snapshot.progress }
      entry.resolve({ ...entry.snapshot })
      this.notify()
    }
  }

  subscribe(listener: QueueListener<Output>): () => void {
    this.listeners.add(listener)
    listener(this.snapshots)
    return () => { this.listeners.delete(listener) }
  }

  private notify(): void {
    const snapshots = this.snapshots
    for (const listener of this.listeners) listener(snapshots)
  }

  private async drain(): Promise<void> {
    if (this.draining) return
    this.draining = true
    try {
      let entry = this.entries.find((candidate) => candidate.snapshot.status === 'queued')
      while (entry) {
        entry.snapshot = { id: entry.snapshot.id, status: 'running', progress: 0 }
        this.notify()
        try {
          const output = await this.worker(entry.input, {
            signal: entry.controller.signal,
            onProgress: (progress) => {
              if (entry?.snapshot.status !== 'running' || entry.controller.signal.aborted) return
              entry.snapshot = { ...entry.snapshot, progress: Math.max(0, Math.min(1, progress)) }
              this.notify()
            },
          })
          entry.snapshot = entry.controller.signal.aborted
            ? { id: entry.snapshot.id, status: 'cancelled', progress: entry.snapshot.progress }
            : { id: entry.snapshot.id, status: 'succeeded', progress: 1, output }
        } catch (error: unknown) {
          entry.snapshot = entry.controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')
            ? { id: entry.snapshot.id, status: 'cancelled', progress: entry.snapshot.progress }
            : { id: entry.snapshot.id, status: 'failed', progress: entry.snapshot.progress, error: error instanceof Error ? error.message : 'El job falló.' }
        }
        entry.resolve({ ...entry.snapshot })
        this.notify()
        entry = this.entries.find((candidate) => candidate.snapshot.status === 'queued')
      }
    } finally {
      this.draining = false
    }
  }
}

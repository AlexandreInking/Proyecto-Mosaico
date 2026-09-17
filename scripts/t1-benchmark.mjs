import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { resizeNearestRgba } from '../Shared/pipeline/src/pixel-resize.ts'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDirectory, '..')
const sourceWidth = 512
const sourceHeight = 512
const targetWidth = 2048
const targetHeight = 2048
const iterations = 7
const source = new Uint8ClampedArray(sourceWidth * sourceHeight * 4)
for (let index = 0; index < source.length; index += 4) {
  const pixel = index / 4
  source[index] = pixel % 251
  source[index + 1] = Math.floor(pixel / sourceWidth) % 241
  source[index + 2] = (pixel * 17) % 239
  source[index + 3] = 255
}

resizeNearestRgba(source, sourceWidth, sourceHeight, targetWidth, targetHeight)
const durationsMs = []
let outputBytes = 0
for (let iteration = 0; iteration < iterations; iteration += 1) {
  const started = performance.now()
  const output = resizeNearestRgba(source, sourceWidth, sourceHeight, targetWidth, targetHeight)
  durationsMs.push(performance.now() - started)
  outputBytes = output.byteLength
}

const sorted = [...durationsMs].sort((left, right) => left - right)
const percentile = (value) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)]
const result = {
  schema: 'mosaico-t1-benchmark-v1',
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
  recordedAtUtc: new Date().toISOString(),
  environment: { platform: process.platform, arch: process.arch, node: process.version },
  workload: { sourceWidth, sourceHeight, targetWidth, targetHeight, iterations, outputBytes },
  durationsMs: durationsMs.map((value) => Number(value.toFixed(3))),
  p50Ms: Number((percentile(0.5) ?? 0).toFixed(3)),
  p95Ms: Number((percentile(0.95) ?? 0).toFixed(3)),
}

const outputPath = resolve(repoRoot, 'output', 'gate', 't1-benchmark.json')
mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(result))

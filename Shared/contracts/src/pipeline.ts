import { z } from 'zod'
import { assetSchema } from './asset.js'

const pipelineArrayValueSchema = z.array(z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.array(z.number().finite()).max(4),
])).max(4096)

export const pipelineValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.array(z.number().finite()).max(4),
  pipelineArrayValueSchema,
])

export const pipelinePortTypeSchema = z.enum([
  'surface', 'surface-or-value', 'color', 'gradient', 'value', 'int', 'float', 'bool',
  'vector2', 'vector3', 'vector4', 'array', 'point', 'path', 'matrix', 'string',
  'mesh', 'camera', 'scene', 'texture',
])
export const pipelinePortDirectionSchema = z.enum(['input', 'output'])
export const pipelineNodeStatusSchema = z.enum(['published', 'backlog'])
export const pipelineNodeCapabilitySchema = z.enum(['cpu2d', 'webgl', 'webgpu'])
export const pipelineNodePreviewSchema = z.enum(['surface', 'value', 'array'])
export const pipelineNodeDefinitionSchema = z.object({
  version: z.literal(1),
  kind: z.string().min(1),
  family: z.string().min(1),
  labelKey: z.string().min(1),
  descriptionKey: z.string().min(1),
  aliases: z.array(z.string().min(1)).max(32),
  status: pipelineNodeStatusSchema,
  capabilities: z.array(pipelineNodeCapabilitySchema).min(1).max(3),
  preview: pipelineNodePreviewSchema,
  evaluatorKey: z.string().min(1),
}).strict()

export const pipelinePortSchema = z.object({
  id: z.string().min(1),
  type: pipelinePortTypeSchema,
  direction: pipelinePortDirectionSchema,
}).strict()

export const pipelineParameterSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['number', 'float', 'range', 'select', 'color', 'asset', 'vector2', 'text', 'boolean', 'array']),
  value: pipelineValueSchema,
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  step: z.number().positive().finite().optional(),
  options: z.array(z.string().min(1)).max(128).optional(),
  portType: pipelinePortTypeSchema.optional(),
  showInNode: z.boolean().optional(),
}).strict()

export const pipelineNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  inputs: z.array(pipelinePortSchema).max(32).optional(),
  outputs: z.array(pipelinePortSchema).max(32).optional(),
  parameters: z.array(pipelineParameterSchema).max(64),
  assetId: z.string().min(1).optional(),
  customNodeId: z.string().min(1).optional(),
  customDefinition: z.unknown().optional(),
  previewVisible: z.boolean().optional(),
}).strict()

export const pipelineEdgeSchema = z.object({
  sourceNodeId: z.string().min(1),
  sourcePortId: z.string().min(1),
  targetNodeId: z.string().min(1),
  targetPortId: z.string().min(1),
}).strict()

export const pipelineKeyframeSchema = z.object({
  id: z.string().min(1),
  nodeId: z.string().min(1),
  parameterId: z.string().min(1),
  timeMs: z.number().int().nonnegative().max(86_400_000),
  value: pipelineValueSchema,
  interpolation: z.enum(['step', 'linear', 'bezier', 'spline']).optional(),
  easing: z.enum(['linear', 'ease-in', 'ease-out', 'ease-in-out']).optional(),
  handles: z.object({ in: z.tuple([z.number().finite().min(0).max(1), z.number().finite().min(0).max(1)]), out: z.tuple([z.number().finite().min(0).max(1), z.number().finite().min(0).max(1)]) }).strict().optional(),
}).strict()

export const pipelineSnapshotSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(128),
  timeMs: z.number().int().nonnegative().max(86_400_000),
  selectedNodeId: z.string().min(1).optional(),
  thumbnailPath: z.string().regex(/^snapshots\/[A-Za-z0-9._-]+\.png$/).optional(),
}).strict()

export const pipelineTimelineSchema = z.object({
  mode: z.enum(['animation', 'snapshots']),
  durationMs: z.number().int().positive().max(86_400_000),
  currentTimeMs: z.number().int().nonnegative().max(86_400_000),
  keyframes: z.array(pipelineKeyframeSchema).max(4096),
  snapshots: z.array(pipelineSnapshotSchema).max(24),
  loop: z.boolean().optional(),
  timelineVisible: z.boolean().optional(),
  timelineHeight: z.number().int().min(180).max(520).optional(),
  render: z.object({
    fps: z.number().int().min(1).max(60),
    rangeStartMs: z.number().int().nonnegative().max(86_400_000),
    rangeEndMs: z.number().int().nonnegative().max(86_400_000),
    selectedFrameTimesMs: z.array(z.number().int().nonnegative().max(86_400_000)).max(4096),
  }).strict().optional(),
}).strict().superRefine((timeline, context) => {
  if (timeline.currentTimeMs > timeline.durationMs) context.addIssue({ code: 'custom', path: ['currentTimeMs'], message: 'Timeline time exceeds duration.' })
  for (const [index, keyframe] of timeline.keyframes.entries()) {
    if (keyframe.timeMs > timeline.durationMs) context.addIssue({ code: 'custom', path: ['keyframes', index, 'timeMs'], message: 'Keyframe time exceeds duration.' })
  }
  for (const [index, snapshot] of timeline.snapshots.entries()) {
    if (snapshot.timeMs > timeline.durationMs) context.addIssue({ code: 'custom', path: ['snapshots', index, 'timeMs'], message: 'Snapshot time exceeds duration.' })
  }
  if (timeline.timelineHeight !== undefined && (!Number.isInteger(timeline.timelineHeight) || timeline.timelineHeight < 180 || timeline.timelineHeight > 520)) context.addIssue({ code: 'custom', path: ['timelineHeight'], message: 'Timeline height is outside safe bounds.' })
  if (timeline.render && timeline.render.rangeStartMs > timeline.render.rangeEndMs) context.addIssue({ code: 'custom', path: ['render'], message: 'Render range is inverted.' })
})

export const pipelineViewportSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  zoom: z.number().finite().min(0.12).max(3.5),
}).strict()

export const pipelineDocumentSchema = z.object({
  format: z.literal('mosaico-pipeline'),
  formatVersion: z.literal(1),
  id: z.string().min(1),
  revision: z.number().int().nonnegative(),
  name: z.string().min(1).max(256),
  nodes: z.array(pipelineNodeSchema).max(256),
  edges: z.array(pipelineEdgeSchema).max(1024),
  assets: z.array(assetSchema).max(256),
  timeline: pipelineTimelineSchema,
  viewport: pipelineViewportSchema,
  selectedNodeId: z.string().min(1).optional(),
}).strict().superRefine((document, context) => {
  const ids = document.nodes.map((node) => node.id)
  if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', path: ['nodes'], message: 'Pipeline node IDs must be unique.' })
  const nodeIds = new Set(ids)
  const assetIds = new Set(document.assets.map((asset) => asset.id))
  for (const [index, edge] of document.edges.entries()) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) context.addIssue({ code: 'custom', path: ['edges', index], message: 'Pipeline edge references a missing node.' })
    const source = document.nodes.find((node) => node.id === edge.sourceNodeId)
    const target = document.nodes.find((node) => node.id === edge.targetNodeId)
    if (source?.outputs && !source.outputs.some((port) => port.id === edge.sourcePortId && port.direction === 'output')) context.addIssue({ code: 'custom', path: ['edges', index, 'sourcePortId'], message: 'Pipeline edge references a missing output port.' })
    if (target?.inputs && !target.inputs.some((port) => port.id === edge.targetPortId && port.direction === 'input')) context.addIssue({ code: 'custom', path: ['edges', index, 'targetPortId'], message: 'Pipeline edge references a missing input port.' })
  }
  for (const [index, node] of document.nodes.entries()) {
    if (node.assetId && !assetIds.has(node.assetId)) context.addIssue({ code: 'custom', path: ['nodes', index, 'assetId'], message: 'Pipeline node references a missing asset.' })
  }
  if (document.selectedNodeId && !nodeIds.has(document.selectedNodeId)) context.addIssue({ code: 'custom', path: ['selectedNodeId'], message: 'Selected node does not exist.' })
})

export type PipelineValue = z.infer<typeof pipelineValueSchema>
export type PipelineNodeDefinition = z.infer<typeof pipelineNodeDefinitionSchema>
export type PipelinePort = z.infer<typeof pipelinePortSchema>
export type PipelineParameter = z.infer<typeof pipelineParameterSchema>
export type PipelineNodeContract = z.infer<typeof pipelineNodeSchema>
export type PipelineEdgeContract = z.infer<typeof pipelineEdgeSchema>
export type PipelineKeyframe = z.infer<typeof pipelineKeyframeSchema>
export type PipelineSnapshot = z.infer<typeof pipelineSnapshotSchema>
export type PipelineTimeline = z.infer<typeof pipelineTimelineSchema>
export type PipelineDocument = z.infer<typeof pipelineDocumentSchema>

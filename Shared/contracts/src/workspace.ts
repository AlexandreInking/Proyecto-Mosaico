import { z } from 'zod'
import { assetSchema } from './asset.js'
import { pipelinePortTypeSchema } from './pipeline.js'

export const WORKSPACE_CONTRACT_VERSION = 1 as const

export const assetFolderSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(256),
  parentId: z.string().min(1).max(128).optional(),
  collapsed: z.boolean().optional(),
}).strict()

export const assetLocationSchema = z.object({
  assetId: z.string().min(1),
  folderId: z.string().min(1).optional(),
}).strict()

export const customNodePortSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(128),
  type: pipelinePortTypeSchema,
  direction: z.enum(['input', 'output']),
  showInNode: z.boolean().optional(),
}).strict()

export const customNodeParameterSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(128),
  type: z.enum(['number', 'float', 'range', 'select', 'color', 'text', 'boolean', 'array']),
  value: z.union([z.string(), z.number().finite(), z.boolean(), z.array(z.number().finite()).max(4), z.array(z.union([z.string(), z.number().finite(), z.boolean()])).max(4096)]),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  step: z.number().positive().finite().optional(),
  options: z.array(z.string().min(1)).max(128).optional(),
  portType: pipelinePortTypeSchema.optional(),
  showInNode: z.boolean().optional(),
}).strict()

export type CustomNodePort = z.infer<typeof customNodePortSchema>
export type CustomNodeParameter = z.infer<typeof customNodeParameterSchema>
export type CustomExpression =
  | { kind: 'literal'; value: string | number | boolean | number[] | (string | number | boolean)[] }
  | { kind: 'ref'; ref: string }
  | { kind: 'call'; name: string; args: CustomExpression[] }
  | { kind: 'binary'; operator: '+' | '-' | '*' | '/'; left: CustomExpression; right: CustomExpression }
export interface CustomNodeDefinition {
  id: string
  version: number
  name: string
  family: string
  inputs: CustomNodePort[]
  outputs: CustomNodePort[]
  parameters: CustomNodeParameter[]
  body: Record<string, CustomExpression>
}

const customExpressionSchema: z.ZodType<CustomExpression> = z.lazy(() => z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('literal'), value: z.union([z.string(), z.number().finite(), z.boolean(), z.array(z.number().finite()).max(4)]) }).strict(),
  z.object({ kind: z.literal('ref'), ref: z.string().min(1).max(64) }).strict(),
  z.object({ kind: z.literal('call'), name: z.string().min(1).max(64), args: z.array(customExpressionSchema).max(32) }).strict(),
  z.object({ kind: z.literal('binary'), operator: z.enum(['+', '-', '*', '/']), left: customExpressionSchema, right: customExpressionSchema }).strict(),
])) as z.ZodType<CustomExpression>

export const customNodeDefinitionSchema: z.ZodType<CustomNodeDefinition> = z.object({
  id: z.string().min(1).max(128),
  version: z.number().int().positive(),
  name: z.string().min(1).max(128),
  family: z.string().min(1).max(64),
  inputs: z.array(customNodePortSchema).max(32),
  outputs: z.array(customNodePortSchema).max(32),
  parameters: z.array(customNodeParameterSchema).max(64),
  body: z.record(z.string().min(1).max(64), customExpressionSchema).refine((body) => Object.keys(body).length <= 32),
}).strict().superRefine((definition, context) => {
  const ids = [...definition.inputs, ...definition.outputs, ...definition.parameters].map((item) => item.id)
  if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', path: ['inputs'], message: 'Custom node identifiers must be unique.' })
  const outputIds = new Set(definition.outputs.map((port) => port.id))
  for (const outputId of Object.keys(definition.body)) if (!outputIds.has(outputId)) context.addIssue({ code: 'custom', path: ['body', outputId], message: 'Custom node body references an unknown output.' })
})

export const customNodePackageSchema = z.object({
  format: z.literal('mosaico-node'),
  formatVersion: z.literal(1),
  metadata: z.object({
    id: z.string().min(1).max(128),
    name: z.string().min(1).max(128),
    family: z.string().min(1).max(64),
  }).strict(),
  definition: customNodeDefinitionSchema,
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict()

const workspaceTabStateSchema = z.object({
  documents: z.array(z.unknown()).max(256),
  activeId: z.string().min(1).optional(),
  ui: z.record(z.string(), z.unknown()).default({}),
}).strict()

export const workspaceDocumentSchema = z.object({
  format: z.literal('mosaico-workspace'),
  formatVersion: z.literal(WORKSPACE_CONTRACT_VERSION),
  id: z.string().min(1),
  name: z.string().min(1).max(256),
  activeModule: z.enum(['Assets', 'Editor', 'Pipelines', 'Mapas', 'Jobs', 'Exportar']),
  selectedAssetId: z.string().min(1).optional(),
  assets: z.array(assetSchema).max(1024),
  assetFolders: z.array(assetFolderSchema).max(256).optional(),
  assetLocations: z.array(assetLocationSchema).max(1024).optional(),
  tabs: z.object({
    editor: workspaceTabStateSchema,
    pipelines: workspaceTabStateSchema,
    maps: workspaceTabStateSchema,
  }).strict(),
  customNodes: z.array(customNodeDefinitionSchema).max(256),
}).strict().superRefine((workspace, context) => {
  const ids = workspace.assets.map((asset) => asset.id)
  if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', path: ['assets'], message: 'Workspace Asset IDs must be unique.' })
  if (workspace.selectedAssetId && !ids.includes(workspace.selectedAssetId)) context.addIssue({ code: 'custom', path: ['selectedAssetId'], message: 'Selected Asset does not exist.' })
})

export type WorkspaceTabState = z.infer<typeof workspaceTabStateSchema>
export type AssetFolder = z.infer<typeof assetFolderSchema>
export type AssetLocation = z.infer<typeof assetLocationSchema>
export type CustomNodePackage = z.infer<typeof customNodePackageSchema>
export type WorkspaceDocument = z.infer<typeof workspaceDocumentSchema>

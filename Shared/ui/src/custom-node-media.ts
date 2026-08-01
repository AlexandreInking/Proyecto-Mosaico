import { customNodePackageSchema, type CustomNodeDefinition, type CustomNodePackage } from '@mosaico/contracts'

function canonicalDefinition(definition: CustomNodeDefinition): string {
  return JSON.stringify(definition)
}

async function sha256(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function createCustomNodePackage(definition: CustomNodeDefinition): Promise<CustomNodePackage> {
  const contentHash = await sha256(canonicalDefinition(definition))
  return customNodePackageSchema.parse({ format: 'mosaico-node', formatVersion: 1, metadata: { id: definition.id, name: definition.name, family: definition.family }, definition, contentHash })
}

export async function serializeCustomNode(definition: CustomNodeDefinition): Promise<Blob> {
  const packageValue = await createCustomNodePackage(definition)
  return new Blob([JSON.stringify(packageValue, null, 2)], { type: 'application/x-mosaico-node+json' })
}

export async function parseCustomNode(file: File): Promise<CustomNodeDefinition> {
  if (file.size > 2 * 1024 * 1024) throw new Error('CUSTOM_NODE_TOO_LARGE')
  const value: unknown = JSON.parse(await file.text())
  const parsed = customNodePackageSchema.safeParse(value)
  if (!parsed.success) throw new Error('CUSTOM_NODE_SCHEMA_INVALID')
  if (parsed.data.contentHash !== await sha256(canonicalDefinition(parsed.data.definition))) throw new Error('CUSTOM_NODE_HASH_INVALID')
  return parsed.data.definition
}

export async function downloadCustomNode(definition: CustomNodeDefinition): Promise<void> {
  const blob = await serializeCustomNode(definition)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${definition.name.replace(/[^\p{L}\p{N}._-]+/gu, '_')}.mnode`
  anchor.click()
  URL.revokeObjectURL(url)
}

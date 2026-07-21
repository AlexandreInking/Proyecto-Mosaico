import {
  deserializeMapDocument,
  deserializeSpriteDocument,
  mapSemanticFingerprint,
  serializeMapDocument,
  serializeSpriteDocument,
  spriteSemanticFingerprint,
  type MapDocument,
  type SpriteDocument,
} from '@mosaico/domain'

export type AuthoringDocument = MapDocument | SpriteDocument
export type SnapshotChannel = 'confirmed' | 'autosave'

export interface AuthoringSnapshot {
  readonly documentId: string
  readonly documentKind: 'map' | 'sprite'
  readonly channel: SnapshotChannel
  readonly revision: number
  readonly savedAt: number
  readonly semanticFingerprint: string
  readonly payload: string
}

export interface AuthoringSnapshotStore {
  read(documentId: string, channel: SnapshotChannel): Promise<AuthoringSnapshot | undefined>
  write(snapshot: AuthoringSnapshot): Promise<void>
  delete(documentId: string, channel: SnapshotChannel): Promise<void>
}

export interface AuthoringRecovery {
  readonly document: AuthoringDocument
  readonly source: SnapshotChannel
  readonly savedAt: number
}

const MAXIMUM_SNAPSHOT_BYTES = 64 * 1024 * 1024
const fingerprintPattern = /^[0-9a-f]{16}$/

function assertDocumentId(documentId: string): void {
  if (typeof documentId !== 'string' || documentId.length < 1 || documentId.length > 128) throw new Error('AUTHORING_SNAPSHOT_INVALID')
}

export function assertAuthoringSnapshot(snapshot: AuthoringSnapshot): void {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('AUTHORING_SNAPSHOT_INVALID')
  assertDocumentId(snapshot.documentId)
  if (snapshot.documentKind !== 'map' && snapshot.documentKind !== 'sprite') throw new Error('AUTHORING_SNAPSHOT_INVALID')
  if (snapshot.channel !== 'confirmed' && snapshot.channel !== 'autosave') throw new Error('AUTHORING_SNAPSHOT_INVALID')
  if (!Number.isInteger(snapshot.revision) || snapshot.revision < 0) throw new Error('AUTHORING_SNAPSHOT_INVALID')
  if (!Number.isInteger(snapshot.savedAt) || snapshot.savedAt < 0) throw new Error('AUTHORING_SNAPSHOT_INVALID')
  if (!fingerprintPattern.test(snapshot.semanticFingerprint)) throw new Error('AUTHORING_SNAPSHOT_INVALID')
  if (typeof snapshot.payload !== 'string' || snapshot.payload.length > MAXIMUM_SNAPSHOT_BYTES) throw new Error('AUTHORING_SNAPSHOT_INVALID')
}

function createSnapshot(document: AuthoringDocument, channel: SnapshotChannel, savedAt: number): AuthoringSnapshot {
  if (!Number.isInteger(savedAt) || savedAt < 0) throw new RangeError('AUTHORING_SAVED_AT_INVALID')
  return document.format === 'mosaico-map'
    ? {
        documentId: document.id, documentKind: 'map', channel, revision: document.revision, savedAt,
        semanticFingerprint: mapSemanticFingerprint(document), payload: serializeMapDocument(document),
      }
    : {
        documentId: document.id, documentKind: 'sprite', channel, revision: document.revision, savedAt,
        semanticFingerprint: spriteSemanticFingerprint(document), payload: serializeSpriteDocument(document),
      }
}

function validateSnapshot(snapshot: AuthoringSnapshot | undefined): AuthoringRecovery | undefined {
  if (!snapshot) return undefined
  try {
    assertAuthoringSnapshot(snapshot)
    const document = snapshot.documentKind === 'map'
      ? deserializeMapDocument(snapshot.payload)
      : deserializeSpriteDocument(snapshot.payload)
    const fingerprint = document.format === 'mosaico-map'
      ? mapSemanticFingerprint(document)
      : spriteSemanticFingerprint(document)
    if (document.id !== snapshot.documentId || document.revision !== snapshot.revision
      || fingerprint !== snapshot.semanticFingerprint) return undefined
    return { document, source: snapshot.channel, savedAt: snapshot.savedAt }
  } catch {
    return undefined
  }
}

export class MemoryAuthoringStore implements AuthoringSnapshotStore {
  readonly #snapshots = new Map<string, AuthoringSnapshot>()

  async read(documentId: string, channel: SnapshotChannel): Promise<AuthoringSnapshot | undefined> {
    assertDocumentId(documentId)
    const snapshot = this.#snapshots.get(`${documentId}:${channel}`)
    return snapshot ? { ...snapshot } : undefined
  }

  async write(snapshot: AuthoringSnapshot): Promise<void> {
    assertAuthoringSnapshot(snapshot)
    this.#snapshots.set(`${snapshot.documentId}:${snapshot.channel}`, { ...snapshot })
  }

  async delete(documentId: string, channel: SnapshotChannel): Promise<void> {
    assertDocumentId(documentId)
    this.#snapshots.delete(`${documentId}:${channel}`)
  }
}

export class AuthoringPersistence {
  readonly #store: AuthoringSnapshotStore

  constructor(store: AuthoringSnapshotStore) { this.#store = store }

  async saveConfirmed(document: AuthoringDocument, savedAt = Date.now()): Promise<void> {
    await this.#store.write(createSnapshot(document, 'confirmed', savedAt))
  }

  async saveAutosave(document: AuthoringDocument, savedAt = Date.now()): Promise<void> {
    await this.#store.write(createSnapshot(document, 'autosave', savedAt))
  }

  async discardAutosave(documentId: string): Promise<void> {
    await this.#store.delete(documentId, 'autosave')
  }

  async recover(documentId: string): Promise<AuthoringRecovery | undefined> {
    assertDocumentId(documentId)
    const reads = await Promise.allSettled([
      this.#store.read(documentId, 'confirmed'),
      this.#store.read(documentId, 'autosave'),
    ])
    const candidates = reads.flatMap((result) => result.status === 'fulfilled' ? [validateSnapshot(result.value)] : [])
      .filter((candidate): candidate is AuthoringRecovery => candidate !== undefined)
      .sort((left, right) => right.document.revision - left.document.revision
        || right.savedAt - left.savedAt
        || (left.source === 'autosave' ? -1 : 1))
    return candidates[0]
  }
}

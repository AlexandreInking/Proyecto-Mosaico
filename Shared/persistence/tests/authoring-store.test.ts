import { describe, expect, it } from 'vitest'
import {
  AuthoringPersistence,
  MemoryAuthoringStore,
  type AuthoringSnapshot,
  type AuthoringSnapshotStore,
} from '../src/index.js'
import { createMapDocument, mapSemanticFingerprint, setTile } from '@mosaico/domain'

const tileset = {
  id: '11111111-1111-4111-8111-111111111111', name: 'Tiles', assetId: 'asset',
  imageWidth: 16, imageHeight: 16, tileWidth: 16, tileHeight: 16,
  marginX: 0, marginY: 0, spacingX: 0, spacingY: 0, tileCount: 1,
}

function documentAtRevisionOne() {
  const initial = createMapDocument({
    id: '22222222-2222-4222-8222-222222222222', name: 'Mapa', width: 2, height: 2,
    cellWidth: 16, cellHeight: 16, layerId: '33333333-3333-4333-8333-333333333333', tilesets: [tileset],
  })
  return setTile(initial, initial.activeLayerId, { x: 0, y: 0 }, { tilesetId: tileset.id, tileId: 0 })
}

describe('authoring persistence and recovery', () => {
  it('reopens an autosaved revision through a new persistence instance', async () => {
    const store = new MemoryAuthoringStore()
    const document = documentAtRevisionOne()
    await new AuthoringPersistence(store).saveAutosave(document, 100)

    const recovery = await new AuthoringPersistence(store).recover(document.id)
    expect(recovery?.source).toBe('autosave')
    expect(recovery?.document.revision).toBe(1)
    expect(recovery && mapSemanticFingerprint(recovery.document as typeof document)).toBe(mapSemanticFingerprint(document))
  })

  it('uses confirmed data when a newer autosave is corrupt', async () => {
    const document = documentAtRevisionOne()
    const validStore = new MemoryAuthoringStore()
    const persistence = new AuthoringPersistence(validStore)
    await persistence.saveConfirmed(document, 100)
    const confirmed = await validStore.read(document.id, 'confirmed')
    const corrupt = { ...confirmed!, channel: 'autosave' as const, savedAt: 200, revision: 99, payload: '{' }
    const store: AuthoringSnapshotStore = {
      read: async (_id, channel) => channel === 'confirmed' ? confirmed : corrupt,
      write: async () => undefined,
      delete: async () => undefined,
    }

    const recovery = await new AuthoringPersistence(store).recover(document.id)
    expect(recovery?.source).toBe('confirmed')
    expect(recovery?.document.revision).toBe(1)
  })

  it('keeps confirmed recovery available when autosave storage fails', async () => {
    const document = documentAtRevisionOne()
    const validStore = new MemoryAuthoringStore()
    await new AuthoringPersistence(validStore).saveConfirmed(document, 100)
    const confirmed = await validStore.read(document.id, 'confirmed')
    const store: AuthoringSnapshotStore = {
      read: async (_id, channel) => channel === 'confirmed' ? confirmed : Promise.reject(new Error('disk fault')),
      write: async () => undefined,
      delete: async () => undefined,
    }
    expect((await new AuthoringPersistence(store).recover(document.id))?.source).toBe('confirmed')
  })

  it('rejects snapshot metadata that disagrees with serialized document', async () => {
    const document = documentAtRevisionOne()
    const validStore = new MemoryAuthoringStore()
    await new AuthoringPersistence(validStore).saveConfirmed(document, 100)
    const forged = { ...(await validStore.read(document.id, 'confirmed'))!, revision: 20 } satisfies AuthoringSnapshot
    const store: AuthoringSnapshotStore = {
      read: async () => forged,
      write: async () => undefined,
      delete: async () => undefined,
    }

    expect(await new AuthoringPersistence(store).recover(document.id)).toBeUndefined()
  })

  it('prefers highest valid revision and can discard autosave', async () => {
    const store = new MemoryAuthoringStore()
    const persistence = new AuthoringPersistence(store)
    const revisionOne = documentAtRevisionOne()
    const revisionTwo = setTile(revisionOne, revisionOne.activeLayerId, { x: 1, y: 0 }, { tilesetId: tileset.id, tileId: 0 })
    await persistence.saveConfirmed(revisionOne, 200)
    await persistence.saveAutosave(revisionTwo, 100)

    expect((await persistence.recover(revisionOne.id))?.document.revision).toBe(2)
    await persistence.discardAutosave(revisionOne.id)
    expect((await persistence.recover(revisionOne.id))?.source).toBe('confirmed')
  })
})

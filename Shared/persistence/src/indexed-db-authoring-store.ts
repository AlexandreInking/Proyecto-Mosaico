import { assertAuthoringSnapshot, type AuthoringSnapshot, type AuthoringSnapshotStore, type SnapshotChannel } from './authoring-store.js'

const STORE_NAME = 'authoring-snapshots'

interface StoredSnapshot extends AuthoringSnapshot { readonly key: string }

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('AUTHORING_STORE_FAILED'))
  })
}

export class IndexedDbAuthoringStore implements AuthoringSnapshotStore {
  readonly #factory: IDBFactory
  readonly #databaseName: string

  constructor(options: { readonly factory?: IDBFactory; readonly databaseName?: string } = {}) {
    const factory = options.factory ?? globalThis.indexedDB
    if (!factory) throw new Error('INDEXED_DB_UNAVAILABLE')
    this.#factory = factory
    this.#databaseName = options.databaseName ?? 'mosaico-authoring-t2'
  }

  #open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.#factory.open(this.#databaseName, 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(new Error('AUTHORING_STORE_FAILED'))
    })
  }

  async read(documentId: string, channel: SnapshotChannel): Promise<AuthoringSnapshot | undefined> {
    const database = await this.#open()
    try {
      const value = await requestResult(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(`${documentId}:${channel}`)) as unknown
      if (!value || typeof value !== 'object') return undefined
      const { key: _key, ...snapshot } = value as StoredSnapshot
      try { assertAuthoringSnapshot(snapshot) } catch { return undefined }
      return snapshot
    } finally { database.close() }
  }

  async write(snapshot: AuthoringSnapshot): Promise<void> {
    assertAuthoringSnapshot(snapshot)
    const database = await this.#open()
    try {
      await requestResult(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME)
        .put({ ...snapshot, key: `${snapshot.documentId}:${snapshot.channel}` }))
    } finally { database.close() }
  }

  async delete(documentId: string, channel: SnapshotChannel): Promise<void> {
    const database = await this.#open()
    try {
      await requestResult(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(`${documentId}:${channel}`))
    } finally { database.close() }
  }
}

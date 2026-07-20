import type { ImportedImage } from './web-image-pipeline.js'
import { assetSchema } from '@mosaico/contracts'

const DATABASE_NAME = 'mosaico-t1'
const DATABASE_VERSION = 1
const ASSET_STORE = 'assets'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(ASSET_STORE)) database.createObjectStore(ASSET_STORE, { keyPath: 'record.id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB.'))
  })
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Falló una operación de persistencia.'))
  })
}

export async function loadImages(): Promise<ImportedImage[]> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(ASSET_STORE, 'readonly')
    const stored = await requestResult(transaction.objectStore(ASSET_STORE).getAll()) as unknown[]
    return stored.flatMap((value) => {
      if (!value || typeof value !== 'object') return []
      const candidate = value as Partial<ImportedImage>
      const record = assetSchema.safeParse(candidate.record)
      if (!record.success || !(candidate.original instanceof Blob) || !(candidate.thumbnail instanceof Blob)) return []
      return [{ record: record.data, original: candidate.original, thumbnail: candidate.thumbnail }]
    })
  } finally {
    database.close()
  }
}

export async function saveImage(image: ImportedImage): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(ASSET_STORE, 'readwrite')
    await requestResult(transaction.objectStore(ASSET_STORE).put(image))
  } finally {
    database.close()
  }
}

export async function deleteImage(id: string): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(ASSET_STORE, 'readwrite')
    await requestResult(transaction.objectStore(ASSET_STORE).delete(id))
  } finally {
    database.close()
  }
}

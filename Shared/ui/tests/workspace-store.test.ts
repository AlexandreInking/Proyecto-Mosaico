import { afterEach, describe, expect, it } from 'vitest'
import { createWorkspaceSnapshot, restoreWorkspaceDraft } from '../src/workspace-store.js'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

describe('workspace draft bridge', () => {
  afterEach(() => { Reflect.deleteProperty(globalThis, 'localStorage') })

  it('captures every Editor tab and clears absent documents on restore', () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memoryStorage() })
    localStorage.setItem('mosaico-pixel-document-v1', JSON.stringify({ id: 'one' }))
    localStorage.setItem('mosaico-pixel-tabs-v1', JSON.stringify({ activeId: 'two', documents: [JSON.stringify({ id: 'one' }), JSON.stringify({ id: 'two' })] }))
    const snapshot = createWorkspaceSnapshot([], 'Assets')
    expect(snapshot.tabs.editor).toMatchObject({ activeId: 'two', documents: [{ id: 'one' }, { id: 'two' }] })

    restoreWorkspaceDraft({ ...snapshot, tabs: { ...snapshot.tabs, editor: { documents: [], ui: {} }, maps: { documents: [], ui: {} }, pipelines: { documents: [], ui: {} } } })
    expect(localStorage.getItem('mosaico-pixel-document-v1')).toBeNull()
    expect(localStorage.getItem('mosaico-pixel-tabs-v1')).toBeNull()
    expect(localStorage.getItem('mosaico-map-tabs-v3')).toBeNull()
    expect(localStorage.getItem('mosaico-pipeline-draft-v2')).toBeNull()
  })
})

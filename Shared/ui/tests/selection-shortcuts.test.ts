import { describe, expect, it } from 'vitest'
import { selectionClipboardCommand } from '../src/selection-shortcuts.js'

describe('selection clipboard shortcuts', () => {
  it('maps Windows and macOS accelerators without requiring a selection', () => {
    expect(selectionClipboardCommand({ ctrlKey: true, metaKey: false, key: 'C' })).toBe('copy')
    expect(selectionClipboardCommand({ ctrlKey: true, metaKey: false, key: 'x' })).toBe('cut')
    expect(selectionClipboardCommand({ ctrlKey: false, metaKey: true, key: 'v' })).toBe('paste')
    expect(selectionClipboardCommand({ ctrlKey: false, metaKey: false, key: 'v' })).toBeUndefined()
  })
})

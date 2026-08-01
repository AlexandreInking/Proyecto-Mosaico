import { describe, expect, it } from 'vitest'
import { EDITOR_PROJECT_EXTENSION, EDITOR_PROJECT_MEDIA_TYPE } from '../src/pixel-media.js'

describe('editor media', () => {
  it('uses mpe for new editor project saves while keeping legacy imports', () => {
    expect(EDITOR_PROJECT_EXTENSION).toBe('.mpe')
    expect(EDITOR_PROJECT_MEDIA_TYPE).toBe('application/vnd.mosaico.editor+json')
  })
})

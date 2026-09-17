import { test } from '@japa/runner'
import { webCapabilities } from '../../app/capabilities.js'

test.group('Web capabilities', () => {
  test('reports cloud API boundaries without native file access', ({ assert }) => {
    assert.deepEqual(webCapabilities(), {
      platform: 'web',
      executionTarget: 'cloud',
      offline: false,
      fileAccess: 'picker',
      uiContract: 'mosaico-ui-t0-v1',
    })
  })
})

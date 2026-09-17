export function webCapabilities() {
  return {
    platform: 'web',
    executionTarget: 'cloud',
    offline: false,
    fileAccess: 'picker',
    uiContract: 'mosaico-ui-t0-v1',
  } as const
}

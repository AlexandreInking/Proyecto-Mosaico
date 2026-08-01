export type SelectionClipboardCommand = 'copy' | 'cut' | 'paste'

export function selectionClipboardCommand(event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'key'>): SelectionClipboardCommand | undefined {
  if (!event.ctrlKey && !event.metaKey) return undefined
  const key = event.key.toLowerCase()
  return key === 'c' ? 'copy' : key === 'x' ? 'cut' : key === 'v' ? 'paste' : undefined
}

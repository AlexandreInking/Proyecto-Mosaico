import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()
const sourceRoots = ['Shared/ui/src', 'Shared/pipeline/src', 'Shared/contracts/src', 'WebApp/client', 'DesktopApp/app']
const extensions = new Set(['.ts', '.tsx', '.css', '.html', '.json'])

async function filesIn(directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const relative = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesIn(relative))
    else if (extensions.has(path.extname(entry.name))) files.push(relative)
  }
  return files
}

test('source text is valid UTF-8 and free of accidental mojibake', async () => {
  const files = (await Promise.all(sourceRoots.map(filesIn))).flat()
  for (const relative of files) {
    const bytes = await readFile(path.join(root, relative))
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (relative.endsWith(`${path.sep}i18n.ts`)) continue
    if (/[ÃÂÐÑâƒ�]/.test(text)) throw new Error(`Mojibake detected in ${relative}`)
  }
})

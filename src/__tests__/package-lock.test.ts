import fs from 'node:fs'
import path from 'node:path'
import { expect, it } from 'vitest'
// npm 12 refuses git dependencies by default (EALLOWGIT), so `npm ci` fails
// if any transitive package resolves to a git URL.
it('resolves every package from a registry, not git', () => {
  const lock = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../package-lock.json'), 'utf8'),
  ) as { packages: Record<string, { resolved?: string }> }
  const fromGit = Object.entries(lock.packages)
    .filter(([, entry]) => entry.resolved?.startsWith('git+'))
    .map(([name]) => name)
  expect(fromGit).toEqual([])
})

import path from 'path'
import os from 'os'
import fs from 'fs/promises'

// Roots that the server is allowed to read/write Obsidian vaults under.
// Restricting to the user's home directory blocks /etc, /usr, app source code, etc.
function getAllowedRoots(): string[] {
  const home = os.homedir()
  const extra = process.env.OBSIDIAN_VAULT_ROOT
  return [home, ...(extra ? [path.resolve(extra)] : [])]
}

export function expandUserPath(input: string): string {
  if (!input) return ''
  if (input.startsWith('~/') || input === '~') {
    return path.join(os.homedir(), input.slice(1))
  }
  return path.resolve(input)
}

export class UnsafeVaultPathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeVaultPathError'
  }
}

// Resolve and validate a user-supplied vault path. Throws if it escapes the
// allowed roots or contains parent-directory traversal after resolution.
export function safeResolveVaultPath(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new UnsafeVaultPathError('Vault path is required')
  }
  const resolved = expandUserPath(input.trim())
  const roots = getAllowedRoots()
  const ok = roots.some((root) => {
    const rel = path.relative(root, resolved)
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
  })
  if (!ok) {
    throw new UnsafeVaultPathError(
      'Vault path must be inside your home directory (or OBSIDIAN_VAULT_ROOT)',
    )
  }
  return resolved
}

export async function assertDirectoryExists(p: string): Promise<void> {
  const stat = await fs.stat(p).catch(() => null)
  if (!stat || !stat.isDirectory()) {
    throw new UnsafeVaultPathError('Vault path must be an existing directory')
  }
}

import { promisify } from 'node:util'
import * as fs from 'node:fs'

export async function exists(path: string): Promise<boolean> {
  const access = promisify(fs.access)

  try {
    await access(path)
    return true
  }
  catch {
    return false
  }
}

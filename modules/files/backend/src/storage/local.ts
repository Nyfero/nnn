import fs from 'node:fs'
import { access, mkdir, rename, rm, stat, statfs } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'
import type { StorageBackend } from './types'

// Stockage sur un dossier du serveur (disque local, volume Docker, point de montage NAS/NFS...)
export class LocalBackend implements StorageBackend {
  private root: string

  constructor(
    readonly name: string,
    root: string
  ) {
    this.root = path.resolve(root)
  }

  describe() {
    return this.root
  }

  private resolve(key: string) {
    const p = path.resolve(this.root, key)
    if (!p.startsWith(this.root + path.sep)) throw new Error('Clé de stockage invalide')
    return p
  }

  async init() {
    await mkdir(this.root, { recursive: true })
    await access(this.root, fs.constants.W_OK)
  }

  async write(key: string, source: Readable) {
    const target = this.resolve(key)
    await mkdir(path.dirname(target), { recursive: true })
    const tmp = `${target}.part`
    try {
      await pipeline(source, fs.createWriteStream(tmp, { flags: 'w' }))
      await rename(tmp, target)
      return (await stat(target)).size
    } catch (err) {
      await rm(tmp, { force: true })
      throw err
    }
  }

  read(key: string, range?: { start: number; end: number }) {
    return fs.createReadStream(this.resolve(key), range)
  }

  async remove(key: string) {
    await rm(this.resolve(key), { force: true })
  }

  async capacity() {
    const s = await statfs(this.root)
    return { totalBytes: s.blocks * s.bsize, freeBytes: s.bavail * s.bsize }
  }
}

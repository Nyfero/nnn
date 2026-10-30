import type { Readable } from 'node:stream'

// Un backend stocke des blobs anonymes (clé -> octets). Les noms, dossiers et droits
// vivent en base : changer de disque ne touche donc jamais à l'arborescence.
// Pour ajouter un type de stockage (S3, SMB...), implémenter cette interface et
// l'enregistrer dans storage/index.ts.
export interface StorageBackend {
  readonly name: string
  describe(): string
  init(): Promise<void>
  /** Écrit le flux (de façon atomique) et renvoie le nombre d'octets réellement écrits. */
  write(key: string, source: Readable): Promise<number>
  /** Lit le blob, éventuellement une plage d'octets (bornes incluses). */
  read(key: string, range?: { start: number; end: number }): Readable
  remove(key: string): Promise<void>
  /** Capacité du support sous-jacent, ou null si inconnue (stockage objet...). */
  capacity(): Promise<{ totalBytes: number; freeBytes: number } | null>
}

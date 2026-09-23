/**
 * Reading a set of files out of a `.tar.gz`.
 *
 * A publisher that cuts a release can attach exactly the bytes a consumer needs, and one
 * download of an archive beats a file-by-file walk of the same revision: fewer round trips,
 * and no way to see two files from two different builds. The archive is served as a
 * `FileSource`, so nothing downstream knows it was ever an archive.
 */

import { type FileSource, withJson } from "./files"

const BLOCK = 512
const decoder = new TextDecoder()

function readString(bytes: Uint8Array, offset: number, length: number): string {
  const field = bytes.subarray(offset, offset + length)
  const end = field.indexOf(0)
  return decoder.decode(end === -1 ? field : field.subarray(0, end))
}

function readOctal(bytes: Uint8Array, offset: number, length: number): number {
  const text = readString(bytes, offset, length).trim()
  const value = text ? Number.parseInt(text, 8) : 0
  return Number.isFinite(value) && value >= 0 ? value : 0
}

/**
 * Every regular file in a tar archive, by path.
 *
 * Only what a `tar czf` of a few directories produces is honoured: regular files, ustar's
 * split `prefix`/`name` for a long path, and GNU's `L` entry for a longer one. Directories,
 * links and PAX metadata records are skipped rather than reported — a consumer asks for the
 * paths it already knows from the manifest, and anything else in the archive is not its
 * business.
 */
export function readTar(bytes: Uint8Array): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>()
  let offset = 0
  let longName: string | null = null
  while (offset + BLOCK <= bytes.length) {
    const name = readString(bytes, offset, 100)
    // Two zero-filled blocks end an archive; one is enough to stop reading.
    if (name === "" && readOctal(bytes, offset + 124, 12) === 0) break
    const size = readOctal(bytes, offset + 124, 12)
    const type = String.fromCharCode(bytes[offset + 156] ?? 0)
    const prefix = readString(bytes, offset + 345, 155)
    const data = bytes.subarray(offset + BLOCK, offset + BLOCK + size)
    offset += BLOCK + Math.ceil(size / BLOCK) * BLOCK
    if (type === "L") {
      longName = decoder.decode(data).replace(/\0+$/, "")
      continue
    }
    const path = longName ?? (prefix ? `${prefix}/${name}` : name)
    longName = null
    if (type === "0" || type === "\0") files.set(path, data)
  }
  return files
}

/**
 * gzip, through Node's own inflater — no dependency. Loaded lazily, the way `localFileSource`
 * loads `node:fs`, so importing this module stays harmless wherever it is only referenced.
 */
export async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const { gunzipSync } = await import("node:zlib")
  return new Uint8Array(gunzipSync(bytes))
}

/** A `FileSource` over an archive already in memory. */
export function tarFileSource(label: string, entries: Map<string, Uint8Array>): FileSource {
  const describe = (): string => label
  return withJson({
    describe,
    async read(path) {
      const bytes = entries.get(path)
      if (!bytes) {
        throw new Error(`${describe()} ${path}: not in the archive (${entries.size} files)`)
      }
      return decoder.decode(bytes)
    },
  })
}

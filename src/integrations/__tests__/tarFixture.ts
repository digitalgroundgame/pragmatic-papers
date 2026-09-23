import { gzipSync } from "node:zlib"

/**
 * A tar archive built by hand, so a test can serve the same bytes a release asset does
 * without shelling out to `tar`.
 */

const BLOCK = 512
const enc = new TextEncoder()

export interface TarEntryOptions {
  /** ustar type flag: "0" regular, "5" directory, "L" GNU long name, "x" PAX record. */
  type?: string
  /** ustar's `prefix` field, which carries the leading directories of a long path. */
  prefix?: string
}

/** One header block plus its payload, padded to the block size. */
export function tarEntry(
  name: string,
  body: string,
  { type = "0", prefix = "" }: TarEntryOptions = {},
): Uint8Array {
  const data = enc.encode(body)
  const out = new Uint8Array(BLOCK + Math.ceil(data.length / BLOCK) * BLOCK)
  out.set(enc.encode(name), 0)
  out.set(enc.encode(data.length.toString(8).padStart(11, "0")), 124)
  out.set(enc.encode(type), 156)
  out.set(enc.encode("ustar\0" + "00"), 257)
  if (prefix) out.set(enc.encode(prefix), 345)
  out.set(data, BLOCK)
  return out
}

/** The entries, then the two zero-filled blocks that close an archive. */
export function tarArchive(...parts: Uint8Array[]): Uint8Array {
  const all = [...parts, new Uint8Array(BLOCK * 2)]
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const part of all) {
    out.set(part, at)
    at += part.length
  }
  return out
}

/**
 * `{ path: contents }` as a gzipped tar, the shape a release asset arrives in. Returned as an
 * `ArrayBuffer`, which is what a `Response` body takes.
 */
export function tarGz(files: Record<string, string | object>): ArrayBuffer {
  const entries = Object.entries(files).map(([path, body]) =>
    tarEntry(path, typeof body === "string" ? body : JSON.stringify(body)),
  )
  const gz = gzipSync(Buffer.from(tarArchive(...entries)))
  return gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength) as ArrayBuffer
}

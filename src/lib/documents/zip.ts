type ZipEntryInput = {
  name: string
  data: Uint8Array | Buffer | string
}

const encoder = new TextEncoder()

function toBytes(data: Uint8Array | Buffer | string): Uint8Array {
  if (typeof data === 'string') return encoder.encode(data)
  if (data instanceof Uint8Array) return data
  return new Uint8Array(data)
}

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) {
    const idx = (crc ^ bytes[i]) & 0xff
    crc = (crc >>> 8) ^ crcTable[idx]
  }
  return (crc ^ 0xffffffff) >>> 0
}

function writeUint16LE(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
}

function writeUint32LE(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true)
}

export function buildZip(entries: ZipEntryInput[]): Uint8Array {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let localOffset = 0

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const fileBytes = toBytes(entry.data)
    const crc = crc32(fileBytes)

    const localHeader = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(localHeader.buffer)
    writeUint32LE(localView, 0, 0x04034b50)
    writeUint16LE(localView, 4, 20)
    writeUint16LE(localView, 6, 0)
    writeUint16LE(localView, 8, 0)
    writeUint16LE(localView, 10, 0)
    writeUint16LE(localView, 12, 0)
    writeUint32LE(localView, 14, crc)
    writeUint32LE(localView, 18, fileBytes.length)
    writeUint32LE(localView, 22, fileBytes.length)
    writeUint16LE(localView, 26, nameBytes.length)
    writeUint16LE(localView, 28, 0)
    localHeader.set(nameBytes, 30)

    localParts.push(localHeader, fileBytes)

    const centralHeader = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(centralHeader.buffer)
    writeUint32LE(centralView, 0, 0x02014b50)
    writeUint16LE(centralView, 4, 20)
    writeUint16LE(centralView, 6, 20)
    writeUint16LE(centralView, 8, 0)
    writeUint16LE(centralView, 10, 0)
    writeUint16LE(centralView, 12, 0)
    writeUint16LE(centralView, 14, 0)
    writeUint32LE(centralView, 16, crc)
    writeUint32LE(centralView, 20, fileBytes.length)
    writeUint32LE(centralView, 24, fileBytes.length)
    writeUint16LE(centralView, 28, nameBytes.length)
    writeUint16LE(centralView, 30, 0)
    writeUint16LE(centralView, 32, 0)
    writeUint16LE(centralView, 34, 0)
    writeUint16LE(centralView, 36, 0)
    writeUint32LE(centralView, 38, 0)
    writeUint32LE(centralView, 42, localOffset)
    centralHeader.set(nameBytes, 46)
    centralParts.push(centralHeader)

    localOffset += localHeader.length + fileBytes.length
  }

  const centralSize = centralParts.reduce((acc, part) => acc + part.length, 0)
  const endRecord = new Uint8Array(22)
  const endView = new DataView(endRecord.buffer)
  writeUint32LE(endView, 0, 0x06054b50)
  writeUint16LE(endView, 4, 0)
  writeUint16LE(endView, 6, 0)
  writeUint16LE(endView, 8, entries.length)
  writeUint16LE(endView, 10, entries.length)
  writeUint32LE(endView, 12, centralSize)
  writeUint32LE(endView, 16, localOffset)
  writeUint16LE(endView, 20, 0)

  const totalSize =
    localParts.reduce((acc, part) => acc + part.length, 0) +
    centralSize +
    endRecord.length
  const output = new Uint8Array(totalSize)

  let cursor = 0
  for (const part of localParts) {
    output.set(part, cursor)
    cursor += part.length
  }
  for (const part of centralParts) {
    output.set(part, cursor)
    cursor += part.length
  }
  output.set(endRecord, cursor)

  return output
}

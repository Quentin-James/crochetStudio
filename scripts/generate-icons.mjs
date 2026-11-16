/**
 * Generates the PWA icons.
 *
 * Written by hand with zlib rather than pulling in an image library: the mark is
 * a handful of circles and strokes, it must match the studio palette exactly,
 * and iOS needs real PNGs (an SVG icon is not accepted for the Home Screen).
 *
 * Run with `npm run icons`. The output is committed, so a normal build needs
 * nothing from this script.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public')
/** Tauri reads its window and installer icons from here. */
const TAURI_ICON_DIR = join(ROOT, 'src-tauri', 'icons')

/* ---- palette (same values as design/tokens.css) ------------------------- */
const CREAM = [0xf1, 0xe8, 0xdc]
const PINK = [0xd9, 0xb6, 0xb0]
const PINK_DEEP = [0xc4, 0x9b, 0x94]
const BROWN = [0x8b, 0x74, 0x64]

/* ---- tiny PNG writer ---------------------------------------------------- */

const crcTable = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

/** `pixels` is RGBA, row-major, 4 bytes per pixel. */
function encodePng(width, height, pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // RGBA
  header[10] = 0 // deflate
  header[11] = 0 // adaptive filtering
  header[12] = 0 // no interlace

  // Each scanline is prefixed with its filter type; 0 means "no filter".
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1)
    raw[rowStart] = 0
    pixels.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ---- drawing ------------------------------------------------------------ */

/** Smooth 0→1 edge, so shapes are anti-aliased instead of jagged. */
const coverage = (distance, feather = 1.2) =>
  Math.min(1, Math.max(0, 0.5 - distance / feather))

/** Distance from a point to a line segment, for the strands and the hook. */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby || 1)),
  )
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t))
}

/**
 * Draws the studio mark: a ball of yarn with a hook resting against it.
 * `inset` shrinks the motif for the maskable variant's safe zone.
 */
function drawIcon(size, inset = 0) {
  const pixels = Buffer.alloc(size * size * 4)
  const scale = size / 48
  const centre = size / 2

  // Motif geometry in the 48×48 space the BrandMark component uses.
  const motif = (value) => (value - 24) * (1 - inset) * scale + centre
  const stroke = (value) => value * (1 - inset) * scale

  const ballX = motif(21)
  const ballY = motif(26)
  const ballR = stroke(15)

  const strands = [
    [9.2, 20.2, 32.8, 36.4],
    [12.8, 15.2, 35, 31],
    [7.2, 26.6, 24.6, 40],
    [18, 11.4, 34.6, 24.6],
  ]

  const put = (index, colour, alpha) => {
    if (alpha <= 0) return
    const inverse = 1 - alpha
    pixels[index] = Math.round(pixels[index] * inverse + colour[0] * alpha)
    pixels[index + 1] = Math.round(pixels[index + 1] * inverse + colour[1] * alpha)
    pixels[index + 2] = Math.round(pixels[index + 2] * inverse + colour[2] * alpha)
    pixels[index + 3] = Math.round(pixels[index + 3] * inverse + 255 * alpha)
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4
      const px = x + 0.5
      const py = y + 0.5

      // Background, full bleed.
      put(index, CREAM, 1)

      // The ball.
      const ball = coverage(Math.hypot(px - ballX, py - ballY) - ballR, scale * 1.2)
      put(index, PINK, ball)

      // Strands, clipped to the ball so they wrap it.
      if (ball > 0.5) {
        for (const [ax, ay, bx, by] of strands) {
          const d = distanceToSegment(px, py, motif(ax), motif(ay), motif(bx), motif(by))
          put(index, PINK_DEEP, coverage(d - stroke(0.55), scale * 1.1) * 0.85)
        }
      }

      // The hook: a shaft with a small curved head.
      const shaft = distanceToSegment(px, py, motif(33), motif(10), motif(33), motif(22.5))
      const head = Math.abs(Math.hypot(px - motif(30.2), py - motif(23.6)) - stroke(3.2))
      const headVisible = py > motif(21) && px < motif(33.5)
      put(index, BROWN, coverage(shaft - stroke(1.1), scale * 1.1))
      if (headVisible) {
        put(index, BROWN, coverage(head - stroke(1.1), scale * 1.1))
      }
    }
  }

  return pixels
}

/* ---- output ------------------------------------------------------------- */

mkdirSync(OUT_DIR, { recursive: true })

const outputs = [
  { file: 'icon-192.png', size: 192, inset: 0 },
  { file: 'icon-512.png', size: 512, inset: 0 },
  // Maskable icons are cropped by the platform, so the motif keeps clear of the edge.
  { file: 'icon-512-maskable.png', size: 512, inset: 0.22 },
  // iOS applies its own rounding and ignores transparency.
  { file: 'apple-touch-icon.png', size: 180, inset: 0.06 },
]

for (const { file, size, inset } of outputs) {
  const png = encodePng(size, size, drawIcon(size, inset))
  writeFileSync(join(OUT_DIR, file), png)
  console.log(`public/${file} — ${size}×${size}, ${(png.length / 1024).toFixed(1)} kB`)
}

/* ---- Tauri desktop icons ------------------------------------------------ */

mkdirSync(TAURI_ICON_DIR, { recursive: true })

const tauriSizes = [
  { file: '32x32.png', size: 32 },
  { file: '128x128.png', size: 128 },
  { file: '128x128@2x.png', size: 256 },
  { file: 'icon.png', size: 512 },
]

for (const { file, size } of tauriSizes) {
  const png = encodePng(size, size, drawIcon(size, 0))
  writeFileSync(join(TAURI_ICON_DIR, file), png)
  console.log(`src-tauri/icons/${file} — ${size}×${size}`)
}

/**
 * Windows wants a single .ico holding several sizes.
 *
 * Since Vista an ICO entry may be a whole PNG rather than a raw bitmap, so the
 * file is just a small directory followed by the PNGs we already know how to
 * make. A 256-pixel entry records its width as 0, which is how the format says
 * "256".
 */
function encodeIco(sizes) {
  const images = sizes.map((size) => encodePng(size, size, drawIcon(size, 0)))

  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // 1 = icon
  header.writeUInt16LE(sizes.length, 4)

  const directory = Buffer.alloc(16 * sizes.length)
  let offset = header.length + directory.length

  sizes.forEach((size, index) => {
    const entry = index * 16
    const image = images[index]
    directory[entry] = size >= 256 ? 0 : size
    directory[entry + 1] = size >= 256 ? 0 : size
    directory[entry + 2] = 0 // palette colours
    directory[entry + 3] = 0 // reserved
    directory.writeUInt16LE(1, entry + 4) // colour planes
    directory.writeUInt16LE(32, entry + 6) // bits per pixel
    directory.writeUInt32LE(image.length, entry + 8)
    directory.writeUInt32LE(offset, entry + 12)
    offset += image.length
  })

  return Buffer.concat([header, directory, ...images])
}

const ico = encodeIco([16, 32, 48, 64, 128, 256])
writeFileSync(join(TAURI_ICON_DIR, 'icon.ico'), ico)
console.log(`src-tauri/icons/icon.ico — 6 tailles, ${(ico.length / 1024).toFixed(1)} kB`)

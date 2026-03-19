/**
 * Replace <text> elements in SVG with <path> so sharp/librsvg renders text without system fonts.
 * Uses opentype.js and a bundled font (lib/fonts/NotoSans-Regular.ttf) to avoid CDN 403 in serverless.
 */

import path from 'path'
import fs from 'fs'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const opentype = require('opentype.js') as { parse: (buf: ArrayBuffer) => { getPath: (text: string, x: number, y: number, fontSize: number) => { getBoundingBox: () => { x1: number; y1: number; x2: number; y2: number }; toPathData: (n?: number) => string } } }

const FONT_URL =
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosans/NotoSans-Regular.ttf'

const FONT_FILENAME = 'NotoSans-Regular.ttf'

/** Paths to try for bundled font (public/ is always deployed by Next.js). */
function getBundledFontPaths(): string[] {
  const cwd = process.cwd()
  return [
    path.join(cwd, 'public', 'fonts', FONT_FILENAME),
    path.join(cwd, 'lib', 'fonts', FONT_FILENAME),
  ]
}

/** TrueType/OTF magic bytes. opentype.js accepts TTF (0x00010000 or 'true') and OTF ('OTTO'). */
function isValidFontBuffer(ab: ArrayBuffer): boolean {
  if (ab.byteLength < 4) return false
  const v = new DataView(ab)
  const sig = v.getUint32(0, false)
  if (sig === 0x00010000) return true // TrueType
  if (sig === 0x74727565) return true // 'true'
  if (v.getUint32(0, true) === 0x4f54544f) return true // 'OTTO' (OTF) little-endian
  return false
}

/** Copy Buffer to a new ArrayBuffer so opentype gets exact bytes (avoids shared-pool issues). */
function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  const ab = new ArrayBuffer(buf.length)
  new Uint8Array(ab).set(buf)
  return ab
}

let fontCache: ReturnType<typeof opentype.parse> | null = null

async function loadFont() {
  if (fontCache) return fontCache

  for (const fontPath of getBundledFontPaths()) {
    if (fs.existsSync(fontPath)) {
      const buf = fs.readFileSync(fontPath)
      const ab = bufferToArrayBuffer(buf)
      if (!isValidFontBuffer(ab)) {
        console.warn('[text-to-path] Bundled file is not a valid TTF/OTF:', fontPath)
        continue
      }
      const font = opentype.parse(ab)
      fontCache = font
      console.info('[text-to-path] Loaded font from', fontPath)
      return font
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(FONT_URL, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Next.js)' },
    })
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`)
    const arrayBuffer = await res.arrayBuffer()
    if (!isValidFontBuffer(arrayBuffer)) {
      throw new Error('Font URL returned non-font data (e.g. HTML). Use bundled font in public/fonts or lib/fonts.')
    }
    const font = opentype.parse(arrayBuffer)
    fontCache = font
    return font
  } catch (e) {
    clearTimeout(timeout)
    throw e
  }
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function getAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`${name}=["']([^"']*)["']`, 'i')
  const m = attrs.match(re)
  return m ? m[1].trim() : null
}

/**
 * Replace all <text> elements in the SVG with <g><path></g> using the loaded font.
 * Preserves fill and position (x, y, text-anchor, font-size).
 */
export async function replaceTextWithPaths(svgString: string): Promise<string> {
  // If there is no SVG text to replace, avoid loading the font entirely.
  if (!/<text\b/i.test(svgString)) return svgString

  const font = await loadFont()
  const textRegex = /<text([^>]*)>([\s\S]*?)<\/text>/g
  let out = svgString
  let match
  while ((match = textRegex.exec(svgString)) !== null) {
    const attrs = match[1]
    const content = decodeXmlEntities(match[2].trim())
    if (!content) continue
    const x = parseFloat(getAttr(attrs, 'x') ?? '0')
    const y = parseFloat(getAttr(attrs, 'y') ?? '0')
    const fill = getAttr(attrs, 'fill') ?? '#ffffff'
    const fontSize = parseFloat(getAttr(attrs, 'font-size') ?? '24')
    const textAnchor = getAttr(attrs, 'text-anchor') ?? 'start'

    const path = font.getPath(content, 0, 0, fontSize)
    const bbox = path.getBoundingBox()
    const pathData = path.toPathData(2)
    const cy = (bbox.y1 + bbox.y2) / 2
    let ox: number
    if (textAnchor === 'middle') ox = (bbox.x1 + bbox.x2) / 2
    else if (textAnchor === 'end') ox = bbox.x2
    else ox = bbox.x1
    const fillEsc = fill.replace(/"/g, '&quot;')
    const replacement = `<g transform="translate(${x},${y}) scale(1,-1) translate(${-ox},${-cy})"><path d="${pathData}" fill="${fillEsc}"/></g>`
    out = out.replace(match[0], replacement)
  }
  return out
}

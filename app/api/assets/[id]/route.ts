import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { getAsset } from '@/lib/automation'

const STORY_WIDTH = 1080
const STORY_HEIGHT = 1920
const SVG_PNG_DENSITY = 144

interface RouteContext {
  params: {
    id: string
  }
}

/** Replace embedded data:image/svg+xml in SVG with data:image/png;base64 so sharp/librsvg can render them. */
async function inlineEmbeddedSvgAsPng(svgBuffer: Buffer): Promise<Buffer> {
  const str = svgBuffer.toString('utf8')
  let out = str

  const base64Regex = /href="(data:image\/svg\+xml;base64,)([^"]+)"/g
  for (const match of [...str.matchAll(base64Regex)]) {
    const decoded = Buffer.from(match[2], 'base64')
    const png = await sharp(decoded).png().toBuffer()
    out = out.replace(match[0], `href="data:image/png;base64,${png.toString('base64')}"`)
  }

  const utf8Regex = /href="(data:image\/svg\+xml;utf8,)([^"]+)"/g
  for (const match of [...out.matchAll(utf8Regex)]) {
    const decoded = Buffer.from(decodeURIComponent(match[2]), 'utf8')
    const png = await sharp(decoded).png().toBuffer()
    out = out.replace(match[0], `href="data:image/png;base64,${png.toString('base64')}"`)
  }

  return out === str ? svgBuffer : Buffer.from(out, 'utf8')
}

export async function GET(request: Request, { params }: RouteContext) {
  const id = Number(params.id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Invalid asset id' }, { status: 400 })
  }

  const asset = await getAsset(id)
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }

  const rawBody =
    asset.content_encoding === 'base64'
      ? Buffer.from(asset.content, 'base64')
      : Buffer.from(asset.content, 'utf8')

  const formatPng = new URL(request.url).searchParams.get('format') === 'png'
  const isSvg = asset.mime_type === 'image/svg+xml'

  if (formatPng && isSvg) {
    try {
      const svgForSharp = await inlineEmbeddedSvgAsPng(rawBody)
      const pngBuffer = await sharp(svgForSharp, { density: SVG_PNG_DENSITY })
        .resize(STORY_WIDTH, STORY_HEIGHT)
        .png()
        .toBuffer()
      return new NextResponse(new Uint8Array(pngBuffer), {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-store',
        },
      })
    } catch (e) {
      console.error('[assets] SVG to PNG conversion failed:', e)
      return NextResponse.json({ error: 'Conversion failed' }, { status: 500 })
    }
  }

  return new NextResponse(new Uint8Array(rawBody), {
    headers: {
      'Content-Type': asset.mime_type,
      'Cache-Control': 'no-store',
    },
  })
}

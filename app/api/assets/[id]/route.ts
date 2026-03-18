import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { getAsset, getCardSvgForPublish } from '@/lib/automation'
import { replaceTextWithPaths } from '@/lib/text-to-path'

const STORY_WIDTH = 1080
const STORY_HEIGHT = 1920
const SVG_PNG_DENSITY = 192

interface RouteContext {
  params: {
    id: string
  }
}

/** Replace embedded data:image/* in SVG with data:image/png;base64 so sharp/librsvg renders them. */
async function inlineEmbeddedImagesAsPng(svgBuffer: Buffer): Promise<Buffer> {
  const str = svgBuffer.toString('utf8')
  let out = str
  const attrs = ['href', 'xlink:href']
  for (const attr of attrs) {
    const dataUriRegex = new RegExp(
      `${attr.replace(':', '\\:')}="(data:image/([^;]+);(base64|utf8),)([^"]+)"`,
      'g'
    )
    const matches = Array.from(out.matchAll(dataUriRegex))
    for (const match of matches) {
      const mime = match[2]
      const enc = match[3]
      const payload = match[4]
      let input: Buffer
      if (enc === 'base64') {
        input = Buffer.from(payload, 'base64')
      } else {
        try {
          input = Buffer.from(decodeURIComponent(payload), 'utf8')
        } catch {
          continue
        }
      }
      let png: Buffer
      try {
        png = await sharp(input).png().toBuffer()
      } catch {
        continue
      }
      const replacement = `${attr}="data:image/png;base64,${png.toString('base64')}"`
      out = out.replace(match[0], replacement)
    }
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
      const cardSvg =
        asset.asset_type === 'card'
          ? await getCardSvgForPublish(id)
          : null
      let svgBuffer = cardSvg ?? rawBody
      if (asset.asset_type === 'card') {
        const svgStr = svgBuffer.toString('utf8')
        const svgWithPaths = await replaceTextWithPaths(svgStr)
        svgBuffer = Buffer.from(svgWithPaths, 'utf8')
      }
      const svgForSharp = await inlineEmbeddedImagesAsPng(svgBuffer)
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

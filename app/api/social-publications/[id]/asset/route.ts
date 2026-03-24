import sharp from 'sharp'
import { NextResponse } from 'next/server'
import { getSocialPublicationSvg } from '@/lib/social-publications'
import { replaceTextWithPaths } from '@/lib/text-to-path'

const FEED_IMAGE_SIZE = 1200

async function inlineEmbeddedImagesAsPng(svg: string): Promise<Buffer> {
  let output = svg
  const attrs = ['href', 'xlink:href']

  for (const attr of attrs) {
    const pattern = new RegExp(
      `${attr.replace(':', '\\:')}="(data:image/([^;]+);(base64|utf8),)([^"]+)"`,
      'g'
    )
    const matches = Array.from(output.matchAll(pattern))

    for (const match of matches) {
      const encoding = match[3]
      const payload = match[4]
      let input: Buffer

      if (encoding === 'base64') {
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

      output = output.replace(match[0], `${attr}="data:image/png;base64,${png.toString('base64')}"`)
    }
  }

  return Buffer.from(output, 'utf8')
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid social publication id' }, { status: 400 })
  }

  const svg = await getSocialPublicationSvg(id)
  if (!svg) {
    return NextResponse.json({ error: 'Social publication image not found' }, { status: 404 })
  }

  const format = new URL(request.url).searchParams.get('format')
  if (format === 'png') {
    let preparedSvg = svg
    try {
      preparedSvg = await replaceTextWithPaths(svg)
    } catch (error) {
      console.warn('[social-publications] Text-to-path failed, continuing with raw SVG:', error)
    }

    const svgBuffer = await inlineEmbeddedImagesAsPng(preparedSvg)
    const png = await sharp(svgBuffer)
      .resize(FEED_IMAGE_SIZE, FEED_IMAGE_SIZE)
      .png()
      .toBuffer()

    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300',
      },
    })
  }

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}

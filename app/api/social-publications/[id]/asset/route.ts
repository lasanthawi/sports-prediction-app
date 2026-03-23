import sharp from 'sharp'
import { NextResponse } from 'next/server'
import { getSocialPublicationSvg } from '@/lib/social-publications'

const FEED_IMAGE_SIZE = 1200

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
    const png = await sharp(Buffer.from(svg, 'utf8'))
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

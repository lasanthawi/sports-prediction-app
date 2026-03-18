import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { getAsset } from '@/lib/automation'

interface RouteContext {
  params: {
    id: string
  }
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
      const pngBuffer = await sharp(rawBody)
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

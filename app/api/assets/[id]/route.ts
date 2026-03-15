import { NextResponse } from 'next/server'
import { getAsset } from '@/lib/automation'

interface RouteContext {
  params: {
    id: string
  }
}

export async function GET(_: Request, { params }: RouteContext) {
  const id = Number(params.id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Invalid asset id' }, { status: 400 })
  }

  const asset = await getAsset(id)
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }

  const body =
    asset.content_encoding === 'base64'
      ? Buffer.from(asset.content, 'base64')
      : asset.content

  return new NextResponse(body, {
    headers: {
      'Content-Type': asset.mime_type,
      'Cache-Control': 'no-store',
    },
  })
}

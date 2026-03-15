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

  return new NextResponse(asset.content, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

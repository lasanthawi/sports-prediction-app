import { NextResponse } from 'next/server'
import { generateAssetsForMatches, publishMatchAssets } from '@/lib/automation'
import { dismissFeedQueueItem, importFeedQueueItem } from '@/lib/feed'

interface RouteContext {
  params: {
    id: string
  }
}

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const id = Number(params.id)
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: 'Invalid feed queue id' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({})) as { action?: 'import' | 'generate' | 'publish' | 'dismiss' }
    const action = body.action || 'import'

    if (action === 'dismiss') {
      const dismissed = await dismissFeedQueueItem(id)
      if (!dismissed) {
        return NextResponse.json({ error: 'Feed item not found' }, { status: 404 })
      }

      return NextResponse.json({ success: true, action, item: dismissed })
    }

    const match = await importFeedQueueItem(id)
    if (!match) {
      return NextResponse.json({ error: 'Feed item not found' }, { status: 404 })
    }

    let generated = null
    let published = null

    if (action === 'generate' || action === 'publish') {
      generated = await generateAssetsForMatches([match])
    }

    if (action === 'publish') {
      published = await publishMatchAssets(match.id)
    }

    return NextResponse.json({ success: true, action, match, generated, published })
  } catch (error: any) {
    console.error('Feed queue action error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

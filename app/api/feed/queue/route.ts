import { NextResponse } from 'next/server'
import { listFeedQueue } from '@/lib/feed'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const items = await listFeedQueue()
    return NextResponse.json({ items })
  } catch (error: any) {
    console.error('Feed queue load error:', error)
    return NextResponse.json({ error: error.message, items: [] }, { status: 500 })
  }
}

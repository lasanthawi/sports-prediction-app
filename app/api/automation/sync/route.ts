import { NextResponse } from 'next/server'
import { syncMatchesFromFeed } from '@/lib/automation'

export async function POST() {
  try {
    const result = await syncMatchesFromFeed()
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Sync automation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

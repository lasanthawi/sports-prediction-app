import { NextResponse } from 'next/server'
import { syncMatchesFromFeed } from '@/lib/automation'

async function handleSync() {
  try {
    const result = await syncMatchesFromFeed()
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Sync automation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  return handleSync()
}

export async function POST() {
  return handleSync()
}

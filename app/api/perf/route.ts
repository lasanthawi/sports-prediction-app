import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    await request.json()
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Perf] Failed to record metric:', error)
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}

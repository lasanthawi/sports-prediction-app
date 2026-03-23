import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    console.info('[Perf]', payload)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Perf] Failed to record metric:', error)
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}

import { NextResponse } from 'next/server'
import { runAutomationPipeline } from '@/lib/automation'

/**
 * Hourly automation: sync feed, refresh statuses (upcoming→live, live→finished),
 * import one queued match (earliest first), generate assets, publish.
 * Call via Vercel Cron or external scheduler.
 * Optional: set CRON_SECRET and send Authorization: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET>
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const querySecret = new URL(request.url).searchParams.get('secret')
    if (token !== cronSecret && querySecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const result = await runAutomationPipeline()
    return NextResponse.json({ ok: true, ...result })
  } catch (error: any) {
    console.error('Hourly automation error:', error)
    return NextResponse.json({ error: error.message, ok: false }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return GET(request)
}

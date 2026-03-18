import { NextResponse } from 'next/server'
import { runUnpublishedQueuePipeline } from '@/lib/automation'

function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret?.trim()) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret.trim()}`
}

/** GET: invoked by Vercel Cron hourly. Requires Authorization: Bearer CRON_SECRET. */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        hint: process.env.CRON_SECRET
          ? 'Use header: Authorization: Bearer <your CRON_SECRET>'
          : 'Add CRON_SECRET in Vercel → Project → Settings → Environment Variables, then redeploy.',
      },
      { status: 401 }
    )
  }
  try {
    const result = await runUnpublishedQueuePipeline()
    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Unpublished queue automation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unpublished queue failed' },
      { status: 500 }
    )
  }
}

/** POST: manual trigger (e.g. from admin). Same auth as GET. */
export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        hint: process.env.CRON_SECRET
          ? 'Use header: Authorization: Bearer <your CRON_SECRET>'
          : 'Add CRON_SECRET in Vercel → Project → Settings → Environment Variables, then redeploy.',
      },
      { status: 401 }
    )
  }
  try {
    const result = await runUnpublishedQueuePipeline()
    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Unpublished queue automation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unpublished queue failed' },
      { status: 500 }
    )
  }
}

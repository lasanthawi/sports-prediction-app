import { NextResponse } from 'next/server'
import { runUnpublishedQueuePipeline } from '@/lib/automation'

export async function handleUnpublishedCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        hint: secret
          ? 'Use header: Authorization: Bearer <your CRON_SECRET>'
          : 'Add CRON_SECRET in Vercel → Settings → Environment Variables, then redeploy.',
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

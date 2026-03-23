import { NextResponse } from 'next/server'
import { runUnpublishedQueuePipeline } from '@/lib/automation'
import { requireCronAuth } from '@/lib/cron-auth'

export async function handleUnpublishedCron(request: Request) {
  const unauthorized = requireCronAuth(request)
  if (unauthorized) return unauthorized

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

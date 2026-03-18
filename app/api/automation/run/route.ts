import { NextResponse } from 'next/server'
import { runAutomationPipeline } from '@/lib/automation'
import { handleUnpublishedCron } from '@/lib/unpublished-cron-handler'

export async function POST(request: Request) {
  try {
    let body: { job?: string } = {}
    try {
      body = await request.json()
    } catch {
      /* empty body */
    }
    if (body.job === 'unpublished-queue') {
      return handleUnpublishedCron(request)
    }
    const result = await runAutomationPipeline()
    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Automation pipeline error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pipeline failed' },
      { status: 500 }
    )
  }
}

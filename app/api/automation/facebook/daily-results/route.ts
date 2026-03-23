import { NextResponse } from 'next/server'
import { runDailyResultsFacebookPost } from '@/lib/automation'
import { requireCronAuth } from '@/lib/cron-auth'

async function handleRequest(request: Request) {
  const unauthorized = requireCronAuth(request)
  if (unauthorized) return unauthorized

  try {
    const result = await runDailyResultsFacebookPost()
    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Daily Facebook results post error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Daily Facebook results post failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return handleRequest(request)
}

export async function POST(request: Request) {
  return handleRequest(request)
}

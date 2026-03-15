import { NextResponse } from 'next/server'
import { listAutomationRuns } from '@/lib/automation'

export async function GET() {
  try {
    const runs = await listAutomationRuns()
    return NextResponse.json({ runs })
  } catch (error: any) {
    console.error('Automation run list error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

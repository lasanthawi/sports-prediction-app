import { NextResponse } from 'next/server'
import { runAutomationPipeline } from '@/lib/automation'

export async function POST() {
  try {
    const result = await runAutomationPipeline()
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Automation pipeline error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

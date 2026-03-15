import { NextResponse } from 'next/server'
import { publishReadyAssets } from '@/lib/automation'

export async function POST() {
  try {
    const result = await publishReadyAssets()
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Publish automation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

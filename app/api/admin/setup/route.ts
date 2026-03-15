import { NextResponse } from 'next/server'
import { ensureSchema } from '@/lib/db'

export async function POST() {
  try {
    await ensureSchema()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Schema setup error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

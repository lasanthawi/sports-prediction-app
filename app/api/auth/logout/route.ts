import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { cookies } from 'next/headers'
import { ensureSchema } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    await ensureSchema()
    const cookieStore = cookies()
    const sessionToken = cookieStore.get('session')?.value
    
    if (sessionToken) {
      await sql`DELETE FROM sessions WHERE session_token = ${sessionToken}`
    }
    
    const response = NextResponse.json({ success: true })
    response.cookies.delete({ name: 'session', path: '/' })
    
    return response
  } catch (error) {
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}

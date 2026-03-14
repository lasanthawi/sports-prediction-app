import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { cookies } from 'next/headers'

export async function POST() {
  try {
    const cookieStore = cookies()
    const sessionToken = cookieStore.get('session')?.value
    
    if (sessionToken) {
      await sql`DELETE FROM sessions WHERE session_token = ${sessionToken}`
    }
    
    const response = NextResponse.json({ success: true })
    response.cookies.delete('session')
    
    return response
  } catch (error) {
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
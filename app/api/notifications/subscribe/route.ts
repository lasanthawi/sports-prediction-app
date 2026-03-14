import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { matchId } = await request.json()
    const cookieStore = cookies()
    const sessionToken = cookieStore.get('session')?.value
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    // Get user from session
    const { rows: userRows } = await sql`
      SELECT u.id, u.email FROM users u
      JOIN sessions s ON u.id = s.user_id
      WHERE s.session_token = ${sessionToken}
    `
    
    if (!userRows.length) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }
    
    const user = userRows[0]
    
    // Subscribe to match notifications
    await sql`
      INSERT INTO notifications (email, match_id, notified)
      VALUES (${user.email}, ${matchId}, false)
      ON CONFLICT (email, match_id) DO NOTHING
    `
    
    return NextResponse.json({ success: true, message: 'Subscribed to notifications' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = cookies()
    const sessionToken = cookieStore.get('session')?.value
    
    if (!sessionToken) {
      return NextResponse.json({ user: null })
    }
    
    const { rows } = await sql`
      SELECT u.id, u.email, u.name, u.role, u.points, u.predictions_count, u.correct_predictions
      FROM users u
      JOIN sessions s ON u.id = s.user_id
      WHERE s.session_token = ${sessionToken}
      AND s.expires_at > NOW()
    `
    
    if (rows.length === 0) {
      return NextResponse.json({ user: null })
    }
    
    return NextResponse.json({ user: rows[0] })
  } catch (error) {
    return NextResponse.json({ user: null })
  }
}
import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { createHash } from 'crypto'
import { ensureSchema } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    await ensureSchema()
    const { email, password } = await request.json()
    
    // Hash password
    const passwordHash = createHash('sha256').update(password).digest('hex')
    
    // Check credentials
    const { rows } = await sql`
      SELECT id, email, name, role, points, predictions_count, correct_predictions
      FROM users 
      WHERE email = ${email} AND password_hash = ${passwordHash}
    `
    
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    
    const user = rows[0]
    
    // Create session token
    const sessionToken = createHash('sha256')
      .update(`${user.id}-${Date.now()}-${Math.random()}`)
      .digest('hex')
    
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    
    await sql`
      INSERT INTO sessions (user_id, session_token, expires_at)
      VALUES (${user.id}, ${sessionToken}, ${expiresAt.toISOString()})
    `
    
    const response = NextResponse.json({ 
      user,
      sessionToken 
    })
    
    // Set cookie
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt
    })
    
    return response
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sql } from '@vercel/postgres'
import { ensureSchema } from '@/lib/db'
import { refreshDerivedMatchStatuses } from '@/lib/matches'

export async function POST(request: Request) {
  try {
    await ensureSchema()
    await refreshDerivedMatchStatuses()

    const cookieStore = cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Sign in to vote', code: 'auth_required' },
        { status: 401 }
      )
    }
    const { rows: sessionRows } = await sql`
      SELECT user_id FROM sessions
      WHERE session_token = ${sessionToken} AND expires_at > NOW()
    `
    if (sessionRows.length === 0) {
      return NextResponse.json(
        { error: 'Sign in to vote', code: 'auth_required' },
        { status: 401 }
      )
    }

    const { matchId, team } = await request.json()
    
    // Check if match is still upcoming
    const { rows: matchCheck } = await sql`
      SELECT status, match_time FROM matches WHERE id = ${matchId}
    `
    
    if (
      !matchCheck.length ||
      matchCheck[0].status !== 'upcoming' ||
      new Date(matchCheck[0].match_time).getTime() <= Date.now()
    ) {
      return NextResponse.json({ 
        error: 'Voting is closed for this match' 
      }, { status: 400 })
    }
    
    // Update vote count
    if (team === 1) {
      await sql`
        UPDATE matches 
        SET poll_team1_votes = poll_team1_votes + 1 
        WHERE id = ${matchId}
      `
    } else {
      await sql`
        UPDATE matches 
        SET poll_team2_votes = poll_team2_votes + 1 
        WHERE id = ${matchId}
      `
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Vote error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

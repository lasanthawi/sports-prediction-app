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
    
    const userId = sessionRows[0].user_id
    
    // Check if user already voted
    const { rows: existingVote } = await sql`
      SELECT team FROM user_votes WHERE user_id = ${userId} AND match_id = ${matchId}
    `
    
    if (existingVote.length > 0) {
      const pastTeam = existingVote[0].team
      if (pastTeam === team) {
         return NextResponse.json({ success: true, message: 'Already voted for this team' })
      }
      
      // Attempt to change vote
      await sql`
        UPDATE user_votes SET team = ${team}, created_at = NOW()
        WHERE user_id = ${userId} AND match_id = ${matchId}
      `
      
      // Update counts based on change
      if (team === 1) {
        await sql`
          UPDATE matches 
          SET poll_team1_votes = poll_team1_votes + 1, poll_team2_votes = GREATEST(poll_team2_votes - 1, 0)
          WHERE id = ${matchId}
        `
      } else {
        await sql`
          UPDATE matches 
          SET poll_team2_votes = poll_team2_votes + 1, poll_team1_votes = GREATEST(poll_team1_votes - 1, 0)
          WHERE id = ${matchId}
        `
      }
      return NextResponse.json({ success: true })
    }

    // Insert new vote
    await sql`
      INSERT INTO user_votes (user_id, match_id, team)
      VALUES (${userId}, ${matchId}, ${team})
    `

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

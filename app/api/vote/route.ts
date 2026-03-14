import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function POST(request: Request) {
  try {
    const { matchId, team } = await request.json()
    
    // Check if match is still upcoming
    const { rows: matchCheck } = await sql`
      SELECT status FROM matches WHERE id = ${matchId}
    `
    
    if (!matchCheck.length || matchCheck[0].status !== 'upcoming') {
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { rows } = await sql`
      SELECT * FROM matches 
      WHERE status IN ('upcoming', 'live')
      ORDER BY match_time ASC
      LIMIT 20
    `
    
    return NextResponse.json({ matches: rows })
  } catch (error: any) {
    console.error('Database error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch matches',
      matches: []
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { team1, team2, match_time, sport } = await request.json()
    
    const { rows } = await sql`
      INSERT INTO matches (team1, team2, match_time, sport, status, poll_team1_votes, poll_team2_votes)
      VALUES (${team1}, ${team2}, ${match_time}, ${sport}, 'upcoming', 0, 0)
      RETURNING *
    `
    
    return NextResponse.json({ match: rows[0] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
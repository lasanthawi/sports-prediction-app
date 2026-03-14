import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { status, team1_score, team2_score, flyer_url, result_flyer_url } = await request.json()
    const matchId = params.id
    
    let query = 'UPDATE matches SET '
    const updates = []
    const values: any[] = []
    let paramIndex = 1
    
    if (status) {
      updates.push(`status = $${paramIndex++}`)
      values.push(status)
    }
    if (team1_score !== undefined) {
      updates.push(`team1_score = $${paramIndex++}`)
      values.push(team1_score)
    }
    if (team2_score !== undefined) {
      updates.push(`team2_score = $${paramIndex++}`)
      values.push(team2_score)
    }
    if (flyer_url) {
      updates.push(`flyer_url = $${paramIndex++}`)
      values.push(flyer_url)
    }
    if (result_flyer_url) {
      updates.push(`result_flyer_url = $${paramIndex++}`)
      values.push(result_flyer_url)
    }
    
    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }
    
    query += updates.join(', ') + ` WHERE id = $${paramIndex} RETURNING *`
    values.push(matchId)
    
    const { rows } = await sql.query(query, values)
    
    return NextResponse.json({ match: rows[0] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
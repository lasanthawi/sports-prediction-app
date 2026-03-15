import { NextResponse } from 'next/server'
import { generateAssetsForMatches } from '@/lib/automation'
import { createMatch, listMatches, listVisibleMatches } from '@/lib/matches'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const includeAll = searchParams.get('includeAll') === '1'
    const matches = includeAll ? await listMatches() : await listVisibleMatches()
    return NextResponse.json({ matches })
  } catch (error: any) {
    console.error('Database error:', error)
    return NextResponse.json({
      error: 'Failed to fetch matches',
      details: error.message,
      matches: [],
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.team1 || !body.team2 || !body.sport || !body.match_time) {
      return NextResponse.json({ error: 'team1, team2, sport, and match_time are required' }, { status: 400 })
    }

    const match = await createMatch(body)
    await generateAssetsForMatches([match])

    return NextResponse.json({ match })
  } catch (error: any) {
    console.error('Create match error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

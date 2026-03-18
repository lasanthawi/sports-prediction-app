import { NextResponse } from 'next/server'
import { getMatch } from '@/lib/matches'
import { publishReadyAssets, publishMatchAssets, setMatchCardsReadyForPublish } from '@/lib/automation'

export async function POST(request: Request) {
  try {
    let body: { matchId?: number } = {}
    try {
      body = await request.json()
    } catch {
      /* empty body */
    }
    const matchId = body.matchId != null ? Number(body.matchId) : NaN
    if (Number.isInteger(matchId) && matchId > 0) {
      const match = await getMatch(matchId)
      if (!match) {
        return NextResponse.json({ error: `Match ${matchId} not found` }, { status: 404 })
      }
      const reset = await setMatchCardsReadyForPublish(matchId)
      const result = await publishMatchAssets(matchId)
      return NextResponse.json({
        ...result,
        matchId,
        matchLabel: `${match.team1} vs ${match.team2}`,
        cardsResetToReady: reset,
      })
    }
    const result = await publishReadyAssets()
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Publish automation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

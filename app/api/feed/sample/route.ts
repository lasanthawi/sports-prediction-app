import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const now = Date.now()

  return NextResponse.json({
    matches: [
      {
        externalId: `sample-${Math.floor(now / 1000)}-1`,
        source: 'sample-feed',
        sport: 'Football',
        league: 'Premier League',
        team1: 'Arsenal',
        team2: 'Chelsea',
        matchTime: new Date(now + 6 * 60 * 60 * 1000).toISOString(),
        venue: 'Emirates Stadium',
        status: 'upcoming',
      },
      {
        externalId: `sample-${Math.floor(now / 1000)}-2`,
        source: 'sample-feed',
        sport: 'Cricket',
        league: 'IPL',
        team1: 'Mumbai Indians',
        team2: 'Chennai Super Kings',
        matchTime: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
        venue: 'Wankhede Stadium',
        status: 'upcoming',
      },
      {
        externalId: `sample-${Math.floor(now / 1000)}-3`,
        source: 'sample-feed',
        sport: 'Basketball',
        league: 'NBA',
        team1: 'Lakers',
        team2: 'Celtics',
        matchTime: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        venue: 'TD Garden',
        status: 'finished',
        winner: 2,
        resultSummary: 'Celtics 112 - 107 Lakers',
      },
    ],
  })
}

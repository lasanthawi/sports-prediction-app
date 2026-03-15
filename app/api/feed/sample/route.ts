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
        team1Captain: 'Martin Odegaard',
        team2Captain: 'Reece James',
        team1Palette: '#D71920,#FFFFFF,#C9A227',
        team2Palette: '#034694,#FFFFFF,#EDBB00',
        team1FlagColors: '#CF142B,#FFFFFF,#00247D',
        team2FlagColors: '#012169,#FFFFFF,#C8102E',
        creativeDirection: 'High-energy stadium poster with electric trails and premium foil shadows',
        rivalryTagline: 'London pride. One crown.',
        artStyle: 'cinematic premium sports key art',
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
        team1Captain: 'Hardik Pandya',
        team2Captain: 'Ruturaj Gaikwad',
        team1Palette: '#005DAA,#D1AB3E,#FFFFFF',
        team2Palette: '#F9CD05,#00529F,#FFFFFF',
        team1FlagColors: '#FF9933,#FFFFFF,#138808',
        team2FlagColors: '#FF9933,#FFFFFF,#138808',
        creativeDirection: 'Dramatic floodlit duel with sparks, dust, and trophy-race energy',
        rivalryTagline: 'Legends collide under the lights.',
        artStyle: 'hyper-real premium trading card illustration',
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
        team1Captain: 'LeBron James',
        team2Captain: 'Jayson Tatum',
        team1Palette: '#552583,#FDB927,#FFFFFF',
        team2Palette: '#007A33,#BA9653,#FFFFFF',
        team1FlagColors: '#B22234,#FFFFFF,#3C3B6E',
        team2FlagColors: '#B22234,#FFFFFF,#3C3B6E',
        creativeDirection: 'Playoff poster energy with spotlighted captains and metallic confetti haze',
        rivalryTagline: 'History never sleeps.',
        artStyle: 'epic posterized arena illustration',
        matchTime: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        venue: 'TD Garden',
        status: 'finished',
        winner: 2,
        resultSummary: 'Celtics 112 - 107 Lakers',
      },
    ],
  })
}

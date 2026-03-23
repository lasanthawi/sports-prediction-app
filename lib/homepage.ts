import { listMatchesForPublic } from './matches'

export interface HomePageMatchRecord {
  id: number
  team1: string
  team2: string
  sport: string
  league?: string | null
  venue?: string | null
  match_time: string
  status: 'upcoming' | 'live' | 'finished' | 'cancelled'
  poll_team1_votes: number
  poll_team2_votes: number
  result_summary?: string | null
  winner?: number | null
  rivalry_tagline?: string | null
  team1_logo?: string | null
  team2_logo?: string | null
  prediction_artwork_url?: string | null
  result_artwork_url?: string | null
  result_card_url?: string | null
  card_asset_url?: string | null
  latest_published_at?: string | null
}

export interface HomePageData {
  counts: {
    live: number
    upcoming: number
    finishedVisible: number
    totalVisible: number
    totalVotes: number
  }
  featuredMatches: HomePageMatchRecord[]
  votingMatches: HomePageMatchRecord[]
  upcomingMatches: HomePageMatchRecord[]
  finishedMatches: HomePageMatchRecord[]
}

export function buildArenaMatchStack({
  votingMatches,
  finishedMatches,
  votedMatchIds = [],
  limit = 20,
}: {
  votingMatches: HomePageMatchRecord[]
  finishedMatches: HomePageMatchRecord[]
  votedMatchIds?: Iterable<number>
  limit?: number
}) {
  const votedSet = new Set(votedMatchIds)
  const prioritizedVotingMatches = votingMatches.filter((match) => !votedSet.has(match.id))
  const arenaMatches = [...prioritizedVotingMatches]

  for (const match of finishedMatches) {
    if (arenaMatches.length >= limit) {
      break
    }

    if (!arenaMatches.some((existing) => existing.id === match.id)) {
      arenaMatches.push(match)
    }
  }

  return arenaMatches.slice(0, limit)
}

function toHomePageMatchRecord(match: Awaited<ReturnType<typeof listMatchesForPublic>>[number]): HomePageMatchRecord {
  return {
    id: match.id,
    team1: match.team1,
    team2: match.team2,
    sport: match.sport,
    league: match.league,
    venue: match.venue,
    match_time: match.match_time,
    status: match.status,
    poll_team1_votes: match.poll_team1_votes,
    poll_team2_votes: match.poll_team2_votes,
    result_summary: match.result_summary,
    winner: match.winner,
    rivalry_tagline: match.rivalry_tagline,
    team1_logo: match.team1_logo,
    team2_logo: match.team2_logo,
    prediction_artwork_url: match.prediction_artwork_url,
    result_artwork_url: match.result_artwork_url,
    result_card_url: match.result_card_url,
    card_asset_url: match.card_asset_url,
    latest_published_at: match.latest_published_at,
  }
}

export function sortMatchesForArena(list: HomePageMatchRecord[]) {
  const now = Date.now()
  const freshLiveWindowMs = 1000 * 60 * 60 * 12

  const statusWeight = (match: HomePageMatchRecord) => {
    const matchTime = new Date(match.match_time).getTime()
    const isStaleLive = match.status === 'live' && Number.isFinite(matchTime) && now - matchTime > freshLiveWindowMs

    if (match.status === 'live' && !isStaleLive) return 0
    if (match.status === 'upcoming') return 1
    if (match.status === 'live') return 2
    if (match.status === 'finished') return 3
    return 4
  }

  return [...list].sort((a, b) => {
    const weightDifference = statusWeight(a) - statusWeight(b)
    if (weightDifference !== 0) {
      return weightDifference
    }

    const aPublished = a.latest_published_at ? new Date(a.latest_published_at).getTime() : 0
    const bPublished = b.latest_published_at ? new Date(b.latest_published_at).getTime() : 0

    if (aPublished !== bPublished) {
      return bPublished - aPublished
    }

    const aTime = new Date(a.match_time).getTime()
    const bTime = new Date(b.match_time).getTime()

    if (a.status === 'finished' && b.status === 'finished') {
      return bTime - aTime
    }

    return aTime - bTime
  })
}

export async function getHomePageData(): Promise<HomePageData> {
  const matches = (await listMatchesForPublic()).map(toHomePageMatchRecord)
  const orderedMatches = sortMatchesForArena(matches)
  const liveMatches = orderedMatches.filter((match) => match.status === 'live')
  const upcomingMatches = orderedMatches.filter((match) => match.status === 'upcoming')
  const finishedMatches = orderedMatches.filter((match) => match.status === 'finished')
  const votingMatches = orderedMatches.filter((match) => match.status !== 'cancelled' && match.status !== 'finished').slice(0, 40)
  const featuredMatches = votingMatches.slice(0, 8)
  const totalVotes = matches.reduce((sum, match) => sum + match.poll_team1_votes + match.poll_team2_votes, 0)

  return {
    counts: {
      live: liveMatches.length,
      upcoming: upcomingMatches.length,
      finishedVisible: finishedMatches.length,
      totalVisible: matches.length,
      totalVotes,
    },
    featuredMatches,
    votingMatches,
    upcomingMatches: upcomingMatches.slice(0, 12),
    finishedMatches: finishedMatches.slice(0, 24),
  }
}

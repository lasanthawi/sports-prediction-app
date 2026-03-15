export type MatchStatus = 'upcoming' | 'live' | 'finished' | 'cancelled'

export interface MatchRecord {
  id: number
  external_id: string | null
  source: string
  sport: string
  league: string | null
  team1: string
  team2: string
  team1_logo: string | null
  team2_logo: string | null
  match_time: string
  venue: string | null
  status: MatchStatus
  result_summary: string | null
  winner: number | null
  poll_team1_votes: number
  poll_team2_votes: number
  created_at: string
  updated_at: string
}

export interface AssetRecord {
  id: number
  match_id: number
  asset_type: string
  format: string
  title: string
  content: string
  published_status: string
  published_to: string | null
  publication_caption: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface AutomationRunRecord {
  id: number
  job_name: string
  status: string
  summary: string | null
  payload: unknown
  started_at: string
  finished_at: string | null
}

export interface MatchInput {
  team1: string
  team2: string
  sport: string
  league?: string | null
  match_time: string
  venue?: string | null
  team1_logo?: string | null
  team2_logo?: string | null
  status?: MatchStatus
  external_id?: string | null
  source?: string
}

export interface MatchUpdateInput {
  status?: MatchStatus
  result_summary?: string | null
  winner?: number | null
  poll_team1_votes?: number
  poll_team2_votes?: number
  match_time?: string
}

export interface FeedMatch {
  externalId: string
  source: string
  sport: string
  league?: string | null
  team1: string
  team2: string
  matchTime: string
  venue?: string | null
  team1Logo?: string | null
  team2Logo?: string | null
  status?: MatchStatus
  winner?: number | null
  resultSummary?: string | null
}

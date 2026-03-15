export type MatchStatus = 'upcoming' | 'live' | 'finished' | 'cancelled'
export type FeedQueueStatus = 'queued' | 'imported' | 'dismissed'

export type AssetType = 'artwork' | 'card'
export type AssetVariant = 'prediction' | 'result'
export type AssetGenerationStatus = 'generated' | 'fallback' | 'queued' | 'failed'

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
  team1_captain: string | null
  team2_captain: string | null
  team1_palette: string | null
  team2_palette: string | null
  team1_flag_colors: string | null
  team2_flag_colors: string | null
  creative_direction: string | null
  rivalry_tagline: string | null
  art_style: string | null
  match_time: string
  venue: string | null
  status: MatchStatus
  result_summary: string | null
  winner: number | null
  poll_team1_votes: number
  poll_team2_votes: number
  prediction_artwork_asset_id?: number | null
  prediction_artwork_url?: string | null
  prediction_card_asset_id?: number | null
  prediction_card_url?: string | null
  prediction_asset_status?: AssetGenerationStatus | null
  prediction_publish_status?: string | null
  result_artwork_asset_id?: number | null
  result_artwork_url?: string | null
  result_card_asset_id?: number | null
  result_card_url?: string | null
  result_asset_status?: AssetGenerationStatus | null
  result_publish_status?: string | null
  card_asset_url?: string | null
  asset_generation_status?: AssetGenerationStatus | null
  publish_status?: string | null
  created_at: string
  updated_at: string
}

export interface AssetRecord {
  id: number
  match_id: number
  asset_type: AssetType
  asset_variant: AssetVariant
  format: string
  mime_type: string
  content_encoding: 'utf8' | 'base64'
  title: string
  content: string
  generation_status: AssetGenerationStatus
  source_model: string | null
  prompt_version: string | null
  image_url: string | null
  render_recipe_version: string | null
  debug_prompt: string | null
  source_asset_id: number | null
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
  team1_captain?: string | null
  team2_captain?: string | null
  team1_palette?: string | null
  team2_palette?: string | null
  team1_flag_colors?: string | null
  team2_flag_colors?: string | null
  creative_direction?: string | null
  rivalry_tagline?: string | null
  art_style?: string | null
  status?: MatchStatus
  external_id?: string | null
  source?: string
}

export interface MatchUpdateInput {
  team1?: string
  team2?: string
  sport?: string
  league?: string | null
  venue?: string | null
  team1_logo?: string | null
  team2_logo?: string | null
  team1_captain?: string | null
  team2_captain?: string | null
  team1_palette?: string | null
  team2_palette?: string | null
  team1_flag_colors?: string | null
  team2_flag_colors?: string | null
  creative_direction?: string | null
  rivalry_tagline?: string | null
  art_style?: string | null
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
  team1Captain?: string | null
  team2Captain?: string | null
  team1Palette?: string | null
  team2Palette?: string | null
  team1FlagColors?: string | null
  team2FlagColors?: string | null
  creativeDirection?: string | null
  rivalryTagline?: string | null
  artStyle?: string | null
  status?: MatchStatus
  winner?: number | null
  resultSummary?: string | null
}

export interface FeedQueueRecord {
  id: number
  external_id: string
  provider: string
  source: string
  sport: string
  league: string | null
  team1: string
  team2: string
  team1_logo: string | null
  team2_logo: string | null
  team1_captain: string | null
  team2_captain: string | null
  team1_palette: string | null
  team2_palette: string | null
  team1_flag_colors: string | null
  team2_flag_colors: string | null
  creative_direction: string | null
  rivalry_tagline: string | null
  art_style: string | null
  match_time: string
  venue: string | null
  status: MatchStatus
  result_summary: string | null
  winner: number | null
  sync_status: FeedQueueStatus
  imported_match_id: number | null
  payload: unknown
  last_seen_at: string
  created_at: string
  updated_at: string
}

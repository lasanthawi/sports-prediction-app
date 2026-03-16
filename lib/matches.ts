import { sql } from '@vercel/postgres'
import { ensureSchema } from './db'
import { FeedMatch, MatchInput, MatchRecord, MatchUpdateInput } from './types'

function normalizeText(value: string | null | undefined) {
  return value?.trim() || null
}

function toAssetUrl(id?: number | null) {
  return id ? `/api/assets/${id}` : null
}

function hydrateMatches(rows: MatchRecord[]) {
  return rows.map((row) => {
    const predictionCardUrl = toAssetUrl(row.prediction_card_asset_id)
    const resultCardUrl = toAssetUrl(row.result_card_asset_id)
    const publishStatus = row.status === 'finished' ? row.result_publish_status : row.prediction_publish_status

    return {
      ...row,
      prediction_artwork_url: toAssetUrl(row.prediction_artwork_asset_id),
      prediction_card_url: predictionCardUrl,
      result_artwork_url: toAssetUrl(row.result_artwork_asset_id),
      result_card_url: resultCardUrl,
      card_asset_url: row.status === 'finished' ? resultCardUrl : predictionCardUrl,
      asset_generation_status:
        (row.status === 'finished' ? row.result_asset_status : row.prediction_asset_status) || null,
      publish_status: publishStatus || 'draft',
    }
  })
}

function normalizeMatchKeyPart(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, ' ') || ''
}

function visibleMatchKey(match: ReturnType<typeof hydrateMatches>[number]) {
  if (match.external_id) {
    return `external:${match.external_id}`
  }

  return [
    normalizeMatchKeyPart(match.sport),
    normalizeMatchKeyPart(match.league),
    normalizeMatchKeyPart(match.team1),
    normalizeMatchKeyPart(match.team2),
    normalizeMatchKeyPart(match.venue),
    new Date(match.match_time).toISOString(),
  ].join('|')
}

function visibleMatchRank(match: ReturnType<typeof hydrateMatches>[number]) {
  const publishRank =
    match.publish_status === 'published'
      ? 3
      : match.publish_status === 'ready'
        ? 2
        : 0
  const assetRank =
    match.asset_generation_status === 'generated'
      ? 2
      : match.asset_generation_status === 'fallback'
        ? 1
        : 0

  return publishRank * 10 + assetRank
}

function dedupeVisibleMatches(matches: ReturnType<typeof hydrateMatches>) {
  const picked = new Map<string, ReturnType<typeof hydrateMatches>[number]>()

  for (const match of matches) {
    const key = visibleMatchKey(match)
    const existing = picked.get(key)

    if (!existing) {
      picked.set(key, match)
      continue
    }

    const currentRank = visibleMatchRank(match)
    const existingRank = visibleMatchRank(existing)

    if (currentRank > existingRank) {
      picked.set(key, match)
      continue
    }

    if (currentRank === existingRank) {
      const currentUpdated = new Date(match.updated_at).getTime()
      const existingUpdated = new Date(existing.updated_at).getTime()

      if (currentUpdated > existingUpdated || (currentUpdated === existingUpdated && match.id > existing.id)) {
        picked.set(key, match)
      }
    }
  }

  return Array.from(picked.values())
}

export async function refreshDerivedMatchStatuses() {
  await ensureSchema()

  await sql`
    UPDATE matches
    SET status = 'live'
    WHERE status = 'upcoming'
      AND match_time <= NOW()
  `
}

function matchSelectClause() {
  return `
    SELECT
      matches.*,
      prediction_art.id AS prediction_artwork_asset_id,
      prediction_art.generation_status AS prediction_asset_status,
      prediction_card.id AS prediction_card_asset_id,
      prediction_card.published_status AS prediction_publish_status,
      result_art.id AS result_artwork_asset_id,
      result_art.generation_status AS result_asset_status,
      result_card.id AS result_card_asset_id,
      result_card.published_status AS result_publish_status
    FROM matches
    LEFT JOIN LATERAL (
      SELECT id, generation_status
      FROM generated_assets
      WHERE match_id = matches.id
        AND asset_type = 'artwork'
        AND asset_variant = 'prediction'
      ORDER BY id DESC
      LIMIT 1
    ) prediction_art ON TRUE
    LEFT JOIN LATERAL (
      SELECT id, published_status
      FROM generated_assets
      WHERE match_id = matches.id
        AND asset_type = 'card'
        AND asset_variant = 'prediction'
      ORDER BY id DESC
      LIMIT 1
    ) prediction_card ON TRUE
    LEFT JOIN LATERAL (
      SELECT id, generation_status
      FROM generated_assets
      WHERE match_id = matches.id
        AND asset_type = 'artwork'
        AND asset_variant = 'result'
      ORDER BY id DESC
      LIMIT 1
    ) result_art ON TRUE
    LEFT JOIN LATERAL (
      SELECT id, published_status
      FROM generated_assets
      WHERE match_id = matches.id
        AND asset_type = 'card'
        AND asset_variant = 'result'
      ORDER BY id DESC
      LIMIT 1
    ) result_card ON TRUE
  `
}

export async function listMatches() {
  await ensureSchema()
  await refreshDerivedMatchStatuses()
  const { rows } = await sql.query<MatchRecord>(`
    ${matchSelectClause()}
    ORDER BY match_time ASC, matches.id DESC
    LIMIT 50
  `)

  return hydrateMatches(rows)
}

export async function listVisibleMatches() {
  await ensureSchema()
  await refreshDerivedMatchStatuses()
  const { rows } = await sql.query<MatchRecord>(`
    ${matchSelectClause()}
    WHERE matches.status IN ('upcoming', 'live')
    ORDER BY match_time ASC, matches.id DESC
    LIMIT 60
  `)

  return dedupeVisibleMatches(hydrateMatches(rows)).slice(0, 20)
}

export async function createMatch(input: MatchInput) {
  await ensureSchema()

  const source = input.source?.trim() || 'manual'
  const status = input.status || 'upcoming'
  const externalId = normalizeText(input.external_id)

  const { rows } = await sql<MatchRecord>`
    INSERT INTO matches (
      external_id,
      source,
      sport,
      league,
      team1,
      team2,
      team1_logo,
      team2_logo,
      team1_captain,
      team2_captain,
      team1_palette,
      team2_palette,
      team1_flag_colors,
      team2_flag_colors,
      creative_direction,
      rivalry_tagline,
      art_style,
      match_time,
      venue,
      status,
      poll_team1_votes,
      poll_team2_votes
    )
    VALUES (
      ${externalId},
      ${source},
      ${input.sport.trim()},
      ${normalizeText(input.league)},
      ${input.team1.trim()},
      ${input.team2.trim()},
      ${normalizeText(input.team1_logo)},
      ${normalizeText(input.team2_logo)},
      ${normalizeText(input.team1_captain)},
      ${normalizeText(input.team2_captain)},
      ${normalizeText(input.team1_palette)},
      ${normalizeText(input.team2_palette)},
      ${normalizeText(input.team1_flag_colors)},
      ${normalizeText(input.team2_flag_colors)},
      ${normalizeText(input.creative_direction)},
      ${normalizeText(input.rivalry_tagline)},
      ${normalizeText(input.art_style)},
      ${input.match_time},
      ${normalizeText(input.venue)},
      ${status},
      0,
      0
    )
    RETURNING *
  `

  return rows[0]
}

export async function updateMatch(id: number, input: MatchUpdateInput) {
  await ensureSchema()

  const existing = await sql<MatchRecord>`
    SELECT * FROM matches WHERE id = ${id}
  `

  if (!existing.rows.length) {
    return null
  }

  const current = existing.rows[0]
  const { rows } = await sql<MatchRecord>`
    UPDATE matches
    SET
      team1 = ${input.team1?.trim() || current.team1},
      team2 = ${input.team2?.trim() || current.team2},
      sport = ${input.sport?.trim() || current.sport},
      league = ${input.league === undefined ? current.league : normalizeText(input.league)},
      venue = ${input.venue === undefined ? current.venue : normalizeText(input.venue)},
      team1_logo = ${input.team1_logo === undefined ? current.team1_logo : normalizeText(input.team1_logo)},
      team2_logo = ${input.team2_logo === undefined ? current.team2_logo : normalizeText(input.team2_logo)},
      team1_captain = ${input.team1_captain === undefined ? current.team1_captain : normalizeText(input.team1_captain)},
      team2_captain = ${input.team2_captain === undefined ? current.team2_captain : normalizeText(input.team2_captain)},
      team1_palette = ${input.team1_palette === undefined ? current.team1_palette : normalizeText(input.team1_palette)},
      team2_palette = ${input.team2_palette === undefined ? current.team2_palette : normalizeText(input.team2_palette)},
      team1_flag_colors = ${input.team1_flag_colors === undefined ? current.team1_flag_colors : normalizeText(input.team1_flag_colors)},
      team2_flag_colors = ${input.team2_flag_colors === undefined ? current.team2_flag_colors : normalizeText(input.team2_flag_colors)},
      creative_direction = ${input.creative_direction === undefined ? current.creative_direction : normalizeText(input.creative_direction)},
      rivalry_tagline = ${input.rivalry_tagline === undefined ? current.rivalry_tagline : normalizeText(input.rivalry_tagline)},
      art_style = ${input.art_style === undefined ? current.art_style : normalizeText(input.art_style)},
      status = ${input.status ?? current.status},
      result_summary = ${input.result_summary === undefined ? current.result_summary : input.result_summary},
      winner = ${input.winner === undefined ? current.winner : input.winner},
      poll_team1_votes = ${input.poll_team1_votes ?? current.poll_team1_votes},
      poll_team2_votes = ${input.poll_team2_votes ?? current.poll_team2_votes},
      match_time = ${input.match_time ?? current.match_time}
    WHERE id = ${id}
    RETURNING *
  `

  return rows[0]
}

export async function getMatch(id: number) {
  await ensureSchema()
  const { rows } = await sql<MatchRecord>`
    SELECT *
    FROM matches
    WHERE id = ${id}
  `

  return rows[0] || null
}

export async function deleteMatch(id: number) {
  await ensureSchema()
  const { rows } = await sql<MatchRecord>`
    DELETE FROM matches
    WHERE id = ${id}
    RETURNING *
  `

  return rows[0] || null
}

export async function upsertFeedMatches(feedMatches: FeedMatch[]) {
  await ensureSchema()
  const saved: MatchRecord[] = []

  for (const item of feedMatches) {
    const { rows } = await sql<MatchRecord>`
      INSERT INTO matches (
        external_id,
        source,
        sport,
        league,
        team1,
        team2,
        team1_logo,
        team2_logo,
        team1_captain,
        team2_captain,
        team1_palette,
        team2_palette,
        team1_flag_colors,
        team2_flag_colors,
        creative_direction,
        rivalry_tagline,
        art_style,
        match_time,
        venue,
        status,
        result_summary,
        winner
      )
      VALUES (
        ${item.externalId},
        ${item.source},
        ${item.sport},
        ${normalizeText(item.league)},
        ${item.team1},
        ${item.team2},
        ${normalizeText(item.team1Logo)},
        ${normalizeText(item.team2Logo)},
        ${normalizeText(item.team1Captain)},
        ${normalizeText(item.team2Captain)},
        ${normalizeText(item.team1Palette)},
        ${normalizeText(item.team2Palette)},
        ${normalizeText(item.team1FlagColors)},
        ${normalizeText(item.team2FlagColors)},
        ${normalizeText(item.creativeDirection)},
        ${normalizeText(item.rivalryTagline)},
        ${normalizeText(item.artStyle)},
        ${item.matchTime},
        ${normalizeText(item.venue)},
        ${item.status || 'upcoming'},
        ${normalizeText(item.resultSummary)},
        ${item.winner ?? null}
      )
      ON CONFLICT (external_id)
      DO UPDATE SET
        source = EXCLUDED.source,
        sport = EXCLUDED.sport,
        league = EXCLUDED.league,
        team1 = EXCLUDED.team1,
        team2 = EXCLUDED.team2,
        team1_logo = EXCLUDED.team1_logo,
        team2_logo = EXCLUDED.team2_logo,
        team1_captain = EXCLUDED.team1_captain,
        team2_captain = EXCLUDED.team2_captain,
        team1_palette = EXCLUDED.team1_palette,
        team2_palette = EXCLUDED.team2_palette,
        team1_flag_colors = EXCLUDED.team1_flag_colors,
        team2_flag_colors = EXCLUDED.team2_flag_colors,
        creative_direction = EXCLUDED.creative_direction,
        rivalry_tagline = EXCLUDED.rivalry_tagline,
        art_style = EXCLUDED.art_style,
        match_time = EXCLUDED.match_time,
        venue = EXCLUDED.venue,
        status = EXCLUDED.status,
        result_summary = EXCLUDED.result_summary,
        winner = EXCLUDED.winner
      RETURNING *
    `

    saved.push(rows[0])
  }

  return saved
}

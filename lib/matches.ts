import { sql } from '@vercel/postgres'
import { ensureSchema } from './db'
import { getActivePublishStatus, normalizePublishStatus } from './publish'
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
    const predictionArtworkUrl = toAssetUrl(row.prediction_artwork_asset_id)
    const resultArtworkUrl = toAssetUrl(row.result_artwork_asset_id)

    return {
      ...row,
      prediction_artwork_url: predictionArtworkUrl,
      prediction_card_url: predictionCardUrl,
      result_artwork_url: resultArtworkUrl,
      result_card_url: resultCardUrl,
      public_artwork_url: row.status === 'finished' ? resultArtworkUrl : predictionArtworkUrl,
      card_asset_url: row.status === 'finished' ? resultCardUrl : predictionCardUrl,
      asset_generation_status:
        (row.status === 'finished' ? row.result_asset_status : row.prediction_asset_status) || null,
      publish_status: getActivePublishStatus(row),
    }
  })
}

function normalizeMatchKeyPart(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, ' ') || ''
}

function visibleMatchKey(match: ReturnType<typeof hydrateMatches>[number]) {
  const matchDate = new Date(match.match_time)
  const dateBucket = Number.isNaN(matchDate.getTime())
    ? normalizeMatchKeyPart(match.match_time)
    : matchDate.toISOString().slice(0, 10)
  const detailKey = [
    normalizeMatchKeyPart(match.sport),
    normalizeMatchKeyPart(match.league),
    normalizeMatchKeyPart(match.team1),
    normalizeMatchKeyPart(match.team2),
    normalizeMatchKeyPart(match.venue),
    dateBucket,
  ].join('|')

  if (detailKey.replaceAll('|', '').length > 0) {
    return detailKey
  }

  return match.external_id ? `external:${match.external_id}` : `match:${match.id}`
}

function visibleMatchRank(match: ReturnType<typeof hydrateMatches>[number]) {
  const assetStatus = match.asset_generation_status
  const publishStatus = normalizePublishStatus(match.publish_status)

  if (assetStatus === 'generated' && publishStatus === 'published') {
    return 4
  }

  if (assetStatus === 'generated') {
    return 3
  }

  if (assetStatus === 'fallback' && publishStatus === 'published') {
    return 2
  }

  if (assetStatus === 'fallback') {
    return 1
  }

  return 0
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
      prediction_card.source_asset_id AS prediction_artwork_asset_id,
      prediction_card.generation_status AS prediction_asset_status,
      prediction_card.id AS prediction_card_asset_id,
      prediction_card.published_status AS prediction_publish_status,
      result_card.source_asset_id AS result_artwork_asset_id,
      result_card.generation_status AS result_asset_status,
      result_card.id AS result_card_asset_id,
      result_card.published_status AS result_publish_status
    FROM matches
    LEFT JOIN LATERAL (
      SELECT id, published_status, generation_status, source_asset_id
      FROM generated_assets
      WHERE match_id = matches.id
        AND asset_type = 'card'
        AND asset_variant = 'prediction'
      ORDER BY (CASE WHEN LOWER(TRIM(published_status)) = 'published' THEN 0 ELSE 1 END), id DESC
      LIMIT 1
    ) prediction_card ON TRUE
    LEFT JOIN LATERAL (
      SELECT id, published_status, generation_status, source_asset_id
      FROM generated_assets
      WHERE match_id = matches.id
        AND asset_type = 'card'
        AND asset_variant = 'result'
      ORDER BY (CASE WHEN LOWER(TRIM(published_status)) = 'published' THEN 0 ELSE 1 END), id DESC
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
  return listVisibleMatchesNoRefresh()
}

function listVisibleMatchesNoRefresh() {
  return sql.query<MatchRecord>(`
    ${matchSelectClause()}
    WHERE matches.status IN ('upcoming', 'live')
      AND prediction_card.id IS NOT NULL
      AND LOWER(TRIM(prediction_card.published_status)) = 'published'
      AND LOWER(TRIM(COALESCE(prediction_card.generation_status, ''))) IN ('generated', 'fallback')
    ORDER BY match_time ASC, matches.id DESC
    LIMIT 60
  `).then(({ rows }) => dedupeVisibleMatches(hydrateMatches(rows)).slice(0, 20))
}

/** Finished matches for the results board. */
export async function listFinishedMatches() {
  await ensureSchema()
  await refreshDerivedMatchStatuses()
  return listFinishedMatchesNoRefresh()
}

function listFinishedMatchesNoRefresh() {
  return sql.query<MatchRecord>(`
    ${matchSelectClause()}
    WHERE matches.status = 'finished'
    ORDER BY match_time DESC, matches.id DESC
    LIMIT 50
  `).then(({ rows }) => hydrateMatches(rows))
}

/** For public homepage: voting matches (with generated assets) + finished matches for results board. */
export async function listMatchesForPublic() {
  await ensureSchema()
  await refreshDerivedMatchStatuses()
  const [voting, finished] = await Promise.all([listVisibleMatchesNoRefresh(), listFinishedMatchesNoRefresh()])
  const byId = new Map(voting.map((m) => [m.id, m]))
  for (const m of finished) {
    if (!byId.has(m.id)) byId.set(m.id, m)
  }
  return Array.from(byId.values()).sort((a, b) => {
    const aTime = new Date(a.match_time).getTime()
    const bTime = new Date(b.match_time).getTime()
    if (a.status === 'finished' && b.status !== 'finished') return 1
    if (a.status !== 'finished' && b.status === 'finished') return -1
    return aTime - bTime
  })
}

/** Match ids that need asset generation: no card or card not generated/fallback for the active variant. */
export async function listMatchIdsNeedingAssetGeneration(): Promise<number[]> {
  await ensureSchema()
  const { rows } = await sql<{ id: number }>`
    SELECT m.id FROM matches m
    LEFT JOIN LATERAL (
      SELECT 1 AS ok
      FROM generated_assets ga
      WHERE ga.match_id = m.id AND ga.asset_type = 'card' AND ga.asset_variant = 'prediction'
        AND LOWER(TRIM(COALESCE(ga.generation_status, ''))) IN ('generated', 'fallback')
      LIMIT 1
    ) pred ON TRUE
    LEFT JOIN LATERAL (
      SELECT 1 AS ok
      FROM generated_assets ga
      WHERE ga.match_id = m.id AND ga.asset_type = 'card' AND ga.asset_variant = 'result'
        AND LOWER(TRIM(COALESCE(ga.generation_status, ''))) IN ('generated', 'fallback')
      LIMIT 1
    ) res ON TRUE
    WHERE (m.status IN ('upcoming', 'live') AND pred.ok IS NULL)
       OR (m.status = 'finished' AND res.ok IS NULL)
    ORDER BY m.match_time ASC
    LIMIT 100
  `
  return rows.map((r) => r.id)
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

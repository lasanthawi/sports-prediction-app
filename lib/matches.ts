import { sql } from '@vercel/postgres'
import { ensureSchema } from './db'
import { FeedMatch, MatchInput, MatchRecord, MatchUpdateInput } from './types'

function normalizeText(value: string | null | undefined) {
  return value?.trim() || null
}

export async function listMatches() {
  await ensureSchema()
  const { rows } = await sql<MatchRecord>`
    SELECT *
    FROM matches
    ORDER BY match_time ASC, id DESC
    LIMIT 50
  `

  return rows
}

export async function listVisibleMatches() {
  await ensureSchema()
  const { rows } = await sql<MatchRecord>`
    SELECT *
    FROM matches
    WHERE status IN ('upcoming', 'live')
    ORDER BY match_time ASC, id DESC
    LIMIT 20
  `

  return rows
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
  const nextStatus = input.status ?? current.status
  const nextResultSummary =
    input.result_summary === undefined ? current.result_summary : input.result_summary
  const nextWinner = input.winner === undefined ? current.winner : input.winner
  const nextTeam1Votes = input.poll_team1_votes ?? current.poll_team1_votes
  const nextTeam2Votes = input.poll_team2_votes ?? current.poll_team2_votes
  const nextMatchTime = input.match_time ?? current.match_time

  const { rows } = await sql<MatchRecord>`
    UPDATE matches
    SET
      status = ${nextStatus},
      result_summary = ${nextResultSummary},
      winner = ${nextWinner},
      poll_team1_votes = ${nextTeam1Votes},
      poll_team2_votes = ${nextTeam2Votes},
      match_time = ${nextMatchTime}
    WHERE id = ${id}
    RETURNING *
  `

  return rows[0]
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

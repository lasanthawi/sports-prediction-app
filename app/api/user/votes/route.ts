import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sql } from '@vercel/postgres'
import { ensureSchema } from '@/lib/db'

export const dynamic = 'force-dynamic'

function normalizePublishStatus(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase() || 'draft'
}

function getActivePublishStatus(match: any) {
  const variantStatus = match.status === 'finished'
    ? match.result_publish_status
    : match.prediction_publish_status

  return normalizePublishStatus(variantStatus || match.publish_status)
}

function toAssetUrl(id?: number | null) {
  return id ? `/api/assets/${id}` : null
}

function hydrateMatches(rows: any[]) {
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

export async function GET() {
  try {
    await ensureSchema()
    const cookieStore = cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ matches: [] }, { status: 401 })
    }

    const { rows: sessionRows } = await sql`
      SELECT user_id FROM sessions
      WHERE session_token = ${sessionToken} AND expires_at > NOW()
    `

    if (sessionRows.length === 0) {
      return NextResponse.json({ matches: [] }, { status: 401 })
    }

    const userId = sessionRows[0].user_id

    const { rows } = await sql`
      SELECT
        matches.*,
        prediction_card.source_asset_id AS prediction_artwork_asset_id,
        prediction_card.generation_status AS prediction_asset_status,
        prediction_card.id AS prediction_card_asset_id,
        prediction_card.published_status AS prediction_publish_status,
        result_card.source_asset_id AS result_artwork_asset_id,
        result_card.generation_status AS result_asset_status,
        result_card.id AS result_card_asset_id,
        result_card.published_status AS result_publish_status,
        uv.team AS voted_team,
        uv.created_at AS voted_at
      FROM user_votes uv
      INNER JOIN matches ON uv.match_id = matches.id
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
      WHERE uv.user_id = ${userId}
      ORDER BY uv.created_at DESC
      LIMIT 20
    `

    return NextResponse.json({ matches: hydrateMatches(rows) })
  } catch (error: any) {
    console.error('Fetch voted matches error:', error)
    return NextResponse.json({ matches: [] }, { status: 500 })
  }
}

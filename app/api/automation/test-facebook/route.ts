import { NextResponse } from 'next/server'
import { getMatch } from '@/lib/matches'
import { publishToFacebookStory } from '@/lib/facebook'
import { sql } from '@vercel/postgres'

/**
 * POST { "matchId": 59 } — Test Facebook Story publish for one match only.
 * Picks the first card asset for that match, builds the public PNG URL, calls the FB API once,
 * and returns the raw Facebook result so you can see exactly why it succeeded or failed.
 *
 * Requires: FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN.
 * The asset URL must be publicly reachable (NEXT_PUBLIC_APP_URL must be your deployed HTTPS URL, not localhost).
 */
export async function POST(request: Request) {
  try {
    let body: { matchId?: number } = {}
    try {
      body = await request.json()
    } catch {
      /* empty */
    }
    const matchId = body.matchId != null ? Number(body.matchId) : NaN
    if (!Number.isInteger(matchId) || matchId <= 0) {
      return NextResponse.json({ error: 'Body must include matchId (e.g. { "matchId": 59 })' }, { status: 400 })
    }

    const match = await getMatch(matchId)
    if (!match) {
      return NextResponse.json({ error: `Match ${matchId} not found` }, { status: 404 })
    }

    const { rows } = await sql`
      SELECT id FROM generated_assets
      WHERE match_id = ${matchId} AND asset_type = 'card'
      ORDER BY asset_variant ASC
      LIMIT 1
    `
    const assetId = rows[0]?.id
    if (assetId == null) {
      return NextResponse.json({
        error: `No card asset found for match ${matchId}. Generate assets first.`,
        matchId,
        match: `${match.team1} vs ${match.team2}`,
      }, { status: 404 })
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, 'https://') ||
      process.env.VERCEL_URL?.replace(/^/, 'https://') ||
      'http://localhost:3000'
    const assetUrl = `${baseUrl}/api/assets/${assetId}?format=png`

    const facebook = await publishToFacebookStory(assetUrl)

    return NextResponse.json({
      matchId,
      match: `${match.team1} vs ${match.team2}`,
      assetId,
      assetUrl,
      facebook,
      hint: !facebook.ok && !facebook.skipped
        ? 'Check the error above. Common: invalid token, wrong permissions, or Facebook cannot fetch the image URL (use a public HTTPS URL, not localhost).'
        : facebook.skipped
          ? 'Set FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN in your environment to post to Facebook.'
          : 'Story was posted to your Page. Check Facebook.',
    })
  } catch (err) {
    console.error('Test Facebook error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Test failed' },
      { status: 500 }
    )
  }
}

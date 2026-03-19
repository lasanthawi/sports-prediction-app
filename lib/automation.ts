import { sql } from '@vercel/postgres'
import { ensureSchema } from './db'
import { fetchConfiguredFeedMatches, importFeedQueueItem, listFeedQueueItemIdsForAutomation, stageFeedMatches } from './feed'
import { buildGeminiPrompt, generateGeminiPortraitArtwork, getPromptVersion } from './gemini'
import { getMatch, listMatches, listMatchIdsNeedingAssetGeneration } from './matches'
import { getActivePublishStatus, isPublishedStatus } from './publish'
import { AssetRecord, AssetVariant, MatchRecord } from './types'
import { publishToFacebookStory } from './facebook'
import { renderTextAsSvgPath } from './text-to-path'

const DEFAULT_WEBHOOK_TIMEOUT_MS = 10000
const RENDER_RECIPE_VERSION = 'portrait-card-v1'

interface UnexpectedAssetTypeSummary {
  asset_type: string
  count: number
}

interface FacebookPublishSummary {
  attempted: number
  success: number
  failed: number
  skipped: boolean
  errors: string[]
  postIds: string[]
}

interface PublishAssetsResult {
  published: number
  queued: number
  mode: 'queue-only' | 'webhook'
  assets: AssetRecord[]
  skipped: boolean
  message: string
  anomalies: {
    unexpectedAssetTypes: UnexpectedAssetTypeSummary[]
  }
  facebook?: FacebookPublishSummary
}

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, 'https://') ||
    process.env.VERCEL_URL?.replace(/^/, 'https://') ||
    'http://localhost:3000'
  ).replace(/\/$/, '')
}

function getCaption(match: MatchRecord, variant: AssetVariant) {
  if (variant === 'result') {
    return `${match.team1} vs ${match.team2} is final. ${match.result_summary || 'Result is in.'}`
  }

  return `${match.team1} vs ${match.team2} starts at ${new Date(match.match_time).toLocaleString()}. Cast your prediction now.`
}

function escapeXml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function getAssetDataUrl(asset: AssetRecord) {
  if (asset.content_encoding === 'base64') {
    return `data:${asset.mime_type};base64,${asset.content}`
  }

  return `data:${asset.mime_type};utf8,${encodeURIComponent(asset.content)}`
}

function buildFallbackArtwork(match: MatchRecord, variant: AssetVariant) {
  const accentA = match.team1_palette || '#58f4a7'
  const accentB = match.team2_palette || '#ff5ca8'
  const centerGlow = variant === 'result' ? '#ffd84d' : '#9cf8c0'
  const haze = variant === 'result' ? '0.22' : '0.18'

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1920" viewBox="0 0 1080 1920" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1080" height="1920" fill="#0B1020"/>
  <rect width="1080" height="1920" fill="url(#bg)"/>
  <rect width="1080" height="1920" fill="url(#atmosphere)"/>
  <circle cx="220" cy="460" r="300" fill="${accentA}" fill-opacity="${haze}"/>
  <circle cx="860" cy="480" r="320" fill="${accentB}" fill-opacity="${haze}"/>
  <ellipse cx="540" cy="920" rx="300" ry="520" fill="${centerGlow}" fill-opacity="0.08"/>
  <path d="M120 300C270 440 300 650 290 860C282 1046 214 1266 120 1540" stroke="${accentA}" stroke-opacity="0.4" stroke-width="24" stroke-linecap="round"/>
  <path d="M960 300C810 440 780 650 790 860C798 1046 866 1266 960 1540" stroke="${accentB}" stroke-opacity="0.4" stroke-width="24" stroke-linecap="round"/>
  <rect x="72" y="86" width="936" height="1748" rx="48" fill="rgba(0,0,0,0.12)" stroke="rgba(255,255,255,0.12)" stroke-width="3"/>
  <rect x="120" y="1180" width="840" height="520" rx="80" fill="url(#fadeBottom)"/>
  <defs>
    <linearGradient id="bg" x1="40" y1="60" x2="1040" y2="1860" gradientUnits="userSpaceOnUse">
      <stop stop-color="#142040"/>
      <stop offset="0.52" stop-color="#1D124A"/>
      <stop offset="1" stop-color="#090B15"/>
    </linearGradient>
    <linearGradient id="atmosphere" x1="540" y1="0" x2="540" y2="1920" gradientUnits="userSpaceOnUse">
      <stop stop-color="rgba(255,255,255,0.08)"/>
      <stop offset="0.34" stop-color="rgba(255,255,255,0.02)"/>
      <stop offset="0.7" stop-color="rgba(0,0,0,0)"/>
      <stop offset="1" stop-color="rgba(5,8,20,0.32)"/>
    </linearGradient>
    <linearGradient id="fadeBottom" x1="540" y1="1180" x2="540" y2="1700" gradientUnits="userSpaceOnUse">
      <stop stop-color="rgba(5,8,20,0)"/>
      <stop offset="1" stop-color="rgba(5,8,20,0.42)"/>
    </linearGradient>
  </defs>
</svg>`
}

const STORY_FONT =
  'Liberation Sans, DejaVu Sans, Helvetica, Arial, sans-serif'

function formatStoryDateLabel(matchTime: string) {
  const date = new Date(matchTime)
  if (Number.isNaN(date.getTime())) return 'MATCHDAY TBA'

  const datePart = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)
  const timePart = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)

  return `${datePart.toUpperCase()} • ${timePart.toUpperCase()}`
}

function formatStoryVenueLabel(venue: string | null) {
  if (!venue || !venue.trim()) return 'VENUE TO BE CONFIRMED'
  const clean = venue.trim().replace(/\s+/g, ' ')
  return clean.length > 38 ? `${clean.slice(0, 35).trimEnd()}...` : clean
}

function getCompactTeamName(name: string) {
  const clean = name.trim().replace(/\s+/g, ' ')
  if (clean.length <= 16) return clean.toUpperCase()

  const parts = clean.split(' ')
  if (parts.length > 1) {
    const shortened = `${parts.slice(0, -1).map((part) => `${part[0]}.`).join(' ')} ${parts[parts.length - 1]}`
    if (shortened.length <= 18) return shortened.toUpperCase()
  }

  return `${clean.slice(0, 15).trimEnd()}...`.toUpperCase()
}

function getStoryMatchUrl(match: MatchRecord) {
  return `${getBaseUrl()}/?match=${match.id}`
}

function getStoryHostLabel(match: MatchRecord) {
  try {
    return new URL(getStoryMatchUrl(match)).host.toUpperCase()
  } catch {
    return 'OUR WEBSITE'
  }
}

/** Optional: pre-rendered headline as SVG <g><path> (from renderTextAsSvgPath). When set, no <text> is used so sharp never needs fonts. */
function buildRenderedCardSvg(
  match: MatchRecord,
  variant: AssetVariant,
  artwork: AssetRecord,
  headlinePathFragment?: string | null
) {
  const artworkUrl = getAssetDataUrl(artwork)
  const accentA = escapeXml(match.team1_palette || '#E4474F')
  const accentB = escapeXml(match.team2_palette || '#2D8CFF')
  const team1Label = escapeXml(getCompactTeamName(match.team1))
  const team2Label = escapeXml(getCompactTeamName(match.team2))
  const dateLabel = escapeXml(formatStoryDateLabel(match.match_time))
  const venueLabel = escapeXml(formatStoryVenueLabel(match.venue))
  const promptLabel = variant === 'result' ? 'FINAL VERDICT' : 'WHO TAKES THE WIN?'
  const buttonVerb = variant === 'result' ? 'VIEW' : 'PICK'
  const footerTitle = variant === 'result' ? 'SEE THE FINAL RESULT' : 'VOTE NOW AND BACK YOUR WINNER'
  const openCardLabel = variant === 'result' ? 'OPEN MATCH RESULT' : 'OPEN PREDICTION CARD'
  const headline =
    headlinePathFragment != null && headlinePathFragment !== ''
      ? headlinePathFragment
      : `<text x="540" y="276" fill="#FFE55C" text-anchor="middle" font-family="${STORY_FONT}" font-size="92" font-weight="900" stroke="#07131F" stroke-width="18" paint-order="stroke fill">${escapeXml(promptLabel)}</text>`
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1920" viewBox="0 0 1080 1920" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="story-top" x1="540" y1="0" x2="540" y2="520" gradientUnits="userSpaceOnUse">
      <stop stop-color="#020611" stop-opacity="0.84"/>
      <stop offset="1" stop-color="#020611" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="story-bottom" x1="540" y1="1320" x2="540" y2="1920" gradientUnits="userSpaceOnUse">
      <stop stop-color="#020611" stop-opacity="0"/>
      <stop offset="1" stop-color="#020611" stop-opacity="0.92"/>
    </linearGradient>
    <linearGradient id="date-pill" x1="188" y1="120" x2="892" y2="202" gradientUnits="userSpaceOnUse">
      <stop stop-color="rgba(12,18,34,0.84)"/>
      <stop offset="1" stop-color="rgba(9,14,28,0.74)"/>
    </linearGradient>
    <linearGradient id="match-bar" x1="74" y1="448" x2="1006" y2="448" gradientUnits="userSpaceOnUse">
      <stop stop-color="rgba(10,15,28,0.82)"/>
      <stop offset="0.5" stop-color="rgba(16,22,37,0.92)"/>
      <stop offset="1" stop-color="rgba(10,15,28,0.82)"/>
    </linearGradient>
    <linearGradient id="cta-shell" x1="88" y1="1438" x2="992" y2="1778" gradientUnits="userSpaceOnUse">
      <stop stop-color="rgba(8,14,30,0.9)"/>
      <stop offset="1" stop-color="rgba(6,10,22,0.82)"/>
    </linearGradient>
    <linearGradient id="team-a-button" x1="118" y1="1576" x2="528" y2="1682" gradientUnits="userSpaceOnUse">
      <stop stop-color="${accentA}"/>
      <stop offset="1" stop-color="#8C1E2D"/>
    </linearGradient>
    <linearGradient id="team-b-button" x1="552" y1="1576" x2="962" y2="1682" gradientUnits="userSpaceOnUse">
      <stop stop-color="${accentB}"/>
      <stop offset="1" stop-color="#124FA6"/>
    </linearGradient>
    <linearGradient id="open-button" x1="328" y1="1820" x2="752" y2="1906" gradientUnits="userSpaceOnUse">
      <stop stop-color="#D7B163"/>
      <stop offset="0.5" stop-color="#C9973E"/>
      <stop offset="1" stop-color="#A97828"/>
    </linearGradient>
    <radialGradient id="vs-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(540 448) rotate(90) scale(134 92)">
      <stop stop-color="#FFD978" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#F3B33A" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="vs-badge" x1="482" y1="390" x2="598" y2="506" gradientUnits="userSpaceOnUse">
      <stop stop-color="rgba(60,43,23,0.95)"/>
      <stop offset="0.5" stop-color="rgba(25,31,55,0.95)"/>
      <stop offset="1" stop-color="rgba(85,53,26,0.95)"/>
    </linearGradient>
  </defs>
  <image href="${artworkUrl}" x="0" y="0" width="1080" height="1920" preserveAspectRatio="xMidYMid slice"/>
  <rect x="0" y="0" width="1080" height="520" fill="url(#story-top)"/>
  <rect x="0" y="1320" width="1080" height="600" fill="url(#story-bottom)"/>
  <rect x="186" y="118" width="708" height="82" rx="40" fill="url(#date-pill)" stroke="rgba(154,177,224,0.28)" stroke-width="2"/>
  <text x="540" y="172" fill="#FFFFFF" text-anchor="middle" font-family="${STORY_FONT}" font-size="34" font-weight="700">${dateLabel}</text>

  ${headline}
  <text x="540" y="250" fill="#E6EAF3" text-anchor="middle" font-family="${STORY_FONT}" font-size="38" font-weight="500">${venueLabel}</text>
  <rect x="74" y="392" width="932" height="112" rx="0" fill="url(#match-bar)" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
  <line x1="74" y1="392" x2="1006" y2="392" stroke="rgba(255,255,255,0.14)" stroke-width="2"/>
  <line x1="74" y1="504" x2="1006" y2="504" stroke="rgba(255,255,255,0.14)" stroke-width="2"/>
  <text x="244" y="464" fill="#FFFFFF" text-anchor="middle" font-family="${STORY_FONT}" font-size="46" font-weight="900">${team1Label}</text>
  <text x="836" y="464" fill="#FFFFFF" text-anchor="middle" font-family="${STORY_FONT}" font-size="46" font-weight="900">${team2Label}</text>
  <circle cx="540" cy="448" r="84" fill="url(#vs-glow)"/>
  <path d="M540 385L586 411V463L540 489L494 463V411L540 385Z" fill="url(#vs-badge)" stroke="#D9B15A" stroke-width="3"/>
  <text x="540" y="454" fill="#FFE374" text-anchor="middle" font-family="${STORY_FONT}" font-size="38" font-weight="900">VS</text>

  <rect x="88" y="1438" width="904" height="258" rx="42" fill="url(#cta-shell)" stroke="rgba(255,255,255,0.18)" stroke-width="3"/>
  <text x="540" y="1500" fill="#FFFFFF" text-anchor="middle" font-family="${STORY_FONT}" font-size="28" font-weight="700">${escapeXml(footerTitle)} *</text>

  <rect x="118" y="1570" width="410" height="106" rx="34" fill="url(#team-a-button)" stroke="rgba(255,255,255,0.2)" stroke-width="3"/>
  <text x="323" y="1611" fill="#FFFFFF" text-anchor="middle" font-family="${STORY_FONT}" font-size="20" font-weight="700" letter-spacing="2">${buttonVerb}</text>
  <text x="323" y="1653" fill="#FFFFFF" text-anchor="middle" font-family="${STORY_FONT}" font-size="36" font-weight="900">${team1Label}</text>

  <rect x="552" y="1570" width="410" height="106" rx="34" fill="url(#team-b-button)" stroke="rgba(255,255,255,0.2)" stroke-width="3"/>
  <text x="757" y="1611" fill="#FFFFFF" text-anchor="middle" font-family="${STORY_FONT}" font-size="20" font-weight="700" letter-spacing="2">${buttonVerb}</text>
  <text x="757" y="1653" fill="#FFFFFF" text-anchor="middle" font-family="${STORY_FONT}" font-size="36" font-weight="900">${team2Label}</text>
  <path d="M540 1544L586 1570V1622L540 1648L494 1622V1570L540 1544Z" fill="url(#vs-badge)" stroke="#D9B15A" stroke-width="3"/>
  <text x="540" y="1613" fill="#FFE374" text-anchor="middle" font-family="${STORY_FONT}" font-size="34" font-weight="900">VS</text>

  <rect x="328" y="1750" width="424" height="88" rx="24" fill="url(#open-button)" stroke="rgba(255,228,178,0.45)" stroke-width="2"/>
  <text x="540" y="1806" fill="#151515" text-anchor="middle" font-family="${STORY_FONT}" font-size="24" font-weight="800">${escapeXml(openCardLabel)}</text>
</svg>`
}

async function upsertAsset(input: {
  matchId: number
  assetType: 'artwork' | 'card'
  assetVariant: AssetVariant
  format: string
  mimeType: string
  contentEncoding: 'utf8' | 'base64'
  title: string
  content: string
  generationStatus: 'generated' | 'fallback' | 'queued' | 'failed'
  sourceModel?: string | null
  promptVersion?: string | null
  imageUrl?: string | null
  renderRecipeVersion?: string | null
  debugPrompt?: string | null
  sourceAssetId?: number | null
  publicationCaption?: string | null
}) {
  const { rows } = await sql<AssetRecord>`
    INSERT INTO generated_assets (
      match_id,
      asset_type,
      asset_variant,
      format,
      mime_type,
      content_encoding,
      title,
      content,
      generation_status,
      source_model,
      prompt_version,
      image_url,
      render_recipe_version,
      debug_prompt,
      source_asset_id,
      publication_caption,
      published_status
    )
    VALUES (
      ${input.matchId},
      ${input.assetType},
      ${input.assetVariant},
      ${input.format},
      ${input.mimeType},
      ${input.contentEncoding},
      ${input.title},
      ${input.content},
      ${input.generationStatus},
      ${input.sourceModel || null},
      ${input.promptVersion || null},
      ${input.imageUrl || null},
      ${input.renderRecipeVersion || null},
      ${input.debugPrompt || null},
      ${input.sourceAssetId || null},
      ${input.publicationCaption || null},
      'ready'
    )
    ON CONFLICT (match_id, asset_type, asset_variant, format)
    DO UPDATE SET
      mime_type = EXCLUDED.mime_type,
      content_encoding = EXCLUDED.content_encoding,
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      generation_status = EXCLUDED.generation_status,
      source_model = EXCLUDED.source_model,
      prompt_version = EXCLUDED.prompt_version,
      image_url = EXCLUDED.image_url,
      render_recipe_version = EXCLUDED.render_recipe_version,
      debug_prompt = EXCLUDED.debug_prompt,
      source_asset_id = EXCLUDED.source_asset_id,
      publication_caption = EXCLUDED.publication_caption,
      published_status = CASE
        WHEN generated_assets.published_status = 'published' THEN generated_assets.published_status
        ELSE 'ready'
      END
    RETURNING *
  `

  return rows[0]
}

async function createArtworkAsset(match: MatchRecord, variant: AssetVariant) {
  const gemini = await generateGeminiPortraitArtwork(match, variant)

  if (gemini.ok) {
    return upsertAsset({
      matchId: match.id,
      assetType: 'artwork',
      assetVariant: variant,
      format: gemini.format,
      mimeType: gemini.mimeType,
      contentEncoding: gemini.contentEncoding,
      title: `${match.team1} vs ${match.team2} ${variant} artwork`,
      content: gemini.content,
      generationStatus: 'generated',
      sourceModel: gemini.sourceModel,
      promptVersion: gemini.promptVersion,
      renderRecipeVersion: null,
      debugPrompt: gemini.prompt,
      publicationCaption: getCaption(match, variant),
    })
  }

  const fallbackContent = buildFallbackArtwork(match, variant)
  return upsertAsset({
    matchId: match.id,
    assetType: 'artwork',
    assetVariant: variant,
    format: 'svg',
    mimeType: 'image/svg+xml',
    contentEncoding: 'utf8',
    title: `${match.team1} vs ${match.team2} ${variant} fallback artwork`,
    content: fallbackContent,
    generationStatus: 'fallback',
    sourceModel: 'fallback-renderer',
    promptVersion: getPromptVersion(),
    debugPrompt: buildGeminiPrompt(match, variant),
    publicationCaption: getCaption(match, variant),
  })
}

async function createRenderedCardAsset(match: MatchRecord, variant: AssetVariant, artwork: AssetRecord) {
  const content = buildRenderedCardSvg(match, variant, artwork)
  return upsertAsset({
    matchId: match.id,
    assetType: 'card',
    assetVariant: variant,
    format: 'svg',
    mimeType: 'image/svg+xml',
    contentEncoding: 'utf8',
    title: `${match.team1} vs ${match.team2} ${variant} card`,
    content,
    generationStatus: artwork.generation_status,
    sourceModel: artwork.source_model,
    promptVersion: artwork.prompt_version,
    renderRecipeVersion: RENDER_RECIPE_VERSION,
    sourceAssetId: artwork.id,
    publicationCaption: getCaption(match, variant),
  })
}

async function getMatchAssets(matchId: number) {
  const { rows } = await sql<AssetRecord>`
    SELECT *
    FROM generated_assets
    WHERE match_id = ${matchId}
    ORDER BY id DESC
  `

  return rows
}

export async function logAutomationRun(jobName: string, status: string, summary: string, payload: unknown) {
  await ensureSchema()
  const { rows } = await sql`
    INSERT INTO automation_runs (job_name, status, summary, payload, finished_at)
    VALUES (${jobName}, ${status}, ${summary}, ${JSON.stringify(payload)}::jsonb, NOW())
    RETURNING *
  `

  return rows[0]
}

export async function fetchFeedMatches() {
  return fetchConfiguredFeedMatches()
}

export async function syncMatchesFromFeed() {
  await ensureSchema()
  const feedMatches = await fetchFeedMatches()

  if (!feedMatches.length) {
    await logAutomationRun('sync_matches', 'skipped', 'No feed configured or provider returned no matches', { count: 0 })
    return { count: 0, staged: [] as unknown[], skipped: true }
  }

  const provider = (process.env.SPORTS_SYNC_PROVIDER || (process.env.SPORTS_SYNC_FEED_URL ? 'custom' : 'thesportsdb')).trim() || 'feed'
  const staged = await stageFeedMatches(feedMatches, provider)
  await logAutomationRun('sync_matches', 'success', `Fetched and staged ${staged.length} feed matches`, { count: staged.length, provider })

  return { count: staged.length, staged, skipped: false }
}

async function reconcileFeedQueueIntoMatches(limit = 100) {
  await ensureSchema()
  const itemIds = await listFeedQueueItemIdsForAutomation(limit)
  const imported: MatchRecord[] = []

  for (const id of itemIds) {
    const match = await importFeedQueueItem(id)
    if (match) {
      imported.push(match)
    }
  }

  return {
    count: imported.length,
    matchIds: imported.map((match) => match.id),
    matches: imported,
  }
}

export async function generateAssetsForMatches(matches: MatchRecord[]) {
  await ensureSchema()
  const generated: AssetRecord[] = []

  for (const incomingMatch of matches) {
    const match = await getMatch(incomingMatch.id) || incomingMatch
    const variants: AssetVariant[] = ['prediction', 'result']

    for (const variant of variants) {
      const artwork = await createArtworkAsset(match, variant)
      const card = await createRenderedCardAsset(match, variant, artwork)
      generated.push(artwork, card)
    }
  }

  await logAutomationRun('generate_assets', 'success', `Generated ${generated.length} assets`, { count: generated.length })
  return generated
}

async function listUnexpectedAssetTypes() {
  const { rows } = await sql<UnexpectedAssetTypeSummary>`
    SELECT asset_type, COUNT(*)::int AS count
    FROM generated_assets
    WHERE LOWER(TRIM(asset_type)) NOT IN ('artwork', 'card')
    GROUP BY asset_type
    ORDER BY asset_type ASC
  `

  return rows
}

async function publishAssets(rows: AssetRecord[], mode: 'queue-only' | 'webhook'): Promise<PublishAssetsResult> {
  const unexpectedAssetTypes = await listUnexpectedAssetTypes()

  if (rows.length === 0) {
    const message = 'No ready card assets to publish.'
    await logAutomationRun('publish_assets', 'skipped', message, {
      count: 0,
      mode,
      anomalies: { unexpectedAssetTypes },
    })
    return {
      published: 0,
      queued: 0,
      mode,
      assets: rows,
      skipped: true,
      message,
      anomalies: { unexpectedAssetTypes },
    }
  }

  const webhookUrl = process.env.PUBLISH_WEBHOOK_URL
  const baseUrl = getBaseUrl()
  const facebookSummary: FacebookPublishSummary = { attempted: 0, success: 0, failed: 0, skipped: false, errors: [], postIds: [] }

  if (!webhookUrl) {
    for (const asset of rows) {
      await sql`
        UPDATE generated_assets
        SET
          published_status = 'published',
          published_to = 'local-app',
          published_at = NOW()
        WHERE id = ${asset.id}
      `

      const assetUrl = `${baseUrl}/api/assets/${asset.id}?format=png`
      const fb = await publishToFacebookStory(assetUrl)
      facebookSummary.attempted += 1
      if (fb.ok) {
        facebookSummary.success += 1
        if (fb.postId) facebookSummary.postIds.push(fb.postId)
      } else if (fb.skipped) {
        facebookSummary.skipped = true
        if (!facebookSummary.errors.includes(fb.reason)) facebookSummary.errors.push(fb.reason)
      } else {
        facebookSummary.failed += 1
        if (fb.error) facebookSummary.errors.push(fb.error)
      }
    }

    const message = `Published ${rows.length} card asset${rows.length === 1 ? '' : 's'} (DB). ${facebookSummary.skipped ? 'Facebook skipped: ' + facebookSummary.errors[0] : facebookSummary.success ? `Facebook: ${facebookSummary.success} story/stories posted.` : facebookSummary.failed ? 'Facebook: ' + (facebookSummary.errors[0] ?? 'failed') : 'No Facebook attempt.'}`
    await logAutomationRun('publish_assets', 'skipped', message, {
      count: rows.length,
      mode,
      facebook: facebookSummary,
      anomalies: { unexpectedAssetTypes },
    })
    return {
      published: rows.length,
      queued: rows.length,
      mode: 'queue-only',
      assets: rows,
      skipped: false,
      message,
      anomalies: { unexpectedAssetTypes },
      facebook: facebookSummary,
    }
  }

  let published = 0
  for (const asset of rows) {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: asset.title,
        caption: asset.publication_caption,
        format: asset.format,
        mimeType: asset.mime_type,
        content: asset.content,
        assetUrl: `${getBaseUrl()}/api/assets/${asset.id}`,
        assetVariant: asset.asset_variant,
      }),
      signal: AbortSignal.timeout(DEFAULT_WEBHOOK_TIMEOUT_MS),
    })

    const nextStatus = response.ok ? 'published' : 'failed'
    const destination = response.headers.get('x-published-to') || webhookUrl

    await sql`
      UPDATE generated_assets
      SET
        published_status = ${nextStatus},
        published_to = ${destination},
        published_at = CASE WHEN ${response.ok} THEN NOW() ELSE published_at END
      WHERE id = ${asset.id}
    `

    if (response.ok) {
      published += 1
      const assetUrl = `${getBaseUrl()}/api/assets/${asset.id}?format=png`
      const fb = await publishToFacebookStory(assetUrl)
      facebookSummary.attempted += 1
      if (fb.ok) {
        facebookSummary.success += 1
        if (fb.postId) facebookSummary.postIds.push(fb.postId)
      } else if (fb.skipped) {
        facebookSummary.skipped = true
        if (!facebookSummary.errors.includes(fb.reason)) facebookSummary.errors.push(fb.reason)
      } else {
        facebookSummary.failed += 1
        if (fb.error) facebookSummary.errors.push(fb.error)
      }
    }
  }

  const message = published === rows.length
    ? `Published ${published} card asset${published === 1 ? '' : 's'}.`
    : `Published ${published} of ${rows.length} card assets.`

  await logAutomationRun('publish_assets', 'success', `Processed ${rows.length} assets`, {
    published,
    queued: rows.length,
    mode,
    facebook: facebookSummary,
    anomalies: { unexpectedAssetTypes },
  })
  return {
    published,
    queued: rows.length,
    mode: 'webhook',
    assets: rows,
    skipped: false,
    message,
    anomalies: { unexpectedAssetTypes },
    facebook: facebookSummary.attempted > 0 ? facebookSummary : undefined,
  }
}

export async function publishReadyAssets() {
  await ensureSchema()
  const { rows } = await sql<AssetRecord>`
    SELECT *
    FROM generated_assets
    WHERE published_status = 'ready'
      AND asset_type = 'card'
    ORDER BY created_at ASC
    LIMIT 20
  `

  return publishAssets(rows, 'queue-only')
}

/** Set a match's card assets to ready so they can be (re-)published. */
export async function setMatchCardsReadyForPublish(matchId: number): Promise<number> {
  await ensureSchema()
  const { rows } = await sql`
    UPDATE generated_assets
    SET published_status = 'ready', published_to = NULL, published_at = NULL
    WHERE match_id = ${matchId} AND asset_type = 'card'
    RETURNING id
  `
  return rows?.length ?? 0
}

export async function publishMatchAssets(matchId: number) {
  await ensureSchema()
  const { rows } = await sql<AssetRecord>`
    SELECT *
    FROM generated_assets
    WHERE match_id = ${matchId}
      AND asset_type = 'card'
      AND published_status = 'ready'
    ORDER BY asset_variant ASC, created_at DESC
  `

  return publishAssets(rows, 'webhook')
}

/** Returns matches whose active variant (prediction or result) is not yet published. */
export async function listUnpublishedMatches(): Promise<MatchRecord[]> {
  const all = await listMatches()
  return all.filter((m) => !isPublishedStatus(getActivePublishStatus(m)))
}

/** Generate assets for matches that need them (no card or card not generated/fallback). Returns count of matches processed. */
async function generateAssetsForMatchesNeedingThem(): Promise<{ matchCount: number; assetCount: number }> {
  const ids = await listMatchIdsNeedingAssetGeneration()
  if (ids.length === 0) return { matchCount: 0, assetCount: 0 }
  const matches: MatchRecord[] = []
  for (const id of ids) {
    const m = await getMatch(id)
    if (m) matches.push(m)
  }
  const generated = matches.length > 0 ? await generateAssetsForMatches(matches) : []
  return { matchCount: matches.length, assetCount: generated.length }
}

/** Generate assets for all unpublished matches, then publish any ready assets. For hourly cron. */
export async function runUnpublishedQueuePipeline() {
  await ensureSchema()
  const sync = await syncMatchesFromFeed()
  const reconciled = await reconcileFeedQueueIntoMatches()
  const { matchCount: needingMatchCount, assetCount: needingAssetCount } = await generateAssetsForMatchesNeedingThem()
  const unpublished = await listUnpublishedMatches()
  const assets = unpublished.length > 0 ? await generateAssetsForMatches(unpublished) : []
  const publish = await publishReadyAssets()

  await logAutomationRun('unpublished_queue', 'success', `Synced ${sync.count}, reconciled ${reconciled.count}, generated for ${needingMatchCount} needing assets and ${unpublished.length} unpublished matches; published ${publish.published}`, {
    syncedCount: sync.count,
    reconciledCount: reconciled.count,
    needingGenerationCount: needingMatchCount,
    unpublishedCount: unpublished.length,
    generatedCount: assets.length + needingAssetCount,
    published: publish.published,
  })

  return {
    sync,
    reconciled,
    needingGenerationCount: needingMatchCount,
    unpublishedCount: unpublished.length,
    assets: { count: assets.length + needingAssetCount },
    publish,
  }
}

export async function runAutomationPipeline() {
  await ensureSchema()
  const sync = await syncMatchesFromFeed()
  const reconciled = await reconcileFeedQueueIntoMatches()
  const { matchCount: needingMatchCount, assetCount: needingAssetCount } = await generateAssetsForMatchesNeedingThem()
  const unpublished = await listUnpublishedMatches()
  const assets = unpublished.length > 0 ? await generateAssetsForMatches(unpublished) : []
  const publish = await publishReadyAssets()

  await logAutomationRun('run_pipeline', 'success', 'Ran sync, asset generation, and publish pipeline', {
    synced: sync.count,
    reconciled: reconciled.count,
    needingGenerationCount: needingMatchCount,
    unpublishedCount: unpublished.length,
    generated: assets.length + needingAssetCount,
    published: publish.published,
  })

  return {
    sync,
    reconciled,
    needingGenerationCount: needingMatchCount,
    unpublishedCount: unpublished.length,
    assets: { count: assets.length + needingAssetCount },
    publish,
  }
}

export async function listAutomationRuns(limit = 10) {
  await ensureSchema()
  const { rows } = await sql`
    SELECT *
    FROM automation_runs
    ORDER BY started_at DESC, id DESC
    LIMIT ${limit}
  `
  return rows
}

export async function getAsset(id: number) {
  await ensureSchema()
  const { rows } = await sql<AssetRecord>`
    SELECT *
    FROM generated_assets
    WHERE id = ${id}
  `
  return rows[0] || null
}

export async function regenerateAssetBundle(matchId: number, variant?: AssetVariant) {
  const match = await getMatch(matchId)
  if (!match) {
    return null
  }

  if (variant) {
    const artwork = await createArtworkAsset(match, variant)
    const card = await createRenderedCardAsset(match, variant, artwork)
    return { artwork, card }
  }

  const assets = await generateAssetsForMatches([match])
  return { assets }
}

export async function getAssetsForMatch(matchId: number) {
  await ensureSchema()
  return getMatchAssets(matchId)
}

/** Returns the card SVG rebuilt from the current template (for PNG export). Headline is rendered as paths so sharp never needs fonts. */
export async function getCardSvgForPublish(cardAssetId: number): Promise<Buffer | null> {
  await ensureSchema()
  const card = await getAsset(cardAssetId)
  if (!card || card.asset_type !== 'card' || card.mime_type !== 'image/svg+xml') return null
  const match = await getMatch(card.match_id)
  if (!match) return null
  const { rows } = await sql<AssetRecord>`
    SELECT * FROM generated_assets
    WHERE match_id = ${card.match_id} AND asset_type = 'artwork' AND asset_variant = ${card.asset_variant}
    LIMIT 1
  `
  const artwork = rows[0]
  if (!artwork) return null
  let headlinePath: string | null = null
  try {
    headlinePath = await renderTextAsSvgPath(card.asset_variant === 'result' ? 'FINAL VERDICT' : 'WHO TAKES THE WIN?', {
      x: 540,
      y: 276,
      fontSize: 92,
      fill: '#FFE55C',
      textAnchor: 'middle',
      stroke: '#07131F',
      strokeWidth: 18,
      shadowColor: '#07131F',
      shadowDy: 12,
      shadowOpacity: 0.45,
    })
  } catch (e) {
    console.warn('[automation] renderTextAsSvgPath failed, card will use fallback text:', e)
  }
  const svg = buildRenderedCardSvg(match, card.asset_variant as AssetVariant, artwork, headlinePath)
  return Buffer.from(svg, 'utf8')
}

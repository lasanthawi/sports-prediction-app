import { sql } from '@vercel/postgres'
import { ensureSchema } from './db'
import { fetchConfiguredFeedMatches, stageFeedMatches } from './feed'
import { buildGeminiPrompt, generateGeminiPortraitArtwork, getPromptVersion } from './gemini'
import { getMatch } from './matches'
import { AssetRecord, AssetVariant, MatchRecord } from './types'

const DEFAULT_WEBHOOK_TIMEOUT_MS = 10000
const RENDER_RECIPE_VERSION = 'portrait-card-v1'

interface UnexpectedAssetTypeSummary {
  asset_type: string
  count: number
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
}

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, 'https://') ||
    process.env.VERCEL_URL?.replace(/^/, 'https://') ||
    'http://localhost:3000'
  )
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

function buildRenderedCardSvg(match: MatchRecord, variant: AssetVariant, artwork: AssetRecord) {
  const artworkUrl = getAssetDataUrl(artwork)
  const isResult = variant === 'result'
  const title = isResult ? 'Result Locked In' : 'Who Takes the Crown?'
  const subline = isResult
    ? match.result_summary || 'Final whistle. Glory claimed.'
    : match.rivalry_tagline || 'Choose your side before kickoff.'
  const accent = isResult ? '#FF67B4' : '#FFD84D'
  const team1Pct = match.poll_team1_votes + match.poll_team2_votes > 0
    ? Math.round((match.poll_team1_votes / (match.poll_team1_votes + match.poll_team2_votes)) * 100)
    : 50
  const team2Pct = 100 - team1Pct

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1920" viewBox="0 0 1080 1920" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="goldBar" x1="40" y1="0" x2="1040" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="#F7C904"/>
      <stop offset="0.5" stop-color="#FFE77A"/>
      <stop offset="1" stop-color="#E8B100"/>
    </linearGradient>
    <linearGradient id="footerBar" x1="0" y1="0" x2="1080" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="#05060F"/>
      <stop offset="1" stop-color="#161A2F"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" rx="48" fill="#070B16"/>
  <rect x="32" y="28" width="1016" height="1864" rx="42" fill="#0A0D18" stroke="rgba(255,216,77,0.66)" stroke-width="4"/>
  <rect x="68" y="48" width="944" height="78" rx="22" fill="url(#goldBar)"/>
  <rect x="70" y="140" width="940" height="152" fill="rgba(0,0,0,0.86)"/>
  <rect x="70" y="292" width="940" height="1208" fill="url(#heroMask)"/>
  <image href="${artworkUrl}" x="70" y="292" width="940" height="1208" preserveAspectRatio="xMidYMid slice"/>
  <rect x="70" y="292" width="940" height="1208" fill="url(#heroOverlay)"/>
  <rect x="70" y="1500" width="940" height="238" rx="28" fill="rgba(5,7,16,0.88)" stroke="rgba(255,255,255,0.12)"/>
  <rect x="70" y="1762" width="940" height="92" fill="url(#footerBar)"/>
  <text x="540" y="226" fill="${accent}" text-anchor="middle" font-family="Arial, sans-serif" font-size="58" font-weight="800" letter-spacing="3">${escapeXml(title)}</text>
  <rect x="114" y="248" width="852" height="64" rx="8" fill="rgba(255,255,255,0.94)"/>
  <text x="540" y="290" fill="#101828" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700">${escapeXml(subline)}</text>
  <text x="120" y="1568" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="66" font-weight="800">${escapeXml(match.team1)}</text>
  <text x="120" y="1648" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="66" font-weight="800">${escapeXml(match.team2)}</text>
  <text x="860" y="1590" fill="#FFD84D" text-anchor="end" font-family="Arial, sans-serif" font-size="28" font-weight="700">${escapeXml(match.sport.toUpperCase())}</text>
  <text x="860" y="1632" fill="#D1D5DB" text-anchor="end" font-family="Arial, sans-serif" font-size="24">${escapeXml(match.league || '')}</text>
  <text x="120" y="1698" fill="#D1D5DB" font-family="Arial, sans-serif" font-size="28">${escapeXml(new Date(match.match_time).toLocaleString())}</text>
  <rect x="120" y="1718" width="400" height="56" rx="28" fill="rgba(92,255,155,0.18)" stroke="rgba(92,255,155,0.46)"/>
  <text x="320" y="1753" fill="#6BFFB1" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700">${isResult ? 'Final community split' : 'Tap your champion'}</text>
  <rect x="120" y="1798" width="376" height="110" rx="28" fill="rgba(92,255,155,0.18)" stroke="rgba(92,255,155,0.42)"/>
  <rect x="584" y="1798" width="376" height="110" rx="28" fill="rgba(255,92,168,0.18)" stroke="rgba(255,92,168,0.42)"/>
  <text x="152" y="1842" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="36" font-weight="800">${escapeXml(match.team1)}</text>
  <text x="152" y="1884" fill="#6BFFB1" font-family="Arial, sans-serif" font-size="26" font-weight="700">${team1Pct}% backing</text>
  <text x="616" y="1842" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="36" font-weight="800">${escapeXml(match.team2)}</text>
  <text x="616" y="1884" fill="#FF76BD" font-family="Arial, sans-serif" font-size="26" font-weight="700">${team2Pct}% backing</text>
  <text x="120" y="1820" fill="rgba(255,255,255,0.66)" font-family="Arial, sans-serif" font-size="16" font-weight="700">BOOSTER PACK</text>
  <text x="540" y="1820" fill="#FFD84D" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700">${isResult ? 'RESULT CARD' : 'PREDICTION CARD'}</text>
  <text x="972" y="1820" fill="rgba(255,255,255,0.66)" text-anchor="end" font-family="Arial, sans-serif" font-size="16" font-weight="700">${escapeXml(match.status.toUpperCase())}</text>
  <defs>
    <linearGradient id="heroMask" x1="540" y1="292" x2="540" y2="1500" gradientUnits="userSpaceOnUse">
      <stop stop-color="rgba(255,255,255,0)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
    <linearGradient id="heroOverlay" x1="540" y1="292" x2="540" y2="1500" gradientUnits="userSpaceOnUse">
      <stop stop-color="rgba(7,11,22,0.16)"/>
      <stop offset="0.55" stop-color="rgba(7,11,22,0.12)"/>
      <stop offset="1" stop-color="rgba(7,11,22,0.72)"/>
    </linearGradient>
  </defs>
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
    }

    const message = `Published ${rows.length} card asset${rows.length === 1 ? '' : 's'} to the local app. External webhook is not configured.`
    await logAutomationRun('publish_assets', 'skipped', message, {
      count: rows.length,
      mode,
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
    }
  }

  const message = published === rows.length
    ? `Published ${published} card asset${published === 1 ? '' : 's'}.`
    : `Published ${published} of ${rows.length} card assets.`

  await logAutomationRun('publish_assets', 'success', `Processed ${rows.length} assets`, {
    published,
    queued: rows.length,
    mode,
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

export async function runAutomationPipeline() {
  await ensureSchema()
  const sync = await syncMatchesFromFeed()
  const assets = [] as AssetRecord[]
  const publish = await publishReadyAssets()

  await logAutomationRun('run_pipeline', 'success', 'Ran sync, asset generation, and publish pipeline', {
    synced: sync.count,
    generated: assets.length,
    published: publish.published,
  })

  return { sync, assets: { count: assets.length }, publish }
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

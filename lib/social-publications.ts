import sharp from 'sharp'
import { sql } from '@vercel/postgres'
import { ensureSchema } from './db'
import { publishFacebookPagePhoto, publishFacebookPageText } from './facebook'
import { listMatches } from './matches'
import { getActivePublishStatus, isPublishedStatus } from './publish'
import { MatchRecord, SocialPostType, SocialPublicationRecord } from './types'

const DEFAULT_DAILY_POST_MATCH_LIMIT = 5
const DEFAULT_DAILY_SCHEDULE_WINDOW_HOURS = 24
const DEFAULT_DAILY_RESULTS_LOOKBACK_HOURS = 24
const DEFAULT_SOCIAL_TIMEZONE = 'Asia/Colombo'

type DailyPostKind = Extract<SocialPostType, 'daily_schedule' | 'daily_results'>

export interface DailyFacebookPostResult {
  postType: DailyPostKind
  selectedMatchIds: number[]
  selectedCount: number
  dedupeKey: string
  skipped: boolean
  skipReason?: string
  facebookPostId?: string
  publicationId?: number
  assetUrl?: string | null
  message: string
  status: 'published' | 'skipped' | 'failed'
}

interface RankedMatch {
  match: MatchRecord
  score: number
  detail: string
}

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, 'https://') ||
    process.env.VERCEL_URL?.replace(/^/, 'https://') ||
    'http://localhost:3000'
  ).replace(/\/$/, '')
}

function getTimezone() {
  return DEFAULT_SOCIAL_TIMEZONE
}

function getEnvNumber(name: string, fallback: number) {
  const value = Number(process.env[name] || '')
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function getLocalDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: getTimezone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatDayLabel(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: getTimezone(),
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function formatMatchTime(matchTime: string) {
  const date = new Date(matchTime)
  if (Number.isNaN(date.getTime())) return 'Time TBD'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: getTimezone(),
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function normalizeKeyPart(value: string | null | undefined) {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function dedupeMatchKey(match: MatchRecord) {
  const date = new Date(match.match_time)
  const dateKey = Number.isNaN(date.getTime()) ? normalizeKeyPart(match.match_time) : date.toISOString().slice(0, 10)
  return [
    normalizeKeyPart(match.sport),
    normalizeKeyPart(match.league),
    normalizeKeyPart(match.team1),
    normalizeKeyPart(match.team2),
    dateKey,
  ].join('|')
}

function leagueWeight(league: string | null | undefined) {
  const normalized = normalizeKeyPart(league)
  const premium = [
    'premier league',
    'uefa champions league',
    'la liga',
    'serie a',
    'bundesliga',
    'ligue 1',
    'nba',
    'nfl',
    'mlb',
    'nhl',
    'ufc',
  ]
  if (premium.some((item) => normalized.includes(item))) return 12
  return normalized ? 4 : 0
}

function sportWeight(sport: string | null | undefined) {
  const normalized = normalizeKeyPart(sport)
  if (['football', 'basketball', 'cricket', 'baseball', 'ice hockey', 'hockey', 'mma'].includes(normalized)) return 8
  return normalized ? 3 : 0
}

function socialPriorityScore(match: MatchRecord, postType: DailyPostKind) {
  const now = Date.now()
  const matchTime = new Date(match.match_time).getTime()
  const hoursFromNow = (matchTime - now) / 36e5
  const published = isPublishedStatus(getActivePublishStatus(match))
  const assetStatus = match.status === 'finished' ? match.result_asset_status : match.prediction_asset_status

  let score = 0
  if (published) score += 20
  if (assetStatus === 'generated') score += 10
  if (assetStatus === 'fallback') score += 6
  if (match.venue) score += 2
  if (match.result_summary) score += 4
  score += leagueWeight(match.league)
  score += sportWeight(match.sport)

  if (postType === 'daily_schedule') {
    if (match.status === 'live') score += 14
    if (hoursFromNow >= 0 && hoursFromNow <= 6) score += 16
    else if (hoursFromNow > 6 && hoursFromNow <= 24) score += 10
    else if (hoursFromNow < -6) score -= 18
  } else {
    if (hoursFromNow <= 0 && hoursFromNow >= -6) score += 18
    else if (hoursFromNow < -6 && hoursFromNow >= -24) score += 10
    else if (hoursFromNow < -24) score -= 16
    if (match.winner) score += 8
  }

  if (match.status === 'cancelled') score -= 100
  return score
}

function resultLine(match: MatchRecord) {
  if (match.winner === 1) return `${match.team1} won`
  if (match.winner === 2) return `${match.team2} won`
  if (match.result_summary?.trim()) return match.result_summary.trim()
  return 'Final result available'
}

function pickDailyMatches(matches: MatchRecord[], postType: DailyPostKind) {
  const limit = getEnvNumber('FB_DAILY_POST_MATCH_LIMIT', DEFAULT_DAILY_POST_MATCH_LIMIT)
  const scheduleWindowHours = getEnvNumber('FB_DAILY_SCHEDULE_WINDOW_HOURS', DEFAULT_DAILY_SCHEDULE_WINDOW_HOURS)
  const resultsWindowHours = getEnvNumber('FB_DAILY_RESULTS_LOOKBACK_HOURS', DEFAULT_DAILY_RESULTS_LOOKBACK_HOURS)
  const now = Date.now()
  const seen = new Set<string>()

  const candidates = matches
    .filter((match) => match.team1?.trim() && match.team2?.trim())
    .filter((match) => {
      const matchTime = new Date(match.match_time).getTime()
      const hoursFromNow = (matchTime - now) / 36e5
      if (postType === 'daily_schedule') {
        return (
          match.status !== 'finished' &&
          match.status !== 'cancelled' &&
          ((hoursFromNow >= 0 && hoursFromNow <= scheduleWindowHours) || (match.status === 'live' && hoursFromNow >= -6))
        )
      }

      return (
        match.status === 'finished' &&
        hoursFromNow <= 0 &&
        hoursFromNow >= -resultsWindowHours &&
        Boolean(match.winner || match.result_summary?.trim())
      )
    })
    .map((match) => ({
      match,
      score: socialPriorityScore(match, postType),
      detail: postType === 'daily_schedule' ? formatMatchTime(match.match_time) : resultLine(match),
    }))
    .sort((a, b) => b.score - a.score || new Date(a.match.match_time).getTime() - new Date(b.match.match_time).getTime())
    .filter((entry) => {
      const key = dedupeMatchKey(entry.match)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  return candidates.slice(0, limit)
}

function buildScheduleCaption(matches: RankedMatch[]) {
  const lines = matches.map((entry, index) => `${index + 1}. ${entry.match.team1} vs ${entry.match.team2} — ${entry.detail}`)
  return [
    `Today’s Vote League schedule is live for ${formatDayLabel()}.`,
    '',
    ...lines,
    '',
    'Which matchup is your lock, and where do you smell an upset?',
    `Drop your picks below and follow the action on ${getBaseUrl()}.`,
  ].join('\n')
}

function buildResultsCaption(matches: RankedMatch[]) {
  const lines = matches.map((entry, index) => `${index + 1}. ${entry.match.team1} vs ${entry.match.team2} — ${entry.detail}`)
  return [
    `Vote League final results for ${formatDayLabel()}.`,
    '',
    ...lines,
    '',
    'Which result surprised you the most, and did the crowd get it right?',
    `Tell us below and catch the latest match cards on ${getBaseUrl()}.`,
  ].join('\n')
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'VL'
}

function svgEscape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function rowY(index: number) {
  return 260 + index * 168
}

function rowColors(match: MatchRecord) {
  return {
    left: match.team1_palette || '#58f4a7',
    right: match.team2_palette || '#ff5ca8',
  }
}

function buildSummarySvg(postType: DailyPostKind, matches: RankedMatch[]) {
  const title = postType === 'daily_schedule' ? 'TODAY’S MATCH SCHEDULE' : 'FINAL RESULTS'
  const subtitle = postType === 'daily_schedule'
    ? 'Pick your locks, call your upsets, and own the comments.'
    : 'The winners are in. Now tell us which result changed the mood.'
  const footer = postType === 'daily_schedule'
    ? 'COMMENT YOUR LOCK + UPSET'
    : 'COMMENT THE BIGGEST SURPRISE'
  const rows = matches.map((entry, index) => {
    const y = rowY(index)
    const colors = rowColors(entry.match)
    return `
      <rect x="72" y="${y}" width="1056" height="136" rx="32" fill="rgba(9,14,28,0.86)" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
      <circle cx="142" cy="${y + 68}" r="34" fill="${colors.left}" fill-opacity="0.18" stroke="${colors.left}" stroke-width="3"/>
      <text x="142" y="${y + 79}" fill="#FFFFFF" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="800">${svgEscape(initials(entry.match.team1))}</text>
      <circle cx="1058" cy="${y + 68}" r="34" fill="${colors.right}" fill-opacity="0.18" stroke="${colors.right}" stroke-width="3"/>
      <text x="1058" y="${y + 79}" fill="#FFFFFF" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="800">${svgEscape(initials(entry.match.team2))}</text>
      <text x="210" y="${y + 52}" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="34" font-weight="800">${svgEscape(entry.match.team1)}</text>
      <text x="210" y="${y + 94}" fill="#B8C4E0" font-family="Arial, sans-serif" font-size="28" font-weight="600">${svgEscape(entry.match.league || entry.match.sport)}</text>
      <text x="990" y="${y + 52}" fill="#FFFFFF" text-anchor="end" font-family="Arial, sans-serif" font-size="34" font-weight="800">${svgEscape(entry.match.team2)}</text>
      <text x="990" y="${y + 94}" fill="#FFE57D" text-anchor="end" font-family="Arial, sans-serif" font-size="24" font-weight="700">${svgEscape(entry.detail)}</text>
      <text x="600" y="${y + 76}" fill="#FFFFFF" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="800">VS</text>
    `
  }).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="1200" viewBox="0 0 1200 1200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="1200" gradientUnits="userSpaceOnUse">
      <stop stop-color="#08111F"/>
      <stop offset="0.55" stop-color="#1A1541"/>
      <stop offset="1" stop-color="#090B15"/>
    </linearGradient>
    <linearGradient id="glow" x1="160" y1="120" x2="1040" y2="1080" gradientUnits="userSpaceOnUse">
      <stop stop-color="rgba(88,244,167,0.18)"/>
      <stop offset="1" stop-color="rgba(255,92,168,0.18)"/>
    </linearGradient>
    <linearGradient id="footer" x1="110" y1="1052" x2="1090" y2="1138" gradientUnits="userSpaceOnUse">
      <stop stop-color="#58F4A7"/>
      <stop offset="1" stop-color="#FF5CA8"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <rect width="1200" height="1200" fill="url(#glow)"/>
  <rect x="44" y="40" width="1112" height="1120" rx="44" fill="rgba(5,9,20,0.36)" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
  <text x="600" y="102" fill="#58F4A7" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="800">VOTE LEAGUE</text>
  <text x="600" y="162" fill="#FFFFFF" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="900">${svgEscape(title)}</text>
  <text x="600" y="206" fill="#B8C4E0" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="500">${svgEscape(subtitle)}</text>
  ${rows}
  <rect x="110" y="1052" width="980" height="88" rx="28" fill="url(#footer)" opacity="0.95"/>
  <text x="600" y="1107" fill="#09111E" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="900">${svgEscape(footer)}</text>
</svg>`
}

async function assertRenderable(svg: string) {
  await sharp(Buffer.from(svg, 'utf8')).png().toBuffer()
}

async function findPublicationByDedupeKey(dedupeKey: string) {
  await ensureSchema()
  const { rows } = await sql<SocialPublicationRecord>`
    SELECT *
    FROM social_publications
    WHERE dedupe_key = ${dedupeKey}
    LIMIT 1
  `
  return rows[0] || null
}

async function createPendingPublication(input: {
  postType: DailyPostKind
  dedupeKey: string
  payload: Record<string, unknown>
}) {
  await ensureSchema()
  const { rows } = await sql<SocialPublicationRecord>`
    INSERT INTO social_publications (
      post_type,
      platform,
      dedupe_key,
      status,
      payload
    )
    VALUES (
      ${input.postType},
      'facebook',
      ${input.dedupeKey},
      'pending',
      ${JSON.stringify(input.payload)}::jsonb
    )
    RETURNING *
  `
  return rows[0]
}

async function updatePublicationAsset(publicationId: number, assetUrl: string, payload: Record<string, unknown>) {
  const { rows } = await sql<SocialPublicationRecord>`
    UPDATE social_publications
    SET asset_url = ${assetUrl}, payload = ${JSON.stringify(payload)}::jsonb
    WHERE id = ${publicationId}
    RETURNING *
  `
  return rows[0]
}

async function finalizePublication(publicationId: number, input: {
  status: 'published' | 'skipped' | 'failed'
  message: string
  externalPostId?: string | null
  assetUrl?: string | null
  payload?: Record<string, unknown>
}) {
  const { rows } = await sql<SocialPublicationRecord>`
    UPDATE social_publications
    SET
      status = ${input.status},
      message = ${input.message},
      external_post_id = ${input.externalPostId || null},
      asset_url = ${input.assetUrl || null},
      payload = ${JSON.stringify(input.payload || {})}::jsonb,
      published_at = CASE WHEN ${input.status} = 'published' THEN NOW() ELSE published_at END
    WHERE id = ${publicationId}
    RETURNING *
  `
  return rows[0]
}

export async function listSocialPublications(limit = 10) {
  await ensureSchema()
  const { rows } = await sql<SocialPublicationRecord>`
    SELECT *
    FROM social_publications
    ORDER BY created_at DESC, id DESC
    LIMIT ${limit}
  `
  return rows
}

export async function getSocialPublication(id: number) {
  await ensureSchema()
  const { rows } = await sql<SocialPublicationRecord>`
    SELECT *
    FROM social_publications
    WHERE id = ${id}
    LIMIT 1
  `
  return rows[0] || null
}

export async function getSocialPublicationSvg(id: number) {
  const publication = await getSocialPublication(id)
  const svg = typeof (publication?.payload as any)?.svg === 'string' ? (publication?.payload as any)?.svg : null
  return svg
}

function buildAssetUrl(publicationId: number) {
  return `${getBaseUrl()}/api/social-publications/${publicationId}/asset?format=png`
}

async function runDailyPost(postType: DailyPostKind): Promise<DailyFacebookPostResult> {
  const dedupeKey = `facebook:${postType}:${getLocalDateKey()}`
  const existing = await findPublicationByDedupeKey(dedupeKey)
  if (existing) {
    return {
      postType,
      selectedMatchIds: Array.isArray((existing.payload as any)?.selectedMatchIds) ? (existing.payload as any).selectedMatchIds : [],
      selectedCount: Array.isArray((existing.payload as any)?.selectedMatchIds) ? (existing.payload as any).selectedMatchIds.length : 0,
      dedupeKey,
      skipped: true,
      skipReason: 'A daily post for this slot already exists.',
      facebookPostId: existing.external_post_id || undefined,
      publicationId: existing.id,
      assetUrl: existing.asset_url,
      message: existing.message || 'Already processed',
      status: existing.status === 'published' ? 'published' : 'skipped',
    }
  }

  const matches = await listMatches(400)
  const selected = pickDailyMatches(matches, postType)
  const selectedMatchIds = selected.map((entry) => entry.match.id)

  if (selected.length < 2) {
    const publication = await createPendingPublication({
      postType,
      dedupeKey,
      payload: { selectedMatchIds, selectedCount: selected.length, skipped: true, reason: 'Not enough strong matches' },
    })
    await finalizePublication(publication.id, {
      status: 'skipped',
      message: 'Skipped: not enough strong matches for a daily post.',
      payload: { selectedMatchIds, selectedCount: selected.length, skipped: true, reason: 'Not enough strong matches' },
    })
    return {
      postType,
      selectedMatchIds,
      selectedCount: selected.length,
      dedupeKey,
      skipped: true,
      skipReason: 'Not enough strong matches for a daily post.',
      publicationId: publication.id,
      message: 'Skipped: not enough strong matches for a daily post.',
      status: 'skipped',
    }
  }

  const caption = postType === 'daily_schedule' ? buildScheduleCaption(selected) : buildResultsCaption(selected)
  const svg = buildSummarySvg(postType, selected)
  const publication = await createPendingPublication({
    postType,
    dedupeKey,
    payload: {
      selectedMatchIds,
      selectedCount: selected.length,
      caption,
      svg,
      dayLabel: formatDayLabel(),
    },
  })

  let assetUrl: string | null = null
  let canRenderImage = false
  try {
    await assertRenderable(svg)
    assetUrl = buildAssetUrl(publication.id)
    await updatePublicationAsset(publication.id, assetUrl, {
      selectedMatchIds,
      selectedCount: selected.length,
      caption,
      svg,
      dayLabel: formatDayLabel(),
    })
    canRenderImage = true
  } catch (error) {
    console.warn('[social] Daily post image render failed, falling back to text post:', error)
  }

  const facebook = canRenderImage && assetUrl
    ? await publishFacebookPagePhoto({ imageUrl: assetUrl, caption })
    : await publishFacebookPageText({ message: caption })

  if (facebook.ok) {
    await finalizePublication(publication.id, {
      status: 'published',
      message: `Published ${postType.replace('_', ' ')} to Facebook.`,
      externalPostId: facebook.postId,
      assetUrl,
      payload: {
        selectedMatchIds,
        selectedCount: selected.length,
        caption,
        svg: canRenderImage ? svg : null,
        imageMode: canRenderImage ? 'photo' : 'text-fallback',
      },
    })
    return {
      postType,
      selectedMatchIds,
      selectedCount: selected.length,
      dedupeKey,
      skipped: false,
      facebookPostId: facebook.postId,
      publicationId: publication.id,
      assetUrl,
      message: `Published ${postType.replace('_', ' ')} to Facebook.`,
      status: 'published',
    }
  }

  const message = facebook.skipped
    ? `Facebook skipped: ${facebook.reason}`
    : `Facebook failed: ${facebook.error}`

  await finalizePublication(publication.id, {
    status: facebook.skipped ? 'skipped' : 'failed',
    message,
    assetUrl,
    payload: {
      selectedMatchIds,
      selectedCount: selected.length,
      caption,
      svg: canRenderImage ? svg : null,
      imageMode: canRenderImage ? 'photo' : 'text-fallback',
      facebook,
    },
  })

  return {
    postType,
    selectedMatchIds,
    selectedCount: selected.length,
    dedupeKey,
    skipped: facebook.skipped,
    skipReason: facebook.skipped ? facebook.reason : facebook.error,
    publicationId: publication.id,
    assetUrl,
    message,
    status: facebook.skipped ? 'skipped' : 'failed',
  }
}

export async function generateDailySchedulePost() {
  return runDailyPost('daily_schedule')
}

export async function generateDailyResultsPost() {
  return runDailyPost('daily_results')
}

export async function runDailyFacebookPosts() {
  const enabled = String(process.env.FB_DAILY_POSTS_ENABLED ?? 'true').trim().toLowerCase()
  if (enabled === 'false' || enabled === '0' || enabled === 'off') {
    return {
      enabled: false,
      schedule: {
        postType: 'daily_schedule' as const,
        selectedMatchIds: [],
        selectedCount: 0,
        dedupeKey: '',
        skipped: true,
        skipReason: 'FB_DAILY_POSTS_ENABLED is disabled',
        message: 'Daily Facebook posts disabled.',
        status: 'skipped' as const,
      },
      results: {
        postType: 'daily_results' as const,
        selectedMatchIds: [],
        selectedCount: 0,
        dedupeKey: '',
        skipped: true,
        skipReason: 'FB_DAILY_POSTS_ENABLED is disabled',
        message: 'Daily Facebook posts disabled.',
        status: 'skipped' as const,
      },
    }
  }

  const [schedule, results] = await Promise.all([
    generateDailySchedulePost(),
    generateDailyResultsPost(),
  ])

  return {
    enabled: true,
    schedule,
    results,
  }
}

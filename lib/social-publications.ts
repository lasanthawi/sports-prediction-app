import sharp from 'sharp'
import { sql } from '@vercel/postgres'
import { ensureSchema } from './db'
import { publishFacebookPagePhoto, publishFacebookPageText } from './facebook'
import { listMatches } from './matches'
import { getActivePublishStatus, isPublishedStatus } from './publish'
import { AssetVariant, MatchRecord, SocialPostType, SocialPublicationRecord } from './types'

const DEFAULT_DAILY_POST_MATCH_LIMIT = 5
const DEFAULT_DAILY_SCHEDULE_WINDOW_HOURS = 24
const DEFAULT_DAILY_RESULTS_LOOKBACK_HOURS = 24
const DEFAULT_SOCIAL_TIMEZONE = 'Asia/Colombo'
const DEFAULT_DAILY_SCHEDULE_HOUR_LOCAL = 8
const DEFAULT_DAILY_RESULTS_HOUR_LOCAL = 20
const DEFAULT_MATCH_POST_RECENCY_HOURS = 72

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

export interface MatchFacebookPostResult {
  postType: 'match_post'
  matchId?: number
  assetId?: number
  assetVariant?: AssetVariant
  dedupeKey?: string
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

function getEnvBoolean(name: string, fallback: boolean) {
  const value = process.env[name]
  if (value == null || value.trim() === '') return fallback
  const normalized = value.trim().toLowerCase()
  return !['false', '0', 'off', 'no'].includes(normalized)
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

function getLocalHour(date = new Date()) {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: getTimezone(),
    hour: 'numeric',
    hour12: false,
  }).format(date)

  return Number(formatted)
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

function buildMatchPostTitle(match: MatchRecord, variant: AssetVariant) {
  return variant === 'result'
    ? `${match.team1} vs ${match.team2}`
    : `${match.team1} vs ${match.team2}`
}

function buildMatchPostDescription(match: MatchRecord, variant: AssetVariant) {
  const timeVenueLine = [formatMatchTime(match.match_time), match.venue?.trim()].filter(Boolean).join(' • ')

  if (variant === 'result') {
    return match.result_summary?.trim() || resultLine(match)
  }

  return timeVenueLine || 'Vote now on the latest matchup.'
}

function buildMatchPostBadge(match: MatchRecord, variant: AssetVariant) {
  if (variant === 'result') {
    return 'FINAL RESULT'
  }

  return match.status === 'live' ? 'LIVE NOW' : 'MATCH PREVIEW'
}

function wrapSvgLines(text: string, maxCharsPerLine: number, maxLines: number) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxCharsPerLine) {
      current = next
      continue
    }

    if (current) {
      lines.push(current)
      if (lines.length === maxLines) return lines
    }

    current = word
  }

  if (current && lines.length < maxLines) {
    lines.push(current)
  }

  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    const last = lines[maxLines - 1]
    lines[maxLines - 1] = last.length > maxCharsPerLine - 3
      ? `${last.slice(0, Math.max(0, maxCharsPerLine - 3)).trimEnd()}...`
      : `${last}...`
  }

  return lines
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

function buildMatchPostSvg(match: MatchRecord, variant: AssetVariant) {
  const badge = buildMatchPostBadge(match, variant)
  const title = buildMatchPostTitle(match, variant)
  const description = buildMatchPostDescription(match, variant)
  const meta = [match.league || match.sport, formatMatchTime(match.match_time)].filter(Boolean).join(' • ')
  const accentLeft = match.team1_palette || '#58F4A7'
  const accentRight = match.team2_palette || '#FF5CA8'
  const footer = variant === 'result' ? 'See the final verdict on Vote League' : 'Comment your pick on Vote League'
  const titleLines = wrapSvgLines(title, 20, 2)
  const descriptionLines = wrapSvgLines(description, 30, 3)
  const titleSvg = titleLines
    .map((line, index) => `<text x="116" y="${256 + index * 76}" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="78" font-weight="900">${svgEscape(line)}</text>`)
    .join('')
  const descriptionSvg = descriptionLines
    .map((line, index) => `<text x="116" y="${556 + index * 66}" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="56" font-weight="700">${svgEscape(line)}</text>`)
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="1200" viewBox="0 0 1200 1200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="84" y1="92" x2="1112" y2="1118" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0B1321"/>
      <stop offset="0.55" stop-color="#121E36"/>
      <stop offset="1" stop-color="#0A0F18"/>
    </linearGradient>
    <linearGradient id="accent" x1="116" y1="1012" x2="1084" y2="1012" gradientUnits="userSpaceOnUse">
      <stop stop-color="${svgEscape(accentLeft)}"/>
      <stop offset="1" stop-color="${svgEscape(accentRight)}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="#08111F"/>
  <circle cx="188" cy="178" r="240" fill="${svgEscape(accentLeft)}" fill-opacity="0.18"/>
  <circle cx="1012" cy="224" r="286" fill="${svgEscape(accentRight)}" fill-opacity="0.16"/>
  <rect x="56" y="56" width="1088" height="1088" rx="44" fill="url(#bg)" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
  <rect x="116" y="116" width="234" height="56" rx="28" fill="rgba(88,244,167,0.14)" stroke="rgba(88,244,167,0.38)" stroke-width="2"/>
  <text x="233" y="152" fill="#D6FFE9" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="800">${svgEscape(badge)}</text>
  ${titleSvg}
  <text x="116" y="328" fill="#B8C4E0" font-family="Arial, sans-serif" font-size="30" font-weight="600">${svgEscape(meta)}</text>
  <rect x="116" y="396" width="968" height="334" rx="34" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
  <text x="116" y="470" fill="#FFE57D" font-family="Arial, sans-serif" font-size="28" font-weight="800">${svgEscape(variant === 'result' ? 'SUMMARY' : 'DETAILS')}</text>
  ${descriptionSvg}
  <text x="116" y="876" fill="#7F8DAA" font-family="Arial, sans-serif" font-size="30" font-weight="600">${svgEscape(match.team1)}</text>
  <text x="600" y="876" fill="#FFE57D" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="900">VS</text>
  <text x="1084" y="876" fill="#7F8DAA" text-anchor="end" font-family="Arial, sans-serif" font-size="30" font-weight="600">${svgEscape(match.team2)}</text>
  <rect x="116" y="972" width="968" height="92" rx="28" fill="url(#accent)"/>
  <text x="600" y="1030" fill="#08111F" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="900">${svgEscape(footer)}</text>
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
  postType: SocialPostType
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

function getMatchPostCaption(match: MatchRecord, variant: AssetVariant) {
  const matchUrl = `${getBaseUrl()}/?match=${match.id}`
  const dateLabel = formatMatchTime(match.match_time)

  if (variant === 'result') {
    return [
      `Final verdict: ${match.team1} vs ${match.team2}.`,
      resultLine(match),
      '',
      'Did the crowd call it right, or did this one flip the script?',
      `See the latest card and drop your take: ${matchUrl}`,
    ].join('\n')
  }

  return [
    `Battle card drop: ${match.team1} vs ${match.team2}.`,
    `${dateLabel}${match.venue ? ` • ${match.venue}` : ''}`,
    '',
    'Who are you backing in this clash?',
    `Comment your pick and open the matchup: ${matchUrl}`,
  ].join('\n')
}

function isReservedDailyPostHour(date = new Date()) {
  if (!getEnvBoolean('FB_DAILY_POSTS_ENABLED', true)) {
    return false
  }
  const localHour = getLocalHour(date)
  const scheduleHour = getEnvNumber('FB_DAILY_SCHEDULE_HOUR_LOCAL', DEFAULT_DAILY_SCHEDULE_HOUR_LOCAL)
  const resultsHour = getEnvNumber('FB_DAILY_RESULTS_HOUR_LOCAL', DEFAULT_DAILY_RESULTS_HOUR_LOCAL)
  return localHour === scheduleHour || localHour === resultsHour
}

async function selectNextMatchPostCandidate() {
  await ensureSchema()
  const recencyHours = getEnvNumber('FB_MATCH_POST_RECENCY_HOURS', DEFAULT_MATCH_POST_RECENCY_HOURS)
  const { rows } = await sql<(MatchRecord & {
    asset_id: number
    asset_variant: AssetVariant
    asset_caption: string | null
    asset_published_at: string
  })>`
    SELECT
      m.*,
      ga.id AS asset_id,
      ga.asset_variant AS asset_variant,
      ga.publication_caption AS asset_caption,
      ga.published_at AS asset_published_at
    FROM generated_assets ga
    INNER JOIN matches m
      ON m.id = ga.match_id
    WHERE LOWER(TRIM(ga.published_status)) = 'published'
      AND ga.asset_type = 'card'
      AND LOWER(TRIM(COALESCE(ga.generation_status, ''))) = 'generated'
      AND ga.published_at IS NOT NULL
      AND ga.published_at >= NOW() - (${recencyHours} * INTERVAL '1 hour')
      AND m.status <> 'cancelled'
      AND (
        (ga.asset_variant = 'prediction' AND m.status IN ('upcoming', 'live'))
        OR (ga.asset_variant = 'result' AND m.status = 'finished')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM social_publications sp
        WHERE sp.dedupe_key = CONCAT('facebook:match_post:asset:', ga.id::text)
      )
    ORDER BY
      CASE
        WHEN ga.asset_variant = 'result' AND m.status = 'finished' THEN 0
        WHEN ga.asset_variant = 'prediction' AND m.status IN ('upcoming', 'live') THEN 1
        ELSE 2
      END,
      ga.published_at DESC,
      ga.id DESC
    LIMIT 1
  `

  return rows[0] || null
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

export async function generateFacebookMatchPost(): Promise<MatchFacebookPostResult> {
  if (!getEnvBoolean('FB_MATCH_POSTS_ENABLED', true)) {
    return {
      postType: 'match_post',
      skipped: true,
      skipReason: 'FB_MATCH_POSTS_ENABLED is disabled',
      message: 'Facebook match posts are disabled.',
      status: 'skipped',
    }
  }

  if (isReservedDailyPostHour()) {
    return {
      postType: 'match_post',
      skipped: true,
      skipReason: 'Reserved for daily Facebook schedule/results posts.',
      message: 'Skipped match post because this hour is reserved for daily summary posts.',
      status: 'skipped',
    }
  }

  const candidate = await selectNextMatchPostCandidate()
  if (!candidate) {
    return {
      postType: 'match_post',
      skipped: true,
      skipReason: 'No eligible published match cards are waiting for a page post.',
      message: 'Skipped: no eligible published match cards are waiting for a page post.',
      status: 'skipped',
    }
  }

  const dedupeKey = `facebook:match_post:asset:${candidate.asset_id}`
  const existing = await findPublicationByDedupeKey(dedupeKey)
  if (existing) {
    return {
      postType: 'match_post',
      matchId: candidate.id,
      assetId: candidate.asset_id,
      assetVariant: candidate.asset_variant,
      dedupeKey,
      skipped: true,
      skipReason: 'This asset already has a Facebook page post.',
      facebookPostId: existing.external_post_id || undefined,
      publicationId: existing.id,
      assetUrl: existing.asset_url,
      message: existing.message || 'Already processed',
      status: existing.status === 'published' ? 'published' : 'skipped',
    }
  }

  const caption = candidate.asset_caption?.trim() || getMatchPostCaption(candidate, candidate.asset_variant)
  const assetUrl = `${getBaseUrl()}/api/assets/${candidate.asset_id}?format=png`
  const publication = await createPendingPublication({
    postType: 'match_post',
    dedupeKey,
    payload: {
      matchId: candidate.id,
      assetId: candidate.asset_id,
      assetVariant: candidate.asset_variant,
      caption,
      imageMode: 'published-card',
      assetUrl,
    },
  })
  await updatePublicationAsset(publication.id, assetUrl, {
    matchId: candidate.id,
    assetId: candidate.asset_id,
    assetVariant: candidate.asset_variant,
    caption,
    imageMode: 'published-card',
    assetUrl,
  })

  const facebook = await publishFacebookPagePhoto({ imageUrl: assetUrl, caption })

  if (facebook.ok) {
    await finalizePublication(publication.id, {
      status: 'published',
      message: `Published ${candidate.asset_variant} match post to Facebook.`,
      externalPostId: facebook.postId,
      assetUrl,
      payload: {
        matchId: candidate.id,
        assetId: candidate.asset_id,
        assetVariant: candidate.asset_variant,
        caption,
        imageMode: 'published-card',
        assetUrl,
      },
    })

    return {
      postType: 'match_post',
      matchId: candidate.id,
      assetId: candidate.asset_id,
      assetVariant: candidate.asset_variant,
      dedupeKey,
      skipped: false,
      facebookPostId: facebook.postId,
      publicationId: publication.id,
      assetUrl,
      message: `Published ${candidate.asset_variant} match post to Facebook.`,
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
        matchId: candidate.id,
        assetId: candidate.asset_id,
        assetVariant: candidate.asset_variant,
        caption,
        imageMode: 'published-card',
        assetUrl,
        facebook,
      },
  })

  return {
    postType: 'match_post',
    matchId: candidate.id,
    assetId: candidate.asset_id,
    assetVariant: candidate.asset_variant,
    dedupeKey,
    skipped: facebook.skipped,
    skipReason: facebook.skipped ? facebook.reason : facebook.error,
    publicationId: publication.id,
    assetUrl,
    message,
    status: facebook.skipped ? 'skipped' : 'failed',
  }
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

import sharp from 'sharp'
import { MatchRecord } from './types'

const DEFAULT_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image-preview'
const PROMPT_VERSION = 'gemini-match-card-v2'

function safe(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback
}

export function getPromptVersion() {
  return PROMPT_VERSION
}

export function buildGeminiPrompt(match: MatchRecord, variant: 'prediction' | 'result') {
  const team1Palette = safe(match.team1_palette, 'team one authentic colors')
  const team2Palette = safe(match.team2_palette, 'team two authentic colors')
  const team1Flag = safe(match.team1_flag_colors, 'flag-inspired gradients')
  const team2Flag = safe(match.team2_flag_colors, 'flag-inspired gradients')
  const captain1 = safe(match.team1_captain, `${match.team1} star captain`)
  const captain2 = safe(match.team2_captain, `${match.team2} star captain`)
  const style = safe(match.art_style, 'photoreal cinematic sports poster')
  const creativeDirection = safe(
    match.creative_direction,
    'realistic stadium battle scene with both captains in dynamic action, dramatic split lighting, storm energy, smoke, sparks, and clean negative space for overlay UI'
  )

  const variantBrief =
    variant === 'result'
      ? `Show the winner with stronger heroic emphasis and the loser with dramatic tension. Mood should feel decisive, realistic, celebratory, and endgame-ready. Match result context: ${safe(match.result_summary, 'final result not supplied yet')}.`
      : 'Build anticipation before kickoff with both captains looking battle-ready, charging toward each other, and framed like a blockbuster rivalry poster.'

  return [
    'Create a portrait 9:16 realistic hero artwork for a sports match prediction card background.',
    `Visual style: ${style}.`,
    `Creative direction: ${creativeDirection}.`,
    `Match: ${match.team1} versus ${match.team2}. Sport: ${match.sport}. League: ${safe(match.league, 'major competition')}. Venue: ${safe(match.venue, 'stadium atmosphere')}.`,
    `Feature the captains prominently: ${captain1} for ${match.team1}; ${captain2} for ${match.team2}. Make them feel like real elite athletes in action, not illustrated icons or silhouettes.`,
    `Integrate ${match.team1} palette (${team1Palette}) and flag colors (${team1Flag}) on one side of the composition; integrate ${match.team2} palette (${team2Palette}) and flag colors (${team2Flag}) on the other side.`,
    `Rivalry angle: ${safe(match.rivalry_tagline, `${match.team1} and ${match.team2} in a high-stakes showdown`)}.`,
    variantBrief,
    'Scene should look like a dramatic match battle poster in a realistic stadium, with cinematic lighting, atmospheric smoke, sparks, and energy between the players.',
    'Do not include any text, logos, scoreboards, badges, UI buttons, countdowns, percentage bars, card frames, packaging, or watermarks.',
    'Do not generate a flyer template or trading card template. This is only the raw realistic background artwork.',
    'Reserve clear negative space for a top title band, a center versus zone, a lower vote CTA area, and a footer strip.',
    'Faces must stay visible and not be covered by foreground effects.',
    'Output polished realistic vertical key art suitable as the background of a premium sports prediction card.',
  ].join(' ')
}

function extractInlineImage(payload: any) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : []
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts
    if (!Array.isArray(parts)) {
      continue
    }

    for (const part of parts) {
      if (part?.inlineData?.data && part?.inlineData?.mimeType?.startsWith('image/')) {
        return {
          mimeType: part.inlineData.mimeType as string,
          data: part.inlineData.data as string,
        }
      }
    }
  }

  return null
}

export async function generateGeminiPortraitArtwork(match: MatchRecord, variant: 'prediction' | 'result') {
  const apiKey = process.env.GEMINI_API_KEY
  const prompt = buildGeminiPrompt(match, variant)

  if (!apiKey) {
    return {
      ok: false as const,
      reason: 'missing_api_key',
      prompt,
    }
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${apiKey}`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
      imageConfig: {
        aspectRatio: '9:16',
      },
    }),
  })

  if (!response.ok) {
    return {
      ok: false as const,
      reason: `gemini_${response.status}`,
      prompt,
      details: await response.text(),
    }
  }

  const payload = await response.json()
  const image = extractInlineImage(payload)
  if (!image) {
    return {
      ok: false as const,
      reason: 'no_image_returned',
      prompt,
      details: JSON.stringify(payload),
    }
  }

  const sourceBuffer = Buffer.from(image.data, 'base64')
  const webpBuffer = await sharp(sourceBuffer)
    .resize({ width: 1080, height: 1920, fit: 'cover' })
    .webp({ quality: 86 })
    .toBuffer()

  return {
    ok: true as const,
    prompt,
    mimeType: 'image/webp',
    format: 'webp',
    contentEncoding: 'base64' as const,
    content: webpBuffer.toString('base64'),
    sourceModel: DEFAULT_MODEL,
    promptVersion: PROMPT_VERSION,
  }
}

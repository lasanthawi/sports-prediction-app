const FB_GRAPH_VERSION = 'v19.0'
const FACEBOOK_API_TIMEOUT_MS = 8000

export type FacebookPublishResult =
  | { ok: true; postId?: string }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; error: string }

function getFacebookConfig() {
  const pageId = process.env.FB_PAGE_ID
  const accessToken = process.env.FB_PAGE_ACCESS_TOKEN

  if (!pageId || !accessToken) {
    return null
  }

  return { pageId, accessToken }
}

function normalizeAssetUrl(assetUrl: string) {
  return assetUrl.replace(/([^:]\/)\/+/g, '$1')
}

function validatePublicAssetUrl(assetUrl: string): FacebookPublishResult | null {
  const normalized = normalizeAssetUrl(assetUrl)
  if (normalized.startsWith('http://localhost') || normalized.startsWith('http://127.0.0.1')) {
    console.error('[Facebook] Asset URL is localhost; Facebook cannot fetch it.')
    return {
      ok: false,
      skipped: false,
      error: 'Asset URL must be public HTTPS. Facebook cannot fetch localhost. Set NEXT_PUBLIC_APP_URL to your deployed URL.',
    }
  }

  return null
}

async function postForm(endpoint: string, params: URLSearchParams) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    signal: AbortSignal.timeout(FACEBOOK_API_TIMEOUT_MS),
  })

  const data = (await response.json()) as {
    id?: string
    post_id?: string
    success?: boolean
    error?: { message?: string }
  }

  if (!response.ok || data.error) {
    throw new Error(`Facebook API Error: ${data.error?.message || 'Request failed'}`)
  }

  return data
}

export async function publishToFacebookStory(assetUrl: string, _caption?: string): Promise<FacebookPublishResult> {
  const config = getFacebookConfig()
  if (!config) {
    console.log('[Facebook] Skipping FB Story publish. FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN not configured.')
    return { ok: false, skipped: true, reason: 'FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN not set' }
  }

  const invalid = validatePublicAssetUrl(assetUrl)
  if (invalid) return invalid
  const normalizedUrl = normalizeAssetUrl(assetUrl)

  console.log(`[Facebook] Publishing story to Page ${config.pageId}...`)

  try {
    const uploadParams = new URLSearchParams()
    uploadParams.append('access_token', config.accessToken)
    uploadParams.append('url', normalizedUrl)
    uploadParams.append('published', 'false')
    const uploadData = await postForm(`https://graph.facebook.com/${FB_GRAPH_VERSION}/${config.pageId}/photos`, uploadParams)

    const photoId = uploadData.id
    if (!photoId) {
      throw new Error('Facebook did not return a photo id')
    }

    const storyParams = new URLSearchParams()
    storyParams.append('access_token', config.accessToken)
    storyParams.append('photo_id', photoId)
    const storyData = await postForm(`https://graph.facebook.com/${FB_GRAPH_VERSION}/${config.pageId}/photo_stories`, storyParams)

    const postId = storyData.post_id || storyData.id
    console.log('[Facebook] Successfully published story ID:', postId)
    return { ok: true, postId: String(postId || '') || undefined }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Facebook] Failed to publish story:', error)
    return { ok: false, skipped: false, error: msg }
  }
}

export async function publishFacebookPagePhoto(input: {
  imageUrl: string
  caption: string
}): Promise<FacebookPublishResult> {
  const config = getFacebookConfig()
  if (!config) {
    return { ok: false, skipped: true, reason: 'FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN not set' }
  }

  const invalid = validatePublicAssetUrl(input.imageUrl)
  if (invalid) return invalid
  const normalizedUrl = normalizeAssetUrl(input.imageUrl)

  try {
    const params = new URLSearchParams()
    params.append('access_token', config.accessToken)
    params.append('url', normalizedUrl)
    params.append('published', 'true')
    params.append('message', input.caption)

    const data = await postForm(`https://graph.facebook.com/${FB_GRAPH_VERSION}/${config.pageId}/photos`, params)
    return { ok: true, postId: String(data.post_id || data.id || '') || undefined }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Facebook] Failed to publish page photo:', error)
    return { ok: false, skipped: false, error: msg }
  }
}

export async function publishFacebookPageText(input: {
  message: string
}): Promise<FacebookPublishResult> {
  const config = getFacebookConfig()
  if (!config) {
    return { ok: false, skipped: true, reason: 'FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN not set' }
  }

  try {
    const params = new URLSearchParams()
    params.append('access_token', config.accessToken)
    params.append('message', input.message)

    const data = await postForm(`https://graph.facebook.com/${FB_GRAPH_VERSION}/${config.pageId}/feed`, params)
    return { ok: true, postId: String(data.post_id || data.id || '') || undefined }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Facebook] Failed to publish page text:', error)
    return { ok: false, skipped: false, error: msg }
  }
}

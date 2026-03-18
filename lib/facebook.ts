export async function publishToFacebookStory(assetUrl: string, caption?: string) {
  const pageId = process.env.FB_PAGE_ID
  const accessToken = process.env.FB_PAGE_ACCESS_TOKEN

  if (!pageId || !accessToken) {
    console.log('[Facebook] Skipping FB Story publish. FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN not configured.')
    return false
  }

  console.log(`[Facebook] Publishing story to Page ${pageId}...`)

  try {
    // Construct the Facebook Graph API Endpoint for posting to a Page Story
    const endpoint = `https://graph.facebook.com/v19.0/${pageId}/photo_stories`
    
    // We send standard URL encoded parameters expected by Graph API
    const params = new URLSearchParams()
    params.append('access_token', accessToken)
    params.append('url', assetUrl)
    
    // Optionally FB API can take a caption? No, for photo_stories it's generally just the media.
    // If you need more complex stories you use ig_user_id or video_stories. Page photo_stories are fairly simple.

    const response = await fetch(`${endpoint}?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[Facebook] Graph API Error:', data.error?.message || data)
      throw new Error(`Facebook API Error: ${data.error?.message || 'Unknown error'}`)
    }

    console.log('[Facebook] Successfully published story ID:', data.post_id || data.id)
    return true
  } catch (error) {
    console.error('[Facebook] Failed to publish story:', error)
    return false
  }
}

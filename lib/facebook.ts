const FB_GRAPH_VERSION = 'v19.0'

/**
 * Publishes an image as a Facebook Page Story using the official two-step flow:
 * 1. Upload photo via Page Photos API (published=false) → get photo_id
 * 2. Publish story via Page Photo Stories API with photo_id
 *
 * We send a URL to Facebook (not base64). FB’s servers fetch the image from that URL,
 * so the response must be raw image bytes with a supported type. FB Stories accept
 * only: .jpeg, .bmp, .png, .gif, .tiff. SVG is not supported.
 *
 * Requires env: FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN.
 * Page token must have: pages_show_list, pages_read_engagement, pages_manage_posts.
 */
export async function publishToFacebookStory(assetUrl: string, _caption?: string) {
  const pageId = process.env.FB_PAGE_ID
  const accessToken = process.env.FB_PAGE_ACCESS_TOKEN

  if (!pageId || !accessToken) {
    console.log('[Facebook] Skipping FB Story publish. FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN not configured.')
    return false
  }

  console.log(`[Facebook] Publishing story to Page ${pageId}...`)

  try {
    // Step 1: Upload photo to Page (unpublished) so we get a photo_id.
    // Facebook fetches the image from assetUrl; it must be publicly accessible (HTTPS).
    const photosEndpoint = `https://graph.facebook.com/${FB_GRAPH_VERSION}/${pageId}/photos`
    const uploadParams = new URLSearchParams()
    uploadParams.append('access_token', accessToken)
    uploadParams.append('url', assetUrl)
    uploadParams.append('published', 'false')

    const uploadRes = await fetch(photosEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: uploadParams.toString(),
    })
    const uploadData = (await uploadRes.json()) as { id?: string; error?: { message?: string } }

    if (!uploadRes.ok || uploadData.error) {
      console.error('[Facebook] Photo upload error:', uploadData.error?.message || uploadData)
      throw new Error(`Facebook API Error: ${uploadData.error?.message || 'Upload failed'}`)
    }

    const photoId = uploadData.id
    if (!photoId) {
      throw new Error('Facebook did not return a photo id')
    }

    // Step 2: Publish the uploaded photo as a Page Story.
    const storiesEndpoint = `https://graph.facebook.com/${FB_GRAPH_VERSION}/${pageId}/photo_stories`
    const storyParams = new URLSearchParams()
    storyParams.append('access_token', accessToken)
    storyParams.append('photo_id', photoId)

    const storyRes = await fetch(storiesEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: storyParams.toString(),
    })
    const storyData = (await storyRes.json()) as { post_id?: string; id?: string; success?: boolean; error?: { message?: string } }

    if (!storyRes.ok || storyData.error) {
      console.error('[Facebook] Story publish error:', storyData.error?.message || storyData)
      throw new Error(`Facebook API Error: ${storyData.error?.message || 'Story publish failed'}`)
    }

    console.log('[Facebook] Successfully published story ID:', storyData.post_id || storyData.id)
    return true
  } catch (error) {
    console.error('[Facebook] Failed to publish story:', error)
    return false
  }
}

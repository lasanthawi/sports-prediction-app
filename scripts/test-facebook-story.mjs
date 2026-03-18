#!/usr/bin/env node
/**
 * Test Facebook Story publishing only (no DB publish, no webhook).
 * Usage: yarn test:facebook-story <matchId>
 * Example: yarn test:facebook-story 59
 *
 * Requires: dev server running (yarn dev), FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN set.
 * The app URL must be public HTTPS (NEXT_PUBLIC_APP_URL) so Facebook can fetch the image — localhost will fail.
 */
const matchIdArg = process.argv[2]
const matchId = matchIdArg ? parseInt(matchIdArg, 10) : null
if (!Number.isInteger(matchId) || matchId <= 0) {
  console.error('Usage: yarn test:facebook-story <matchId>')
  console.error('Example: yarn test:facebook-story 59')
  process.exit(1)
}

const bases = ['http://localhost:3001', 'http://localhost:3000']

async function run() {
  for (const base of bases) {
    try {
      const url = `${base}/api/automation/test-facebook`
      console.log(`POST ${url} (Facebook Story only, matchId=${matchId}) ...`)
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      })
      const text = await res.text()
      let data
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        console.error('Server returned non-JSON:', text.slice(0, 200))
        process.exit(1)
      }
      if (!res.ok) {
        console.error('Error', res.status, data)
        process.exit(1)
      }
      console.log(JSON.stringify(data, null, 2))
      if (data.facebook?.ok) {
        console.log('\nSuccess: Story posted to your Facebook Page. Check Facebook.')
      } else if (data.facebook?.skipped) {
        console.log('\nSkipped:', data.facebook.reason)
        console.log('Set FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN in .env.local (or Vercel) and restart the dev server.')
      } else if (data.facebook && !data.facebook.ok) {
        console.log('\nFailed:', data.facebook.error)
        if (data.assetUrl && (data.assetUrl.includes('localhost') || data.assetUrl.includes('127.0.0.1'))) {
          console.log('\nYour asset URL is localhost — Facebook’s servers cannot reach it.')
          console.log('Deploy the app (e.g. Vercel) or use ngrok, then set NEXT_PUBLIC_APP_URL to that public HTTPS URL.')
        }
      }
      return
    } catch (e) {
      if (e.cause?.code === 'ECONNREFUSED') continue
      throw e
    }
  }
  console.error('Could not reach dev server. Start it with: yarn dev')
  process.exit(1)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

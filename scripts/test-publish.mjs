#!/usr/bin/env node
/**
 * Test publish:
 *   yarn test:publish           - runs full pipeline (sync → generate → publish)
 *   yarn test:publish <matchId> - resets that match's cards to ready and publishes (for already-generated matches)
 * Start the dev server first: yarn dev (often on http://localhost:3001 if 3000 is in use).
 */
const bases = ['http://localhost:3001', 'http://localhost:3000'];
const matchIdArg = process.argv[2];
const matchId = matchIdArg ? parseInt(matchIdArg, 10) : null;
const publishMatch = Number.isInteger(matchId) && matchId > 0;

async function run() {
  for (const base of bases) {
    try {
      let url, body, label;
      if (publishMatch) {
        url = `${base}/api/automation/publish`;
        body = JSON.stringify({ matchId });
        label = `publish match ${matchId}`;
      } else {
        url = `${base}/api/automation/run`;
        body = '{}';
        label = 'sync + generate + publish';
      }
      console.log(`POST ${url} (${label}) ...`);
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        console.error(`Server returned non-JSON (status ${res.status}). Response starts with: ${text.slice(0, 120)}...`);
        if (text.trimStart().startsWith('<!')) {
          console.error('Tip: You may have hit a 404 or error page. Ensure the dev server is running and the route exists.');
        }
        process.exit(1);
      }
      if (!res.ok) {
        if (!publishMatch && res.status === 404) {
          console.log('Pipeline route not found, trying publish-only...');
          const pubRes = await fetch(`${base}/api/automation/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
          const pubText = await pubRes.text();
          let pubData;
          try {
            pubData = pubText ? JSON.parse(pubText) : {};
          } catch {
            console.error('Publish endpoint also returned non-JSON.');
            process.exit(1);
          }
          console.log(JSON.stringify({ published: pubData.published, queued: pubData.queued, skipped: pubData.skipped, message: pubData.message }, null, 2));
          return;
        }
        console.error('Error:', res.status, data);
        process.exit(1);
      }
      if (publishMatch && data.matchLabel != null) {
        const out = {
          matchId: data.matchId,
          match: data.matchLabel,
          cardsResetToReady: data.cardsResetToReady,
          published: data.published,
          queued: data.queued,
          skipped: data.skipped,
          message: data.message,
          facebook: data.facebook,
        };
        console.log(JSON.stringify(out, null, 2));
        if (data.facebook) {
          if (data.facebook.skipped || data.facebook.failed > 0) {
            console.log('\nFacebook Story: did not post to your Page. Check:', data.facebook.errors?.join(' ') || data.facebook);
            if (data.facebook.errors?.some((e) => e.includes('localhost') || e.includes('public HTTPS'))) {
              console.log('Tip: Set NEXT_PUBLIC_APP_URL to your public app URL (e.g. Vercel or ngrok). Facebook cannot fetch images from localhost.');
            }
          } else if (data.facebook.success > 0) {
            console.log('\nFacebook Story: successfully posted', data.facebook.success, 'story/stories to your Page.');
          }
        }
        return;
      }
      const summary = {
        sync: data.sync?.count ?? data.sync,
        needingGeneration: data.needingGenerationCount,
        unpublished: data.unpublishedCount,
        assetsGenerated: data.assets?.count,
        publish: data.publish
          ? {
              published: data.publish.published,
              queued: data.publish.queued,
              mode: data.publish.mode,
              skipped: data.publish.skipped,
              message: data.publish.message,
            }
          : undefined,
      };
      console.log(JSON.stringify(summary, null, 2));
      if (data.publish?.skipped && data.publish?.message?.includes('No ready')) {
        console.log('\nTip: No ready card assets yet. Run sync (and import matches from feed queue) and generate assets in Admin, or ensure feed env (e.g. SPORTSDB_API_KEY, SPORTSDB_LEAGUE_IDS) is set so sync can pull matches.');
      }
      return;
    } catch (e) {
      if (e.cause?.code === 'ECONNREFUSED') continue;
      throw e;
    }
  }
  console.error('Could not reach dev server. Start it with: yarn dev');
  process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

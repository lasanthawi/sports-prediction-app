# Sports Prediction App

Sports prediction app with:

- manual match creation
- live community voting
- automatic database bootstrapping
- seeded admin and player accounts
- optional fixture/result syncing from a JSON feed
- Gemini-powered portrait artwork generation with fallback artwork
- final prediction and result card rendering layered over that artwork
- optional publishing through a webhook

## Setup

1. Install dependencies with `yarn install`.
2. Configure the environment variables from `.env.example`.
3. Run `yarn dev`.
4. Open `/login` or `/admin`.

## Seeded Accounts

These accounts are created automatically the first time the database schema is initialized by an auth or admin route.

### Admin

- Email: `admin@sports.com`
- Password: `admin123`

### Players

- `player1@sports.com` / `player123` - John Doe
- `player2@sports.com` / `player123` - Jane Smith
- `player3@sports.com` / `player123` - Mike Wilson

## Database

The app auto-creates these tables:

- `users`
- `sessions`
- `matches`
- `generated_assets`
- `automation_runs`

## Automation Flow

The automation pipeline supports both split jobs and a full end-to-end cron flow:

1. `POST /api/automation/sync` stages feed items
2. `POST /api/automation/assets` generates assets for existing matches
3. `POST /api/automation/publish` publishes ready card assets
4. `GET/POST /api/unpublished-queue` runs the full hourly pipeline: sync feed, reconcile queued/imported feed items into `matches`, generate missing assets, and publish ready cards

`vercel.json` includes matching cron jobs so the pipeline can run automatically after deployment.

If Facebook Story auto-publish is enabled, keep `PUBLISH_BATCH_SIZE` small so one cron run can finish reliably within serverless time limits.

## SportsDB Coverage

When `SPORTS_SYNC_PROVIDER=thesportsdb`, the app now defaults to a broader set of major
competitions across football, basketball, baseball, hockey, cricket, rugby, motorsport,
fighting, tennis, golf, and American football. You can still replace that scope completely
with `SPORTSDB_LEAGUE_IDS`.

## Premium Match Card Metadata

Manual match creation and feed sync both accept richer visual metadata:

- `team1Captain`
- `team2Captain`
- `team1Palette`
- `team2Palette`
- `team1FlagColors`
- `team2FlagColors`
- `creativeDirection`
- `rivalryTagline`
- `artStyle`

When present, the app can generate Gemini portrait hero artwork for both `prediction` and `result` variants, then compose the final booster-pack card with HTML/CSS/SVG overlays for button zones, labels, vote stats, and result framing.

If Gemini fails or no key is configured, the app falls back to the built-in artwork renderer so cards still display and publish.

## Feed Contract

`SPORTS_SYNC_FEED_URL` may return either a JSON array or an object with a `matches` array.

Core fields:

- `externalId`
- `team1`
- `team2`
- `sport`
- `matchTime`

Recommended fields:

- `league`
- `venue`
- `status`
- `winner`
- `resultSummary`
- the premium metadata listed above

Use `/api/feed/sample` as the reference payload. It now includes captain, palette, flag-color, style, and tagline data so you can test the premium card pipeline safely.

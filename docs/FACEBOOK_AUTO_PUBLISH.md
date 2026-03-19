# Facebook Story auto-publish setup

## When stories are published to Facebook

Facebook Story publish runs in these cases:

1. **Hourly cron (`/api/unpublished-queue`)**  
   Runs at the start of every hour. It syncs the feed, reconciles queued/imported feed items into app matches, generates assets for matches that need them, then runs **publish** for all ready card assets. Each published card is also sent to Facebook (if credentials are set).

2. **Publish cron (`/api/automation/publish`)**  
   Runs at :30 past the hour, every 6 hours. Publishes up to 20 ready card assets and posts each to Facebook.

3. **Manual publish (Admin or API)**  
   When you click **Publish** in Admin, or call `POST /api/automation/publish` (optionally with `{ "matchId": 59 }`), ready cards are published and each is posted to Facebook.

4. **Feed queue “Publish”**  
   When you publish a match from the feed queue, that match’s cards are published and posted to Facebook.

So whenever the app “publishes” a card (cron or manual), it also attempts to post that card as a Facebook Story.

## Required environment variables (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `FB_PAGE_ID` | Yes, for FB | Your Facebook Page ID. |
| `FB_PAGE_ACCESS_TOKEN` | Yes, for FB | Page access token (see [FACEBOOK_PAGE_TOKEN.md](./FACEBOOK_PAGE_TOKEN.md)). |
| `NEXT_PUBLIC_APP_URL` | Yes, for FB | Public app URL (e.g. `https://your-app.vercel.app`) so Facebook can fetch the image. No trailing slash. |
| `CRON_SECRET` | Yes, for crons | Secret for cron auth. Set in Vercel; Vercel sends `Authorization: Bearer <CRON_SECRET>`. |

## Cron schedule (vercel.json)

- `GET/POST /api/unpublished-queue` — every hour (`0 * * * *`) — sync + generate + publish (and FB).
- `POST /api/automation/publish` — every 6 hours at :30 — publish ready assets (and FB).

## Story image: always latest design

The PNG sent to Facebook is **rebuilt from the current template** when you request `?format=png` for a card asset. You do **not** need to regenerate assets to get the new design; the next publish (or test) will use the latest full-screen “Who’s gonna win?” / “Who won?” layout.

## Checklist

- [ ] `FB_PAGE_ID` and `FB_PAGE_ACCESS_TOKEN` set in Vercel (Production + Preview if you want).
- [ ] `NEXT_PUBLIC_APP_URL` set to your production URL (no trailing slash).
- [ ] `CRON_SECRET` set in Vercel so the crons are authorized.
- [ ] Redeploy after changing env vars.

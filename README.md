# Sports Prediction App

Sports prediction app with:

- manual match creation
- live community voting
- automatic database bootstrapping
- seeded admin and player accounts
- optional fixture/result syncing from a JSON feed
- automatic SVG image generation for previews and results
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

The automation pipeline is split into three jobs:

1. `POST /api/automation/sync`
2. `POST /api/automation/assets`
3. `POST /api/automation/publish`

`vercel.json` includes matching cron jobs so the pipeline can run automatically after deployment.

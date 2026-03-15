import { sql } from '@vercel/postgres'
import { createHash } from 'crypto'

let schemaReady = false

const seededUsers = [
  {
    email: 'admin@sports.com',
    name: 'Arena Admin',
    role: 'admin',
    password: 'admin123',
    points: 0,
    predictionsCount: 0,
    correctPredictions: 0,
  },
  {
    email: 'player1@sports.com',
    name: 'John Doe',
    role: 'player',
    password: 'player123',
    points: 250,
    predictionsCount: 34,
    correctPredictions: 18,
  },
  {
    email: 'player2@sports.com',
    name: 'Jane Smith',
    role: 'player',
    password: 'player123',
    points: 420,
    predictionsCount: 52,
    correctPredictions: 33,
  },
  {
    email: 'player3@sports.com',
    name: 'Mike Wilson',
    role: 'player',
    password: 'player123',
    points: 180,
    predictionsCount: 28,
    correctPredictions: 12,
  },
]

export async function ensureSchema() {
  if (schemaReady) {
    return
  }

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'player',
      password_hash TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      predictions_count INTEGER NOT NULL DEFAULT 0,
      correct_predictions INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT users_role_check CHECK (role IN ('admin', 'player'))
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS matches (
      id SERIAL PRIMARY KEY,
      external_id TEXT UNIQUE,
      source TEXT NOT NULL DEFAULT 'manual',
      sport TEXT NOT NULL,
      league TEXT,
      team1 TEXT NOT NULL,
      team2 TEXT NOT NULL,
      team1_logo TEXT,
      team2_logo TEXT,
      match_time TIMESTAMPTZ NOT NULL,
      venue TEXT,
      status TEXT NOT NULL DEFAULT 'upcoming',
      result_summary TEXT,
      winner SMALLINT,
      poll_team1_votes INTEGER NOT NULL DEFAULT 0,
      poll_team2_votes INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT matches_status_check CHECK (status IN ('upcoming', 'live', 'finished', 'cancelled')),
      CONSTRAINT matches_winner_check CHECK (winner IN (1, 2) OR winner IS NULL)
    )
  `

  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS team1_captain TEXT`
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS team2_captain TEXT`
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS team1_palette TEXT`
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS team2_palette TEXT`
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS team1_flag_colors TEXT`
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS team2_flag_colors TEXT`
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS creative_direction TEXT`
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS rivalry_tagline TEXT`
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS art_style TEXT`

  await sql`
    CREATE TABLE IF NOT EXISTS generated_assets (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      asset_type TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'svg',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      published_status TEXT NOT NULL DEFAULT 'draft',
      published_to TEXT,
      publication_caption TEXT,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (match_id, asset_type, format)
    )
  `

  await sql`ALTER TABLE generated_assets ADD COLUMN IF NOT EXISTS asset_variant TEXT NOT NULL DEFAULT 'prediction'`
  await sql`ALTER TABLE generated_assets ADD COLUMN IF NOT EXISTS mime_type TEXT NOT NULL DEFAULT 'image/svg+xml'`
  await sql`ALTER TABLE generated_assets ADD COLUMN IF NOT EXISTS content_encoding TEXT NOT NULL DEFAULT 'utf8'`
  await sql`ALTER TABLE generated_assets ADD COLUMN IF NOT EXISTS generation_status TEXT NOT NULL DEFAULT 'generated'`
  await sql`ALTER TABLE generated_assets ADD COLUMN IF NOT EXISTS source_model TEXT`
  await sql`ALTER TABLE generated_assets ADD COLUMN IF NOT EXISTS prompt_version TEXT`
  await sql`ALTER TABLE generated_assets ADD COLUMN IF NOT EXISTS image_url TEXT`
  await sql`ALTER TABLE generated_assets ADD COLUMN IF NOT EXISTS render_recipe_version TEXT`
  await sql`ALTER TABLE generated_assets ADD COLUMN IF NOT EXISTS debug_prompt TEXT`
  await sql`ALTER TABLE generated_assets ADD COLUMN IF NOT EXISTS source_asset_id INTEGER REFERENCES generated_assets(id) ON DELETE SET NULL`

  await sql`
    ALTER TABLE generated_assets
    DROP CONSTRAINT IF EXISTS generated_assets_match_id_asset_type_format_key;
  `

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS generated_assets_match_type_variant_format_idx
    ON generated_assets (match_id, asset_type, asset_variant, format);
  `

  await sql`
    CREATE TABLE IF NOT EXISTS automation_runs (
      id SERIAL PRIMARY KEY,
      job_name TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS feed_sync_items (
      id SERIAL PRIMARY KEY,
      external_id TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL DEFAULT 'custom',
      source TEXT NOT NULL DEFAULT 'feed',
      sport TEXT NOT NULL,
      league TEXT,
      team1 TEXT NOT NULL,
      team2 TEXT NOT NULL,
      team1_logo TEXT,
      team2_logo TEXT,
      team1_captain TEXT,
      team2_captain TEXT,
      team1_palette TEXT,
      team2_palette TEXT,
      team1_flag_colors TEXT,
      team2_flag_colors TEXT,
      creative_direction TEXT,
      rivalry_tagline TEXT,
      art_style TEXT,
      match_time TIMESTAMPTZ NOT NULL,
      venue TEXT,
      status TEXT NOT NULL DEFAULT 'upcoming',
      result_summary TEXT,
      winner SMALLINT,
      sync_status TEXT NOT NULL DEFAULT 'queued',
      imported_match_id INTEGER REFERENCES matches(id) ON DELETE SET NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT feed_sync_items_status_check CHECK (status IN ('upcoming', 'live', 'finished', 'cancelled')),
      CONSTRAINT feed_sync_items_sync_status_check CHECK (sync_status IN ('queued', 'imported', 'dismissed')),
      CONSTRAINT feed_sync_items_winner_check CHECK (winner IN (1, 2) OR winner IS NULL)
    )
  `

  await sql`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `

  await sql`DROP TRIGGER IF EXISTS set_users_updated_at ON users`
  await sql`
    CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `

  for (const user of seededUsers) {
    const passwordHash = createHash('sha256').update(user.password).digest('hex')

    await sql`
      INSERT INTO users (
        email,
        name,
        role,
        password_hash,
        points,
        predictions_count,
        correct_predictions
      )
      VALUES (
        ${user.email},
        ${user.name},
        ${user.role},
        ${passwordHash},
        ${user.points},
        ${user.predictionsCount},
        ${user.correctPredictions}
      )
      ON CONFLICT (email)
      DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        password_hash = EXCLUDED.password_hash,
        points = EXCLUDED.points,
        predictions_count = EXCLUDED.predictions_count,
        correct_predictions = EXCLUDED.correct_predictions
    `
  }

  await sql`DROP TRIGGER IF EXISTS set_matches_updated_at ON matches`
  await sql`
    CREATE TRIGGER set_matches_updated_at
    BEFORE UPDATE ON matches
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `

  await sql`DROP TRIGGER IF EXISTS set_generated_assets_updated_at ON generated_assets`
  await sql`
    CREATE TRIGGER set_generated_assets_updated_at
    BEFORE UPDATE ON generated_assets
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `

  await sql`DROP TRIGGER IF EXISTS set_feed_sync_items_updated_at ON feed_sync_items`
  await sql`
    CREATE TRIGGER set_feed_sync_items_updated_at
    BEFORE UPDATE ON feed_sync_items
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `

  schemaReady = true
}

import { sql } from '@vercel/postgres'

let schemaReady = false

export async function ensureSchema() {
  if (schemaReady) {
    return
  }

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
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `

  await sql`
    DROP TRIGGER IF EXISTS set_matches_updated_at ON matches;
  `

  await sql`
    CREATE TRIGGER set_matches_updated_at
    BEFORE UPDATE ON matches
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `

  await sql`
    DROP TRIGGER IF EXISTS set_generated_assets_updated_at ON generated_assets;
  `

  await sql`
    CREATE TRIGGER set_generated_assets_updated_at
    BEFORE UPDATE ON generated_assets
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `

  schemaReady = true
}

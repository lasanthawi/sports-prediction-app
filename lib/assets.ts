import { sql } from '@vercel/postgres'
import { ensureSchema } from './db'
import { AssetRecord } from './types'

export async function getAsset(id: number) {
  await ensureSchema()
  const { rows } = await sql<AssetRecord>`
    SELECT *
    FROM generated_assets
    WHERE id = ${id}
  `

  return rows[0] || null
}

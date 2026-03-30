import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sql } from '@vercel/postgres'
import { ensureSchema } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function getAdminUser() {
  await ensureSchema()
  const cookieStore = cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (!sessionToken) {
    return null
  }

  const { rows } = await sql`
    SELECT u.id, u.role
    FROM users u
    INNER JOIN sessions s ON s.user_id = u.id
    WHERE s.session_token = ${sessionToken}
      AND s.expires_at > NOW()
    LIMIT 1
  `

  if (rows.length === 0 || rows[0].role !== 'admin') {
    return null
  }

  return rows[0]
}

export async function GET() {
  try {
    const adminUser = await getAdminUser()

    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [{ rows: summaryRows }, { rows: userRows }] = await Promise.all([
      sql`
        SELECT
          COUNT(*)::int AS total_votes_cast,
          COUNT(DISTINCT user_id)::int AS unique_voters,
          MAX(created_at) AS latest_vote_at
        FROM user_votes
      `,
      sql`
        SELECT
          u.id,
          u.name,
          u.email,
          u.role,
          u.points,
          u.predictions_count,
          u.correct_predictions,
          u.created_at,
          COUNT(uv.match_id)::int AS vote_count,
          MAX(uv.created_at) AS last_vote_at
        FROM users u
        LEFT JOIN user_votes uv ON uv.user_id = u.id
        GROUP BY
          u.id,
          u.name,
          u.email,
          u.role,
          u.points,
          u.predictions_count,
          u.correct_predictions,
          u.created_at
        ORDER BY
          CASE WHEN u.role = 'admin' THEN 0 ELSE 1 END,
          vote_count DESC,
          u.points DESC,
          u.created_at DESC
      `,
    ])

    const summary = summaryRows[0] || {
      total_votes_cast: 0,
      unique_voters: 0,
      latest_vote_at: null,
    }

    const users = userRows.map((row) => ({
      ...row,
      accuracy:
        Number(row.predictions_count) > 0
          ? Math.round((Number(row.correct_predictions) / Number(row.predictions_count)) * 100)
          : null,
    }))

    return NextResponse.json({
      summary,
      users,
    })
  } catch (error) {
    console.error('Admin dashboard analytics error:', error)
    return NextResponse.json({ error: 'Failed to load admin analytics' }, { status: 500 })
  }
}

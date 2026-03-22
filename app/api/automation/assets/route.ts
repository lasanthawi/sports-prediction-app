import { NextResponse } from 'next/server'
import { generateAssetsForMatches } from '@/lib/automation'
import { listMatches } from '@/lib/matches'

async function handleAssets() {
  try {
    const matches = await listMatches()
    const assets = await generateAssetsForMatches(matches.filter((match) => match.status !== 'cancelled'))
    return NextResponse.json({ count: assets.length, assets })
  } catch (error: any) {
    console.error('Asset automation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  return handleAssets()
}

export async function POST() {
  return handleAssets()
}

import { NextResponse } from 'next/server'
import { generateAssetsForMatches, publishMatchAssets, regenerateAssetBundle } from '@/lib/automation'
import { AssetVariant, MatchUpdateInput } from '@/lib/types'
import { deleteMatch, getMatch, updateMatch } from '@/lib/matches'

interface RouteContext {
  params: {
    id: string
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const id = Number(params.id)
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: 'Invalid match id' }, { status: 400 })
    }

    const body = await request.json() as MatchUpdateInput
    const match = await updateMatch(id, body)

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    await generateAssetsForMatches([match])

    return NextResponse.json({ match })
  } catch (error: any) {
    console.error('Update match error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const id = Number(params.id)
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: 'Invalid match id' }, { status: 400 })
    }

    let mode: 'artwork' | 'card' | 'full' | 'publish' = 'full'
    let variant: AssetVariant | undefined

    try {
      const body = await request.json() as { mode?: 'artwork' | 'card' | 'full' | 'publish'; variant?: AssetVariant | 'all' }
      mode = body.mode || 'full'
      variant = body.variant && body.variant !== 'all' ? body.variant : undefined
    } catch {
      // Support empty-body POSTs from older admin flows.
    }

    const match = await getMatch(id)
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    if (mode === 'publish') {
      const published = await publishMatchAssets(id)
      return NextResponse.json({ success: true, mode, published })
    }

    if (variant) {
      const regenerated = await regenerateAssetBundle(id, variant)
      return NextResponse.json({ success: true, mode, variant, regenerated })
    }

    await generateAssetsForMatches([match])

    return NextResponse.json({ success: true, mode: mode || 'full', variant: 'all' })
  } catch (error: any) {
    console.error('Regenerate asset error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  try {
    const id = Number(params.id)
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: 'Invalid match id' }, { status: 400 })
    }

    const match = await deleteMatch(id)
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete match error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { generateAssetsForMatches } from '@/lib/automation'
import { updateMatch } from '@/lib/matches'

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

    const body = await request.json()
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

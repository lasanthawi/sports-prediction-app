import { NextResponse } from 'next/server'

export function requireCronAuth(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = request.headers.get('authorization')

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        hint: secret
          ? 'Use header: Authorization: Bearer <your CRON_SECRET>'
          : 'Add CRON_SECRET in Vercel -> Settings -> Environment Variables, then redeploy.',
      },
      { status: 401 }
    )
  }

  return null
}

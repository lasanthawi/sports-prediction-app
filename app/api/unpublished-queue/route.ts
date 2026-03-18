import { handleUnpublishedCron } from '@/lib/unpublished-cron-handler'

/** Hourly cron + manual: GET or POST with Authorization: Bearer CRON_SECRET */
export async function GET(request: Request) {
  return handleUnpublishedCron(request)
}

export async function POST(request: Request) {
  return handleUnpublishedCron(request)
}

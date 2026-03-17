import type { MatchStatus } from './types'

type PublishStateSource = {
  status: MatchStatus | string
  prediction_publish_status?: string | null
  result_publish_status?: string | null
  publish_status?: string | null
}

export function normalizePublishStatus(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase() || 'draft'
}

export function getActivePublishStatus(match: PublishStateSource) {
  const variantStatus = match.status === 'finished'
    ? match.result_publish_status
    : match.prediction_publish_status

  return normalizePublishStatus(variantStatus || match.publish_status)
}

export function isPublishedStatus(value: string | null | undefined) {
  return normalizePublishStatus(value) === 'published'
}

export function getPublishStatusLabel(value: string | null | undefined) {
  const status = normalizePublishStatus(value)

  if (status === 'published') {
    return 'Published'
  }
  if (status === 'ready') {
    return 'Ready to Publish'
  }
  if (status === 'failed') {
    return 'Publish Failed'
  }
  if (status === 'draft') {
    return 'Draft'
  }

  return status
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

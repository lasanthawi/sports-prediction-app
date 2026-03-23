const DEFAULT_DISPLAY_TIMEZONE = 'Asia/Colombo'
const DEFAULT_DISPLAY_LOCALE = 'en-US'

export function formatMatchDateTime(matchTime: string) {
  const date = new Date(matchTime)
  if (Number.isNaN(date.getTime())) {
    return 'Time TBD'
  }

  return new Intl.DateTimeFormat(DEFAULT_DISPLAY_LOCALE, {
    timeZone: DEFAULT_DISPLAY_TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function formatMatchDate(matchTime: string) {
  const date = new Date(matchTime)
  if (Number.isNaN(date.getTime())) {
    return 'Date TBD'
  }

  return new Intl.DateTimeFormat(DEFAULT_DISPLAY_LOCALE, {
    timeZone: DEFAULT_DISPLAY_TIMEZONE,
    month: 'short',
    day: 'numeric',
  }).format(date)
}

// Dates in the shop's own timezone. A shopkeeper's "today" is their local
// calendar day, not UTC's: at 01:30 in Kampala it is already tomorrow in UTC
// terms only if you get this wrong the other way round, so anything that picks
// a default date range goes through here.

export const DEFAULT_TIMEZONE = 'Africa/Kampala'

/** Today's date (YYYY-MM-DD) in the given timezone. */
export function todayIn(timezone: string = DEFAULT_TIMEZONE, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Adds (or subtracts) whole days to a YYYY-MM-DD date. Pure calendar arithmetic. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`
}

/** "Wed 10 Sep" for a YYYY-MM-DD date, without any timezone shifting. */
export function shortDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-UG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

/** "10 Sep 2026" for a YYYY-MM-DD date. */
export function longDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** "Mon" for a YYYY-MM-DD date. */
export function weekdayShort(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-UG', {
    weekday: 'short',
    timeZone: 'UTC',
  })
}

/** "20 Sep" for a YYYY-MM-DD date. */
export function dayMonth(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

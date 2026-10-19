const clinicTimeZone = 'Asia/Colombo'

export function getBookingDays(count, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: clinicTimeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, part.value]))
  const start = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`)
  const days = []
  for (let offset = 0; days.length < count; offset++) {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + offset)
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) days.push(date)
  }
  return days
}

export const bookingDateKey = date => date.toISOString().slice(0, 10)
export const bookingDateLabel = (date, options) => date.toLocaleDateString('en-US', { ...options, timeZone: 'UTC' })

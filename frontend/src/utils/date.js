export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatAppointmentDate(date) {
  if (!date) return 'N/A'

  const dateValue = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T00:00:00`)
    : new Date(date)

  if (Number.isNaN(dateValue.getTime())) return date

  return dateValue.toLocaleDateString()
}

export const appointmentStatuses = ['total', 'pending', 'confirmed', 'completed', 'cancelled', 'rescheduled']

export function hasRescheduleHistory(appointment) {
  return appointment.rescheduled === true || (Array.isArray(appointment.rescheduleHistory) && appointment.rescheduleHistory.length > 0)
}

export function summarizeAppointments(appointments) {
  const summary = Object.fromEntries(appointmentStatuses.map(status => [status, 0]))
  summary.total = appointments.length
  for (const appointment of appointments) {
    if (Object.hasOwn(summary, appointment.status) && appointment.status !== 'total' && appointment.status !== 'rescheduled') summary[appointment.status] += 1
    if (hasRescheduleHistory(appointment)) summary.rescheduled += 1
  }
  return summary
}

export function formatMoney(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
    : 'Fee unavailable'
}
